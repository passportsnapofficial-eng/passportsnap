import { sendOrderDeliveryEmail } from '../../src/lib/email/orderDeliveryCore.js';
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
    const result = await sendOrderDeliveryEmail(request.body || {});
    response.status(200).json(result);
  } catch (error) {
    sendError(response, error, 'Unable to send the finished photo email.');
  }
}
