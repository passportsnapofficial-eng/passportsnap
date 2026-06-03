import { canvasToBlob, loadImageElement } from './cropUtils';
import { removeBackgroundForPassportExport } from './backgroundRemovalClient';
import { enhanceFinishedPassportPhoto } from './imageEnhancementClient';
import { removeBackgroundWithSegmentationBackup } from '../backgroundRemoval/backups/localSegmentationFallback';
import {
  detectPassportFaces,
  segmentPassportSubject,
} from './mediapipeVision';
import { runPassportValidationWorker } from './passportValidationWorkerClient';

// Delivered at 1200px (600 DPI for a 2x2in photo) so the final image keeps
// detail from high-res uploads instead of being capped at the 600px minimum.
const STANDARD_EXPORT_SIZE = 1200;
const MIN_FILE_SIZE_BYTES = 54 * 1024;
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const TARGET_HEAD_RATIO = 0.58;
const MIN_HEAD_RATIO = 0.49;
const MAX_HEAD_RATIO = 0.69;
const REMOVE_BG_MODEL = 'remove_bg_api';
const DEFAULT_IMAGE_ENHANCEMENT_MODEL = 'realesr-general-x4v3';
const DEFAULT_IMAGE_ENHANCEMENT_OUTSCALE = 2;
const DEFAULT_IMAGE_ENHANCEMENT_DENOISE_STRENGTH = 0.5;

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

function createImageEnhancementState(model, outscale, denoiseStrength) {
  return {
    attempted: false,
    applied: false,
    error: '',
    model,
    outscale,
    denoiseStrength,
    targetWidth: STANDARD_EXPORT_SIZE,
    targetHeight: STANDARD_EXPORT_SIZE,
  };
}

function normalizePositiveNumber(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
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

async function normalizeDownloadExport(exported, options = {}) {
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

  let imageEnhancement = createImageEnhancementState(
    options.imageEnhancementModel || DEFAULT_IMAGE_ENHANCEMENT_MODEL,
    normalizePositiveNumber(
      options.imageEnhancementOutscale,
      DEFAULT_IMAGE_ENHANCEMENT_OUTSCALE,
    ),
    normalizePositiveNumber(
      options.imageEnhancementDenoiseStrength,
      DEFAULT_IMAGE_ENHANCEMENT_DENOISE_STRENGTH,
    ),
  );

  if (options.imageEnhancementEnabled !== false) {
    imageEnhancement.attempted = true;
    await options.reportStage?.('enhance-photo');

    try {
      const enhancementInputBlob = await canvasToBlob(canvas, 'image/jpeg', 0.98);
      if (!enhancementInputBlob) {
        throw new Error('Could not prepare the finished photo for enhancement.');
      }

      const enhancementInputDataUrl = await readBlobAsDataUrl(enhancementInputBlob);
      const enhanced = await enhanceFinishedPassportPhoto(enhancementInputDataUrl, {
        model: imageEnhancement.model,
        outscale: imageEnhancement.outscale,
        denoiseStrength: imageEnhancement.denoiseStrength,
        targetWidth: canvas.width,
        targetHeight: canvas.height,
      });

      if (enhanced?.applied && isUsableImageSource(enhanced.dataUrl)) {
        const enhancedImage = await loadImageElement(enhanced.dataUrl);
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = 'high';
        context.drawImage(enhancedImage, 0, 0, canvas.width, canvas.height);
        imageEnhancement = {
          ...imageEnhancement,
          ...enhanced,
          applied: true,
          targetWidth: canvas.width,
          targetHeight: canvas.height,
        };
      }
    } catch (error) {
      imageEnhancement = {
        ...imageEnhancement,
        applied: false,
        error:
          error instanceof Error && error.message
            ? error.message
            : 'Image enhancement could not be completed. The current export was kept.',
      };
    }
  }

  const blob = await encodeDownloadBlob(canvas);
  const dataUrl = await readBlobAsDataUrl(blob);

  return {
    ...exported,
    blob,
    dataUrl,
    outputWidth: STANDARD_EXPORT_SIZE,
    outputHeight: STANDARD_EXPORT_SIZE,
    targetAspectRatio: 1,
    enhancement: imageEnhancement,
    analysis: {
      ...exported.analysis,
      technical: {
        ...exported.analysis.technical,
        outputWidth: STANDARD_EXPORT_SIZE,
        outputHeight: STANDARD_EXPORT_SIZE,
        outputAspectRatio: 1,
        normalizedForDownload: true,
        imageEnhancementAttempted: Boolean(imageEnhancement.attempted),
        imageEnhanced: Boolean(imageEnhancement.applied),
        imageEnhancementModel: imageEnhancement.model || null,
        imageEnhancementScale: Number(imageEnhancement.outscale || 0),
        imageEnhancementDenoiseStrength: Number(imageEnhancement.denoiseStrength || 0),
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
  imageEnhancementOptions,
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

  return normalizeDownloadExport(exported, {
    reportStage,
    ...imageEnhancementOptions,
  });
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
    REMOVE_BG_MODEL;
  const imageEnhancementEnabled = options.imageEnhancementEnabled ?? (
    import.meta.env.VITE_IMAGE_ENHANCEMENT_ENABLED !== 'false'
  );
  const imageEnhancementOptions = {
    imageEnhancementEnabled,
    imageEnhancementModel:
      options.imageEnhancementModel ||
      import.meta.env.VITE_IMAGE_ENHANCEMENT_MODEL ||
      DEFAULT_IMAGE_ENHANCEMENT_MODEL,
    imageEnhancementOutscale: normalizePositiveNumber(
      options.imageEnhancementOutscale ||
      import.meta.env.VITE_IMAGE_ENHANCEMENT_SCALE,
      DEFAULT_IMAGE_ENHANCEMENT_OUTSCALE,
    ),
    imageEnhancementDenoiseStrength: normalizePositiveNumber(
      options.imageEnhancementDenoiseStrength ||
      import.meta.env.VITE_IMAGE_ENHANCEMENT_DENOISE,
      DEFAULT_IMAGE_ENHANCEMENT_DENOISE_STRENGTH,
    ),
  };
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
        applied: Boolean(
          removedBackground?.applied &&
          isUsableImageSource(removedBackground?.dataUrl)
        ),
      };
    } catch {
      try {
        const fallbackBackgroundRemoval = await removeBackgroundWithSegmentationBackup(image, segmentation);

        backgroundRemoval = {
          ...backgroundRemoval,
          ...fallbackBackgroundRemoval,
          applied: Boolean(
            fallbackBackgroundRemoval?.applied &&
            isUsableImageSource(fallbackBackgroundRemoval?.dataUrl)
          ),
          fallbackUsed: true,
          error: 'Automatic background cleanup needed a local fallback for this photo.',
        };
      } catch {
        backgroundRemoval = {
          ...backgroundRemoval,
          applied: false,
          fallbackUsed: false,
          error: 'Automatic background cleanup could not finish. The original background was kept.',
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
      imageEnhancementOptions,
    });
  } catch (error) {
    if (preferredExportSource !== source) {
      backgroundRemoval = {
        ...backgroundRemoval,
        applied: false,
        fallbackUsed: true,
        error: 'Automatic background cleanup could not be verified, so the original background was kept.',
      };
      normalizedExport = await validateAndExportImage({
        source,
        exportSource: source,
        preset,
        faceDetection,
        segmentation,
        backgroundRemoval,
        respectSourceFraming,
        reportStage,
        imageEnhancementOptions,
      });
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
