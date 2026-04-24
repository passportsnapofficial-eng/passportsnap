import { processPassportPhoto } from './mockPassportProcessor';

function normalizeStatus(status) {
  return status === 'passed' ? 'pass' : 'fail';
}

function aggregateGroupStatus(checks, keys) {
  const relevantChecks = checks.filter((check) => keys.includes(check.key));

  if (!relevantChecks.length) {
    return 'fail';
  }

  if (relevantChecks.some((check) => check.status === 'failed')) {
    return 'fail';
  }

  return relevantChecks.some((check) => check.status === 'passed' || check.status === 'info') ? 'pass' : 'fail';
}

export async function validatePassportPhoto(imageSource, country, options = {}) {
  const result = await processPassportPhoto(imageSource, {
    ...options,
    countryLabel: typeof country === 'string' && country ? country : options.countryLabel,
  });

  return {
    status: normalizeStatus(result.status),
    rejectionReasons: result.rejectionReasons || [],
    checks: {
      face: aggregateGroupStatus(result.checks, [
        'faceModelReady',
        'faceDetected',
        'singleFace',
        'faceCentered',
        'headStraight',
        'fullFaceVisible',
        'facialFeaturesClear',
      ]),
      headSize: aggregateGroupStatus(result.checks, ['headSize', 'framingDistance']),
      background: aggregateGroupStatus(result.checks, [
        'backgroundModelReady',
        'backgroundPlain',
        'backgroundLight',
        'backgroundToneAllowed',
        'backgroundShadow',
        'backgroundDistractions',
      ]),
      lighting: aggregateGroupStatus(result.checks, ['lightingEven', 'exposure', 'harshShadow']),
      eyes: aggregateGroupStatus(result.checks, ['eyesOpen', 'eyesVisible', 'eyesLevel', 'eyewearFree']),
      expression: aggregateGroupStatus(result.checks, ['neutralExpression', 'mouthClosed']),
      blur: aggregateGroupStatus(result.checks, ['sharpness']),
      technical: aggregateGroupStatus(result.checks, ['sourceResolution', 'aspectRatio', 'outputDimensions']),
    },
    detailedChecks: result.checks.reduce((summary, check) => {
      if (check.status === 'info') {
        return summary;
      }

      summary[check.key] = normalizeStatus(check.status);
      return summary;
    }, {}),
    result,
  };
}
