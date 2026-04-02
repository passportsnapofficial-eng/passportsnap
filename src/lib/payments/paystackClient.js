async function parseJsonResponse(response) {
  let payload = null;

  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw new Error(payload?.message || 'The payment request could not be completed.');
  }

  return payload;
}

export function buildPaystackCallbackUrl() {
  const url = new URL(window.location.href);
  url.searchParams.delete('reference');
  url.searchParams.delete('trxref');
  url.searchParams.set('paystack', 'callback');
  return `${url.origin}${url.pathname}${url.search}`;
}

export async function initializePaystackPayment(payload) {
  const response = await fetch('/api/paystack/initialize', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  return parseJsonResponse(response);
}

export async function verifyPaystackPayment(reference) {
  const response = await fetch(`/api/paystack/verify?reference=${encodeURIComponent(reference)}`, {
    method: 'GET',
  });

  return parseJsonResponse(response);
}
