import { DOCUMENT_TYPES } from '../../data/documentTypes.js';
import { PREMIUM_RETOUCH_FEE } from '../utils/constants.js';

export const CHECKOUT_CURRENCY = 'GHS';
export const CURRENCY_MINOR_UNIT = 100;

const DOCUMENT_INDEX = new Map(DOCUMENT_TYPES.map((document) => [document.id, document]));

export function toMinorUnits(amount) {
  return Math.round(Number(amount || 0) * CURRENCY_MINOR_UNIT);
}

export function fromMinorUnits(amountMinor) {
  return Number(amountMinor || 0) / CURRENCY_MINOR_UNIT;
}

export function getDocumentPricing(documentId) {
  return DOCUMENT_INDEX.get(documentId) || null;
}

export function computeCheckoutTotals(cartItems = [], premiumRetouch = false) {
  const subtotal = cartItems.reduce((sum, item) => {
    const documentType = getDocumentPricing(item.documentId);
    return sum + (documentType?.price || 0);
  }, 0);

  const premiumFee = cartItems.length && premiumRetouch ? PREMIUM_RETOUCH_FEE : 0;
  const total = subtotal + premiumFee;

  return {
    subtotal,
    premiumFee,
    total,
    amountMinor: toMinorUnits(total),
    currency: CHECKOUT_CURRENCY,
  };
}

export function buildPaystackMetadata(cartItems = [], premiumRetouch = false) {
  const itemSummary = cartItems.map((item) => item.documentId);

  return {
    integration: 'passportsnap',
    premiumRetouch,
    itemCount: cartItems.length,
    documentIds: itemSummary,
    custom_fields: [
      {
        display_name: 'Order Type',
        variable_name: 'order_type',
        value: 'passport_photo',
      },
      {
        display_name: 'Documents',
        variable_name: 'document_ids',
        value: itemSummary.join(', '),
      },
      {
        display_name: 'Premium Retouch',
        variable_name: 'premium_retouch',
        value: premiumRetouch ? 'yes' : 'no',
      },
    ],
  };
}
