async function parseJsonResponse(response) {
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload?.message || 'Unable to send the finished photo email.');
  }

  return payload;
}

export async function requestOrderDeliveryEmail(order) {
  return parseJsonResponse(
    await fetch('/api/orders/delivery', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(order),
    }),
  );
}
