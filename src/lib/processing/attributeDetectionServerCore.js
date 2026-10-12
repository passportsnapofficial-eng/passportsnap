import process from 'node:process';

// The attribute service runs where a model can live (see
// services/attribute_detection). This proxy keeps its URL private and gives
// the browser one same-origin endpoint to call.
const DEFAULT_SERVICE_URL = 'http://127.0.0.1:8789/detect';
const DEFAULT_TIMEOUT_MS = 23000;
const MAX_DATA_URL_LENGTH = 6 * 1024 * 1024;
const DATA_URL_RE = /^data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+$/;

function createHttpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

// Resolution order: an explicit ATTRIBUTE_SERVICE_URL (external host), then
// the Python function that ships inside this same deployment
// (api/attribute_model.py) reached through the deployment's own origin, so a
// fresh Vercel project needs no configuration at all to get verdicts.
export function getAttributeServiceUrl(selfOrigin = '') {
  const explicit = String(process.env.ATTRIBUTE_SERVICE_URL || '').trim();
  if (explicit) {
    return explicit;
  }
  const origin = String(selfOrigin || '').trim().replace(/\/+$/, '');
  if (origin && process.env.VERCEL) {
    return `${origin}/api/attribute_model`;
  }
  return DEFAULT_SERVICE_URL;
}

export function isAttributeServiceConfigured(selfOrigin = '') {
  return Boolean(String(process.env.ATTRIBUTE_SERVICE_URL || '').trim()) || Boolean(selfOrigin && process.env.VERCEL);
}

function validateDataUrl(dataUrl) {
  const value = String(dataUrl || '').trim();
  if (!value) {
    throw createHttpError('An image data URL is required.', 400);
  }
  if (value.length > MAX_DATA_URL_LENGTH) {
    throw createHttpError('Image is too large for attribute detection.', 413);
  }
  if (!DATA_URL_RE.test(value)) {
    throw createHttpError('Only base64 image data URLs are accepted.', 400);
  }
  return value;
}

// Pings the model's health endpoint so a later verdict request finds a warm
// instance. Best effort: a failure here is reported, never thrown, because the
// verdict path already fails closed on its own.
export async function warmAttributeService({ selfOrigin = '', timeoutMs = 50000 } = {}) {
  if (!isAttributeServiceConfigured(selfOrigin)) {
    return { warm: false, message: 'Attribute detection service is not configured.' };
  }
  const healthUrl = getAttributeServiceUrl(selfOrigin).replace(/\/detect\/?$/, '/health');
  const token = String(process.env.ATTRIBUTE_SERVICE_TOKEN || '').trim();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();
  try {
    const response = await fetch(healthUrl, {
      method: 'GET',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => null);
    return { warm: Boolean(response.ok && payload?.ok), ms: Date.now() - started, model: payload?.model || '' };
  } catch (error) {
    return { warm: false, ms: Date.now() - started, message: error instanceof Error ? error.message : 'warm-up failed' };
  } finally {
    clearTimeout(timeoutId);
  }
}

// Resolves to the service's three-state verdicts. Any failure - no service
// configured, timeout, bad status - surfaces as statusCode 503 so the client
// can treat every attribute as "unsure" and fall back to asking the customer.
// The service being down must never read as "nothing detected".
export async function detectPhotoAttributes({ dataUrl, timeoutMs = DEFAULT_TIMEOUT_MS, selfOrigin = '' }) {
  const validated = validateDataUrl(dataUrl);

  if (!isAttributeServiceConfigured(selfOrigin)) {
    throw createHttpError('Attribute detection service is not configured.', 503);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // A private Hugging Face Space needs a bearer token on every request.
    const token = String(process.env.ATTRIBUTE_SERVICE_TOKEN || '').trim();
    const response = await fetch(getAttributeServiceUrl(selfOrigin), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ dataUrl: validated }),
      signal: controller.signal,
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload || typeof payload !== 'object' || !payload.attributes) {
      const detail = payload?.detail || payload?.message || `Attribute service returned ${response.status}.`;
      throw createHttpError(String(detail), response.status >= 500 || response.status === 0 ? 503 : response.status);
    }

    return {
      available: true,
      model: String(payload.model || ''),
      attributes: payload.attributes,
      present: Array.isArray(payload.present) ? payload.present : [],
      unsure: Array.isArray(payload.unsure) ? payload.unsure : [],
      absent: Array.isArray(payload.absent) ? payload.absent : [],
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw createHttpError('Attribute detection timed out.', 503);
    }
    if (error?.statusCode) {
      throw error;
    }
    throw createHttpError('Attribute detection service is unreachable.', 503);
  } finally {
    clearTimeout(timeoutId);
  }
}
