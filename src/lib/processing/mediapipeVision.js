import {
  FaceLandmarker,
  FilesetResolver,
  ImageSegmenter,
} from '@mediapipe/tasks-vision';
import {
  buildFaceDetection,
  createFaceDetectionError,
} from './faceDetection';

const WASM_BASE_PATH = '/mediapipe/wasm';
const FACE_LANDMARKER_MODEL_PATH = '/models/face_landmarker.task';
const SELFIE_SEGMENTER_MODEL_PATH = '/models/selfie_segmenter.tflite';
const MEDIAPIPE_NOISE_PATTERNS = [
  /gl_context\.cc/i,
  /OpenGL error checking is disabled/i,
  /Graph successfully started running/i,
  /FaceBlendshapesGraph acceleration to xnnpack/i,
  /TensorFlow Lite XNNPACK delegate/i,
  /Feedback manager requires a model with a single signature inference/i,
  /segmentation_postprocessor_gl\.cc/i,
  /wasm streaming compile failed/i,
  /falling back to ArrayBuffer instantiation/i,
  /failed to asynchronously prepare wasm/i,
  /both async and sync fetching of the wasm failed/i,
];

let tasksPromise = null;
let mediaPipeConsoleFilterInstalled = false;

function shouldSuppressMediaPipeLog(args) {
  const message = args
    .map((value) => {
      if (typeof value === 'string') return value;
      if (value instanceof Error) return value.message;
      return '';
    })
    .join(' ');

  return MEDIAPIPE_NOISE_PATTERNS.some((pattern) => pattern.test(message));
}

function installMediaPipeConsoleFilter() {
  if (mediaPipeConsoleFilterInstalled || typeof window === 'undefined') {
    return;
  }

  ['log', 'info', 'warn', 'debug', 'error'].forEach((method) => {
    const original = console[method];
    if (typeof original !== 'function') {
      return;
    }

    console[method] = (...args) => {
      if (shouldSuppressMediaPipeLog(args)) {
        return;
      }

      original.apply(console, args);
    };
  });

  mediaPipeConsoleFilterInstalled = true;
}

async function createPassportVisionTasks() {
  installMediaPipeConsoleFilter();
  const vision = await FilesetResolver.forVisionTasks(WASM_BASE_PATH);
  const [faceLandmarker, imageSegmenter] = await Promise.all([
    FaceLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: FACE_LANDMARKER_MODEL_PATH,
        delegate: 'CPU',
      },
      runningMode: 'IMAGE',
      numFaces: 5,
      minFaceDetectionConfidence: 0.6,
      minFacePresenceConfidence: 0.6,
      minTrackingConfidence: 0.5,
      outputFaceBlendshapes: true,
      outputFacialTransformationMatrixes: false,
    }),
    ImageSegmenter.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: SELFIE_SEGMENTER_MODEL_PATH,
        delegate: 'CPU',
      },
      runningMode: 'IMAGE',
      outputConfidenceMasks: false,
      outputCategoryMask: true,
    }),
  ]);

  return {
    faceLandmarker,
    imageSegmenter,
  };
}

async function getPassportVisionTasks() {
  if (!tasksPromise) {
    tasksPromise = createPassportVisionTasks().catch((error) => {
      tasksPromise = null;
      throw error;
    });
  }

  return tasksPromise;
}

export async function detectPassportFaces(image, frameWidth, frameHeight) {
  try {
    const { faceLandmarker } = await getPassportVisionTasks();
    const result = faceLandmarker.detect(image);
    return buildFaceDetection(result, frameWidth, frameHeight);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Face detection could not initialize.';
    return createFaceDetectionError(frameWidth, frameHeight, message);
  }
}

function normalizeSegmentationLabels(labels = []) {
  if (!Array.isArray(labels)) {
    return [];
  }

  return labels.map((label) => String(label || '').trim().toLowerCase());
}

function getForegroundIndexes(labels) {
  if (!labels.length) {
    return [1];
  }

  // MediaPipe's selfie segmenter can expose a single "selfie" label while the
  // category mask itself is still binary. In practice this model encodes the
  // subject as 0 and the background as 255, so the foreground is not the
  // usual class index 1.
  if (labels.length === 1) {
    return [0];
  }

  const backgroundIndex = Math.max(
    0,
    labels.findIndex((label) => label.includes('background')),
  );

  const indexes = labels
    .map((label, index) => ({ label, index }))
    .filter(({ index }) => index !== backgroundIndex)
    .map(({ index }) => index);

  return indexes.length ? indexes : [1];
}

export async function segmentPassportSubject(image) {
  try {
    const { imageSegmenter } = await getPassportVisionTasks();
    const result = imageSegmenter.segment(image);
    const categoryMask = result.categoryMask;
    const labels = normalizeSegmentationLabels(imageSegmenter.getLabels?.() || []);

    if (!categoryMask) {
      result.close();
      return {
        supported: true,
        error: 'The segmentation model returned no category mask.',
        labels,
        foregroundIndexes: getForegroundIndexes(labels),
        categoryMask: null,
      };
    }

    const serialized = {
      supported: true,
      error: null,
      labels,
      foregroundIndexes: getForegroundIndexes(labels),
      categoryMask: {
        width: categoryMask.width,
        height: categoryMask.height,
        data: new Uint8Array(categoryMask.getAsUint8Array()),
      },
    };

    result.close();
    return serialized;
  } catch (error) {
    return {
      supported: true,
      error: error instanceof Error ? error.message : 'Image segmentation could not initialize.',
      labels: [],
      foregroundIndexes: [1],
      categoryMask: null,
    };
  }
}
