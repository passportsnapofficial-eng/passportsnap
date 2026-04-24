import process from 'node:process';
import {
  buildPaymentMetadata,
  computeCheckoutTotals,
  fromMinorUnits,
  getDocumentPricing,
  toMinorUnits,
} from '../checkout/pricing.js';
import { getPublicSiteSettings } from '../admin/adminServerCore.js';

const STRIPE_API_BASE = 'https://api.stripe.com/v1';
const PAYMENT_PROVIDER_TIMEOUT_MS = 15000;

function getSecretKey() {
  const secretKey = process.env.STRIPE_SECRET_KEY || '';

  if (!secretKey) {
    throw new Error('Stripe secret key is missing. Add STRIPE_SECRET_KEY to the environment.');
  }

  return secretKey;
}

function getDefaultReturnUrl() {
  return process.env.STRIPE_RETURN_URL || 'http://127.0.0.1:5173/';
}

export function buildOrderReference() {
  const stamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `PS-${stamp}-${random}`;
}

export function normalizeCartItems(cartItems = [], siteSettings = null) {
  return cartItems.map((item) => {
    const documentId = String(item?.documentId || '').trim();
    if (!documentId || !getDocumentPricing(documentId, siteSettings)) {
      throw new Error('One or more cart items are invalid for checkout.');
    }

    return { documentId };
  });
}

function cleanReturnUrl(urlValue) {
  const parsed = new URL(urlValue);
  parsed.searchParams.delete('session_id');
  parsed.searchParams.delete('stripe');
  parsed.searchParams.delete('reference');
  parsed.searchParams.delete('trxref');
  return parsed;
}

export function resolveReturnUrl(requestedReturnUrl, originHeader = '') {
  if (requestedReturnUrl) {
    try {
      const parsed = cleanReturnUrl(requestedReturnUrl);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        return parsed.toString();
      }
    } catch {
      // Fall through to origin/default handling.
    }
  }

  if (originHeader) {
    try {
      const parsed = cleanReturnUrl(originHeader);
      parsed.pathname = '/';
      return parsed.toString();
    } catch {
      // Fall through to default handling.
    }
  }

  return cleanReturnUrl(getDefaultReturnUrl()).toString();
}

export function buildSuccessUrl(returnUrl) {
  const successUrl = cleanReturnUrl(returnUrl);
  successUrl.searchParams.set('stripe', 'success');
  successUrl.searchParams.set('session_id', '{CHECKOUT_SESSION_ID}');
  return successUrl.toString();
}

export function buildCancelUrl(returnUrl) {
  const cancelUrl = cleanReturnUrl(returnUrl);
  cancelUrl.searchParams.set('stripe', 'cancelled');
  return cancelUrl.toString();
}

function normalizeMetadataDocumentIds(documentIds) {
  if (Array.isArray(documentIds)) {
    return documentIds
      .map((documentId) => ({ documentId: String(documentId || '').trim() }))
      .filter((item) => item.documentId);
  }

  if (typeof documentIds === 'string' && documentIds.trim()) {
    return documentIds
      .split(',')
      .map((documentId) => documentId.trim())
      .filter(Boolean)
      .map((documentId) => ({ documentId }));
  }

  return [];
}

function parseBoolean(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === 'true' || normalized === 'yes' || normalized === '1';
  }

  return false;
}

function readMetadataMinor(metadata, ...keys) {
  for (const key of keys) {
    const rawValue = metadata?.[key];
    const numericValue = Number(rawValue);
    if (Number.isFinite(numericValue)) {
      return Math.round(numericValue);
    }
  }

  return null;
}

async function fetchStripeJson(path, options, timeoutMessage) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PAYMENT_PROVIDER_TIMEOUT_MS);

  try {
    const response = await fetch(`${STRIPE_API_BASE}${path}`, {
      ...options,
      signal: controller.signal,
    });

    const result = await response.json().catch(() => null);
    return { response, result };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(timeoutMessage);
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

function appendMetadata(params, metadata) {
  for (const [key, value] of Object.entries(metadata)) {
    if (value === undefined || value === null || value === '') continue;
    params.append(`metadata[${key}]`, String(value));
  }
}

function appendLineItem(params, index, { name, description, amountMinor, quantity = 1, currency = 'usd' }) {
  params.append(`line_items[${index}][quantity]`, String(quantity));
  params.append(`line_items[${index}][price_data][currency]`, currency);
  params.append(`line_items[${index}][price_data][unit_amount]`, String(amountMinor));
  params.append(`line_items[${index}][price_data][product_data][name]`, name);
  if (description) {
    params.append(`line_items[${index}][price_data][product_data][description]`, description);
  }
}

function buildCustomerName(firstName, lastName) {
  return [firstName, lastName].filter(Boolean).join(' ').trim();
}

export async function initializeTransaction(payload, options = {}) {
  const secretKey = getSecretKey();
  const siteSettings = await getPublicSiteSettings();
  const email = String(payload.email || '').trim();
  const firstName = String(payload.firstName || '').trim();
  const lastName = String(payload.lastName || '').trim();
  const phone = String(payload.phone || '').trim();
  const cartItems = normalizeCartItems(payload.cartItems, siteSettings);
  const premiumRetouch = Boolean(payload.premiumRetouch);

  if (!email) {
    throw new Error('Email is required before payment.');
  }

  if (!cartItems.length) {
    throw new Error('A valid cart is required before payment.');
  }

  const totals = computeCheckoutTotals(cartItems, premiumRetouch, siteSettings);
  if (!totals.amountMinor) {
    throw new Error('The final order total is invalid.');
  }

  const currencyCode = totals.currency.toLowerCase();
  const returnUrl = resolveReturnUrl(payload.returnUrl, options.originHeader);
  const orderReference = buildOrderReference();
  const customerName = buildCustomerName(firstName, lastName);
  const metadata = {
    ...buildPaymentMetadata(cartItems, premiumRetouch, siteSettings),
    orderReference,
    order_reference: orderReference,
    email,
    firstName,
    first_name: firstName,
    lastName,
    last_name: lastName,
    customerName,
    customer_name: customerName,
    phone,
  };

  const params = new URLSearchParams();
  params.append('mode', 'payment');
  params.append('success_url', buildSuccessUrl(returnUrl));
  params.append('cancel_url', buildCancelUrl(returnUrl));
  params.append('client_reference_id', orderReference);
  params.append('customer_email', email);
  params.append('billing_address_collection', 'auto');
  params.append('phone_number_collection[enabled]', 'true');
  appendMetadata(params, metadata);

  let lineItemIndex = 0;
  for (const item of cartItems) {
    const document = getDocumentPricing(item.documentId, siteSettings);
    appendLineItem(params, lineItemIndex, {
      name: document?.name || 'Passport photo',
      description: document?.sizeLabel || item.documentId,
      amountMinor: toMinorUnits(document?.price || 0),
      currency: currencyCode,
    });
    lineItemIndex += 1;
  }

  if (premiumRetouch) {
    appendLineItem(params, lineItemIndex, {
      name: 'Premium retouch',
      description: 'Manual review and cleanup before final delivery',
      amountMinor: toMinorUnits(totals.premiumFee),
      currency: currencyCode,
    });
  }

  const { response, result } = await fetchStripeJson(
    '/checkout/sessions',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    },
    'Checkout took too long to start. Please try again.',
  );

  if (!response.ok || !result?.id || !result?.url) {
    throw new Error(result?.error?.message || 'Stripe could not initialize this checkout.');
  }

  return {
    checkoutUrl: result.url,
    sessionId: result.id,
    orderReference,
    subtotal: totals.subtotal,
    premiumFee: totals.premiumFee,
    total: totals.total,
    amount: totals.total,
    amountMinor: totals.amountMinor,
    currency: totals.currency,
  };
}

export async function verifyTransaction(sessionId) {
  const secretKey = getSecretKey();

  if (!sessionId) {
    throw new Error('A Stripe session ID is required.');
  }

  const { response, result } = await fetchStripeJson(
    `/checkout/sessions/${encodeURIComponent(sessionId)}`,
    {
      headers: {
        Authorization: `Bearer ${secretKey}`,
      },
    },
    'Payment verification is taking too long. Please check again.',
  );

  if (!response.ok || !result?.id) {
    throw new Error(result?.error?.message || 'Unable to confirm this payment right now.');
  }

  const metadata = result.metadata || {};
  const cartItems = normalizeMetadataDocumentIds(metadata.documentIds || metadata.document_ids);

  if (!cartItems.length) {
    throw new Error('Payment cart data is missing from this session.');
  }

  const premiumRetouch = parseBoolean(metadata.premiumRetouch || metadata.premium_retouch);
  const quotedSubtotalMinor = readMetadataMinor(metadata, 'quotedSubtotalMinor', 'quoted_subtotal_minor');
  const quotedPremiumFeeMinor = readMetadataMinor(metadata, 'quotedPremiumFeeMinor', 'quoted_premium_fee_minor') || 0;
  const quotedTotalMinor = readMetadataMinor(metadata, 'quotedTotalMinor', 'quoted_total_minor');
  let expectedTotals;

  if (quotedTotalMinor !== null) {
    expectedTotals = {
      subtotal: fromMinorUnits(quotedSubtotalMinor ?? Math.max(0, quotedTotalMinor - quotedPremiumFeeMinor)),
      premiumFee: fromMinorUnits(quotedPremiumFeeMinor),
      total: fromMinorUnits(quotedTotalMinor),
      amountMinor: quotedTotalMinor,
      currency: String(metadata.currency || result.currency || 'USD').toUpperCase(),
    };
  } else {
    const siteSettings = await getPublicSiteSettings();
    const validatedCartItems = normalizeCartItems(cartItems, siteSettings);
    expectedTotals = computeCheckoutTotals(validatedCartItems, premiumRetouch, siteSettings);
  }

  const paidAmount = Number(result.amount_total || 0);
  const paidCurrency = String(result.currency || expectedTotals.currency).toUpperCase();

  if (result.payment_status !== 'paid') {
    throw new Error('Payment is not confirmed yet. Please check again.');
  }

  if (paidAmount !== expectedTotals.amountMinor) {
    throw new Error('Payment amount verification failed.');
  }

  if (paidCurrency !== expectedTotals.currency) {
    throw new Error('Payment currency verification failed.');
  }

  const customerName =
    String(result.customer_details?.name || metadata.customerName || metadata.customer_name || '').trim() ||
    buildCustomerName(metadata.firstName || metadata.first_name, metadata.lastName || metadata.last_name) ||
    String(result.customer_email || metadata.email || '').trim() ||
    'Customer';

  return {
    orderReference: String(
      result.client_reference_id || metadata.orderReference || metadata.order_reference || result.id,
    ),
    paymentReference: String(result.id),
    amountMinor: paidAmount,
    amount: fromMinorUnits(paidAmount),
    subtotal: expectedTotals.subtotal,
    premiumFee: expectedTotals.premiumFee,
    total: expectedTotals.total,
    currency: paidCurrency,
    paidAt: new Date(Number(result.created || Date.now() / 1000) * 1000).toISOString(),
    status: 'success',
    channel:
      Array.isArray(result.payment_method_types) && result.payment_method_types.length
        ? result.payment_method_types.join(', ')
        : 'card',
    gatewayResponse: 'Paid via Stripe Checkout',
    metadata,
    customer: {
      email: String(result.customer_details?.email || result.customer_email || metadata.email || '').trim(),
      phone: String(result.customer_details?.phone || metadata.phone || '').trim(),
      name: customerName,
    },
  };
}
