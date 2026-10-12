import process from 'node:process';

// The attribute service runs where a model can live (see
// services/attribute_detection). This proxy keeps its URL private and gives
// the browser one same-origin endpoint to call.
const DEFAULT_SERVICE_URL = 'http://127.0.0.1:8789/detect';
const DEFAULT_TIMEOUT_MS = 20000;
const MAX_DATA_URL_LENGTH = 6 * 1024 * 1024;
const DATA_URL_RE = /^data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+$/;

function createHttpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

export function getAttributeServiceUrl() {
  return String(process.env.ATTRIBUTE_SERVICE_URL || DEFAULT_SERVICE_URL).trim();
}

export function isAttributeServiceConfigured() {
  return Boolean(String(process.env.ATTRIBUTE_SERVICE_URL || '').trim());
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

// Resolves to the service's three-state verdicts. Any failure - no service
// configured, timeout, bad status - surfaces as statusCode 503 so the client
// can treat every attribute as "unsure" and fall back to asking the customer.
// The service being down must never read as "nothing detected".
export async function detectPhotoAttributes({ dataUrl, timeoutMs = DEFAULT_TIMEOUT_MS }) {
  const validated = validateDataUrl(dataUrl);

  if (!isAttributeServiceConfigured()) {
    throw createHttpError('Attribute detection service is not configured.', 503);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // A private Hugging Face Space needs a bearer token on every request.
    const token = String(process.env.ATTRIBUTE_SERVICE_TOKEN || '').trim();
    const response = await fetch(getAttributeServiceUrl(), {
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
