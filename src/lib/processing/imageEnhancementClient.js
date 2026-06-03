const DEFAULT_ENDPOINT = '/api/enhance-photo';
const DEFAULT_MODEL = 'realesr-general-x4v3';
const DEFAULT_OUTSCALE = 2;
const DEFAULT_DENOISE_STRENGTH = 0.5;

function normalizePositiveInteger(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.round(parsed);
}

function normalizePositiveNumber(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

async function readBlobAsDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Could not read the enhanced image.'));
    reader.readAsDataURL(blob);
  });
}

async function parseErrorResponse(response) {
  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    try {
      const payload = await response.json();
      if (typeof payload?.message === 'string' && payload.message.trim()) {
        return payload.message.trim();
      }
    } catch {
      return 'Image enhancement failed.';
    }
  }

  const text = await response.text();
  return text.trim() || 'Image enhancement failed.';
}

function parseHeaderNumber(response, headerName, fallback = 0) {
  const value = Number(response.headers.get(headerName) || '');
  return Number.isFinite(value) ? value : fallback;
}

export async function enhanceFinishedPassportPhoto(source, options = {}) {
  if (typeof source !== 'string' || !source.trim()) {
    throw new Error('No finished photo was available for enhancement.');
  }

  const endpoint = String(options.endpoint || DEFAULT_ENDPOINT).trim() || DEFAULT_ENDPOINT;
  const model = String(options.model || DEFAULT_MODEL).trim() || DEFAULT_MODEL;
  const outscale = normalizePositiveNumber(options.outscale, DEFAULT_OUTSCALE);
  const denoiseStrength = normalizePositiveNumber(
    options.denoiseStrength,
    DEFAULT_DENOISE_STRENGTH,
  );
  const targetWidth = normalizePositiveInteger(options.targetWidth, 600);
  const targetHeight = normalizePositiveInteger(options.targetHeight, 600);
  const sourceBlob = await fetch(source).then((response) => response.blob());
  const formData = new FormData();

  formData.append('model', model);
  formData.append('outscale', String(outscale));
  formData.append('denoise_strength', String(denoiseStrength));
  formData.append('target_width', String(targetWidth));
  formData.append('target_height', String(targetHeight));
  formData.append('file', sourceBlob, 'passport-finished.jpg');

  const response = await fetch(endpoint, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }

  const blob = await response.blob();
  if (!blob || blob.size === 0) {
    throw new Error('Image enhancement did not return a usable photo.');
  }

  const dataUrl = await readBlobAsDataUrl(blob);
  if (!dataUrl) {
    throw new Error('Image enhancement did not return a usable photo.');
  }

  return {
    applied: true,
    dataUrl,
    blob,
    mimeType: blob.type || 'image/jpeg',
    model: response.headers.get('x-enhancement-model') || model,
    outscale: parseHeaderNumber(response, 'x-enhancement-scale', outscale),
    denoiseStrength,
    targetWidth: parseHeaderNumber(response, 'x-enhancement-target-width', targetWidth),
    targetHeight: parseHeaderNumber(response, 'x-enhancement-target-height', targetHeight),
  };
}
