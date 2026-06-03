import {
  proxyImageEnhancementRequest,
  readRawRequestBody,
} from '../src/lib/processing/imageEnhancementServerCore.js';
import { sendError, setApiHeaders } from './_helpers.js';

export const config = {
  api: {
    bodyParser: false,
  },
};

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
    const bodyBuffer = await readRawRequestBody(request);
    const result = await proxyImageEnhancementRequest({
      bodyBuffer,
      contentType: request.headers['content-type'] || 'application/octet-stream',
    });

    response.setHeader('Content-Type', result.contentType);
    response.setHeader('Content-Length', String(result.contentLength));
    response.setHeader('X-Enhancement-Model', result.enhancementModel);
    response.setHeader('X-Enhancement-Scale', result.enhancementScale);
    response.setHeader('X-Enhancement-Target-Width', result.enhancementTargetWidth);
    response.setHeader('X-Enhancement-Target-Height', result.enhancementTargetHeight);
    response.status(result.statusCode).send(result.bodyBuffer);
  } catch (error) {
    sendError(response, error, 'Image enhancement failed. Please try again.');
  }
}
