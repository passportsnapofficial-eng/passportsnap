import {
  proxyBackgroundRemovalRequest,
  readRawRequestBody,
  setBackgroundRemovalCorsHeaders,
} from '../src/lib/backgroundRemoval/backgroundRemovalServerCore.js';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(request, response) {
  setBackgroundRemovalCorsHeaders(response);

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
    const result = await proxyBackgroundRemovalRequest({
      bodyBuffer,
      contentType: request.headers['content-type'] || 'application/octet-stream',
      contentLength: request.headers['content-length'] || bodyBuffer.length,
    });

    response.setHeader('Content-Type', result.contentType);
    response.setHeader('Content-Length', String(result.contentLength));
    response.setHeader('X-Background-Model', result.backgroundModel);
    response.setHeader('X-Background-Mask-Quality', result.maskQuality);
    response.setHeader('X-Background-Transparent-Ratio', result.transparentRatio);
    response.setHeader('X-Background-Foreground-Ratio', result.foregroundRatio);
    response.setHeader('X-Background-Feather-Ratio', result.featherRatio);
    response.status(result.statusCode).send(result.bodyBuffer);
  } catch (error) {
    response.status(error?.statusCode || 502).json({
      message: error instanceof Error ? error.message : 'Background removal failed.',
    });
  }
}
