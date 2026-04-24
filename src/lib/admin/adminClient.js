const ADMIN_STORAGE_KEY = 'ps_admin_session';

function parseJsonResponse(response) {
  return response.json().catch(() => ({}));
}

async function requestAdmin(url, options = {}) {
  const response = await fetch(url, options);
  const payload = await parseJsonResponse(response);

  if (!response.ok) {
    throw new Error(payload?.message || 'Unable to complete the admin request.');
  }

  return payload;
}

export function getStoredAdminSession() {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.sessionStorage.getItem(ADMIN_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.token ? parsed : null;
  } catch {
    return null;
  }
}

export function storeAdminSession(session) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(session));
}

export function clearAdminSession() {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(ADMIN_STORAGE_KEY);
}

export async function adminLogin(email, password) {
  const payload = await requestAdmin('/api/admin/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });

  storeAdminSession(payload);
  return payload;
}

export async function fetchAdminOverview(token) {
  return requestAdmin('/api/admin/overview', {
    method: 'GET',
    headers: {
      'x-admin-token': token,
    },
  });
}

export async function saveAdminReviewRequest(token, payload) {
  return requestAdmin('/api/admin/reviews', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-token': token,
    },
    body: JSON.stringify(payload),
  });
}

export async function saveAdminSiteSettings(token, payload) {
  return requestAdmin('/api/admin/settings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-token': token,
    },
    body: JSON.stringify(payload),
  });
}
