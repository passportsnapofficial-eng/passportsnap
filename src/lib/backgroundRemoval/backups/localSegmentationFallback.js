import { canvasToBlob } from '../../processing/cropUtils';

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function readBlobAsDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Could not prepare the fallback photo.'));
    reader.readAsDataURL(blob);
  });
}

function createSegmentationMaskCanvas(segmentation, targetWidth, targetHeight) {
  if (!segmentation?.categoryMask?.data) {
    return null;
  }

  const { data, width, height } = segmentation.categoryMask;
  const foregroundIndexes = Array.isArray(segmentation.foregroundIndexes) && segmentation.foregroundIndexes.length
    ? segmentation.foregroundIndexes
    : [1];
  const foregroundLookup = new Set(foregroundIndexes.map((value) => Number(value)));
  const sourceCanvas = document.createElement('canvas');
  const sourceContext = sourceCanvas.getContext('2d');

  if (!sourceContext) {
    return null;
  }

  sourceCanvas.width = width;
  sourceCanvas.height = height;
  const imageData = sourceContext.createImageData(width, height);
  let foregroundPixels = 0;

  for (let index = 0; index < data.length; index += 1) {
    const isForeground = foregroundLookup.has(data[index]);
    const offset = index * 4;

    imageData.data[offset] = 255;
    imageData.data[offset + 1] = 255;
    imageData.data[offset + 2] = 255;
    imageData.data[offset + 3] = isForeground ? 255 : 0;

    if (isForeground) {
      foregroundPixels += 1;
    }
  }

  sourceContext.putImageData(imageData, 0, 0);

  const scaledCanvas = document.createElement('canvas');
  const scaledContext = scaledCanvas.getContext('2d');

  if (!scaledContext) {
    return null;
  }

  scaledCanvas.width = targetWidth;
  scaledCanvas.height = targetHeight;
  scaledContext.clearRect(0, 0, targetWidth, targetHeight);
  scaledContext.imageSmoothingEnabled = true;
  scaledContext.imageSmoothingQuality = 'high';
  scaledContext.drawImage(sourceCanvas, 0, 0, targetWidth, targetHeight);

  return {
    canvas: scaledCanvas,
    foregroundRatio: data.length ? foregroundPixels / data.length : 0,
  };
}

export async function removeBackgroundWithSegmentationBackup(image, segmentation) {
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  const mask = createSegmentationMaskCanvas(segmentation, width, height);

  if (!mask?.canvas) {
    throw new Error('No usable segmentation mask was available for local background cleanup.');
  }

  const subjectCanvas = document.createElement('canvas');
  const subjectContext = subjectCanvas.getContext('2d');

  if (!subjectContext) {
    throw new Error('Could not prepare the local background cleanup canvas.');
  }

  subjectCanvas.width = width;
  subjectCanvas.height = height;
  subjectContext.imageSmoothingEnabled = true;
  subjectContext.imageSmoothingQuality = 'high';
  subjectContext.drawImage(image, 0, 0, width, height);
  subjectContext.globalCompositeOperation = 'destination-in';
  subjectContext.drawImage(mask.canvas, 0, 0, width, height);
  subjectContext.globalCompositeOperation = 'source-over';

  const outputCanvas = document.createElement('canvas');
  const outputContext = outputCanvas.getContext('2d');

  if (!outputContext) {
    throw new Error('Could not prepare the local background cleanup output.');
  }

  outputCanvas.width = width;
  outputCanvas.height = height;
  outputContext.fillStyle = '#ffffff';
  outputContext.fillRect(0, 0, width, height);
  outputContext.imageSmoothingEnabled = true;
  outputContext.imageSmoothingQuality = 'high';
  outputContext.drawImage(subjectCanvas, 0, 0, width, height);

  const blob = await canvasToBlob(outputCanvas, 'image/jpeg', 0.96);
  if (!blob) {
    throw new Error('Local background cleanup did not return a usable photo.');
  }

  return {
    applied: true,
    dataUrl: await readBlobAsDataUrl(blob),
    blob,
    mimeType: blob.type || 'image/jpeg',
    model: 'mediapipe_selfie_segmenter',
    maskQuality: clamp(mask.foregroundRatio / 0.62, 0.2, 0.95),
    transparentRatio: clamp(1 - mask.foregroundRatio, 0, 1),
    foregroundRatio: clamp(mask.foregroundRatio, 0, 1),
    featherRatio: 0,
  };
}
