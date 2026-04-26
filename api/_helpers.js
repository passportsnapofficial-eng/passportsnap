const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const SECURITY_HEADERS = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};

function resolveAllowedOrigin(requestOrigin) {
  if (!requestOrigin) return null;
  if (!ALLOWED_ORIGINS.length) return requestOrigin;
  return ALLOWED_ORIGINS.includes(requestOrigin) ? requestOrigin : null;
}

export function setApiHeaders(response, request, allowedMethods = 'GET,OPTIONS') {
  const requestOrigin = request.headers.origin || '';
  const allowedOrigin = resolveAllowedOrigin(requestOrigin);

  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    response.setHeader(key, value);
  }

  if (allowedOrigin) {
    response.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-admin-token');
    response.setHeader('Access-Control-Allow-Methods', allowedMethods);
    response.setHeader('Vary', 'Origin');
  }

  response.setHeader('Content-Type', 'application/json');
}

export function getAdminTokenFromRequest(request) {
  const directHeader = request.headers['x-admin-token'];
  if (typeof directHeader === 'string' && directHeader.trim()) {
    return directHeader.trim();
  }

  const authorization = request.headers.authorization || '';
  if (authorization.toLowerCase().startsWith('bearer ')) {
    return authorization.slice(7).trim();
  }

  return '';
}

export function sendError(response, error, fallback = 'An unexpected error occurred.') {
  const message = error instanceof Error ? error.message : fallback;
  const isClientError =
    (error?.statusCode >= 400 && error?.statusCode < 500) ||
    message.includes('required') ||
    message.includes('invalid') ||
    message.includes('Invalid') ||
    message.includes('missing') ||
    message.includes('not found') ||
    message.includes('denied') ||
    message.includes('not allowed');

  const statusCode = error?.statusCode || (isClientError ? 400 : 500);
  response.status(statusCode).json({ message: isClientError ? message : fallback });
}
