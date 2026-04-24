function distance(firstPoint, secondPoint) {
  return Math.hypot(secondPoint.x - firstPoint.x, secondPoint.y - firstPoint.y);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

const HEAD_RATIO_ADJUSTMENT = 1.08;
const HEAD_RATIO_TARGET_MIN = 0.5;
const HEAD_RATIO_TARGET_MAX = 0.74;

function averagePoints(points) {
  if (!points.length) {
    return { x: 0, y: 0 };
  }

  const total = points.reduce(
    (sum, point) => ({
      x: sum.x + point.x,
      y: sum.y + point.y,
    }),
    { x: 0, y: 0 },
  );

  return {
    x: total.x / points.length,
    y: total.y / points.length,
  };
}

function toPixelPoint(landmark, frameWidth, frameHeight) {
  return {
    x: Number(landmark?.x || 0) * frameWidth,
    y: Number(landmark?.y || 0) * frameHeight,
    z: Number(landmark?.z || 0),
  };
}

function getPoint(points, index) {
  return points[index] || { x: 0, y: 0, z: 0 };
}

function getBounds(points) {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  points.forEach((point) => {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  });

  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
    return {
      x: 0,
      y: 0,
      width: 0,
      height: 0,
    };
  }

  return {
    x: minX,
    y: minY,
    width: Math.max(maxX - minX, 0),
    height: Math.max(maxY - minY, 0),
  };
}

function getBlendshapeMap(classification = null) {
  const categories = classification?.categories || [];

  return categories.reduce((scores, category) => {
    if (!category?.categoryName) {
      return scores;
    }

    scores[category.categoryName] = Number(category.score || 0);
    return scores;
  }, {});
}

function getEyeAspectRatio(points, indexes) {
  const [outerIndex, upperLeftIndex, upperRightIndex, innerIndex, lowerRightIndex, lowerLeftIndex] = indexes;
  const outer = getPoint(points, outerIndex);
  const upperLeft = getPoint(points, upperLeftIndex);
  const upperRight = getPoint(points, upperRightIndex);
  const inner = getPoint(points, innerIndex);
  const lowerRight = getPoint(points, lowerRightIndex);
  const lowerLeft = getPoint(points, lowerLeftIndex);
  const horizontal = distance(outer, inner);

  if (!horizontal) {
    return 0;
  }

  const verticalA = distance(upperLeft, lowerLeft);
  const verticalB = distance(upperRight, lowerRight);
  return (verticalA + verticalB) / (2 * horizontal);
}

function getNormalizedBounds(bounds, frameWidth, frameHeight) {
  return {
    x: frameWidth ? bounds.x / frameWidth : 0,
    y: frameHeight ? bounds.y / frameHeight : 0,
    width: frameWidth ? bounds.width / frameWidth : 0,
    height: frameHeight ? bounds.height / frameHeight : 0,
  };
}

function normalizeRollDegrees(value) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  if (value > 90) {
    return value - 180;
  }

  if (value < -90) {
    return value + 180;
  }

  return value;
}

function enrichFace(faceInput, frameWidth, frameHeight) {
  const points = Array.isArray(faceInput.landmarks) ? faceInput.landmarks : [];
  const boundingBox = getBounds(points);
  const centerX = boundingBox.x + boundingBox.width / 2;
  const centerY = boundingBox.y + boundingBox.height / 2;
  const centerXRatio = frameWidth ? centerX / frameWidth : 0;
  const centerYRatio = frameHeight ? centerY / frameHeight : 0;
  const widthRatio = frameWidth ? boundingBox.width / frameWidth : 0;
  const heightRatio = frameHeight ? boundingBox.height / frameHeight : 0;
  const areaRatio = frameWidth && frameHeight ? (boundingBox.width * boundingBox.height) / (frameWidth * frameHeight) : 0;
  const normalizedBounds = getNormalizedBounds(boundingBox, frameWidth, frameHeight);

  const leftEyeCenter = averagePoints([getPoint(points, 33), getPoint(points, 133), getPoint(points, 159), getPoint(points, 145)]);
  const rightEyeCenter = averagePoints([getPoint(points, 362), getPoint(points, 263), getPoint(points, 386), getPoint(points, 374)]);
  const eyeMidpoint = averagePoints([leftEyeCenter, rightEyeCenter]);
  const noseTip = getPoint(points, 1);
  const forehead = getPoint(points, 10);
  const chin = getPoint(points, 152);
  const mouthUpper = getPoint(points, 13);
  const mouthLower = getPoint(points, 14);
  const mouthLeft = getPoint(points, 61);
  const mouthRight = getPoint(points, 291);
  const leftSide = getPoint(points, 234);
  const rightSide = getPoint(points, 454);
  const leftTemple = getPoint(points, 127);
  const rightTemple = getPoint(points, 356);
  const leftEarScorePoint = getPoint(points, 93);
  const rightEarScorePoint = getPoint(points, 323);

  const rawRollDeg = (Math.atan2(rightEyeCenter.y - leftEyeCenter.y, rightEyeCenter.x - leftEyeCenter.x) * 180) / Math.PI;
  const rollDeg = normalizeRollDegrees(rawRollDeg);
  const faceWidth = distance(leftSide, rightSide) || boundingBox.width || 1;
  const yawOffsetRatio = (noseTip.x - eyeMidpoint.x) / Math.max(faceWidth / 2, 1);
  const eyeToChinHeight = Math.max(chin.y - eyeMidpoint.y, 1);
  const noseVerticalRatio = (noseTip.y - eyeMidpoint.y) / eyeToChinHeight;
  const leftEyeEAR = getEyeAspectRatio(points, [33, 160, 158, 133, 153, 144]);
  const rightEyeEAR = getEyeAspectRatio(points, [362, 385, 387, 263, 373, 380]);
  const lipGapRatio = distance(mouthUpper, mouthLower) / Math.max(faceWidth, 1);
  const mouthWidthRatio = distance(mouthLeft, mouthRight) / Math.max(faceWidth, 1);
  const blendshapeScores = faceInput.blendshapeScores || {};
  const blinkScore = Math.max(
    Number(blendshapeScores.eyeBlinkLeft || 0),
    Number(blendshapeScores.eyeBlinkRight || 0),
  );
  const smileScore = Math.max(
    Number(blendshapeScores.mouthSmileLeft || 0),
    Number(blendshapeScores.mouthSmileRight || 0),
  );
  const jawOpenScore = Number(blendshapeScores.jawOpen || 0);
  const browRaiseScore = Math.max(
    Number(blendshapeScores.browInnerUp || 0),
    Number(blendshapeScores.browOuterUpLeft || 0),
    Number(blendshapeScores.browOuterUpRight || 0),
  );

  const insideFrame =
    normalizedBounds.x >= 0 &&
    normalizedBounds.y >= 0 &&
    normalizedBounds.x + normalizedBounds.width <= 1 &&
    normalizedBounds.y + normalizedBounds.height <= 1;
  const centeredHorizontally = Math.abs(centerXRatio - 0.5) <= 0.12;
  const centeredVertically = centerYRatio >= 0.39 && centerYRatio <= 0.58;
  const rollAbs = Math.abs(rollDeg);
  const yawAbs = Math.abs(yawOffsetRatio);
  const eyesLevel = rollAbs <= 10;
  const eyesLevelBorderline = rollAbs <= 14;
  const yawOkay = yawAbs <= 0.15;
  const yawBorderline = yawAbs <= 0.2;
  const pitchOkay = noseVerticalRatio >= 0.23 && noseVerticalRatio <= 0.5;
  const pitchBorderline = noseVerticalRatio >= 0.2 && noseVerticalRatio <= 0.54;
  const headStraight = eyesLevel && yawOkay && pitchOkay;
  const headStraightBorderline = eyesLevelBorderline && yawBorderline && pitchBorderline;
  const chinVisible = chin.y > frameHeight * 0.03 && chin.y < frameHeight * 0.985;
  const crownVisible = forehead.y > frameHeight * 0.015 && forehead.y < frameHeight * 0.94;
  const sideMarginsOkay =
    leftTemple.x > frameWidth * 0.02 &&
    rightTemple.x < frameWidth * 0.98 &&
    leftSide.x > frameWidth * 0.015 &&
    rightSide.x < frameWidth * 0.985;
  const fullFaceVisible = insideFrame && chinVisible && crownVisible && sideMarginsOkay;
  const sideFaceVisible =
    leftEarScorePoint.x > frameWidth * 0.015 &&
    rightEarScorePoint.x < frameWidth * 0.985 &&
    sideMarginsOkay;
  const eyesOpen =
    leftEyeEAR >= 0.155 &&
    rightEyeEAR >= 0.155 &&
    blinkScore <= 0.58;
  const mouthClosed = jawOpenScore <= 0.18 && lipGapRatio <= 0.085;
  const mouthClosedBorderline = jawOpenScore <= 0.28 && lipGapRatio <= 0.11;
  const strongSmile = smileScore >= 0.45 && mouthWidthRatio >= 0.58;
  const expressionBorderline =
    mouthClosedBorderline &&
    !(smileScore >= 0.58 && mouthWidthRatio >= 0.64);
  const neutralExpression = mouthClosed && !strongSmile;
  const rawHeadRatio = heightRatio;
  const estimatedHeadRatio = clamp(rawHeadRatio * HEAD_RATIO_ADJUSTMENT, 0, 1);
  const headRatio = estimatedHeadRatio;
  const headSizeOkay = headRatio >= HEAD_RATIO_TARGET_MIN && headRatio <= HEAD_RATIO_TARGET_MAX;

  return {
    sourceId: faceInput.sourceId || null,
    landmarks: points,
    blendshapeScores,
    boundingBox,
    normalizedBounds,
    centerX,
    centerY,
    centerXRatio,
    centerYRatio,
    widthRatio,
    heightRatio,
    areaRatio,
    rawHeadRatio,
    estimatedHeadRatio,
    headRatio,
    headSizeOkay,
    insideFrame,
    centeredHorizontally,
    centeredVertically,
    centered: centeredHorizontally && centeredVertically,
    fullFaceVisible,
    sideFaceVisible,
    chinVisible,
    crownVisible,
    eyesOpen,
    leftEyeEAR,
    rightEyeEAR,
    blinkScore,
    eyeVisibilityScore: Math.min(leftEyeEAR, rightEyeEAR),
    eyesLevel,
    eyesLevelBorderline,
    rollDeg,
    yawOffsetRatio,
    pitchRatio: noseVerticalRatio,
    headStraight,
    headStraightBorderline,
    lookingForward: yawOkay,
    yawOkay,
    yawBorderline,
    pitchOkay,
    pitchBorderline,
    mouthClosed,
    mouthClosedBorderline,
    lipGapRatio,
    mouthWidthRatio,
    jawOpenScore,
    smileScore,
    browRaiseScore,
    strongSmile,
    expressionBorderline,
    neutralExpression,
    featuresVisible: fullFaceVisible && sideFaceVisible,
    positionedWell: headStraight && fullFaceVisible && centeredHorizontally && centeredVertically,
  };
}

function summarizeFaces(faces, frameWidth, frameHeight, base = {}) {
  const enrichedFaces = faces
    .map((face) => enrichFace(face, frameWidth, frameHeight))
    .filter((face) => face.boundingBox.width > 0 && face.boundingBox.height > 0)
    .sort((left, right) => right.areaRatio - left.areaRatio);

  return {
    ...base,
    frameWidth,
    frameHeight,
    facesCount: enrichedFaces.length,
    faces: enrichedFaces,
    primaryFace: enrichedFaces[0] || null,
  };
}

function serializeLandmarks(landmarks = [], frameWidth, frameHeight) {
  if (!Array.isArray(landmarks)) {
    return [];
  }

  return landmarks.map((landmark) => toPixelPoint(landmark, frameWidth, frameHeight));
}

export function buildFaceDetection(faceLandmarkerResult, frameWidth, frameHeight) {
  if (!faceLandmarkerResult) {
    return summarizeFaces([], frameWidth, frameHeight, {
      supported: false,
      error: 'Face landmarker returned no result.',
    });
  }

  const faces = (faceLandmarkerResult.faceLandmarks || []).map((landmarks, index) => ({
    sourceId: `face-${index + 1}`,
    landmarks: serializeLandmarks(landmarks, frameWidth, frameHeight),
    blendshapeScores: getBlendshapeMap(faceLandmarkerResult.faceBlendshapes?.[index]),
  }));

  return summarizeFaces(faces, frameWidth, frameHeight, {
    supported: true,
    error: null,
  });
}

export function createFaceDetectionError(frameWidth, frameHeight, errorMessage) {
  return summarizeFaces([], frameWidth, frameHeight, {
    supported: true,
    error: errorMessage || 'Face landmarker failed.',
  });
}

export function projectFaceDetectionToCrop(faceDetection, crop, frameWidth, frameHeight) {
  if (!faceDetection) {
    return summarizeFaces([], frameWidth, frameHeight, {
      supported: false,
      error: 'Face detection data was unavailable.',
    });
  }

  const scaleX = crop.width ? frameWidth / crop.width : 1;
  const scaleY = crop.height ? frameHeight / crop.height : 1;
  const projectedFaces = faceDetection.faces.map((face, index) => ({
    sourceId: face.sourceId || `face-${index + 1}`,
    landmarks: face.landmarks.map((point) => ({
      x: (point.x - crop.x) * scaleX,
      y: (point.y - crop.y) * scaleY,
      z: point.z,
    })),
    blendshapeScores: face.blendshapeScores || {},
  }));

  return summarizeFaces(projectedFaces, frameWidth, frameHeight, {
    supported: faceDetection.supported,
    error: faceDetection.error,
  });
}
