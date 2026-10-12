import { detectPhotoAttributes, warmAttributeService } from '../src/lib/processing/attributeDetectionServerCore.js';
import { sendError, setApiHeaders } from './_helpers.js';

export default async function handler(request, response) {
  setApiHeaders(response, request, 'GET,POST,OPTIONS');

  if (request.method === 'OPTIONS') {
    response.status(204).end();
    return;
  }

  // GET warms the model function so the verdict after capture does not pay
  // the cold start (model download + load). The app calls this as soon as
  // the customer starts taking a photo.
  if (request.method === 'GET') {
    const host = String(request.headers['x-forwarded-host'] || request.headers.host || '').trim();
    const proto = String(request.headers['x-forwarded-proto'] || 'https').split(',')[0].trim() || 'https';
    try {
      const result = await warmAttributeService({ selfOrigin: host ? `${proto}://${host}` : '' });
      response.status(200).json(result);
    } catch (error) {
      response.status(200).json({ warm: false, message: error?.message || 'warm-up skipped' });
    }
    return;
  }

  if (request.method !== 'POST') {
    response.status(405).json({ message: 'Method not allowed.' });
    return;
  }

  try {
    // The bundled Python model lives in this same deployment; reach it through
    // the host the customer used so production and previews each hit their own.
    const host = String(request.headers['x-forwarded-host'] || request.headers.host || '').trim();
    const proto = String(request.headers['x-forwarded-proto'] || 'https').split(',')[0].trim() || 'https';
    const result = await detectPhotoAttributes({
      dataUrl: request.body?.dataUrl,
      selfOrigin: host ? `${proto}://${host}` : '',
    });
    response.status(200).json(result);
  } catch (error) {
    // 503 is the deliberate "service unavailable" signal the client fails
    // closed on; everything else is a client-side problem with the request.
    if (error?.statusCode === 503) {
      response.status(503).json({ available: false, message: error.message });
      return;
    }
    sendError(response, error, 'Attribute detection failed.');
  }
}
