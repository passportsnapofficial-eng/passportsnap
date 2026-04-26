import { createServer } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { timingSafeEqual } from 'node:crypto';
import {
  authenticateAdmin,
  getAdminOverview,
  getPublicSiteSettings,
  isValidAdminToken,
  saveAdminSiteSettings,
  upsertAdminReviewRequest,
} from '../src/lib/admin/adminServerCore.js';
import {
  proxyBackgroundRemovalRequest,
  readRawRequestBody,
} from '../src/lib/backgroundRemoval/backgroundRemovalServerCore.js';
import { initializeTransaction, verifyTransaction } from '../src/lib/payments/stripeServerCore.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const rootDir = resolve(__dirname, '..');
const distDir = resolve(rootDir, 'dist');
const envPath = resolve(rootDir, '.env.local');

loadLocalEnv(envPath);

const DEFAULT_PORT = Number(process.env.PORT || process.env.PAYMENTS_SERVER_PORT || 8790);
const MAX_PORT_ATTEMPTS = Number(process.env.PORT_FALLBACK_ATTEMPTS || 10);
const SERVE_DIST = process.argv.includes('--serve-dist');

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

// In-memory rate limiter: tracks failed admin login attempts per IP.
const loginAttempts = new Map();
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 10;

function isLoginRateLimited(ip) {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry) return false;
  if (now - entry.windowStart > LOGIN_WINDOW_MS) {
    loginAttempts.delete(ip);
    return false;
  }
  return entry.count >= LOGIN_MAX_ATTEMPTS;
}

function recordLoginAttempt(ip) {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || now - entry.windowStart > LOGIN_WINDOW_MS) {
    loginAttempts.set(ip, { count: 1, windowStart: now });
  } else {
    entry.count += 1;
  }
}

function clearLoginAttempts(ip) {
  loginAttempts.delete(ip);
}

function getClientIp(request) {
  const forwarded = request.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return request.socket?.remoteAddress || '0.0.0.0';
}

function resolveAllowedOrigin(requestOrigin) {
  if (!requestOrigin) return null;
  if (!ALLOWED_ORIGINS.length) return requestOrigin;
  return ALLOWED_ORIGINS.includes(requestOrigin) ? requestOrigin : null;
}

function loadLocalEnv(filePath) {
  if (!existsSync(filePath)) return;

  const contents = readFileSync(filePath, 'utf8');
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const separatorIndex = line.indexOf('=');
    if (separatorIndex < 0) continue;

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, '');
    if (key && !(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function setBaseHeaders(response, statusCode, contentType = 'application/json', extraHeaders = {}, requestOrigin = '') {
  const allowedOrigin = resolveAllowedOrigin(requestOrigin);
  const corsHeaders = allowedOrigin
    ? {
        'Access-Control-Allow-Origin': allowedOrigin,
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-admin-token',
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
        'Vary': 'Origin',
      }
    : {};

  response.writeHead(statusCode, {
    ...SECURITY_HEADERS,
    ...corsHeaders,
    'Content-Type': contentType,
    ...extraHeaders,
  });
}

function sendJson(response, statusCode, payload, requestOrigin = '') {
  setBaseHeaders(response, statusCode, 'application/json', {}, requestOrigin);
  response.end(JSON.stringify(payload));
}

function getAdminTokenFromRequest(request) {
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

function sendText(response, statusCode, message, requestOrigin = '') {
  setBaseHeaders(response, statusCode, 'text/plain; charset=utf-8', {}, requestOrigin);
  response.end(message);
}

function fileContentType(filePath) {
  const extension = extname(filePath).toLowerCase();
  const types = {
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.wasm': 'application/wasm',
    '.tflite': 'application/octet-stream',
    '.task': 'application/octet-stream',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
  };

  return types[extension] || 'application/octet-stream';
}

function isAssetLikePath(requestPath) {
  const lastSegment = requestPath.split('/').pop() || '';
  return lastSegment.includes('.') && !requestPath.endsWith('/');
}

function resolveCompatAssetPath(requestPath) {
  if (!/^\/assets\/passportValidationWorker-[^/]+\.js$/i.test(requestPath)) {
    return null;
  }

  const compatPath = join(distDir, 'assets', 'passportValidationCompat.js');
  return existsSync(compatPath) ? compatPath : null;
}

function decodeRequestPath(requestPath) {
  try {
    return decodeURIComponent(requestPath);
  } catch {
    return requestPath;
  }
}

function serveStaticAsset(requestPath, response) {
  const normalizedPath = decodeRequestPath(requestPath === '/' ? '/index.html' : requestPath);
  const targetPath = resolve(distDir, `.${normalizedPath}`);
  const safePath = targetPath.startsWith(distDir) ? targetPath : null;

  if (!safePath || !existsSync(safePath)) {
    const compatAssetPath = resolveCompatAssetPath(normalizedPath);

    if (compatAssetPath) {
      setBaseHeaders(response, 200, fileContentType(compatAssetPath), {
        'Cache-Control': 'no-store, max-age=0',
      });
      response.end(readFileSync(compatAssetPath));
      return;
    }

    if (isAssetLikePath(normalizedPath)) {
      sendText(response, 404, 'Static asset not found.');
      return;
    }

    const indexPath = join(distDir, 'index.html');
    if (!existsSync(indexPath)) {
      sendText(response, 404, 'Build output not found.');
      return;
    }

    setBaseHeaders(response, 200, 'text/html; charset=utf-8', {
      'Cache-Control': 'no-store, max-age=0',
    });
    response.end(readFileSync(indexPath));
    return;
  }

  const isFingerprinted = /\.[a-f0-9]{8,}\.[a-z]+$/.test(normalizedPath);
  const cacheControl = normalizedPath.endsWith('.html')
    ? 'no-store, max-age=0'
    : isFingerprinted
      ? 'public, max-age=31536000, immutable'
      : 'no-store, max-age=0';

  setBaseHeaders(response, 200, fileContentType(safePath), { 'Cache-Control': cacheControl });
  response.end(readFileSync(safePath));
}

function parseRequestBody(request) {
  return new Promise((resolvePromise, rejectPromise) => {
    let body = '';

    request.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        rejectPromise(new Error('Request body too large.'));
      }
    });

    request.on('end', () => {
      if (!body) {
        resolvePromise({});
        return;
      }

      try {
        resolvePromise(JSON.parse(body));
      } catch {
        rejectPromise(new Error('Invalid JSON payload.'));
      }
    });

    request.on('error', rejectPromise);
  });
}

const server = createServer(async (request, response) => {
  if (!request.url) {
    sendJson(response, 400, { message: 'Invalid request URL.' });
    return;
  }

  const requestOrigin = request.headers.origin || '';

  if (request.method === 'OPTIONS') {
    setBaseHeaders(response, 204, 'application/json', {}, requestOrigin);
    response.end();
    return;
  }

  const requestUrl = new URL(request.url, `http://${request.headers.host || '127.0.0.1'}`);
  const clientIp = getClientIp(request);

  try {
    if (request.method === 'POST' && requestUrl.pathname === '/api/admin/login') {
      if (isLoginRateLimited(clientIp)) {
        sendJson(response, 429, { message: 'Too many login attempts. Try again later.' }, requestOrigin);
        return;
      }

      const payload = await parseRequestBody(request);

      try {
        const result = authenticateAdmin(payload.email, payload.password);
        clearLoginAttempts(clientIp);
        sendJson(response, 200, result, requestOrigin);
      } catch (authError) {
        recordLoginAttempt(clientIp);
        sendJson(response, 401, {
          message: authError instanceof Error ? authError.message : 'Invalid admin credentials.',
        }, requestOrigin);
      }
      return;
    }

    if (requestUrl.pathname.startsWith('/api/admin/')) {
      const token = getAdminTokenFromRequest(request);

      if (!isValidAdminToken(token)) {
        sendJson(response, 401, { message: 'Admin access denied.' }, requestOrigin);
        return;
      }

      if (request.method === 'GET' && requestUrl.pathname === '/api/admin/overview') {
        const result = await getAdminOverview();
        sendJson(response, 200, result, requestOrigin);
        return;
      }

      if (request.method === 'POST' && requestUrl.pathname === '/api/admin/reviews') {
        const payload = await parseRequestBody(request);
        const result = await upsertAdminReviewRequest(payload);
        sendJson(response, 200, result, requestOrigin);
        return;
      }

      if (request.method === 'POST' && requestUrl.pathname === '/api/admin/settings') {
        const payload = await parseRequestBody(request);
        const result = await saveAdminSiteSettings(payload);
        sendJson(response, 200, result, requestOrigin);
        return;
      }
    }

    if (request.method === 'GET' && requestUrl.pathname === '/api/settings') {
      const result = await getPublicSiteSettings();
      sendJson(response, 200, result, requestOrigin);
      return;
    }

    if (request.method === 'POST' && requestUrl.pathname === '/api/stripe/initialize') {
      const payload = await parseRequestBody(request);
      const result = await initializeTransaction(payload, {
        originHeader: requestOrigin,
      });
      sendJson(response, 200, result, requestOrigin);
      return;
    }

    if (request.method === 'GET' && requestUrl.pathname === '/api/stripe/verify') {
      const sessionId = requestUrl.searchParams.get('sessionId');
      const result = await verifyTransaction(sessionId);
      sendJson(response, 200, result, requestOrigin);
      return;
    }

    if (request.method === 'POST' && requestUrl.pathname === '/api/remove-bg') {
      const bodyBuffer = await readRawRequestBody(request);
      const result = await proxyBackgroundRemovalRequest({
        bodyBuffer,
        contentType: request.headers['content-type'] || 'application/octet-stream',
        contentLength: request.headers['content-length'] || bodyBuffer.length,
      });

      setBaseHeaders(response, result.statusCode, result.contentType, {
        'Content-Length': String(result.contentLength),
        'X-Background-Model': result.backgroundModel,
        'X-Background-Mask-Quality': result.maskQuality,
        'X-Background-Transparent-Ratio': result.transparentRatio,
        'X-Background-Foreground-Ratio': result.foregroundRatio,
        'X-Background-Feather-Ratio': result.featherRatio,
      }, requestOrigin);
      response.end(result.bodyBuffer);
      return;
    }

    if (SERVE_DIST) {
      serveStaticAsset(requestUrl.pathname, response);
      return;
    }

    sendJson(response, 404, { message: 'Route not found.' }, requestOrigin);
  } catch (error) {
    const isClientError = error instanceof Error && (
      error.message.includes('required') ||
      error.message.includes('invalid') ||
      error.message.includes('Invalid') ||
      error.message.includes('missing') ||
      error.message.includes('too large') ||
      error.message.includes('JSON')
    );
    const statusCode = isClientError ? 400 : 500;
    const message = isClientError
      ? (error instanceof Error ? error.message : 'Bad request.')
      : 'An unexpected error occurred. Please try again.';
    sendJson(response, statusCode, { message }, requestOrigin);
  }
});

function listenOnAvailablePort(startPort) {
  let port = startPort;
  let attempts = 0;

  const tryListen = () => {
    const onError = (error) => {
      if (error?.code === 'EADDRINUSE' && attempts < MAX_PORT_ATTEMPTS) {
        attempts += 1;
        port += 1;
        console.warn(`Port ${port - 1} is already in use. Trying ${port}...`);
        tryListen();
        return;
      }

      throw error;
    };

    server.once('error', onError);
    server.listen(port, () => {
      server.removeListener('error', onError);
      console.log(`Application server listening on http://127.0.0.1:${port}`);
    });
  };

  tryListen();
}

listenOnAvailablePort(DEFAULT_PORT);
