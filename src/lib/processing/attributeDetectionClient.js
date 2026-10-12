const REQUEST_TIMEOUT_MS = 25000;

export const ATTRIBUTE_KEYS = ['glasses', 'hat', 'head_covering', 'face_mask'];

function unavailable(reason) {
  return {
    available: false,
    reason,
    model: '',
    // Unavailable is reported as "unsure" for every attribute on purpose: the
    // compliance checks then fall through to the customer-confirmation gate
    // instead of clearing anything on the strength of a check that never ran.
    attributes: Object.fromEntries(
      ATTRIBUTE_KEYS.map((key) => [key, { attribute: key, state: 'unsure', score: null }]),
    ),
  };
}

// Fire-and-forget: wakes the model while the customer is still framing their
// photo so the verdict after capture does not pay a cold start.
export function warmAttributeDetection() {
  try {
    fetch('/api/attributes', { method: 'GET', keepalive: true }).catch(() => {});
  } catch {
    // Warm-up is an optimisation only.
  }
}

// Asks the server-side model whether the finished photo shows glasses, a hat,
// a religious head covering, or a face mask. Resolves to three-state verdicts
// per attribute; never rejects, so a network problem cannot break processing.
export async function detectPhotoAttributes(dataUrl) {
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) {
    return unavailable('no_image');
  }

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch('/api/attributes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dataUrl }),
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => null);

    if (!response.ok || !payload?.available || !payload.attributes) {
      return unavailable(payload?.message || `attribute_service_${response.status}`);
    }

    const attributes = Object.fromEntries(
      ATTRIBUTE_KEYS.map((key) => {
        const entry = payload.attributes[key];
        const state = ['present', 'absent', 'unsure'].includes(entry?.state) ? entry.state : 'unsure';
        return [key, { attribute: key, state, score: Number.isFinite(entry?.score) ? entry.score : null }];
      }),
    );

    return {
      available: true,
      reason: '',
      model: String(payload.model || ''),
      attributes,
    };
  } catch (error) {
    return unavailable(error instanceof Error && error.name === 'AbortError' ? 'timeout' : 'network_error');
  } finally {
    window.clearTimeout(timeoutId);
  }
}
