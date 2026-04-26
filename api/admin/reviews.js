import {
  isValidAdminToken,
  upsertAdminReviewRequest,
} from '../../src/lib/admin/adminServerCore.js';
import { getAdminTokenFromRequest, sendError, setApiHeaders } from '../_helpers.js';

export default async function handler(request, response) {
  setApiHeaders(response, request, 'POST,OPTIONS');

  if (request.method === 'OPTIONS') {
    response.status(204).end();
    return;
  }

  if (request.method !== 'POST') {
    response.status(405).json({ message: 'Method not allowed.' });
    return;
  }

  if (!isValidAdminToken(getAdminTokenFromRequest(request))) {
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
    sendError(response, error, 'Unable to update the review queue right now.');
  }
}
