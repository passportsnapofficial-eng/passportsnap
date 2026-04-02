import {
  analyzeFrame,
  canvasToBlob,
  getCenteredPassportCrop,
  loadImageElement,
} from './cropUtils';

export async function exportPassportImage(source, preset) {
  const image = await loadImageElement(source);
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;
  const targetAspectRatio = preset.outputWidth / preset.outputHeight;
  const crop = getCenteredPassportCrop(sourceWidth, sourceHeight, targetAspectRatio);

  const analysisCanvas = document.createElement('canvas');
  analysisCanvas.width = 120;
  analysisCanvas.height = Math.max(120, Math.round(120 / targetAspectRatio));
  const analysisContext = analysisCanvas.getContext('2d');
  analysisContext.drawImage(
    image,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    analysisCanvas.width,
    analysisCanvas.height,
  );

  const analysis = analyzeFrame(
    analysisContext,
    analysisCanvas.width,
    analysisCanvas.height,
  );

  const canvas = document.createElement('canvas');
  canvas.width = preset.outputWidth;
  canvas.height = preset.outputHeight;
  const context = canvas.getContext('2d');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.filter = 'contrast(1.02) saturate(0.98) brightness(1.02)';
  context.drawImage(
    image,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    canvas.width,
    canvas.height,
  );

  const edgeGlow = context.createRadialGradient(
    canvas.width / 2,
    canvas.height / 2,
    canvas.width * 0.24,
    canvas.width / 2,
    canvas.height / 2,
    canvas.width * 0.72,
  );
  edgeGlow.addColorStop(0, 'rgba(255,255,255,0)');
  edgeGlow.addColorStop(1, 'rgba(255,255,255,0.1)');
  context.fillStyle = edgeGlow;
  context.fillRect(0, 0, canvas.width, canvas.height);

  const blob = await canvasToBlob(canvas);

  return {
    dataUrl: canvas.toDataURL('image/jpeg', 0.92),
    blob,
    outputWidth: canvas.width,
    outputHeight: canvas.height,
    targetAspectRatio,
    sourceWidth,
    sourceHeight,
    crop,
    analysis,
  };
}
