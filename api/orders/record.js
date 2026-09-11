import { upsertAdminOrderRecord } from '../../src/lib/admin/adminServerCore.js';
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
    const record = await upsertAdminOrderRecord(request.body || {});
    // Acknowledge only. The normalized record carries the archived images, and
    // echoing those back would return megabytes the client already has.
    response.status(200).json({
      ok: true,
      id: record.id,
      paymentReference: record.paymentReference,
    });
  } catch (error) {
    sendError(response, error, 'Unable to record this order for admin review.');
  }
}
