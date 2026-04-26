const REMOVE_BG_API_URL = 'https://api.remove.bg/v1.0/removebg';
const REMOVE_BG_MODEL = 'remove_bg_api';
const DEFAULT_TIMEOUT_MS = 30000;
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // 4 MB — sufficient for high-res passport portraits

const ALLOWED_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

// Magic byte signatures for supported image formats.
const IMAGE_MAGIC = [
  { bytes: [0xff, 0xd8, 0xff], mime: 'image/jpeg' },
  { bytes: [0x89, 0x50, 0x4e, 0x47], mime: 'image/png' },
  { bytes: [0x52, 0x49, 0x46, 0x46], mime: 'image/webp' }, // RIFF header (WebP)
];

function sniffImageMimeType(buffer) {
  if (!buffer || buffer.length < 4) return null;
  for (const sig of IMAGE_MAGIC) {
    if (sig.bytes.every((byte, i) => buffer[i] === byte)) {
      return sig.mime;
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

function getRemoveBgApiKey() {
  return normalizeTrimmedString(process.env.REMOVE_BG_API_KEY || process.env.REMOVEBG_API_KEY);
}

export function getBackgroundRemovalProxyTimeoutMs() {
  const raw = Number(process.env.BACKGROUND_REMOVAL_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_TIMEOUT_MS;
}

export function getBackgroundRemovalUploadLimitBytes() {
  const raw = Number(process.env.BACKGROUND_REMOVAL_MAX_UPLOAD_BYTES || MAX_UPLOAD_BYTES);
  return Number.isFinite(raw) && raw > 0 ? raw : MAX_UPLOAD_BYTES;
}

export function setBackgroundRemovalCorsHeaders(response) {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  response.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
}

export function readRawRequestBody(request, options = {}) {
  const maxBytes = options.maxBytes || getBackgroundRemovalUploadLimitBytes();

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
  const request = new Request('http://127.0.0.1/api/remove-bg', {
    method: 'POST',
    headers: {
      'Content-Type': contentType,
    },
    body: bodyBuffer,
  });

  return request.formData();
}

function readFileName(uploadedFile) {
  if (!uploadedFile || typeof uploadedFile.name !== 'string' || !uploadedFile.name.trim()) {
    return 'passport-photo.jpg';
  }

  return uploadedFile.name.trim();
}

async function buildRemoveBgRequestBody(bodyBuffer, contentType) {
  const formData = await parseIncomingFormData(bodyBuffer, contentType);
  const uploadedFile = formData.get('file');
  const imageUrl = normalizeTrimmedString(formData.get('image_url'));

  if (!(uploadedFile instanceof Blob) && !imageUrl) {
    const error = new Error('Image file is required.');
    error.statusCode = 400;
    throw error;
  }

  const removeBgFormData = new FormData();
  removeBgFormData.append('size', 'regular');
  removeBgFormData.append('type', 'person');
  removeBgFormData.append('format', 'png');

  if (uploadedFile instanceof Blob) {
    const fileBuffer = Buffer.from(await uploadedFile.arrayBuffer());
    validateImageFile(uploadedFile, fileBuffer);
    const validatedBlob = new Blob([fileBuffer], { type: uploadedFile.type || 'image/jpeg' });
    removeBgFormData.append('image_file', validatedBlob, readFileName(uploadedFile));
  } else {
    removeBgFormData.append('image_url', imageUrl);
  }

  return removeBgFormData;
}

export async function proxyBackgroundRemovalRequest({ bodyBuffer, contentType }) {
  const apiKey = getRemoveBgApiKey();
  if (!apiKey) {
    const error = new Error('REMOVE_BG_API_KEY is not configured.');
    error.statusCode = 500;
    throw error;
  }

  const timeoutMs = getBackgroundRemovalProxyTimeoutMs();
  const requestBody = await buildRemoveBgRequestBody(bodyBuffer, contentType);
  const response = await fetch(REMOVE_BG_API_URL, {
    method: 'POST',
    headers: {
      'X-Api-Key': apiKey,
    },
    body: requestBody,
    signal: AbortSignal.timeout(timeoutMs),
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

    const message = parseServiceError(
      payload,
      response.status === 422
        ? 'Background not clean, please retake photo'
        : 'Background removal failed.',
    );
    const error = new Error(message);
    error.statusCode = response.status;
    throw error;
  }

  return {
    statusCode: response.status,
    bodyBuffer: responseBuffer,
    contentType: contentTypeHeader || 'image/jpeg',
    contentLength: responseBuffer.length,
    backgroundModel: REMOVE_BG_MODEL,
    maskQuality: '',
    transparentRatio: '',
    foregroundRatio: '',
    featherRatio: '',
  };
}
