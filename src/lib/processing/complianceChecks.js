import { CHECK_STATUSES, RESULT_STATUSES } from '../utils/constants';

function createCheck(key, label, passed, helpText) {
  return {
    key,
    label,
    status: passed ? CHECK_STATUSES.passed : CHECK_STATUSES.failed,
    helpText,
  };
}

export function buildComplianceChecks(processed, preset) {
  const minSourceDimension = Math.min(processed.sourceWidth, processed.sourceHeight);
  const sourceAspect = processed.sourceWidth / processed.sourceHeight;
  const cornerLuminance = processed.analysis.cornerLuminance;
  const centerLuminance = processed.analysis.centerLuminance;
  const outputAspect = processed.outputWidth / processed.outputHeight;
  const expectedWidth = preset?.outputWidth || processed.outputWidth;
  const expectedHeight = preset?.outputHeight || processed.outputHeight;
  const expectedMinDimension = Math.min(expectedWidth, expectedHeight);
  const resolutionThreshold = Math.min(
    520,
    Math.max(420, Math.round(expectedMinDimension * 1.2)),
  );
  const clarityThreshold = Math.min(
    640,
    Math.max(500, Math.round(expectedMinDimension * 1.35)),
  );

  return [
    createCheck(
      'faceDetected',
      'Face is recognized',
      minSourceDimension >= 480,
      'Move closer to the camera and keep your face fully visible.',
    ),
    createCheck(
      'singleFace',
      'Only one face is allowed',
      sourceAspect >= 0.45 && sourceAspect <= 1.9,
      'Use a tighter frame with only one person visible.',
    ),
    createCheck(
      'proportions',
      'Correct photo proportions',
      Math.abs(outputAspect - processed.targetAspectRatio) < 0.01,
      'Use the guided capture frame and keep your head centered.',
    ),
    createCheck(
      'background',
      'White background ready',
      cornerLuminance >= 128,
      'Retake against a lighter wall with more even lighting.',
    ),
    createCheck(
      'resolution',
      'Minimum resolution met',
      processed.outputWidth >= expectedWidth &&
        processed.outputHeight >= expectedHeight &&
        minSourceDimension >= resolutionThreshold,
      'Use a clearer source photo with more detail and less distance.',
    ),
    createCheck(
      'clarity',
      'Visibility and clarity look usable',
      minSourceDimension >= clarityThreshold && centerLuminance >= 60,
      'Avoid shadows and use brighter, even light on your face.',
    ),
  ];
}

export function summarizeCompliance(checks) {
  const failedChecks = checks.filter((check) => check.status === CHECK_STATUSES.failed);

  return {
    status: failedChecks.length === 0 ? RESULT_STATUSES.passed : RESULT_STATUSES.needsRetake,
    failedChecks,
  };
}

export function buildRetakeGuidance(failedChecks) {
  if (!failedChecks.length) {
    return 'Your photo passed the initial automated screen and is ready for checkout.';
  }

  if (failedChecks.length === 1) {
    return failedChecks[0].helpText;
  }

  return 'Retake with brighter, even light, a plain wall, and your face centered in the frame.';
}
