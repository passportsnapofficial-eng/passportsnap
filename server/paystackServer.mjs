import { createServer } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildPaystackMetadata,
  computeCheckoutTotals,
  fromMinorUnits,
  getDocumentPricing,
} from '../src/lib/checkout/pricing.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const rootDir = resolve(__dirname, '..');
const distDir = resolve(rootDir, 'dist');
const envPath = resolve(rootDir, '.env.local');

loadLocalEnv(envPath);

const PORT = Number(process.env.PAYSTACK_SERVER_PORT || 8787);
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || '';
const DEFAULT_CALLBACK_URL = process.env.PAYSTACK_CALLBACK_URL || 'http://127.0.0.1:5173/?paystack=callback';
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

function setBaseHeaders(response, statusCode, contentType = 'application/json') {
  response.writeHead(statusCode, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Content-Type': contentType,
  });
}

function sendJson(response, statusCode, payload) {
  setBaseHeaders(response, statusCode);
  response.end(JSON.stringify(payload));
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
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
  };

  return types[extension] || 'application/octet-stream';
}

function serveStaticAsset(requestPath, response) {
  const normalizedPath = requestPath === '/' ? '/index.html' : requestPath;
  const targetPath = resolve(distDir, `.${normalizedPath}`);
  const safePath = targetPath.startsWith(distDir) ? targetPath : null;

  if (!safePath || !existsSync(safePath)) {
    const indexPath = join(distDir, 'index.html');
    if (!existsSync(indexPath)) {
      sendText(response, 404, 'Build output not found.');
      return;
    }

    setBaseHeaders(response, 200, 'text/html; charset=utf-8');
    response.end(readFileSync(indexPath));
    return;
  }

  setBaseHeaders(response, 200, fileContentType(safePath));
  response.end(readFileSync(safePath));
}

function buildReference() {
  const stamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `PS-${stamp}-${random}`;
}

function normalizeCartItems(cartItems = []) {
  return cartItems.map((item) => {
    const documentId = String(item?.documentId || '').trim();
    if (!documentId || !getDocumentPricing(documentId)) {
      throw new Error('One or more cart items are invalid for checkout.');
    }

    return { documentId };
  });
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

function resolveCallbackUrl(request, requestedCallbackUrl) {
  if (requestedCallbackUrl) {
    try {
      const parsed = new URL(requestedCallbackUrl);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        parsed.searchParams.set('paystack', 'callback');
        return parsed.toString();
      }
    } catch {
      // Fall back to the default callback URL.
    }
  }

  const originHeader = request.headers.origin;
  if (originHeader) {
    try {
      const parsed = new URL(originHeader);
      parsed.searchParams.set('paystack', 'callback');
      return `${parsed.origin}/?paystack=callback`;
    } catch {
      // Fall back below.
    }
  }

  return DEFAULT_CALLBACK_URL;
}

function buildCancelUrl(callbackUrl) {
  const cancelUrl = new URL(callbackUrl);
  cancelUrl.searchParams.set('paystack', 'cancelled');
  return cancelUrl.toString();
}

async function initializeTransaction(payload, request) {
  if (!PAYSTACK_SECRET_KEY) {
    throw new Error('Paystack secret key is missing. Add PAYSTACK_SECRET_KEY to .env.local.');
  }

  const email = String(payload.email || '').trim();
  const firstName = String(payload.firstName || '').trim();
  const lastName = String(payload.lastName || '').trim();
  const phone = String(payload.phone || '').trim();
  const cartItems = normalizeCartItems(payload.cartItems);
  const premiumRetouch = Boolean(payload.premiumRetouch);

  if (!email) {
    throw new Error('Email is required before payment.');
  }

  if (!cartItems.length || cartItems.some((item) => !item.documentId)) {
    throw new Error('A valid cart is required before payment.');
  }

  const totals = computeCheckoutTotals(cartItems, premiumRetouch);
  if (!totals.amountMinor) {
    throw new Error('The final order total is invalid.');
  }

  const callbackUrl = resolveCallbackUrl(request, payload.callbackUrl);
  const metadata = buildPaystackMetadata(cartItems, premiumRetouch);
  metadata.cancel_action = buildCancelUrl(callbackUrl);

  const reference = buildReference();

  const paystackResponse = await fetch('https://api.paystack.co/transaction/initialize', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: String(totals.amountMinor),
      email,
      currency: totals.currency,
      reference,
      callback_url: callbackUrl,
      metadata,
      first_name: firstName || undefined,
      last_name: lastName || undefined,
      phone: phone || undefined,
    }),
  });

  const result = await paystackResponse.json();
  if (!paystackResponse.ok || !result?.status || !result?.data?.authorization_url) {
    throw new Error(result?.message || 'Paystack could not initialize this payment.');
  }

  return {
    authorizationUrl: result.data.authorization_url,
    accessCode: result.data.access_code,
    reference: result.data.reference,
    amount: totals.total,
    amountMinor: totals.amountMinor,
    currency: totals.currency,
  };
}

async function verifyTransaction(reference) {
  if (!PAYSTACK_SECRET_KEY) {
    throw new Error('Paystack secret key is missing. Add PAYSTACK_SECRET_KEY to .env.local.');
  }

  if (!reference) {
    throw new Error('A payment reference is required.');
  }

  const paystackResponse = await fetch(
    `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
    {
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
      },
    },
  );

  const result = await paystackResponse.json();
  if (!paystackResponse.ok || !result?.status || !result?.data) {
    throw new Error(result?.message || 'Unable to verify the Paystack transaction.');
  }

  const metadata = result.data.metadata || {};
  const cartItems = normalizeCartItems(
    Array.isArray(metadata.documentIds)
      ? metadata.documentIds.map((documentId) => ({ documentId }))
      : [],
  );
  const premiumRetouch = Boolean(metadata.premiumRetouch);
  const expectedTotals = computeCheckoutTotals(cartItems, premiumRetouch);
  const paidAmount = Number(result.data.amount || 0);
  const paidCurrency = result.data.currency || expectedTotals.currency;

  if (result.data.status !== 'success') {
    throw new Error(`Payment is not complete yet. Current status: ${result.data.status}.`);
  }

  if (paidAmount !== expectedTotals.amountMinor) {
    throw new Error('Payment amount verification failed.');
  }

  if (paidCurrency !== expectedTotals.currency) {
    throw new Error('Payment currency verification failed.');
  }

  return {
    reference: result.data.reference,
    amountMinor: paidAmount,
    amount: fromMinorUnits(paidAmount),
    currency: paidCurrency,
    paidAt: result.data.paidAt || result.data.transaction_date,
    status: result.data.status,
    channel: result.data.channel || 'card',
    gatewayResponse: result.data.gateway_response || 'Payment completed',
    metadata,
    customer: result.data.customer || null,
  };
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
    if (request.method === 'POST' && requestUrl.pathname === '/api/paystack/initialize') {
      const payload = await parseRequestBody(request);
      const result = await initializeTransaction(payload, request);
      sendJson(response, 200, result);
      return;
    }

    if (request.method === 'GET' && requestUrl.pathname === '/api/paystack/verify') {
      const reference = requestUrl.searchParams.get('reference');
      const result = await verifyTransaction(reference);
      sendJson(response, 200, result);
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

server.listen(PORT, () => {
  console.log(`Paystack API server listening on http://127.0.0.1:${PORT}`);
});
