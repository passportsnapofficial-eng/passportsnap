import { verifyTransaction } from '../../src/lib/payments/stripeServerCore.js';
import { sendError, setApiHeaders } from '../_helpers.js';

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

  try {
    const result = await verifyTransaction(request.query.sessionId || '');
    response.status(200).json(result);
  } catch (error) {
    sendError(response, error, 'Unable to verify payment right now. Please try again.');
  }
}
