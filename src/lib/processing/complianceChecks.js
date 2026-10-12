import { CHECK_STATUSES, RESULT_STATUSES } from '../utils/constants';
import { HIGH_RES_EXPORT_DPI } from './exportResolution';

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
    // A check the automated pass could not decide. The customer has to answer
    // it themselves before the photo can be sold.
    requiresConfirmation: Boolean(options.requiresConfirmation),
    confirmLabel: options.confirmLabel || '',
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

function isAutomaticBackgroundRemovalApplied(processed) {
  const backgroundRemoval = processed.backgroundRemoval || processed.analysis?.backgroundRemoval;
  return Boolean(backgroundRemoval?.applied);
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
  hatFree: 'Remove hat',
  maskFree: 'Remove face mask',
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
  const headwear = processed.analysis.headwear || {};
  // Three-state verdicts from the server model (see
  // attributeDetectionClient.js). Anything it did not settle is "unsure", and
  // unsure can only ever lead to a customer confirmation, never to a clear.
  const attributeDetection = processed.analysis.attributes || null;
  const attributeState = (key) => attributeDetection?.attributes?.[key]?.state || 'unsure';
  const lighting = processed.analysis.lighting;
  const sharpness = processed.analysis.sharpness;
  const framing = processed.analysis.framing;
  const primaryFace = faceDetection.primaryFace || null;
  const minSourceDimension = Math.min(processed.sourceWidth, processed.sourceHeight);
  const outputAspect = processed.outputWidth / processed.outputHeight;
  const targetAspect = processed.targetAspectRatio;
  const normalizedForDownload = Boolean(processed.analysis?.technical?.normalizedForDownload);
  // A normalized download is accepted at any pixel size as long as it keeps the
  // target aspect ratio and meets at least the spec resolution. This decouples
  // the delivered resolution from the spec dimensions so the export can be
  // rendered denser (e.g. 1200px) without failing dimension validation.
  const aspectMatchesTarget =
    Number.isFinite(outputAspect) &&
    Number.isFinite(targetAspect) &&
    Math.abs(outputAspect - targetAspect) <= 0.02;
  const meetsSpecResolution =
    Math.min(processed.outputWidth, processed.outputHeight) >=
    Math.min(preset.outputWidth, preset.outputHeight);
  const outputDimensionsAccepted =
    (processed.outputWidth === preset.outputWidth && processed.outputHeight === preset.outputHeight) ||
    (normalizedForDownload && aspectMatchesTarget && meetsSpecResolution);
  const resolutionThreshold = getResolutionThreshold(preset);
  const {
    allowedBackgroundTones,
    preferredBackgroundTones,
    requiresUnalteredPhoto,
    allowBackgroundCleanup,
    eyewearPolicy,
  } = getValidationPolicy(documentType);
  const backgroundTone = background.backgroundTone || 'other';
  const backgroundToneLabel = background.backgroundToneLabel || getBackgroundToneLabel(backgroundTone);
  const backgroundToneAllowed = allowedBackgroundTones.includes(backgroundTone);
  const backgroundTonePreferred = preferredBackgroundTones.includes(backgroundTone);
  const backgroundToneRecoverable = false;
  const backgroundRemovalApplied = isAutomaticBackgroundRemovalApplied(processed);
  const backgroundRemovalAttempted = Boolean(
    processed.backgroundRemoval?.attempted || processed.analysis?.backgroundRemoval?.attempted,
  );
  const backgroundAdvisoryOnly = allowBackgroundCleanup && (backgroundRemovalAttempted || backgroundRemovalApplied);
  const eyewearClassifierReady = Boolean(eyewear.classifierReady);
  const modelGlasses = attributeState('glasses');
  const wearingGlasses = Boolean(eyewear.wearingGlasses) || modelGlasses === 'present';
  const glassesCleared = !wearingGlasses && modelGlasses === 'absent';
  // Undecided when neither the browser heuristic nor the server model reached
  // a confident verdict. The heuristic saying "no glasses" is not enough on
  // its own: it measured 0 of 3 on light skin in the labelled fixtures.
  const eyewearUndecided =
    !wearingGlasses &&
    !glassesCleared &&
    (eyewear.supported === false || Boolean(eyewear.glassesAbstain) || modelGlasses === 'unsure');
  const highConfidenceEyewear =
    modelGlasses === 'present' ||
    (Boolean(eyewear.wearingGlasses) &&
    (
      Boolean(eyewear.heuristicHighConfidence) ||
      (
        eyewearClassifierReady &&
        (
          Number(eyewear.mlEyewearScore || 0) >= 0.92 ||
          (
            Number(eyewear.mlEyewearScore || 0) >= 0.84 &&
            Number(eyewear.classifierMargin || 0) >= 0.18 &&
            Number(eyewear.heuristicEyewearScore || eyewear.eyewearScore || 0) >= 0.68
          )
        )
      )
    ));
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
  const advisoryBackgroundPlain = backgroundAdvisoryOnly;
  const advisoryBackgroundLight = backgroundAdvisoryOnly;
  const advisoryBackgroundShadow = backgroundAdvisoryOnly;
  const advisoryBackgroundDistractions = backgroundAdvisoryOnly;
  const faceSharpnessVariance = Number(sharpness?.faceLaplacianVariance || sharpness?.laplacianVariance || 0);
  const faceSharpnessEdgeDensity = Number(sharpness?.faceEdgeDensity || 0);
  const analysisQualityStrongEnough =
    Number(sharpness?.qualityScore || 0) >= 0.35 &&
    (faceSharpnessVariance >= 30 || portraitSharpnessVariance >= 42) &&
    (faceSharpnessEdgeDensity >= 0.018 || portraitSharpnessEdgeDensity >= 0.024);
  const acceptedBackgroundLabel = formatToneList(allowedBackgroundTones);
  const checks = [];

  const hatDetected = Boolean(headwear.hatDetected) || attributeState('hat') === 'present';
  const hatCleared = !hatDetected && attributeState('hat') === 'absent';
  const headCoveringDetected = Boolean(headwear.hijabDetected) || attributeState('head_covering') === 'present';
  const maskState = attributeState('face_mask');
  const hatHelp = 'Remove hats, caps, and fashion headwear. Religious head coverings may remain when the full face is visible.';
  const maskHelp = 'Remove any face mask or covering so your nose and mouth are fully visible.';

  checks.push(
    // The browser heuristics only ever assert the failing side: they cannot
    // separate a dark cap from dark hair. The server model can clear a photo.
    // Without a confident verdict from either, ask the person to confirm.
    hatDetected
      ? createPassedCheck('Headwear', 'hatFree', 'No hat detected', 'Hat detected', false, hatHelp)
      : hatCleared
        ? createPassedCheck('Headwear', 'hatFree', 'No hat detected', 'Hat detected', true, hatHelp)
        : createInfoCheck(
            'Headwear',
            'hatFree',
            'Confirm you are not wearing a hat',
            'The automatic headwear check could not clear this photo on its own, so please confirm it yourself. Remove hats, caps and fashion headwear. Religious head coverings may stay on when the full face is visible.',
            {
              requiresConfirmation: true,
              confirmLabel: 'I am not wearing a hat, cap, or other fashion headwear.',
            },
          ),
    // Religious head coverings are permitted, so this never blocks. It exists
    // so the result says what was seen and reminds the customer of the one
    // condition that applies: the full face must stay visible.
    createInfoCheck(
      'Headwear',
      'hijabDetection',
      headCoveringDetected
        ? 'Religious head covering detected'
        : headwear.possibleHeadCovering
          ? 'Possible head covering detected'
          : 'No religious head covering detected',
      headCoveringDetected
        ? 'Religious head coverings are allowed. Keep the full face visible from the bottom of the chin to the top of the forehead.'
        : headwear.possibleHeadCovering
          ? 'Please confirm whether this is religious headwear or a hat; the automated result is intentionally conservative.'
          : 'No religious head covering was identified by the automated check.',
    ),
    maskState === 'present'
      ? createPassedCheck('Face & Position', 'maskFree', 'No face mask detected', 'Face mask detected', false, maskHelp)
      : maskState === 'absent'
        ? createPassedCheck('Face & Position', 'maskFree', 'No face mask detected', 'Face mask detected', true, maskHelp)
        : createInfoCheck(
            'Face & Position',
            'maskFree',
            'Confirm you are not wearing a face mask',
            'The automatic mask check could not reach a verdict on this photo, so please confirm it yourself before you submit it.',
            {
              requiresConfirmation: true,
              confirmLabel: 'I am not wearing a face mask or anything covering my nose or mouth.',
            },
          ),
  );

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
    // When the detector could not reach a verdict, say so. Reporting "No
    // glasses detected" on an abstention is exactly what let photos of people
    // plainly wearing glasses through as compliant.
    eyewearUndecided
      ? createInfoCheck(
          'Eyes & Expression',
          'eyewearFree',
          'Confirm you are not wearing glasses',
          'The glasses check could not reach a verdict on this photo, so please confirm it yourself before you submit it.',
          {
            requiresConfirmation: true,
            confirmLabel: 'I am not wearing glasses in this photo.',
          },
        )
      : eyewearPolicy === 'conditional'
      ? createAdvisoryCheck(
          'Eyes & Expression',
          'eyewearFree',
          'No glasses detected',
          'Glasses detected - check for glare and clear eyes',
          !wearingGlasses,
          true,
          'If glasses stay on, the eyes must remain clearly visible and free of glare, reflections, and tinted lenses.',
        )
      : highConfidenceEyewear
        ? createPassedCheck(
            'Eyes & Expression',
            'eyewearFree',
            'No glasses detected',
            'Glasses detected',
            !wearingGlasses,
            'Remove glasses and retake the photo. This document blocks eyewear before checkout.',
          )
        : wearingGlasses
          // Signs of glasses without a confident verdict used to pass with a
          // note. A note is not a verdict; ask instead.
          ? createInfoCheck(
              'Eyes & Expression',
              'eyewearFree',
              'Confirm you are not wearing glasses',
              'The checks saw signs of glasses but could not be sure. Confirm yourself before you submit this photo.',
              {
                requiresConfirmation: true,
                confirmLabel: 'I am not wearing glasses in this photo.',
              },
            )
          : createPassedCheck(
              'Eyes & Expression',
              'eyewearFree',
              'No glasses detected',
              'Glasses detected',
              true,
              'Remove glasses and retake the photo. This document blocks eyewear before checkout.',
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
        info: 'Background color needs cleanup advice',
      },
      backgroundToneAllowed
        ? CHECK_STATUSES.passed
        : backgroundAdvisoryOnly
          ? CHECK_STATUSES.info
          : CHECK_STATUSES.failed,
      requiresUnalteredPhoto && !backgroundRemovalApplied
        ? `Use a ${acceptedBackgroundLabel} background. This document usually expects an unaltered photo, but the workflow will still try automatic cleanup before failing.`
        : `Use a ${acceptedBackgroundLabel} background. A plain light backdrop still gives the cleanest automatic background removal.`,
      backgroundToneAllowed && !backgroundTonePreferred
        ? `${backgroundToneLabel} is allowed for this document, but the workflow prefers a clean white background when automatic cleanup succeeds.`
        : !backgroundToneAllowed && backgroundAdvisoryOnly
          ? `${backgroundToneLabel} was detected. The workflow can still continue, but a plain light background gives more reliable cleanup.`
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
    createPassedCheck(
      'Image Technicals',
      'outputDpi',
      `High-resolution ${Number(processed.analysis?.technical?.outputDpi || 0)} DPI export`,
      `Export density below ${HIGH_RES_EXPORT_DPI} DPI`,
      Number(processed.analysis?.technical?.outputDpi || 0) >= HIGH_RES_EXPORT_DPI,
      `Rebuild the download so its embedded resolution metadata is at least ${HIGH_RES_EXPORT_DPI} DPI.`,
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

// Checks the automated pass could not decide. Checkout stays locked until the
// customer answers each one, so an undecided detector can never quietly sell a
// non-compliant photo.
export function getPendingConfirmations(checks = []) {
  return checks
    .filter((check) => check.requiresConfirmation && check.status === CHECK_STATUSES.info)
    .map((check) => ({
      key: check.key,
      label: check.label,
      confirmLabel: check.confirmLabel,
      noteText: check.noteText,
    }));
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
