import { verifyTransaction } from '../../src/lib/payments/stripeServerCore.js';

function setHeaders(response) {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  response.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  response.setHeader('Content-Type', 'application/json');
}

export default async function handler(request, response) {
  setHeaders(response);

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
    response.status(400).json({
      message: error instanceof Error ? error.message : 'Unexpected server error.',
    });
  }
}
