async function parseJsonResponse(response) {
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload?.message || 'Unable to record this order for admin review.');
  }

  return payload;
}

export async function recordOrderForAdmin(order) {
  if (!order?.id && !order?.paymentReference) {
    return null;
  }

  const response = await fetch('/api/orders/record', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(order),
  });

  return parseJsonResponse(response);
}
