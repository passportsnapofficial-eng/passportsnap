import process from 'node:process';

const RESEND_API_BASE = 'https://api.resend.com';
const EMAIL_TIMEOUT_MS = 15000;

function resolveRecipientEmail(payload = {}) {
  return String(
    payload.recipientEmail ||
      payload.deliveryEmail ||
      payload.receiptEmail ||
      payload.customerEmail ||
      '',
  )
    .trim()
    .toLowerCase();
}

function resolveSenderEmail() {
  return String(
    process.env.ORDER_DELIVERY_FROM_EMAIL ||
      process.env.RESEND_FROM_EMAIL ||
      '',
  ).trim();
}

function getResendApiKey() {
  return String(process.env.RESEND_API_KEY || '').trim();
}

function hasManualFulfillmentPending(item = {}) {
  return Boolean(item.manualFulfillmentRequired) && !String(item.fulfilledPhoto || '').trim();
}

function resolveDeliverableImage(item = {}) {
  const fulfilledPhoto = String(item.fulfilledPhoto || '').trim();
  if (fulfilledPhoto) {
    return fulfilledPhoto;
  }

  if (hasManualFulfillmentPending(item)) {
    return '';
  }

  return String(item.photo || '').trim();
}

function parseImageDataUrl(dataUrl) {
  const match = String(dataUrl || '').match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) {
    return null;
  }

  return {
    contentType: match[1],
    base64: match[2],
  };
}

function getAttachmentExtension(contentType = '') {
  if (contentType.includes('png')) return 'png';
  if (contentType.includes('webp')) return 'webp';
  return 'jpg';
}

function toAttachment(item, index) {
  const imageUrl = resolveDeliverableImage(item);
  const parsedImage = parseImageDataUrl(imageUrl);
  if (!parsedImage) {
    return null;
  }

  const documentLabel = String(item.documentName || item.countryLabel || item.documentId || 'passport-photo')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || `passport-photo-${index + 1}`;

  return {
    filename: `${documentLabel}-${index + 1}.${getAttachmentExtension(parsedImage.contentType)}`,
    content: parsedImage.base64,
  };
}

function buildEmailHtml({
  customerName,
  orderId,
  paymentReference,
  total,
  currency,
  items,
  fulfillmentNote,
}) {
  const safeCustomerName = customerName || 'Customer';
  const itemLines = items
    .map((item) => {
      const parts = [
        item.documentName,
        item.countryLabel,
        item.sizeLabel,
      ].filter(Boolean);
      return `<li>${parts.join(' - ')}</li>`;
    })
    .join('');

  const noteBlock = fulfillmentNote
    ? `<p style="margin:16px 0 0;color:#334155;"><strong>Admin note:</strong> ${fulfillmentNote}</p>`
    : '';

  return `
    <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:24px;color:#0f172a;">
      <h1 style="margin:0 0 12px;font-size:24px;">Your PassportSnap photo is ready</h1>
      <p style="margin:0 0 16px;line-height:1.6;">Hi ${safeCustomerName}, your finished photo has been attached to this email.</p>
      <div style="border:1px solid #e2e8f0;border-radius:16px;padding:16px;background:#f8fafc;">
        <p style="margin:0 0 8px;"><strong>Order:</strong> ${orderId || 'Not available'}</p>
        <p style="margin:0 0 8px;"><strong>Payment reference:</strong> ${paymentReference || orderId || 'Not available'}</p>
        <p style="margin:0;"><strong>Total paid:</strong> ${currency || 'USD'} ${Number(total || 0).toFixed(2)}</p>
      </div>
      <div style="margin-top:20px;">
        <p style="margin:0 0 10px;"><strong>Attached files:</strong></p>
        <ul style="margin:0;padding-left:20px;line-height:1.7;">${itemLines}</ul>
      </div>
      ${noteBlock}
      <p style="margin:20px 0 0;line-height:1.6;color:#475569;">If you ordered a dashboard-backed account, the same finished image is also available in your order history.</p>
    </div>
  `;
}

async function postResendEmail(payload) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), EMAIL_TIMEOUT_MS);

  try {
    const response = await fetch(`${RESEND_API_BASE}/emails`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${getResendApiKey()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const result = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(result?.message || result?.error?.message || 'Email delivery failed.');
    }

    return result;
  } finally {
    clearTimeout(timeoutId);
  }
}

export function canSendOrderDeliveryEmail() {
  return Boolean(getResendApiKey() && resolveSenderEmail());
}

export async function sendOrderDeliveryEmail(payload = {}) {
  const recipientEmail = resolveRecipientEmail(payload);
  const senderEmail = resolveSenderEmail();
  const orderItems = Array.isArray(payload.items) ? payload.items : [];
  const deliverableItems = orderItems.filter((item) => Boolean(resolveDeliverableImage(item)));
  const attachments = deliverableItems
    .map((item, index) => toAttachment(item, index))
    .filter(Boolean);

  if (!recipientEmail) {
    return { ok: false, skipped: true, reason: 'missing_recipient' };
  }

  if (!attachments.length) {
    return { ok: false, skipped: true, reason: 'missing_finished_images' };
  }

  if (!canSendOrderDeliveryEmail()) {
    return { ok: false, skipped: true, reason: 'email_not_configured' };
  }

  const result = await postResendEmail({
    from: senderEmail,
    to: [recipientEmail],
    subject: `Your PassportSnap photo is ready${payload.orderId ? ` - ${payload.orderId}` : ''}`,
    html: buildEmailHtml({
      customerName: payload.customerName,
      orderId: payload.orderId,
      paymentReference: payload.paymentReference,
      total: payload.total,
      currency: payload.currency,
      items: deliverableItems,
      fulfillmentNote: payload.fulfillmentNote,
    }),
    attachments,
  });

  return {
    ok: true,
    id: result?.id || '',
    recipientEmail,
    attachmentCount: attachments.length,
  };
}
