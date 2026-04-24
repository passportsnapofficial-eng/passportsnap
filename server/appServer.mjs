import { createServer } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
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

function setBaseHeaders(response, statusCode, contentType = 'application/json', extraHeaders = {}) {
  response.writeHead(statusCode, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-admin-token',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Content-Type': contentType,
    ...extraHeaders,
  });
}

function sendJson(response, statusCode, payload) {
  setBaseHeaders(response, statusCode);
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

function sendText(response, statusCode, message) {
  setBaseHeaders(response, statusCode, 'text/plain; charset=utf-8');
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

  setBaseHeaders(response, 200, fileContentType(safePath), {
    'Cache-Control': normalizedPath.endsWith('.html') ? 'no-store, max-age=0' : 'no-store, max-age=0',
  });
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

  if (request.method === 'OPTIONS') {
    setBaseHeaders(response, 204);
    response.end();
    return;
  }

  const requestUrl = new URL(request.url, `http://${request.headers.host || '127.0.0.1'}`);

  try {
    if (request.method === 'POST' && requestUrl.pathname === '/api/admin/login') {
      const payload = await parseRequestBody(request);
      const result = authenticateAdmin(payload.email, payload.password);
      sendJson(response, 200, result);
      return;
    }

    if (requestUrl.pathname.startsWith('/api/admin/')) {
      const token = getAdminTokenFromRequest(request);

      if (!isValidAdminToken(token)) {
        sendJson(response, 401, { message: 'Admin access denied.' });
        return;
      }

      if (request.method === 'GET' && requestUrl.pathname === '/api/admin/overview') {
        const result = await getAdminOverview();
        sendJson(response, 200, result);
        return;
      }

      if (request.method === 'POST' && requestUrl.pathname === '/api/admin/reviews') {
        const payload = await parseRequestBody(request);
        const result = await upsertAdminReviewRequest(payload);
        sendJson(response, 200, result);
        return;
      }

      if (request.method === 'POST' && requestUrl.pathname === '/api/admin/settings') {
        const payload = await parseRequestBody(request);
        const result = await saveAdminSiteSettings(payload);
        sendJson(response, 200, result);
        return;
      }
    }

    if (request.method === 'GET' && requestUrl.pathname === '/api/settings') {
      const result = await getPublicSiteSettings();
      sendJson(response, 200, result);
      return;
    }

    if (request.method === 'POST' && requestUrl.pathname === '/api/stripe/initialize') {
      const payload = await parseRequestBody(request);
      const result = await initializeTransaction(payload, {
        originHeader: request.headers.origin || '',
      });
      sendJson(response, 200, result);
      return;
    }

    if (request.method === 'GET' && requestUrl.pathname === '/api/stripe/verify') {
      const sessionId = requestUrl.searchParams.get('sessionId');
      const result = await verifyTransaction(sessionId);
      sendJson(response, 200, result);
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
      });
      response.end(result.bodyBuffer);
      return;
    }

    if (SERVE_DIST) {
      serveStaticAsset(requestUrl.pathname, response);
      return;
    }

    sendJson(response, 404, { message: 'Route not found.' });
  } catch (error) {
    sendJson(response, 400, {
      message: error instanceof Error ? error.message : 'Unexpected server error.',
    });
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
