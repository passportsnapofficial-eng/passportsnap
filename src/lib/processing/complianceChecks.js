import { CHECK_STATUSES, RESULT_STATUSES } from '../utils/constants';

function resolveCheckLabel(labels, status) {
  if (typeof labels === 'string') {
    return labels;
  }

  if (!labels || typeof labels !== 'object') {
    return '';
  }

  if (status === CHECK_STATUSES.passed) {
    return labels.passed || labels.default || labels.failed || labels.info || '';
  }

  if (status === CHECK_STATUSES.failed) {
    return labels.failed || labels.default || labels.passed || labels.info || '';
  }

  return labels.info || labels.default || labels.failed || labels.passed || '';
}

function createCheck(group, key, labels, status, helpText = '', noteText = '', options = {}) {
  return {
    group,
    key,
    label: resolveCheckLabel(labels, status),
    labels,
    status,
    helpText,
    noteText,
    recoverable: Boolean(options.recoverable),
    recoveryType: options.recoveryType || null,
  };
}

function createPassedCheck(group, key, passedLabel, failedLabel, passed, helpText = '', options = {}) {
  return createCheck(
    group,
    key,
    {
      passed: passedLabel,
      failed: failedLabel,
      info: failedLabel,
    },
    passed ? CHECK_STATUSES.passed : CHECK_STATUSES.failed,
    helpText,
    '',
    options,
  );
}

function createInfoCheck(group, key, label, noteText, options = {}) {
  return createCheck(group, key, { info: label }, CHECK_STATUSES.info, '', noteText, options);
}

function createAdvisoryCheck(group, key, passedLabel, failedLabel, passed, advisory, helpText = '', options = {}) {
  if (passed) {
    return createCheck(
      group,
      key,
      {
        passed: passedLabel,
        failed: failedLabel,
        info: failedLabel,
      },
      CHECK_STATUSES.passed,
      helpText,
      '',
      options,
    );
  }

  return createCheck(
    group,
    key,
    {
      passed: passedLabel,
      failed: failedLabel,
      info: failedLabel,
    },
    advisory ? CHECK_STATUSES.info : CHECK_STATUSES.failed,
    helpText,
    '',
    options,
  );
}

function getResolutionThreshold(preset) {
  const expectedMinDimension = Math.min(preset.outputWidth, preset.outputHeight);
  return Math.max(720, Math.round(expectedMinDimension * 1.45));
}

function isWithinRange(value, min, max) {
  return Number.isFinite(value) && value >= min && value <= max;
}

function lowercaseFirst(value) {
  if (!value) {
    return '';
  }

  return `${value.charAt(0).toLowerCase()}${value.slice(1)}`;
}

function formatList(items = []) {
  if (items.length <= 1) {
    return items[0] || '';
  }

  if (items.length === 2) {
    return `${items[0]} and ${items[1]}`;
  }

  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

function getBackgroundToneLabel(tone) {
  switch (tone) {
    case 'white':
      return 'white';
    case 'grey':
      return 'light grey';
    case 'cream':
      return 'light cream';
    default:
      return 'non-compliant';
  }
}

function formatToneList(tones = []) {
  const labels = tones.map(getBackgroundToneLabel);

  if (labels.length <= 1) {
    return labels[0] || 'white';
  }

  if (labels.length === 2) {
    return `${labels[0]} or ${labels[1]}`;
  }

  return `${labels.slice(0, -1).join(', ')}, or ${labels[labels.length - 1]}`;
}

function getValidationPolicy(documentType) {
  const allowedBackgroundTones = documentType?.validationPolicy?.allowedBackgroundTones || ['white', 'grey', 'cream'];
  const preferredBackgroundTones = documentType?.validationPolicy?.preferredBackgroundTones || ['white'];
  const requiresUnalteredPhoto = Boolean(documentType?.validationPolicy?.requiresUnalteredPhoto);
  const allowBackgroundCleanup =
    !requiresUnalteredPhoto && documentType?.validationPolicy?.allowBackgroundCleanup !== false;
  const eyewearPolicy = documentType?.validationPolicy?.eyewearPolicy || 'forbidden';

  return {
    allowedBackgroundTones,
    preferredBackgroundTones,
    requiresUnalteredPhoto,
    allowBackgroundCleanup,
    eyewearPolicy,
  };
}

const FRIENDLY_REJECTION_REASON_OVERRIDES = {
  faceDetected: 'Face not found',
  singleFace: 'Multiple faces detected',
  faceCentered: 'Face not centered',
  headStraight: 'Head not straight',
  fullFaceVisible: 'Full face not visible',
  facialFeaturesClear: 'Facial features not clear enough',
  sideFaceVisible: 'Both sides of the face are not visible',
  headSize: 'Head size is out of range',
  framingDistance: 'Move a little closer to the camera',
  eyesOpen: 'Eyes are not fully open',
  eyesVisible: 'Eyes are not clear enough',
  eyesLevel: 'Eyes not level',
  eyewearFree: 'Remove glasses',
  neutralExpression: 'Keep a neutral expression',
  mouthClosed: 'Keep your mouth closed',
  backgroundPlain: 'Background is too busy',
  backgroundLight: 'Background is too dark',
  backgroundToneAllowed: 'Background color is not accepted',
  backgroundShadow: 'Heavy shadow behind your head',
  backgroundDistractions: 'Another person or object is in the frame',
  lightingEven: 'Lighting is uneven',
  exposure: 'Face is too bright or too dark',
  harshShadow: 'Harsh shadows on the face',
  sharpness: 'Photo is too blurry',
  sourceResolution: 'Photo is too small',
  aspectRatio: 'Photo framing is off',
  outputDimensions: 'We could not finish this photo cleanly',
};

function normalizeFriendlyReason(value) {
  return String(value || '')
    .trim()
    .replace(/\.$/, '');
}

function mapCheckToFriendlyReason(check) {
  const override = FRIENDLY_REJECTION_REASON_OVERRIDES[check.key];
  if (override) {
    return override;
  }

  const label = normalizeFriendlyReason(check.label);
  if (!label) {
    return '';
  }

  return label;
}

function collectFriendlyReasonCandidates(check) {
  const candidates = new Set();

  const pushCandidate = (value) => {
    const normalized = normalizeFriendlyReason(value).toLowerCase();
    if (normalized) {
      candidates.add(normalized);
    }
  };

  pushCandidate(mapCheckToFriendlyReason(check));
  pushCandidate(check?.label);
  pushCandidate(check?.helpText);

  switch (check?.key) {
    case 'headStraight':
      pushCandidate('Look straight at the camera');
      break;
    case 'headSize':
      pushCandidate('Face too small');
      pushCandidate('Face too large');
      break;
    case 'exposure':
      pushCandidate('Face is too bright');
      pushCandidate('Face is too dark');
      break;
    default:
      break;
  }

  return candidates;
}

function reasonMatchesFailedCheck(reason, check) {
  const normalizedReason = normalizeFriendlyReason(reason).toLowerCase();
  if (!normalizedReason) {
    return false;
  }

  return collectFriendlyReasonCandidates(check).has(normalizedReason);
}

export function buildComplianceChecks(processed, preset, documentType = null) {
  const faceDetection = processed.analysis.faceDetection;
  const background = processed.analysis.background;
  const eyewear = processed.analysis.eyewear || {};
  const lighting = processed.analysis.lighting;
  const sharpness = processed.analysis.sharpness;
  const framing = processed.analysis.framing;
  const primaryFace = faceDetection.primaryFace || null;
  const minSourceDimension = Math.min(processed.sourceWidth, processed.sourceHeight);
  const outputAspect = processed.outputWidth / processed.outputHeight;
  const targetAspect = processed.targetAspectRatio;
  const normalizedForDownload = Boolean(processed.analysis?.technical?.normalizedForDownload);
  const outputDimensionsAccepted =
    (processed.outputWidth === preset.outputWidth && processed.outputHeight === preset.outputHeight) ||
    (normalizedForDownload && processed.outputWidth === 600 && processed.outputHeight === 600);
  const resolutionThreshold = getResolutionThreshold(preset);
  const {
    allowedBackgroundTones,
    preferredBackgroundTones,
    requiresUnalteredPhoto,
    eyewearPolicy,
  } = getValidationPolicy(documentType);
  const backgroundTone = background.backgroundTone || 'other';
  const backgroundToneLabel = background.backgroundToneLabel || getBackgroundToneLabel(backgroundTone);
  const backgroundToneAllowed = allowedBackgroundTones.includes(backgroundTone);
  const backgroundTonePreferred = preferredBackgroundTones.includes(backgroundTone);
  const backgroundToneRecoverable = false;
  const backgroundRemovalApplied = Boolean(processed.analysis?.backgroundRemoval?.applied);
  const highConfidenceEyewear =
    Boolean(eyewear.wearingGlasses) &&
    (
      Number(eyewear.mlEyewearScore || 0) >= 0.92 ||
      Number(eyewear.heuristicEyewearScore || eyewear.eyewearScore || 0) >= 0.9 ||
      Number(eyewear.glareRatio || 0) >= 0.12 ||
      (
        Number(eyewear.bridgeDarkRatio || 0) >= 0.24 &&
        Number(eyewear.templeDarkRatio || 0) >= 0.24
      )
    );
  const portraitSharpnessVariance = Number(sharpness?.portraitLaplacianVariance || 0);
  const portraitSharpnessEdgeDensity = Number(sharpness?.portraitEdgeDensity || 0);
  // These heuristics are useful guidance, but too noisy to hard-fail photos that are otherwise valid.
  const advisoryHeadSize = true;
  const advisoryFramingDistance = true;
  const advisoryFaceCentered = Boolean(primaryFace);
  const advisoryHeadStraight = Boolean(primaryFace?.headStraightBorderline);
  const advisoryFacialFeaturesClear = Boolean(primaryFace);
  const advisoryEyesVisible = true;
  const advisoryLightingEven = true;
  const advisoryExposure = true;
  const advisoryHarshShadow = true;
  const advisoryNeutralExpression = Boolean(primaryFace?.expressionBorderline);
  const advisoryMouthClosed = Boolean(primaryFace?.mouthClosedBorderline || primaryFace?.expressionBorderline);
  const advisoryBackgroundPlain = backgroundRemovalApplied;
  const advisoryBackgroundLight = backgroundRemovalApplied;
  const advisoryBackgroundShadow = backgroundRemovalApplied;
  const advisoryBackgroundDistractions = backgroundRemovalApplied;
  const faceSharpnessVariance = Number(sharpness?.faceLaplacianVariance || sharpness?.laplacianVariance || 0);
  const faceSharpnessEdgeDensity = Number(sharpness?.faceEdgeDensity || 0);
  const analysisQualityStrongEnough =
    Number(sharpness?.qualityScore || 0) >= 0.35 &&
    (faceSharpnessVariance >= 30 || portraitSharpnessVariance >= 42) &&
    (faceSharpnessEdgeDensity >= 0.018 || portraitSharpnessEdgeDensity >= 0.024);
  const acceptedBackgroundLabel = formatToneList(allowedBackgroundTones);
  const checks = [];

  checks.push(
    createPassedCheck(
      'Face & Position',
      'faceModelReady',
      'Face validation model loaded',
      'Face validation model unavailable',
      Boolean(faceDetection.supported && !faceDetection.error),
      'Reload the page and try again if the face validator could not start.',
    ),
    createPassedCheck(
      'Face & Position',
      'faceDetected',
      'Face detected',
      'Face not detected',
      faceDetection.facesCount >= 1,
      'Move into frame with your full face visible and remove anything covering it.',
    ),
    createPassedCheck(
      'Face & Position',
      'singleFace',
      'Only one face detected',
      'Multiple faces detected',
      faceDetection.facesCount === 1,
      'Use a photo with only one person in view.',
    ),
    createAdvisoryCheck(
      'Face & Position',
      'faceCentered',
      'Face centered in frame',
      'Face off-center in frame',
      Boolean(framing.faceCentered),
      advisoryFaceCentered,
      'Center your face and leave balanced space on both sides.',
    ),
    createAdvisoryCheck(
      'Face & Position',
      'headStraight',
      'Head straight and looking forward',
      'Head angle not compliant',
      Boolean(framing.headStraight && framing.lookingForward),
      advisoryHeadStraight,
      'Face the camera directly and keep your head level.',
    ),
    createPassedCheck(
      'Face & Position',
      'fullFaceVisible',
      'Full face visible without cropping',
      'Face cropped or partially hidden',
      Boolean(framing.fullFaceVisible && framing.chinVisible && framing.crownVisible),
      'Keep your chin, forehead, and both sides of your face clear inside the frame.',
    ),
    createAdvisoryCheck(
      'Face & Position',
      'facialFeaturesClear',
      'Eyes, nose, and mouth clearly visible',
      'Facial features not clear enough',
      Boolean(framing.facialFeaturesClear),
      advisoryFacialFeaturesClear,
      'Remove hands, hair, or deep shadow covering your facial features.',
    ),
    createPassedCheck(
      'Face & Position',
      'sideFaceVisible',
      'Both sides of the face stay visible',
      'Both sides of the face are not visible',
      Boolean(framing.sideFaceVisible),
      'Avoid side angles or cropping that hides part of your face.',
    ),
  );

  checks.push(
    createAdvisoryCheck(
      'Head Size & Framing',
      'headSize',
      'Head height ratio within range',
      'Head height ratio outside range',
      Boolean(framing.headSizeOkay),
      advisoryHeadSize,
      'Adjust the crop until your head fills roughly 50% to 75% of the frame height.',
    ),
    createAdvisoryCheck(
      'Head Size & Framing',
      'framingDistance',
      'Not too zoomed in or too far away',
      'Framing distance not compliant',
      isWithinRange(primaryFace?.headRatio, 0.46, 0.8),
      advisoryFramingDistance,
      'Avoid extreme crops. A natural passport framing leaves a little space above the head and around the shoulders.',
    ),
    createInfoCheck(
      'Head Size & Framing',
      'shouldersVisible',
      'Shoulders visible',
      framing.shouldersVisible
        ? 'Shoulders are present in the frame, which helps the crop look natural.'
        : 'Shoulders are optional, but a little more upper-body space usually gives a stronger passport crop.',
    ),
  );

  checks.push(
    createPassedCheck(
      'Eyes & Expression',
      'eyesOpen',
      'Eyes open',
      'Eyes not fully open',
      Boolean(primaryFace?.eyesOpen),
      'Open both eyes fully and look straight at the camera.',
    ),
    createAdvisoryCheck(
      'Eyes & Expression',
      'eyesVisible',
      'Eyes clearly visible',
      'Eyes not clear enough',
      Boolean(lighting.eyesVisible),
      advisoryEyesVisible,
      'Remove hair, hands, glare, or deep shadow that hides your eyes.',
    ),
    createPassedCheck(
      'Eyes & Expression',
      'eyesLevel',
      'Eyes level',
      'Eyes not level',
      Boolean(lighting.eyeLevelOkay),
      'Keep your head upright so the eyes stay level.',
    ),
    eyewearPolicy === 'conditional'
      ? createAdvisoryCheck(
          'Eyes & Expression',
          'eyewearFree',
          'No glasses detected',
          'Glasses detected - check for glare and clear eyes',
          !eyewear.wearingGlasses,
          true,
          'If glasses stay on, the eyes must remain clearly visible and free of glare, reflections, and tinted lenses.',
        )
      : highConfidenceEyewear
        ? createPassedCheck(
            'Eyes & Expression',
            'eyewearFree',
            'No glasses detected',
            'Glasses detected',
            !eyewear.wearingGlasses,
            'Remove glasses and retake the photo. This document blocks eyewear before checkout.',
          )
        : createAdvisoryCheck(
            'Eyes & Expression',
            'eyewearFree',
            'No glasses detected',
            'Possible glasses detected - confirm eyes are clear',
            !eyewear.wearingGlasses,
            true,
            'If the detector is unsure, keep the eyes fully visible and free of glare before using the export.',
          ),
    createAdvisoryCheck(
      'Eyes & Expression',
      'neutralExpression',
      'Neutral expression',
      'Expression not neutral',
      Boolean(primaryFace?.neutralExpression),
      advisoryNeutralExpression,
      'Keep a calm expression. A broad smile or obvious grin can be rejected.',
    ),
    createAdvisoryCheck(
      'Eyes & Expression',
      'mouthClosed',
      'Mouth closed',
      'Mouth open',
      Boolean(primaryFace?.mouthClosed),
      advisoryMouthClosed,
      'Keep your lips together and avoid visible teeth or a clearly open mouth.',
    ),
  );

  checks.push(
    createPassedCheck(
      'Background',
      'backgroundModelReady',
      'Background segmentation model loaded',
      'Background segmentation model unavailable',
      Boolean(background.supported && !background.segmentationError),
      'Reload the page and try again if the background validator could not start.',
    ),
    createAdvisoryCheck(
      'Background',
      'backgroundPlain',
      'Plain background detected',
      'Background not plain enough',
      Boolean(background.plainBackground),
      advisoryBackgroundPlain,
      'Use a plain wall without visible texture, decor, or patterns.',
    ),
    createAdvisoryCheck(
      'Background',
      'backgroundLight',
      'Background bright enough',
      'Background too dark',
      Boolean(background.lightBackground),
      advisoryBackgroundLight,
      'Use a brighter background so it reads as a clear passport-photo backdrop.',
    ),
    createCheck(
      'Background',
      'backgroundToneAllowed',
      {
        passed: 'Accepted background color detected',
        failed: 'Background color not accepted',
        info: 'Background color accepted with caution',
      },
      backgroundToneAllowed ? CHECK_STATUSES.passed : CHECK_STATUSES.failed,
      requiresUnalteredPhoto && !backgroundRemovalApplied
        ? `Use a ${acceptedBackgroundLabel} background. This document usually expects an unaltered photo, but the workflow will still try automatic cleanup before failing.`
        : `Use a ${acceptedBackgroundLabel} background. If automatic cleanup cannot produce a clean white background, the photo is rejected.`,
      backgroundToneAllowed && !backgroundTonePreferred
        ? `${backgroundToneLabel} is allowed for this document, but the workflow prefers a clean white background when automatic cleanup succeeds.`
        : '',
      {
        recoverable: backgroundToneRecoverable,
        recoveryType: backgroundToneRecoverable ? 'background_cleanup' : null,
      },
    ),
    createAdvisoryCheck(
      'Background',
      'backgroundShadow',
      'No heavy shadow behind head',
      'Heavy shadow behind head',
      Boolean(background.noShadowBehindHead),
      advisoryBackgroundShadow,
      'Move away from the wall or use softer front lighting to remove head shadows.',
    ),
    createAdvisoryCheck(
      'Background',
      'backgroundDistractions',
      'No distracting person or object detected',
      'Distracting person or object detected',
      Boolean(background.noBackgroundDistractions),
      advisoryBackgroundDistractions,
      'Keep other people and prominent objects out of frame.',
    ),
  );

  checks.push(
    createAdvisoryCheck(
      'Lighting & Quality',
      'lightingEven',
      'Even lighting on the face',
      'Lighting uneven on the face',
      Boolean(lighting.evenLighting),
      advisoryLightingEven,
      'Use even light from the front instead of strong side light.',
    ),
    createAdvisoryCheck(
      'Lighting & Quality',
      'exposure',
      'Exposure balanced',
      'Exposure too bright or too dark',
      Boolean(lighting.exposureOkay),
      advisoryExposure,
      'Brighten the scene evenly or avoid harsh hotspots on your face.',
    ),
    createAdvisoryCheck(
      'Lighting & Quality',
      'harshShadow',
      'No harsh facial shadows',
      'Harsh facial shadows detected',
      Boolean(!lighting.harshShadow),
      advisoryHarshShadow,
      'Reduce strong contrast across your face with softer front lighting.',
    ),
    createPassedCheck(
      'Lighting & Quality',
      'sharpness',
      'Image quality clear enough for detail analysis',
      'Image quality too low for reliable detail analysis',
      analysisQualityStrongEnough,
      'Use a sharper, higher-quality photo with clearer facial detail. Low-detail images cannot be analyzed reliably.',
    ),
  );

  checks.push(
    createPassedCheck(
      'Image Technicals',
      'sourceResolution',
      'Source resolution high enough',
      'Source resolution too low',
      minSourceDimension >= resolutionThreshold,
      'Use a higher-resolution photo or move closer to the camera.',
    ),
    createPassedCheck(
      'Image Technicals',
      'aspectRatio',
      'Correct aspect ratio',
      'Incorrect aspect ratio',
      Math.abs(outputAspect - targetAspect) < 0.01,
      'Keep the reviewed crop aligned with the selected document format.',
    ),
    createPassedCheck(
      'Image Technicals',
      'outputDimensions',
      'Correct export dimensions',
      'Incorrect export dimensions',
      outputDimensionsAccepted,
      'Try another source photo if the final passport download cannot be rebuilt cleanly.',
    ),
  );

  checks.push(
    createInfoCheck(
      'Manual Review',
      'recency',
      'Recency and current appearance',
      'Photo age, current appearance, and official acceptance still require human review.',
    ),
  );

  return checks;
}

export function summarizeCompliance(checks) {
  const failedChecks = checks.filter((check) => check.status === CHECK_STATUSES.failed);
  const recoverableFailedChecks = failedChecks.filter((check) => check.recoverable);
  const blockingFailedChecks = failedChecks.filter((check) => !check.recoverable);
  const canRecoverWithRetouch = recoverableFailedChecks.length > 0 && blockingFailedChecks.length === 0;

  return {
    status:
      failedChecks.length === 0
        ? RESULT_STATUSES.passed
        : canRecoverWithRetouch
          ? RESULT_STATUSES.needsRetouch
          : RESULT_STATUSES.needsRetake,
    failedChecks,
    blockingFailedChecks,
    recoverableFailedChecks,
    recovery: {
      available: canRecoverWithRetouch,
      requiresPremiumRetouch: canRecoverWithRetouch,
      label: canRecoverWithRetouch ? 'Background cleanup required' : '',
    },
  };
}

export function buildFriendlyRejectionReasons(failedChecks, preferredReasons = []) {
  const seen = new Set();
  const reasons = [];
  const matchedPreferredReasons = Array.isArray(preferredReasons)
    ? preferredReasons.filter((reason) => failedChecks.some((check) => reasonMatchesFailedCheck(reason, check)))
    : [];

  const pushReason = (value) => {
    const normalized = normalizeFriendlyReason(value);
    if (!normalized) {
      return;
    }

    const key = normalized.toLowerCase();
    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    reasons.push(normalized);
  };

  matchedPreferredReasons.forEach(pushReason);
  failedChecks.forEach((check) => {
    const hasMatchingPreferredReason = matchedPreferredReasons.some((reason) => reasonMatchesFailedCheck(reason, check));
    if (!hasMatchingPreferredReason) {
      pushReason(mapCheckToFriendlyReason(check));
    }
  });

  return reasons.slice(0, 5);
}

export function buildDetectedIssuesSummary(failedChecks) {
  if (!failedChecks.length) {
    return '';
  }

  const issueLabels = failedChecks
    .map((check) => lowercaseFirst(check.label))
    .filter(Boolean);

  return `Detected issues: ${formatList(issueLabels)}.`;
}

export function buildRetakeGuidance(failedChecks) {
  if (!failedChecks.length) {
    return 'We could not finish this photo from the current image.';
  }

  const reasons = buildFriendlyRejectionReasons(failedChecks);

  if (failedChecks.every((check) => check.recoverable)) {
    return 'This photo needs a little cleanup before it is ready.';
  }

  if (!reasons.length) {
    return 'Take one more photo and we will try again.';
  }

  if (reasons.length === 1) {
    return `${reasons[0]}. Take one more photo and we will try again.`;
  }

  return `${reasons.slice(0, 2).join(' and ')}. Take one more photo and we will try again.`;
}
