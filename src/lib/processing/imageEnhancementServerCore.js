const DEFAULT_SERVICE_URL = 'http://127.0.0.1:8788/enhance';
const DEFAULT_TIMEOUT_MS = 45000;
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const ALLOWED_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const IMAGE_MAGIC = [
  { bytes: [0xff, 0xd8, 0xff], mime: 'image/jpeg' },
  { bytes: [0x89, 0x50, 0x4e, 0x47], mime: 'image/png' },
  { bytes: [0x52, 0x49, 0x46, 0x46], mime: 'image/webp' },
];

function normalizeTrimmedString(value) {
  const input = String(value || '').trim();
  return input || '';
}

function parseServiceError(payload, fallbackMessage) {
  if (!payload) {
    return fallbackMessage;
  }

  if (typeof payload === 'string') {
    return payload.trim() || fallbackMessage;
  }

  if (typeof payload === 'object') {
    if (typeof payload.message === 'string' && payload.message.trim()) {
      return payload.message.trim();
    }

    if (typeof payload.detail === 'string' && payload.detail.trim()) {
      return payload.detail.trim();
    }
  }

  return fallbackMessage;
}

function sniffImageMimeType(buffer) {
  if (!buffer || buffer.length < 4) {
    return null;
  }

  for (const signature of IMAGE_MAGIC) {
    if (signature.bytes.every((byte, index) => buffer[index] === byte)) {
      return signature.mime;
    }
  }

  return null;
}

function validateImageFile(file, fileBuffer) {
  const declaredType = (file.type || '').split(';')[0].trim().toLowerCase();
  if (declaredType && !ALLOWED_IMAGE_MIME_TYPES.has(declaredType)) {
    const error = new Error('Only JPEG, PNG, or WebP images are accepted.');
    error.statusCode = 415;
    throw error;
  }

  const sniffed = sniffImageMimeType(fileBuffer);
  if (!sniffed) {
    const error = new Error('The uploaded file does not appear to be a valid image.');
    error.statusCode = 415;
    throw error;
  }
}

function normalizePositiveNumber(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

function normalizePositiveInteger(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.round(parsed);
}

function readFileName(uploadedFile) {
  if (!uploadedFile || typeof uploadedFile.name !== 'string' || !uploadedFile.name.trim()) {
    return 'passport-photo.jpg';
  }

  return uploadedFile.name.trim();
}

export function getImageEnhancementServiceUrl() {
  return normalizeTrimmedString(
    process.env.REAL_ESRGAN_SERVICE_URL ||
    process.env.IMAGE_ENHANCEMENT_SERVICE_URL ||
    DEFAULT_SERVICE_URL,
  );
}

export function getImageEnhancementProxyTimeoutMs() {
  const raw = Number(
    process.env.IMAGE_ENHANCEMENT_TIMEOUT_MS ||
    process.env.REAL_ESRGAN_TIMEOUT_MS ||
    DEFAULT_TIMEOUT_MS,
  );
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_TIMEOUT_MS;
}

export function getImageEnhancementUploadLimitBytes() {
  const raw = Number(
    process.env.IMAGE_ENHANCEMENT_MAX_UPLOAD_BYTES ||
    process.env.REAL_ESRGAN_MAX_UPLOAD_BYTES ||
    MAX_UPLOAD_BYTES,
  );
  return Number.isFinite(raw) && raw > 0 ? raw : MAX_UPLOAD_BYTES;
}

export function readRawRequestBody(request, options = {}) {
  const maxBytes = options.maxBytes || getImageEnhancementUploadLimitBytes();

  return new Promise((resolve, reject) => {
    const chunks = [];
    let totalBytes = 0;

    request.on('data', (chunk) => {
      totalBytes += chunk.length;

      if (totalBytes > maxBytes) {
        reject(new Error('Image file is too large.'));
        request.destroy();
        return;
      }

      chunks.push(chunk);
    });

    request.on('end', () => {
      resolve(Buffer.concat(chunks));
    });

    request.on('error', reject);
  });
}

async function parseIncomingFormData(bodyBuffer, contentType) {
  const request = new Request('http://127.0.0.1/api/enhance-photo', {
    method: 'POST',
    headers: {
      'Content-Type': contentType,
    },
    body: bodyBuffer,
  });

  return request.formData();
}

async function buildEnhancementRequestBody(bodyBuffer, contentType) {
  const formData = await parseIncomingFormData(bodyBuffer, contentType);
  const uploadedFile = formData.get('file');

  if (!(uploadedFile instanceof Blob)) {
    const error = new Error('Image file is required.');
    error.statusCode = 400;
    throw error;
  }

  const fileBuffer = Buffer.from(await uploadedFile.arrayBuffer());
  validateImageFile(uploadedFile, fileBuffer);

  const requestBody = new FormData();
  requestBody.append(
    'file',
    new Blob([fileBuffer], { type: uploadedFile.type || 'image/jpeg' }),
    readFileName(uploadedFile),
  );
  requestBody.append(
    'model',
    normalizeTrimmedString(formData.get('model')) || 'realesr-general-x4v3',
  );
  requestBody.append(
    'outscale',
    String(normalizePositiveNumber(formData.get('outscale'), 2)),
  );
  requestBody.append(
    'denoise_strength',
    String(normalizePositiveNumber(formData.get('denoise_strength'), 0.5)),
  );
  requestBody.append(
    'target_width',
    String(normalizePositiveInteger(formData.get('target_width'), 600)),
  );
  requestBody.append(
    'target_height',
    String(normalizePositiveInteger(formData.get('target_height'), 600)),
  );

  return requestBody;
}

export async function proxyImageEnhancementRequest({ bodyBuffer, contentType }) {
  const serviceUrl = getImageEnhancementServiceUrl();
  if (!serviceUrl) {
    const error = new Error('REAL_ESRGAN_SERVICE_URL is not configured.');
    error.statusCode = 500;
    throw error;
  }

  const requestBody = await buildEnhancementRequestBody(bodyBuffer, contentType);
  const response = await fetch(serviceUrl, {
    method: 'POST',
    body: requestBody,
    signal: AbortSignal.timeout(getImageEnhancementProxyTimeoutMs()),
  });

  const contentTypeHeader = response.headers.get('content-type') || '';
  const responseBuffer = Buffer.from(await response.arrayBuffer());

  if (!response.ok) {
    let payload = null;
    if (contentTypeHeader.includes('application/json')) {
      try {
        payload = JSON.parse(responseBuffer.toString('utf8'));
      } catch {
        payload = null;
      }
    } else {
      payload = responseBuffer.toString('utf8');
    }

    const message = parseServiceError(payload, 'Image enhancement failed.');
    const error = new Error(message);
    error.statusCode = response.status;
    throw error;
  }

  return {
    statusCode: response.status,
    bodyBuffer: responseBuffer,
    contentType: contentTypeHeader || 'image/jpeg',
    contentLength: responseBuffer.length,
    enhancementModel: response.headers.get('x-enhancement-model') || '',
    enhancementScale: response.headers.get('x-enhancement-scale') || '',
    enhancementTargetWidth: response.headers.get('x-enhancement-target-width') || '',
    enhancementTargetHeight: response.headers.get('x-enhancement-target-height') || '',
  };
}
