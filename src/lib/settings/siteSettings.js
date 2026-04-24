import { DOCUMENT_TYPES } from '../../data/documentTypes.js';

export const SITE_SETTINGS_CURRENCY = 'USD';
export const DEFAULT_PREMIUM_RETOUCH_FEE = 7.99;
export const DEFAULT_WATERMARK_TEXT = 'PASSPORTSNAP';

function roundCurrency(value, fallback = 0) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return Number(fallback.toFixed(2));
  }

  return Number(numericValue.toFixed(2));
}

function normalizeInteger(value, fallback = 0) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return fallback;
  }

  return Math.max(0, Math.round(numericValue));
}

function parseBoolean(value, fallback = false) {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value === 1;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return fallback;
    return normalized === 'true' || normalized === 'yes' || normalized === '1';
  }

  return fallback;
}

function normalizeTimestamp(value) {
  if (!value) return null;

  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) {
    return null;
  }

  return timestamp.toISOString();
}

export function getDefaultSiteSettings(baseDocuments = DOCUMENT_TYPES) {
  return {
    currency: SITE_SETTINGS_CURRENCY,
    premiumRetouchFee: DEFAULT_PREMIUM_RETOUCH_FEE,
    watermarkText: DEFAULT_WATERMARK_TEXT,
    watermarkEnabled: true,
    updatedAt: null,
    documents: baseDocuments.map((document, index) => ({
      documentId: document.id,
      price: roundCurrency(document.price, 0),
      isActive: document.status !== 'disabled',
      displayOrder: index,
      updatedAt: null,
    })),
  };
}

export function normalizeSiteSettings(rawSettings = {}, baseDocuments = DOCUMENT_TYPES) {
  const defaults = getDefaultSiteSettings(baseDocuments);
  const rawDocuments = Array.isArray(rawSettings.documents) ? rawSettings.documents : [];
  const rawById = new Map(
    rawDocuments
      .map((item) => ({
        ...item,
        documentId: String(item?.documentId || item?.document_id || '').trim(),
      }))
      .filter((item) => item.documentId)
      .map((item) => [item.documentId, item]),
  );

  const documents = baseDocuments.map((document, index) => {
    const fallback = defaults.documents.find((item) => item.documentId === document.id) || defaults.documents[index];
    const current = rawById.get(document.id) || {};

    return {
      documentId: document.id,
      price: roundCurrency(current.price, fallback.price),
      isActive: parseBoolean(current.isActive ?? current.is_active, fallback.isActive),
      displayOrder: normalizeInteger(current.displayOrder ?? current.display_order, fallback.displayOrder),
      updatedAt: normalizeTimestamp(current.updatedAt || current.updated_at),
    };
  });

  return {
    currency: SITE_SETTINGS_CURRENCY,
    premiumRetouchFee: roundCurrency(rawSettings.premiumRetouchFee ?? rawSettings.premium_retouch_fee, defaults.premiumRetouchFee),
    watermarkText: String(rawSettings.watermarkText ?? rawSettings.watermark_text ?? defaults.watermarkText).trim() || DEFAULT_WATERMARK_TEXT,
    watermarkEnabled: parseBoolean(rawSettings.watermarkEnabled ?? rawSettings.watermark_enabled, defaults.watermarkEnabled),
    updatedAt: normalizeTimestamp(rawSettings.updatedAt || rawSettings.updated_at),
    documents: documents.sort((left, right) => left.displayOrder - right.displayOrder || left.documentId.localeCompare(right.documentId)),
  };
}

export function buildDocumentCatalog(rawSettings = {}, baseDocuments = DOCUMENT_TYPES) {
  const normalizedSettings = normalizeSiteSettings(rawSettings, baseDocuments);
  const settingsById = new Map(normalizedSettings.documents.map((document) => [document.documentId, document]));

  return baseDocuments
    .map((document, index) => {
      const current = settingsById.get(document.id) || normalizedSettings.documents[index];

      return {
        ...document,
        price: current?.price ?? roundCurrency(document.price, 0),
        isActive: current?.isActive ?? true,
        displayOrder: current?.displayOrder ?? index,
        status: current?.isActive === false ? 'disabled' : document.status,
      };
    })
    .sort((left, right) => left.displayOrder - right.displayOrder || left.countryLabel.localeCompare(right.countryLabel));
}

export function buildActiveDocumentCatalog(rawSettings = {}, baseDocuments = DOCUMENT_TYPES) {
  return buildDocumentCatalog(rawSettings, baseDocuments).filter((document) => document.isActive !== false);
}

export function getSiteDocumentSetting(documentId, rawSettings = {}, baseDocuments = DOCUMENT_TYPES) {
  return buildDocumentCatalog(rawSettings, baseDocuments).find((document) => document.id === documentId) || null;
}
