import { loadImageElement } from './cropUtils';

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function getReviewFrameLayout(imageWidth, imageHeight, targetAspectRatio, adjustments = {}) {
  const imageAspectRatio = imageWidth / imageHeight;
  const scale = clamp(Number(adjustments.scale || adjustments.zoom || 1), 1, 1.8);
  const positionX = clamp(Number(adjustments.positionX || adjustments.offsetX || 0), -1, 1);
  const positionY = clamp(Number(adjustments.positionY || adjustments.offsetY || 0), -1, 1);
  let baseWidthRatio = 1;
  let baseHeightRatio = 1;

  if (imageAspectRatio > targetAspectRatio) {
    baseHeightRatio = targetAspectRatio / imageAspectRatio;
  } else {
    baseWidthRatio = imageAspectRatio / targetAspectRatio;
  }

  const baseLeftRatio = (1 - baseWidthRatio) / 2;
  const baseTopRatio = (1 - baseHeightRatio) / 2;
  const scaledWidthRatio = baseWidthRatio * scale;
  const scaledHeightRatio = baseHeightRatio * scale;
  const maxTranslateXRatio = Math.abs((1 - scaledWidthRatio) / 2);
  const maxTranslateYRatio = Math.abs((1 - scaledHeightRatio) / 2);

  return {
    scale,
    positionX,
    positionY,
    baseWidthRatio,
    baseHeightRatio,
    baseLeftRatio,
    baseTopRatio,
    scaledWidthRatio,
    scaledHeightRatio,
    maxTranslateXRatio,
    maxTranslateYRatio,
    exportLeftRatio: (1 - scaledWidthRatio) / 2 + positionX * maxTranslateXRatio,
    exportTopRatio: (1 - scaledHeightRatio) / 2 + positionY * maxTranslateYRatio,
  };
}

export async function buildReviewedSourcePhoto(sourcePhoto, preset, adjustments = {}) {
  const image = await loadImageElement(sourcePhoto);
  const targetAspectRatio = preset.outputWidth / preset.outputHeight;
  const canvasWidth = Math.max(1600, preset.outputWidth * 3);
  const canvasHeight = Math.max(
    1600,
    Math.round(canvasWidth / targetAspectRatio),
    preset.outputHeight * 3,
  );
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  canvas.width = canvasWidth;
  canvas.height = canvasHeight;

  const layout = getReviewFrameLayout(
    image.naturalWidth || image.width,
    image.naturalHeight || image.height,
    targetAspectRatio,
    adjustments,
  );
  const drawWidth = canvas.width * layout.scaledWidthRatio;
  const drawHeight = canvas.height * layout.scaledHeightRatio;
  const drawX = canvas.width * layout.exportLeftRatio;
  const drawY = canvas.height * layout.exportTopRatio;

  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(image, drawX, drawY, drawWidth, drawHeight);

  // Keep the reviewed handoff lossless so the validator does not re-score a compressed preview.
  return canvas.toDataURL('image/png');
}
