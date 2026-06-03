import { buildDocumentCatalog, normalizeSiteSettings } from '../settings/siteSettings.js';

export const CHECKOUT_CURRENCY = 'USD';
export const CURRENCY_MINOR_UNIT = 100;
export const PHOTO_PACKAGE_TYPES = {
  digital: 'digital',
  digitalPrints: 'digital_prints',
};
export const PRINT_COPY_OPTIONS = [2, 4, 6];
export const DEFAULT_PRINT_COPIES = 2;

const PRINT_COPY_FEE_FIELDS = {
  2: 'digitalPrint2CopyFee',
  4: 'digitalPrint4CopyFee',
  6: 'digitalPrint6CopyFee',
};

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
    const legacyPrintFee = Number(siteSettingsOrPricingConfig.digitalPrintFee || 0);
    return {
      currency: siteSettingsOrPricingConfig.currency || CHECKOUT_CURRENCY,
      premiumRetouchFee: Number(siteSettingsOrPricingConfig.premiumRetouchFee || 0),
      digitalPrintFee: legacyPrintFee,
      digitalPrint2CopyFee: Number(siteSettingsOrPricingConfig.digitalPrint2CopyFee ?? legacyPrintFee),
      digitalPrint4CopyFee: Number(siteSettingsOrPricingConfig.digitalPrint4CopyFee ?? legacyPrintFee),
      digitalPrint6CopyFee: Number(siteSettingsOrPricingConfig.digitalPrint6CopyFee ?? legacyPrintFee),
      complianceCheckFee: Number(siteSettingsOrPricingConfig.complianceCheckFee || 0),
      photoRetouchingFee: Number(siteSettingsOrPricingConfig.photoRetouchingFee || 0),
      documents: siteSettingsOrPricingConfig.documents,
    };
  }

  const normalizedSettings = normalizeSiteSettings(siteSettingsOrPricingConfig || {});
  return {
    currency: CHECKOUT_CURRENCY,
    premiumRetouchFee: normalizedSettings.premiumRetouchFee,
    digitalPrintFee: normalizedSettings.digitalPrintFee,
    digitalPrint2CopyFee: normalizedSettings.digitalPrint2CopyFee,
    digitalPrint4CopyFee: normalizedSettings.digitalPrint4CopyFee,
    digitalPrint6CopyFee: normalizedSettings.digitalPrint6CopyFee,
    complianceCheckFee: normalizedSettings.complianceCheckFee,
    photoRetouchingFee: normalizedSettings.photoRetouchingFee,
    documents: buildDocumentCatalog(normalizedSettings),
  };
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

export function normalizePrintCopies(value) {
  const numericValue = Number(value);
  return PRINT_COPY_OPTIONS.includes(numericValue) ? numericValue : DEFAULT_PRINT_COPIES;
}

export function getPrintCopyLabel(printCopies = DEFAULT_PRINT_COPIES) {
  const normalized = normalizePrintCopies(printCopies);
  return `${normalized} ${normalized === 1 ? 'copy' : 'copies'}`;
}

export function getPhotoPackageLabel(photoPackage, printCopies = DEFAULT_PRINT_COPIES) {
  return photoPackage === PHOTO_PACKAGE_TYPES.digitalPrints
    ? `Digital + printouts (${getPrintCopyLabel(printCopies)})`
    : 'Digital only';
}

function resolvePrintPackageFee(pricingConfig, printCopies = DEFAULT_PRINT_COPIES) {
  const normalizedCopies = normalizePrintCopies(printCopies);
  const feeKey = PRINT_COPY_FEE_FIELDS[normalizedCopies];
  return Number(pricingConfig[feeKey] ?? pricingConfig.digitalPrintFee ?? 0);
}

export function normalizeCheckoutOptions(options = {}, premiumRetouchRequired = false) {
  const photoPackage =
    String(options?.photoPackage || options?.photo_package || PHOTO_PACKAGE_TYPES.digital).trim() === PHOTO_PACKAGE_TYPES.digitalPrints
      ? PHOTO_PACKAGE_TYPES.digitalPrints
      : PHOTO_PACKAGE_TYPES.digital;

  return {
    photoPackage,
    printCopies: normalizePrintCopies(options?.printCopies ?? options?.print_copies),
    complianceCheck: parseBoolean(options?.complianceCheck ?? options?.compliance_check),
    photoRetouching: parseBoolean(options?.photoRetouching ?? options?.photo_retouching),
    premiumRetouch: premiumRetouchRequired || parseBoolean(options?.premiumRetouch ?? options?.premium_retouch),
  };
}

function normalizeLegacySelection(selection, premiumRetouchRequired = false) {
  if (typeof selection === 'boolean') {
    return normalizeCheckoutOptions({ premiumRetouch: selection }, premiumRetouchRequired);
  }

  return normalizeCheckoutOptions(selection, premiumRetouchRequired);
}

export function getDocumentPricing(documentId, siteSettingsOrPricingConfig = null) {
  const pricingConfig = resolvePricingConfig(siteSettingsOrPricingConfig);
  return pricingConfig.documents.find((document) => document.id === documentId) || null;
}

export function computeCheckoutTotals(cartItems = [], selection = false, siteSettingsOrPricingConfig = null, premiumRetouchRequired = false) {
  const pricingConfig = resolvePricingConfig(siteSettingsOrPricingConfig);
  const options = normalizeLegacySelection(selection, premiumRetouchRequired);
  const subtotal = cartItems.reduce((sum, item) => {
    const documentType = getDocumentPricing(item.documentId, pricingConfig);
    return sum + (documentType?.price || 0);
  }, 0);

  const printPackageFee = cartItems.length && options.photoPackage === PHOTO_PACKAGE_TYPES.digitalPrints
    ? resolvePrintPackageFee(pricingConfig, options.printCopies)
    : 0;
  const complianceCheckFee = cartItems.length && options.complianceCheck
    ? pricingConfig.complianceCheckFee
    : 0;
  const photoRetouchingFee = cartItems.length && options.photoRetouching
    ? pricingConfig.photoRetouchingFee
    : 0;
  const premiumFee = cartItems.length && options.premiumRetouch ? pricingConfig.premiumRetouchFee : 0;
  const total = subtotal + printPackageFee + complianceCheckFee + photoRetouchingFee + premiumFee;

  return {
    subtotal,
    photoPackage: options.photoPackage,
    printCopies: options.printCopies,
    printPackageFee,
    complianceCheck: options.complianceCheck,
    complianceCheckFee,
    photoRetouching: options.photoRetouching,
    photoRetouchingFee,
    premiumRetouch: options.premiumRetouch,
    premiumFee,
    total,
    amountMinor: toMinorUnits(total),
    currency: pricingConfig.currency || CHECKOUT_CURRENCY,
  };
}

export function buildPaymentMetadata(cartItems = [], selection = false, siteSettingsOrPricingConfig = null, premiumRetouchRequired = false) {
  const totals = computeCheckoutTotals(cartItems, selection, siteSettingsOrPricingConfig, premiumRetouchRequired);
  const itemSummary = cartItems.map((item) => item.documentId);
  const serializedDocumentIds = itemSummary.join(',');

  return {
    integration: 'passportsnap',
    currency: totals.currency,
    photoPackage: totals.photoPackage,
    photo_package: totals.photoPackage,
    printCopies: String(totals.printCopies),
    print_copies: String(totals.printCopies),
    complianceCheck: totals.complianceCheck ? 'true' : 'false',
    compliance_check: totals.complianceCheck ? 'true' : 'false',
    photoRetouching: totals.photoRetouching ? 'true' : 'false',
    photo_retouching: totals.photoRetouching ? 'true' : 'false',
    premiumRetouch: totals.premiumRetouch ? 'true' : 'false',
    premium_retouch: totals.premiumRetouch ? 'true' : 'false',
    itemCount: String(cartItems.length),
    item_count: String(cartItems.length),
    documentIds: serializedDocumentIds,
    document_ids: serializedDocumentIds,
    quotedSubtotalMinor: String(toMinorUnits(totals.subtotal)),
    quoted_subtotal_minor: String(toMinorUnits(totals.subtotal)),
    quotedPrintPackageFeeMinor: String(toMinorUnits(totals.printPackageFee)),
    quoted_print_package_fee_minor: String(toMinorUnits(totals.printPackageFee)),
    quotedComplianceCheckFeeMinor: String(toMinorUnits(totals.complianceCheckFee)),
    quoted_compliance_check_fee_minor: String(toMinorUnits(totals.complianceCheckFee)),
    quotedPhotoRetouchingFeeMinor: String(toMinorUnits(totals.photoRetouchingFee)),
    quoted_photo_retouching_fee_minor: String(toMinorUnits(totals.photoRetouchingFee)),
    quotedPremiumFeeMinor: String(toMinorUnits(totals.premiumFee)),
    quoted_premium_fee_minor: String(toMinorUnits(totals.premiumFee)),
    quotedTotalMinor: String(totals.amountMinor),
    quoted_total_minor: String(totals.amountMinor),
  };
}
