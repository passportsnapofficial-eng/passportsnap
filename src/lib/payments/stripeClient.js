const PAYMENT_REQUEST_TIMEOUT_MS = 30000;

async function parseJsonResponse(response) {
  let payload = null;

  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const error = new Error(payload?.message || 'The payment request could not be completed.');
    error.statusCode = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
}

async function fetchWithTimeout(url, options, timeoutMessage) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), PAYMENT_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });

    return await parseJsonResponse(response);
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(timeoutMessage);
    }

    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export function buildStripeReturnUrl() {
  const url = new URL(window.location.href);
  url.searchParams.delete('session_id');
  url.searchParams.delete('stripe');
  url.searchParams.delete('reference');
  url.searchParams.delete('trxref');
  return `${url.origin}${url.pathname}${url.search}`;
}

export async function initializeStripePayment(payload) {
  return fetchWithTimeout(
    '/api/stripe/initialize',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    },
    'Checkout took too long to start. Please try again.',
  );
}

export async function verifyStripePayment(sessionId) {
  return fetchWithTimeout(
    `/api/stripe/verify?sessionId=${encodeURIComponent(sessionId)}`,
    {
      method: 'GET',
    },
    'Payment verification is taking too long. Please check again.',
  );
}
