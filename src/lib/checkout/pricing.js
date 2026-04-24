import { buildDocumentCatalog, normalizeSiteSettings } from '../settings/siteSettings.js';

export const CHECKOUT_CURRENCY = 'USD';
export const CURRENCY_MINOR_UNIT = 100;

export function toMinorUnits(amount) {
  return Math.round(Number(amount || 0) * CURRENCY_MINOR_UNIT);
}

export function fromMinorUnits(amountMinor) {
  return Number(amountMinor || 0) / CURRENCY_MINOR_UNIT;
}

function resolvePricingConfig(siteSettingsOrPricingConfig = null) {
  if (
    siteSettingsOrPricingConfig &&
    Array.isArray(siteSettingsOrPricingConfig.documents) &&
    (!siteSettingsOrPricingConfig.documents.length || 'id' in siteSettingsOrPricingConfig.documents[0]) &&
    typeof siteSettingsOrPricingConfig.premiumRetouchFee === 'number'
  ) {
    return siteSettingsOrPricingConfig;
  }

  const normalizedSettings = normalizeSiteSettings(siteSettingsOrPricingConfig || {});
  return {
    currency: CHECKOUT_CURRENCY,
    premiumRetouchFee: normalizedSettings.premiumRetouchFee,
    documents: buildDocumentCatalog(normalizedSettings),
  };
}

export function getDocumentPricing(documentId, siteSettingsOrPricingConfig = null) {
  const pricingConfig = resolvePricingConfig(siteSettingsOrPricingConfig);
  return pricingConfig.documents.find((document) => document.id === documentId) || null;
}

export function computeCheckoutTotals(cartItems = [], premiumRetouch = false, siteSettingsOrPricingConfig = null) {
  const pricingConfig = resolvePricingConfig(siteSettingsOrPricingConfig);
  const subtotal = cartItems.reduce((sum, item) => {
    const documentType = getDocumentPricing(item.documentId, pricingConfig);
    return sum + (documentType?.price || 0);
  }, 0);

  const premiumFee = cartItems.length && premiumRetouch ? pricingConfig.premiumRetouchFee : 0;
  const total = subtotal + premiumFee;

  return {
    subtotal,
    premiumFee,
    total,
    amountMinor: toMinorUnits(total),
    currency: pricingConfig.currency || CHECKOUT_CURRENCY,
  };
}

export function buildPaymentMetadata(cartItems = [], premiumRetouch = false, siteSettingsOrPricingConfig = null) {
  const totals = computeCheckoutTotals(cartItems, premiumRetouch, siteSettingsOrPricingConfig);
  const itemSummary = cartItems.map((item) => item.documentId);
  const serializedDocumentIds = itemSummary.join(',');

  return {
    integration: 'passportsnap',
    currency: totals.currency,
    premiumRetouch: premiumRetouch ? 'true' : 'false',
    premium_retouch: premiumRetouch ? 'true' : 'false',
    itemCount: String(cartItems.length),
    item_count: String(cartItems.length),
    documentIds: serializedDocumentIds,
    document_ids: serializedDocumentIds,
    quotedSubtotalMinor: String(toMinorUnits(totals.subtotal)),
    quoted_subtotal_minor: String(toMinorUnits(totals.subtotal)),
    quotedPremiumFeeMinor: String(toMinorUnits(totals.premiumFee)),
    quoted_premium_fee_minor: String(toMinorUnits(totals.premiumFee)),
    quotedTotalMinor: String(totals.amountMinor),
    quoted_total_minor: String(totals.amountMinor),
  };
}
