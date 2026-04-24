import { COUNTRY_FORMATS } from './countryFormats.js';

export const DEFAULT_DOCUMENT_ID = 'us-passport';

export const DOCUMENT_TYPES = COUNTRY_FORMATS.map((format) => ({
  id: format.id,
  name: format.name,
  shortName: format.shortName,
  status: format.status,
  badge: format.badge,
  price: format.price,
  typeLabel: format.typeLabel,
  presetId: format.preset.id,
  countryLabel: format.countryLabel,
  flagPath: format.flagPath,
  authority: format.authority,
  sourceUrl: format.sourceUrl,
  sourceLabel: format.sourceLabel,
  description: format.description,
  highlight: format.highlight,
  deliveryLabel: format.deliveryLabel,
  trustLabel: format.trustLabel,
  requirementSummary: format.requirementSummary,
  captureHint: format.captureHint,
  requirements: format.rules,
  validationPolicy: format.validationPolicy,
  officialSizeLabel: format.preset.officialSize,
  backgroundLabel: format.preset.background,
}));

export function getDocumentById(documentId) {
  return DOCUMENT_TYPES.find((documentType) => documentType.id === documentId) || DOCUMENT_TYPES[0];
}

export const ACTIVE_DOCUMENT = getDocumentById(DEFAULT_DOCUMENT_ID);
