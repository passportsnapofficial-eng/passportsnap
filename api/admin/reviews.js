import {
  isValidAdminToken,
  upsertAdminReviewRequest,
} from '../../src/lib/admin/adminServerCore.js';

function setHeaders(response) {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-admin-token');
  response.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  response.setHeader('Content-Type', 'application/json');
}

function getAdminToken(request) {
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

export default async function handler(request, response) {
  setHeaders(response);

  if (request.method === 'OPTIONS') {
    response.status(204).end();
    return;
  }

  if (request.method !== 'POST') {
    response.status(405).json({ message: 'Method not allowed.' });
    return;
  }

  if (!isValidAdminToken(getAdminToken(request))) {
    response.status(401).json({ message: 'Admin access denied.' });
    return;
  }

  try {
    const payload =
      typeof request.body === 'string'
        ? JSON.parse(request.body || '{}')
        : request.body || {};

    const result = await upsertAdminReviewRequest(payload);
    response.status(200).json(result);
  } catch (error) {
    response.status(400).json({
      message: error instanceof Error ? error.message : 'Unexpected server error.',
    });
  }
}
