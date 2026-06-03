import process from 'node:process';
import {
  buildPaymentMetadata,
  computeCheckoutTotals,
  DEFAULT_PRINT_COPIES,
  fromMinorUnits,
  getDocumentPricing,
  getPrintCopyLabel,
  normalizeCheckoutOptions,
  PHOTO_PACKAGE_TYPES,
  toMinorUnits,
} from '../checkout/pricing.js';
import { US_DELIVERY_COUNTRY, resolveUsCountryName } from '../../data/usLocations.js';
import { getPublicSiteSettings } from '../admin/adminServerCore.js';

const STRIPE_API_BASE = 'https://api.stripe.com/v1';
const PAYMENT_PROVIDER_TIMEOUT_MS = 30000;
const MAX_CART_ITEMS = 25;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SHIPPING_ADDRESS_KEYS = ['addressLine1', 'addressLine2', 'city', 'stateProvince', 'postalCode', 'country'];

function createHttpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

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
  if (!Array.isArray(cartItems) || cartItems.length === 0) {
    throw createHttpError('A valid cart is required before payment.', 400);
  }

  if (cartItems.length > MAX_CART_ITEMS) {
    throw createHttpError(`Cart cannot exceed ${MAX_CART_ITEMS} items.`, 400);
  }

  return cartItems.map((item) => {
    const documentId = String(item?.documentId || '').trim();
    if (!documentId || !getDocumentPricing(documentId, siteSettings)) {
      throw createHttpError('One or more cart items are invalid for checkout.', 400);
    }

    return {
      documentId,
      requiresPremiumRetouch: Boolean(item?.requiresPremiumRetouch),
    };
  });
}

function groupCartItemsForCheckout(cartItems = []) {
  const grouped = new Map();

  for (const item of cartItems) {
    const documentId = String(item?.documentId || '').trim();
    if (!documentId) {
      continue;
    }

    const current = grouped.get(documentId);
    if (current) {
      current.quantity += 1;
      continue;
    }

    grouped.set(documentId, {
      documentId,
      quantity: 1,
    });
  }

  return Array.from(grouped.values());
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
  return successUrl
    .toString()
    .replace('%7BCHECKOUT_SESSION_ID%7D', '{CHECKOUT_SESSION_ID}');
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

function serializeStripeParams(params) {
  return params
    .toString()
    .replace(/%7BCHECKOUT_SESSION_ID%7D/g, '{CHECKOUT_SESSION_ID}');
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

function normalizeShippingAddress(address = {}) {
  const normalizedCountry =
    resolveUsCountryName(address.country || '') ||
    String(address.country || '').trim();

  return {
    addressLine1: String(address.addressLine1 || '').trim(),
    addressLine2: String(address.addressLine2 || '').trim(),
    city: String(address.city || '').trim(),
    stateProvince: String(address.stateProvince || '').trim(),
    postalCode: String(address.postalCode || '').trim(),
    country: normalizedCountry,
  };
}

function formatShippingAddress(address = {}) {
  return [
    address.addressLine1,
    address.addressLine2,
    address.city,
    address.stateProvince,
    address.postalCode,
    address.country,
  ].filter(Boolean).join(', ');
}

function hasRequiredShippingAddress(address = {}) {
  return Boolean(
    address.addressLine1 &&
    address.city &&
    address.stateProvince &&
    address.postalCode &&
    address.country
  );
}

export async function initializeTransaction(payload, options = {}) {
  const secretKey = getSecretKey();
  const siteSettings = await getPublicSiteSettings();
  const email = String(payload.email || '').trim();
  const deliveryEmail = String(payload.deliveryEmail || '').trim();
  const firstName = String(payload.firstName || '').trim();
  const lastName = String(payload.lastName || '').trim();
  const phone = String(payload.phone || '').trim();
  const shippingAddress = normalizeShippingAddress(payload.shippingAddress || {});
  const cartItems = normalizeCartItems(payload.cartItems, siteSettings);
  const premiumRetouchRequired = cartItems.some((item) => Boolean(item.requiresPremiumRetouch));
  const checkoutOptions = normalizeCheckoutOptions(payload.checkoutOptions || {
    photoPackage: payload.photoPackage,
    printCopies: payload.printCopies,
    complianceCheck: payload.complianceCheck,
    photoRetouching: payload.photoRetouching,
    premiumRetouch: payload.premiumRetouch,
  }, premiumRetouchRequired);

  if (!email) {
    throw createHttpError('Email is required before payment.', 400);
  }

  if (!EMAIL_RE.test(email)) {
    throw createHttpError('A valid email address is required before payment.', 400);
  }

  if (!cartItems.length) {
    throw createHttpError('A valid cart is required before payment.', 400);
  }

  if (
    (checkoutOptions.complianceCheck || checkoutOptions.photoRetouching || checkoutOptions.premiumRetouch) &&
    !deliveryEmail
  ) {
    throw createHttpError('A delivery email is required for orders with manual services.', 400);
  }

  if (deliveryEmail && !EMAIL_RE.test(deliveryEmail)) {
    throw createHttpError('A valid delivery email is required before payment.', 400);
  }

  if (
    checkoutOptions.photoPackage === PHOTO_PACKAGE_TYPES.digitalPrints &&
    !hasRequiredShippingAddress(shippingAddress)
  ) {
    throw createHttpError('A complete delivery address is required for print orders.', 400);
  }

  if (
    checkoutOptions.photoPackage === PHOTO_PACKAGE_TYPES.digitalPrints &&
    shippingAddress.country !== US_DELIVERY_COUNTRY
  ) {
    throw createHttpError('Print delivery is available in the United States only right now.', 400);
  }

  const totals = computeCheckoutTotals(cartItems, checkoutOptions, siteSettings, premiumRetouchRequired);
  if (!totals.amountMinor) {
    throw createHttpError('The final order total is invalid.', 400);
  }

  const currencyCode = totals.currency.toLowerCase();
  const returnUrl = resolveReturnUrl(payload.returnUrl, options.originHeader);
  const orderReference = buildOrderReference();
  const customerName = buildCustomerName(firstName, lastName);
  const metadata = {
    ...buildPaymentMetadata(cartItems, checkoutOptions, siteSettings, premiumRetouchRequired),
    orderReference,
    order_reference: orderReference,
    email,
    deliveryEmail,
    delivery_email: deliveryEmail,
    firstName,
    first_name: firstName,
    lastName,
    last_name: lastName,
    customerName,
    customer_name: customerName,
    phone,
    shippingAddress: formatShippingAddress(shippingAddress),
    shipping_address: formatShippingAddress(shippingAddress),
  };
  for (const key of SHIPPING_ADDRESS_KEYS) {
    if (shippingAddress[key]) {
      metadata[key] = shippingAddress[key];
    }
  }

  const params = new URLSearchParams();
  params.append('mode', 'payment');
  params.append('success_url', buildSuccessUrl(returnUrl));
  params.append('cancel_url', buildCancelUrl(returnUrl));
  params.append('client_reference_id', orderReference);
  params.append('customer_email', email);
  params.append('billing_address_collection', 'auto');
  appendMetadata(params, metadata);

  let lineItemIndex = 0;
  const groupedCartItems = groupCartItemsForCheckout(cartItems);
  for (const item of groupedCartItems) {
    const document = getDocumentPricing(item.documentId, siteSettings);
    appendLineItem(params, lineItemIndex, {
      name: document?.name || 'Passport photo',
      description: document?.sizeLabel || item.documentId,
      amountMinor: toMinorUnits(document?.price || 0),
      quantity: item.quantity,
      currency: currencyCode,
    });
    lineItemIndex += 1;
  }

  if (checkoutOptions.photoPackage === PHOTO_PACKAGE_TYPES.digitalPrints) {
    appendLineItem(params, lineItemIndex, {
      name: 'Digital photo + printouts',
      description: `${getPrintCopyLabel(totals.printCopies)} with free delivery and digital copy included`,
      amountMinor: toMinorUnits(totals.printPackageFee),
      currency: currencyCode,
    });
    lineItemIndex += 1;
  }

  if (checkoutOptions.complianceCheck) {
    appendLineItem(params, lineItemIndex, {
      name: 'Expert compliance check',
      description: 'Official-requirements review with acceptance guarantee',
      amountMinor: toMinorUnits(totals.complianceCheckFee),
      currency: currencyCode,
    });
    lineItemIndex += 1;
  }

  if (checkoutOptions.photoRetouching) {
    appendLineItem(params, lineItemIndex, {
      name: 'Photo retouching',
      description: 'Skin cleanup, stray hair fixes, and small dust removal',
      amountMinor: toMinorUnits(totals.photoRetouchingFee),
      currency: currencyCode,
    });
    lineItemIndex += 1;
  }

  if (checkoutOptions.premiumRetouch) {
    appendLineItem(params, lineItemIndex, {
      name: 'Premium retouch',
      description: `Manual review and cleanup for ${cartItems.length} photo${cartItems.length === 1 ? '' : 's'}`,
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
      body: serializeStripeParams(params),
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
    photoPackage: totals.photoPackage,
    printCopies: totals.printCopies,
    printPackageFee: totals.printPackageFee,
    complianceCheckFee: totals.complianceCheckFee,
    photoRetouchingFee: totals.photoRetouchingFee,
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
    throw createHttpError('A Stripe session ID is required.', 400);
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
    throw createHttpError('Payment cart data is missing from this session.', 400);
  }

  const checkoutOptions = normalizeCheckoutOptions({
    photoPackage: metadata.photoPackage || metadata.photo_package,
    printCopies: metadata.printCopies || metadata.print_copies,
    complianceCheck: metadata.complianceCheck || metadata.compliance_check,
    photoRetouching: metadata.photoRetouching || metadata.photo_retouching,
    premiumRetouch: metadata.premiumRetouch || metadata.premium_retouch,
  });
  const quotedSubtotalMinor = readMetadataMinor(metadata, 'quotedSubtotalMinor', 'quoted_subtotal_minor');
  const quotedPrintPackageFeeMinor = readMetadataMinor(metadata, 'quotedPrintPackageFeeMinor', 'quoted_print_package_fee_minor') || 0;
  const quotedComplianceCheckFeeMinor = readMetadataMinor(metadata, 'quotedComplianceCheckFeeMinor', 'quoted_compliance_check_fee_minor') || 0;
  const quotedPhotoRetouchingFeeMinor = readMetadataMinor(metadata, 'quotedPhotoRetouchingFeeMinor', 'quoted_photo_retouching_fee_minor') || 0;
  const quotedPremiumFeeMinor = readMetadataMinor(metadata, 'quotedPremiumFeeMinor', 'quoted_premium_fee_minor') || 0;
  const quotedTotalMinor = readMetadataMinor(metadata, 'quotedTotalMinor', 'quoted_total_minor');
  let expectedTotals;

  if (quotedTotalMinor !== null) {
    expectedTotals = {
      subtotal: fromMinorUnits(quotedSubtotalMinor ?? Math.max(0, quotedTotalMinor - quotedPrintPackageFeeMinor - quotedComplianceCheckFeeMinor - quotedPhotoRetouchingFeeMinor - quotedPremiumFeeMinor)),
      photoPackage: checkoutOptions.photoPackage,
      printCopies: checkoutOptions.printCopies || DEFAULT_PRINT_COPIES,
      printPackageFee: fromMinorUnits(quotedPrintPackageFeeMinor),
      complianceCheck: checkoutOptions.complianceCheck,
      complianceCheckFee: fromMinorUnits(quotedComplianceCheckFeeMinor),
      photoRetouching: checkoutOptions.photoRetouching,
      photoRetouchingFee: fromMinorUnits(quotedPhotoRetouchingFeeMinor),
      premiumRetouch: checkoutOptions.premiumRetouch,
      premiumFee: fromMinorUnits(quotedPremiumFeeMinor),
      total: fromMinorUnits(quotedTotalMinor),
      amountMinor: quotedTotalMinor,
      currency: String(metadata.currency || result.currency || 'USD').toUpperCase(),
    };
  } else {
    const siteSettings = await getPublicSiteSettings();
    const validatedCartItems = normalizeCartItems(cartItems, siteSettings);
    expectedTotals = computeCheckoutTotals(validatedCartItems, checkoutOptions, siteSettings);
  }

  const paidAmount = Number(result.amount_total || 0);
  const paidCurrency = String(result.currency || expectedTotals.currency).toUpperCase();

  if (result.payment_status !== 'paid') {
    throw createHttpError('Payment is not confirmed yet. Please check again.', 409);
  }

  if (paidAmount !== expectedTotals.amountMinor) {
    throw createHttpError('Payment amount verification failed.', 400);
  }

  if (paidCurrency !== expectedTotals.currency) {
    throw createHttpError('Payment currency verification failed.', 400);
  }

  const customerName =
    String(result.customer_details?.name || metadata.customerName || metadata.customer_name || '').trim() ||
    buildCustomerName(metadata.firstName || metadata.first_name, metadata.lastName || metadata.last_name) ||
    String(result.customer_email || metadata.email || '').trim() ||
    'Customer';
  const firstName = String(metadata.firstName || metadata.first_name || '').trim();
  const lastName = String(metadata.lastName || metadata.last_name || '').trim();

  return {
    sessionId: String(result.id),
    orderReference: String(
      result.client_reference_id || metadata.orderReference || metadata.order_reference || result.id,
    ),
    paymentReference: String(result.id),
    amountMinor: paidAmount,
    amount: fromMinorUnits(paidAmount),
    subtotal: expectedTotals.subtotal,
    photoPackage: expectedTotals.photoPackage,
    printCopies: expectedTotals.printCopies,
    printPackageFee: expectedTotals.printPackageFee,
    complianceCheck: expectedTotals.complianceCheck,
    complianceCheckFee: expectedTotals.complianceCheckFee,
    photoRetouching: expectedTotals.photoRetouching,
    photoRetouchingFee: expectedTotals.photoRetouchingFee,
    premiumRetouch: expectedTotals.premiumRetouch,
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
      deliveryEmail: String(metadata.deliveryEmail || metadata.delivery_email || '').trim(),
      phone: String(result.customer_details?.phone || metadata.phone || '').trim(),
      name: customerName,
      firstName,
      lastName,
    },
    deliveryEmail: String(metadata.deliveryEmail || metadata.delivery_email || '').trim(),
    shippingAddress: {
      addressLine1: String(metadata.addressLine1 || '').trim(),
      addressLine2: String(metadata.addressLine2 || '').trim(),
      city: String(metadata.city || '').trim(),
      stateProvince: String(metadata.stateProvince || '').trim(),
      postalCode: String(metadata.postalCode || '').trim(),
      country: String(metadata.country || '').trim(),
    },
  };
}
