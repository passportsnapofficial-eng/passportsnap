import { getAdminOverview, isValidAdminToken } from '../../src/lib/admin/adminServerCore.js';
import { getAdminTokenFromRequest, sendError, setApiHeaders } from '../_helpers.js';

export default async function handler(request, response) {
  setApiHeaders(response, request, 'GET,OPTIONS');

  if (request.method === 'OPTIONS') {
    response.status(204).end();
    return;
  }

  if (request.method !== 'GET') {
    response.status(405).json({ message: 'Method not allowed.' });
    return;
  }

  if (!isValidAdminToken(getAdminTokenFromRequest(request))) {
    response.status(401).json({ message: 'Admin access denied.' });
    return;
  }

  try {
    const result = await getAdminOverview();
    response.status(200).json(result);
  } catch (error) {
    sendError(response, error, 'Unable to load the admin overview right now.');
  }
}
