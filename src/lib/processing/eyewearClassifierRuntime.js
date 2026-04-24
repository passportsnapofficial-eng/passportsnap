import {
  FilesetResolver,
  ImageClassifier,
} from '@mediapipe/tasks-vision';

const WASM_BASE_PATH = '/mediapipe/wasm';
const DEFAULT_MODEL_PATH =
  import.meta.env.VITE_EYEWEAR_CLASSIFIER_MODEL_PATH || '/models/eyewear_classifier.tflite';
const FACE_EXPANSION_RATIO = 0.22;
const FACE_CROP_SIZE = 224;

let classifierPromise = null;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function round(value) {
  return Math.round(value);
}

function normalizeLabel(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_');
}

function isPositiveLabel(label) {
  return [
    'glasses',
    'eyeglasses',
    'with_glasses',
    'wearing_glasses',
    'with_eyeglasses',
    'eyewear',
  ].includes(label);
}

function isNegativeLabel(label) {
  return [
    'no_glasses',
    'without_glasses',
    'no_eyeglasses',
    'without_eyeglasses',
    'no_eyewear',
    'none',
    'bare_face',
  ].includes(label);
}

async function createEyewearClassifier() {
  const response = await fetch(DEFAULT_MODEL_PATH);
  if (!response.ok) {
    return null;
  }

  const modelBuffer = new Uint8Array(await response.arrayBuffer());
  if (!modelBuffer.byteLength) {
    return null;
  }

  const vision = await FilesetResolver.forVisionTasks(WASM_BASE_PATH);
  const classifier = await ImageClassifier.createFromModelBuffer(vision, modelBuffer);

  await classifier.setOptions({
    maxResults: 4,
    runningMode: 'IMAGE',
  });

  return classifier;
}

async function getEyewearClassifier() {
  if (!classifierPromise) {
    classifierPromise = createEyewearClassifier().catch(() => null);
  }

  return classifierPromise;
}

function getExpandedFaceRect(primaryFace, imageWidth, imageHeight) {
  const box = primaryFace?.boundingBox;
  if (!box) {
    return null;
  }

  const expansionX = box.width * FACE_EXPANSION_RATIO;
  const expansionY = box.height * FACE_EXPANSION_RATIO;

  return {
    x: round(clamp(box.x - expansionX, 0, imageWidth - 1)),
    y: round(clamp(box.y - expansionY, 0, imageHeight - 1)),
    width: round(clamp(box.width + expansionX * 2, 1, imageWidth)),
    height: round(clamp(box.height + expansionY * 2, 1, imageHeight)),
  };
}

function createCanvas(width, height) {
  if (typeof OffscreenCanvas === 'function') {
    return new OffscreenCanvas(width, height);
  }

  if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }

  throw new Error('Canvas is unavailable for eyewear classification.');
}

function cropFaceForClassification(sourceCanvas, faceRect) {
  const cropCanvas = createCanvas(FACE_CROP_SIZE, FACE_CROP_SIZE);
  const context = cropCanvas.getContext('2d', { willReadFrequently: false });

  if (!context) {
    throw new Error('Could not create the eyewear classification canvas context.');
  }

  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, FACE_CROP_SIZE, FACE_CROP_SIZE);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(
    sourceCanvas,
    faceRect.x,
    faceRect.y,
    faceRect.width,
    faceRect.height,
    0,
    0,
    FACE_CROP_SIZE,
    FACE_CROP_SIZE,
  );

  return cropCanvas;
}

function parseClassifierCategories(result) {
  const categories = Array.isArray(result?.classifications)
    ? result.classifications.flatMap((classification) => classification?.categories || [])
    : [];
  let positiveCategory = null;
  let negativeCategory = null;

  categories.forEach((category) => {
    const normalized = normalizeLabel(category?.categoryName || category?.displayName || '');
    const score = Number(category?.score || 0);
    const entry = {
      label: normalized,
      rawLabel: String(category?.categoryName || category?.displayName || '').trim(),
      score,
    };

    if (!positiveCategory && isPositiveLabel(normalized)) {
      positiveCategory = entry;
    }

    if (!negativeCategory && isNegativeLabel(normalized)) {
      negativeCategory = entry;
    }
  });

  return {
    positiveCategory,
    negativeCategory,
  };
}

export async function classifyEyewearFromCanvas(sourceCanvas, primaryFace, imageWidth, imageHeight) {
  if (!primaryFace) {
    return {
      supported: false,
      modelReady: false,
      error: 'Primary face unavailable for eyewear classification.',
    };
  }

  const classifier = await getEyewearClassifier();
  if (!classifier) {
    return {
      supported: false,
      modelReady: false,
      error: 'Eyewear classifier model is unavailable.',
    };
  }

  const faceRect = getExpandedFaceRect(primaryFace, imageWidth, imageHeight);
  if (!faceRect) {
    return {
      supported: false,
      modelReady: true,
      error: 'Face crop unavailable for eyewear classification.',
    };
  }

  const faceCanvas = cropFaceForClassification(sourceCanvas, faceRect);
  const result = classifier.classify(faceCanvas);
  const { positiveCategory, negativeCategory } = parseClassifierCategories(result);
  const glassesScore = Number(positiveCategory?.score || 0);
  const noGlassesScore = Number(negativeCategory?.score || 0);

  return {
    supported: true,
    modelReady: true,
    modelPath: DEFAULT_MODEL_PATH,
    glassesLabel: positiveCategory?.rawLabel || positiveCategory?.label || 'glasses',
    noGlassesLabel: negativeCategory?.rawLabel || negativeCategory?.label || 'no_glasses',
    glassesScore,
    noGlassesScore,
    scoreMargin: glassesScore - noGlassesScore,
    classifierDecision:
      glassesScore >= 0.5 &&
      glassesScore >= noGlassesScore,
  };
}
