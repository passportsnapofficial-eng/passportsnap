import { loadImageElement } from '../processing/cropUtils.js';

// The archive keeps the customer's original upload so an admin can redo a
// retouch by hand. That original is the reviewed 1800x1800 PNG, which runs
// 2.4-5.9MB - past the serverless request body limit on its own. Store a
// bounded JPEG of it instead; it stays good enough to work from.
const MAX_ARCHIVE_SOURCE_EDGE = 1000;
const ARCHIVE_SOURCE_QUALITY = 0.82;

async function compressArchiveSource(dataUrl) {
  const value = String(dataUrl || '').trim();
  if (!value) {
    return '';
  }

  try {
    const image = await loadImageElement(value);
    const width = image.naturalWidth || image.width;
    const height = image.naturalHeight || image.height;

    if (!width || !height) {
      return '';
    }

    const scale = Math.min(1, MAX_ARCHIVE_SOURCE_EDGE / Math.max(width, height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));

    const context = canvas.getContext('2d');
    if (!context) {
      return '';
    }

    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    return canvas.toDataURL('image/jpeg', ARCHIVE_SOURCE_QUALITY);
  } catch {
    // A missing original must not cost us the whole order record.
    return '';
  }
}

// `photo` and `fulfilledPhoto` are left untouched: the admin re-sends those to
// the customer when a manual fulfillment completes, so they must stay at full
// delivery quality.
async function toArchiveItem(item = {}) {
  return {
    ...item,
    sourcePhoto: await compressArchiveSource(item.sourcePhoto),
  };
}

export async function buildAdminOrderRecord(order) {
  const items = Array.isArray(order?.items) ? order.items : [];

  return {
    ...order,
    items: await Promise.all(items.map(toArchiveItem)),
  };
}

async function parseJsonResponse(response) {
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload?.message || 'Unable to record this order for admin review.');
  }

  return payload;
}

export async function recordOrderForAdmin(order) {
  if (!order?.id && !order?.paymentReference) {
    return null;
  }

  const response = await fetch('/api/orders/record', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(await buildAdminOrderRecord(order)),
  });

  return parseJsonResponse(response);
}
