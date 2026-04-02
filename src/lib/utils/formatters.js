import { CHECKOUT_CURRENCY } from '../checkout/pricing.js';

export function formatCurrency(value) {
  return new Intl.NumberFormat('en-GH', {
    style: 'currency',
    currency: CHECKOUT_CURRENCY,
  }).format(value);
}

export function formatDate(isoDate) {
  if (!isoDate) return '';

  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return isoDate;

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

export function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .trim();
}

export function formatDownloadFilename(item, orderId = '') {
  const docSlug = slugify(item?.documentName || item?.name || 'passport-photo');
  const sizeSlug = slugify(item?.sizeLabel || '2x2');
  const suffix = orderId ? `-${slugify(orderId)}` : '';
  return `${docSlug}-${sizeSlug}${suffix}.jpg`;
}
