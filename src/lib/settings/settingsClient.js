import { normalizeSiteSettings } from './siteSettings.js';

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload?.message || 'Unable to load site settings.');
  }

  return payload;
}

export async function fetchPublicSiteSettings() {
  const payload = await requestJson('/api/settings');
  return normalizeSiteSettings(payload);
}
