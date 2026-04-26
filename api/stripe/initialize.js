import { initializeTransaction } from '../../src/lib/payments/stripeServerCore.js';
import { sendError, setApiHeaders } from '../_helpers.js';

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

  try {
    const payload =
      typeof request.body === 'string'
        ? JSON.parse(request.body || '{}')
        : request.body || {};

    const result = await initializeTransaction(payload, {
      originHeader: request.headers.origin || '',
    });

    response.status(200).json(result);
  } catch (error) {
    sendError(response, error, 'Unable to start checkout right now. Please try again.');
  }
}
