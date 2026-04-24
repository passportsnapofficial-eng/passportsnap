import { canvasToBlob, loadImageElement } from './cropUtils';

const DEFAULT_MODEL = 'remove_bg_api';
const DEFAULT_ENDPOINT = '/api/remove-bg';

async function compositePngOnWhite(pngBlob) {
  const dataUrl = await readBlobAsDataUrl(pngBlob);
  const img = await loadImageElement(dataUrl);
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not composite background removal result.');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0);
  return canvasToBlob(canvas, 'image/jpeg', 0.96);
}

function parseNumericHeader(headers, key) {
  const value = Number(headers.get(key) || '');
  return Number.isFinite(value) ? value : 0;
}

function readBlobAsDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Could not read processed image.'));
    reader.readAsDataURL(blob);
  });
}

async function createBackgroundRemovalUpload(source) {
  const image = await loadImageElement(source);
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('Could not prepare the image for background removal.');
  }

  canvas.width = image.naturalWidth || image.width;
  canvas.height = image.naturalHeight || image.height;
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  const blob = await canvasToBlob(canvas, 'image/png');
  if (!blob) {
    throw new Error('Could not prepare the image for background removal.');
  }

  return blob;
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
      return 'Background removal failed.';
    }
  }

  const text = await response.text();
  return text.trim() || 'Background removal failed.';
}

export async function removeBackgroundForPassportExport(source, options = {}) {
  if (typeof source !== 'string' || !source.trim()) {
    throw new Error('No photo was available for background cleanup.');
  }

  const model = String(options.model || DEFAULT_MODEL).trim() || DEFAULT_MODEL;
  const endpoint = String(options.endpoint || DEFAULT_ENDPOINT).trim() || DEFAULT_ENDPOINT;
  const uploadBlob = await createBackgroundRemovalUpload(source);
  const formData = new FormData();

  formData.append('model', model);
  formData.append('file', uploadBlob, 'reviewed-source.png');

  const response = await fetch(endpoint, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }

  const rawBlob = await response.blob();
  if (!rawBlob || rawBlob.size === 0) {
    throw new Error('Background cleanup did not return a usable photo.');
  }

  const processedBlob = await compositePngOnWhite(rawBlob);
  if (!processedBlob || processedBlob.size === 0) {
    throw new Error('Background cleanup did not return a usable photo.');
  }

  const dataUrl = await readBlobAsDataUrl(processedBlob);
  if (!dataUrl) {
    throw new Error('Background cleanup did not return a usable photo.');
  }

  return {
    applied: true,
    dataUrl,
    blob: processedBlob,
    mimeType: processedBlob.type || 'image/jpeg',
    model: response.headers.get('x-background-model') || model,
    maskQuality: parseNumericHeader(response.headers, 'x-background-mask-quality'),
    transparentRatio: parseNumericHeader(response.headers, 'x-background-transparent-ratio'),
    foregroundRatio: parseNumericHeader(response.headers, 'x-background-foreground-ratio'),
    featherRatio: parseNumericHeader(response.headers, 'x-background-feather-ratio'),
  };
}
