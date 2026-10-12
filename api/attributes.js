import { detectPhotoAttributes } from '../src/lib/processing/attributeDetectionServerCore.js';
import { sendError, setApiHeaders } from './_helpers.js';

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
    const result = await detectPhotoAttributes({ dataUrl: request.body?.dataUrl });
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
