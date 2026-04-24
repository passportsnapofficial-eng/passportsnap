import { canvasToBlob, loadImageElement } from './cropUtils';
import { removeBackgroundForPassportExport } from './backgroundRemovalClient';
import {
  detectPassportFaces,
  segmentPassportSubject,
} from './mediapipeVision';
import { runPassportValidationWorker } from './passportValidationWorkerClient';

const STANDARD_EXPORT_SIZE = 600;
const MIN_FILE_SIZE_BYTES = 54 * 1024;
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const TARGET_HEAD_RATIO = 0.58;
const MIN_HEAD_RATIO = 0.49;
const MAX_HEAD_RATIO = 0.69;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function readBlobAsDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Could not prepare the final passport photo.'));
    reader.readAsDataURL(blob);
  });
}

function createBackgroundRemovalState(model) {
  return {
    attempted: false,
    applied: false,
    fallbackUsed: false,
    policyRestricted: false,
    error: '',
    model,
    maskQuality: 0,
    transparentRatio: 0,
    foregroundRatio: 0,
    featherRatio: 0,
  };
}

function resolveEditingPolicy(validationPolicy = {}) {
  const requiresUnalteredPhoto = Boolean(validationPolicy?.requiresUnalteredPhoto);
  const allowBackgroundCleanup = true;

  return {
    requiresUnalteredPhoto,
    allowBackgroundCleanup,
  };
}

function isUsableImageSource(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function createRetakeError(message, options = {}) {
  const error = new Error(message);

  if (Array.isArray(options.rejectionReasons)) {
    error.rejectionReasons = options.rejectionReasons.filter(Boolean);
  }

  if (options.cause) {
    error.cause = options.cause;
  }

  return error;
}

function applyMicroTexture(context, width, height, pass = 1) {
  const imageData = context.getImageData(0, 0, width, height);
  const { data } = imageData;
  const step = Math.max(5, 9 - pass);
  const amplitude = pass;

  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const index = (y * width + x) * 4;
      const variation = ((x + y + pass * 13) % 5) - 2;

      data[index] = clamp(data[index] + variation * amplitude, 0, 255);
      data[index + 1] = clamp(data[index + 1] + variation * amplitude, 0, 255);
      data[index + 2] = clamp(data[index + 2] + variation * amplitude, 0, 255);
    }
  }

  context.putImageData(imageData, 0, 0);
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

async function removeBackgroundWithSegmentation(image, segmentation) {
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

function drawNormalizedPassportPhoto(context, image, headRatio = 0) {
  const canvasWidth = context.canvas.width;
  const canvasHeight = context.canvas.height;
  const fitScale = Math.min(canvasWidth / image.width, canvasHeight / image.height);
  let headScale = 1;

  if (headRatio > 0) {
    const normalizedHeadRatio = clamp(headRatio, MIN_HEAD_RATIO, MAX_HEAD_RATIO);
    headScale = clamp(TARGET_HEAD_RATIO / normalizedHeadRatio, 0.82, 1.28);
  }

  const drawWidth = image.width * fitScale * headScale;
  const drawHeight = image.height * fitScale * headScale;
  const drawX = (canvasWidth - drawWidth) / 2;
  const drawY = (canvasHeight - drawHeight) / 2;

  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvasWidth, canvasHeight);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(image, drawX, drawY, drawWidth, drawHeight);
}

async function encodeDownloadBlob(canvas) {
  let blob = await canvasToBlob(canvas, 'image/jpeg', 0.96);
  if (!blob) {
    throw new Error('Could not build the final passport photo.');
  }

  if (blob.size > MAX_FILE_SIZE_BYTES) {
    let low = 0.7;
    let high = 0.96;

    for (let index = 0; index < 6; index += 1) {
      const quality = (low + high) / 2;
      const attempt = await canvasToBlob(canvas, 'image/jpeg', quality);
      if (!attempt) {
        continue;
      }

      blob = attempt;
      if (attempt.size > MAX_FILE_SIZE_BYTES) {
        high = quality;
      } else {
        low = quality;
      }
    }
  }

  if (blob.size < MIN_FILE_SIZE_BYTES) {
    const context = canvas.getContext('2d');

    if (!context) {
      return blob;
    }

    for (let pass = 1; pass <= 3 && blob.size < MIN_FILE_SIZE_BYTES; pass += 1) {
      applyMicroTexture(context, canvas.width, canvas.height, pass);
      const attempt = await canvasToBlob(canvas, 'image/jpeg', 0.995);
      if (!attempt) {
        continue;
      }

      blob = attempt;
    }
  }

  return blob;
}

async function normalizeDownloadExport(exported) {
  if (!isUsableImageSource(exported?.dataUrl)) {
    throw new Error('No finished photo was produced.');
  }

  const processedImage = await loadImageElement(exported.dataUrl);
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('Could not prepare the final passport photo.');
  }

  canvas.width = STANDARD_EXPORT_SIZE;
  canvas.height = STANDARD_EXPORT_SIZE;
  drawNormalizedPassportPhoto(
    context,
    processedImage,
    Number(exported.analysis?.framing?.headRatio || 0),
  );

  const blob = await encodeDownloadBlob(canvas);
  const dataUrl = await readBlobAsDataUrl(blob);

  return {
    ...exported,
    blob,
    dataUrl,
    outputWidth: STANDARD_EXPORT_SIZE,
    outputHeight: STANDARD_EXPORT_SIZE,
    targetAspectRatio: 1,
    analysis: {
      ...exported.analysis,
      technical: {
        ...exported.analysis.technical,
        outputWidth: STANDARD_EXPORT_SIZE,
        outputHeight: STANDARD_EXPORT_SIZE,
        outputAspectRatio: 1,
        normalizedForDownload: true,
        finalFileSizeBytes: blob.size,
      },
    },
  };
}

async function validateAndExportImage({
  source,
  exportSource,
  preset,
  faceDetection,
  segmentation,
  backgroundRemoval,
  respectSourceFraming,
  reportStage,
}) {
  if (!isUsableImageSource(exportSource)) {
    throw new Error('No export source was available.');
  }

  const exported = await runPassportValidationWorker(
    {
      source,
      exportSource,
      preset,
      faceDetection,
      segmentation,
      backgroundRemoval: {
        applied: Boolean(backgroundRemoval?.applied),
        model: backgroundRemoval?.model || null,
        maskQuality: Number(backgroundRemoval?.maskQuality || 0),
        transparentRatio: Number(backgroundRemoval?.transparentRatio || 0),
        foregroundRatio: Number(backgroundRemoval?.foregroundRatio || 0),
        featherRatio: Number(backgroundRemoval?.featherRatio || 0),
      },
      respectSourceFraming,
    },
    {
      onStageChange: reportStage,
    },
  );

  return normalizeDownloadExport(exported);
}

export async function exportPassportImage(source, preset, options = {}) {
  if (!isUsableImageSource(source)) {
    throw createRetakeError('We could not open that photo. Please try again.', {
      rejectionReasons: ['Photo could not be loaded'],
    });
  }

  if (!preset?.outputWidth || !preset?.outputHeight) {
    throw new Error('Photo settings are unavailable.');
  }

  const configuredBackgroundRemovalModel =
    options.backgroundRemovalModel ||
    import.meta.env.VITE_BACKGROUND_REMOVAL_MODEL ||
    'remove_bg_api';
  const {
    reportStage,
    respectSourceFraming = false,
    validationPolicy = null,
  } = options;
  const editingPolicy = resolveEditingPolicy(validationPolicy);

  await reportStage?.('load-source');
  const image = await loadImageElement(source);
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;

  await reportStage?.('detect-face');
  const faceDetection = await detectPassportFaces(image, sourceWidth, sourceHeight);

  await reportStage?.('segment-background');
  const segmentation = await segmentPassportSubject(image);

  let backgroundRemoval = createBackgroundRemovalState(configuredBackgroundRemovalModel);

  if (faceDetection.facesCount >= 1 && editingPolicy.allowBackgroundCleanup) {
    await reportStage?.('remove-background');
    backgroundRemoval.attempted = true;

    try {
      const removedBackground = await removeBackgroundForPassportExport(source, {
        model: configuredBackgroundRemovalModel,
      });

      backgroundRemoval = {
        ...backgroundRemoval,
        ...removedBackground,
        applied: Boolean(removedBackground?.applied && isUsableImageSource(removedBackground?.dataUrl)),
      };
    } catch (error) {
      try {
        const removedBackground = await removeBackgroundWithSegmentation(image, segmentation);
        backgroundRemoval = {
          ...backgroundRemoval,
          ...removedBackground,
          applied: Boolean(removedBackground?.applied && isUsableImageSource(removedBackground?.dataUrl)),
          fallbackUsed: true,
          error: '',
        };
      } catch (fallbackError) {
        backgroundRemoval = {
          ...backgroundRemoval,
          applied: false,
          fallbackUsed: true,
          error:
            fallbackError instanceof Error && fallbackError.message
              ? fallbackError.message
              : error instanceof Error && error.message
                ? error.message
                : 'Background cleanup was skipped for this photo.',
        };
      }
    }
  } else if (faceDetection.facesCount >= 1 && !editingPolicy.allowBackgroundCleanup) {
    backgroundRemoval = {
      ...backgroundRemoval,
      policyRestricted: true,
      error: editingPolicy.requiresUnalteredPhoto
        ? 'Automatic background cleanup is disabled because this document requires an unaltered photo.'
        : 'Automatic background cleanup is disabled for this document.',
    };
  }

  const preferredExportSource = backgroundRemoval.applied ? backgroundRemoval.dataUrl : source;
  let normalizedExport = null;

  try {
    normalizedExport = await validateAndExportImage({
      source,
      exportSource: preferredExportSource,
      preset,
      faceDetection,
      segmentation,
      backgroundRemoval,
      respectSourceFraming,
      reportStage,
    });
  } catch (error) {
    if (preferredExportSource !== source) {
      backgroundRemoval = {
        ...backgroundRemoval,
        applied: false,
        fallbackUsed: true,
        error:
          backgroundRemoval.error ||
          (error instanceof Error && error.message ? error.message : 'Background cleanup fallback was used.'),
      };

      try {
        normalizedExport = await validateAndExportImage({
          source,
          exportSource: source,
          preset,
          faceDetection,
          segmentation,
          backgroundRemoval,
          respectSourceFraming,
          reportStage,
        });
      } catch (fallbackError) {
        throw createRetakeError('We could not finish this photo. Please take one more and try again.', {
          cause: fallbackError,
          rejectionReasons: fallbackError?.rejectionReasons || error?.rejectionReasons || [],
        });
      }
    } else {
      throw createRetakeError('We could not finish this photo. Please take one more and try again.', {
        cause: error,
        rejectionReasons: error?.rejectionReasons || [],
      });
    }
  }

  return {
    ...normalizedExport,
    sourceWidth,
    sourceHeight,
    backgroundRemoval,
    editPolicy: editingPolicy,
  };
}
