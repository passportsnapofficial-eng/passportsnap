import { US_PASSPORT_PRESET } from '../../data/sizePresets';
import { PROCESSING_STEPS } from '../utils/constants';
import {
  buildFriendlyRejectionReasons,
  buildComplianceChecks,
  buildDetectedIssuesSummary,
  buildRetakeGuidance,
  summarizeCompliance,
} from './complianceChecks';
import { exportPassportImage } from './exportPassportImage';

function delay(ms) {
  return new Promise((resolve) => {
    globalThis.setTimeout(resolve, ms);
  });
}

function getStepDuration(stepKey) {
  return PROCESSING_STEPS.find((step) => step.key === stepKey)?.durationMs || 0;
}

async function reportProcessingStage(stepKey, onStageChange) {
  onStageChange?.(stepKey);

  const durationMs = getStepDuration(stepKey);
  if (durationMs > 0) {
    await delay(durationMs);
  }
}

export async function processPassportPhoto(sourcePhoto, options = {}) {
  const preset = options.preset || US_PASSPORT_PRESET;
  const documentType = options.documentType;
  const countryLabel = options.countryLabel || documentType?.countryLabel || preset.defaultCountry;
  const validationPolicy = documentType?.validationPolicy || {};

  const reportStage = (stepKey) => reportProcessingStage(stepKey, options.onStageChange);
  const exported = await exportPassportImage(sourcePhoto, preset, {
    reportStage,
    respectSourceFraming: Boolean(options.respectSourceFraming),
    validationPolicy,
  });
  const checks = buildComplianceChecks(exported, preset, documentType);
  const summary = summarizeCompliance(checks);
  const failedCount = summary.failedChecks.length;
  const backgroundToneLabel = exported.analysis.background.backgroundToneLabel || exported.analysis.background.backgroundTone || 'Other';
  const backgroundCleanupAllowed = Boolean(exported.editPolicy?.allowBackgroundCleanup);
  const requiresUnalteredPhoto = Boolean(exported.editPolicy?.requiresUnalteredPhoto);
  const backgroundRemovalApplied = Boolean(exported.backgroundRemoval?.applied);
  const issueSummary = buildDetectedIssuesSummary(summary.failedChecks);
  const rejectionReasons =
    summary.status === 'passed'
      ? []
      : buildFriendlyRejectionReasons(
          summary.failedChecks,
          exported.rejectionReasons || [],
        );
  const issueSummaryItems = summary.failedChecks.map((check) => ({
    key: check.key,
    label: check.label,
    helpText: check.helpText,
    recoverable: check.recoverable,
  }));

  await reportStage('finalize-result');

  const headline =
    summary.status === 'passed'
      ? 'Your photo is ready'
      : summary.status === 'needs_retouch'
        ? 'Almost ready'
        : "Let's fix this";
  const message =
    summary.status === 'passed'
      ? backgroundRemovalApplied
        ? `We framed it, cleaned it up, and got it ready for ${countryLabel}.`
        : `We framed it and validated it for ${countryLabel}.`
      : summary.status === 'needs_retouch'
        ? `We can finish this one with a little extra cleanup. The ${backgroundToneLabel.toLowerCase()} background just needs a final polish.`
        : buildRetakeGuidance(summary.failedChecks);
  const detail =
    summary.status === 'passed'
      ? requiresUnalteredPhoto && !backgroundRemovalApplied
        ? 'No automated retouching was applied because this document expects an unaltered photo.'
        : 'Finish checkout now or take another one if you want a different shot.'
      : summary.status === 'needs_retouch'
        ? `${failedCount} ${failedCount === 1 ? 'small fix is' : 'small fixes are'} left before it is ready.`
        : `${failedCount} ${failedCount === 1 ? 'thing needs' : 'things need'} attention before the next photo.`;

  return {
    id: `result-${Date.now()}`,
    sourcePhoto,
    processedPhoto: exported.dataUrl,
    exportDataUrl: exported.dataUrl,
    exportBlob: exported.blob,
    presetId: preset.id,
    countryLabel,
    sizeLabel: preset.officialSize || preset.label,
    outputLabel: `${preset.outputWidth} x ${preset.outputHeight} px JPG`,
    outputWidth: exported.outputWidth,
    outputHeight: exported.outputHeight,
    flagPath: documentType?.flagPath || preset.flagPath,
    backgroundLabel: preset.background,
    documentName: documentType?.name || `${countryLabel} Photo`,
    authority: documentType?.authority || preset.authority,
    sourceUrl: documentType?.sourceUrl || preset.sourceUrl,
    sourceLabel: documentType?.sourceLabel || preset.sourceLabel,
    requirements: documentType?.requirements || preset.requirements || [],
    status: summary.status,
    canProceedToCheckout: summary.status !== 'needs_retake',
    requiresPremiumRetouch: summary.recovery.requiresPremiumRetouch,
    backgroundRemovalApplied,
    backgroundCleanupAllowed,
    requiresUnalteredPhoto,
    recovery: summary.recovery,
    checks,
    rejectionReasons,
    failedChecks: summary.failedChecks,
    blockingFailedChecks: summary.blockingFailedChecks,
    recoverableFailedChecks: summary.recoverableFailedChecks,
    issueSummary,
    issueSummaryItems,
    headline,
    message,
    detail,
    metadata: {
      sourceWidth: exported.sourceWidth,
      sourceHeight: exported.sourceHeight,
      outputWidth: exported.outputWidth,
      outputHeight: exported.outputHeight,
      crop: exported.crop,
      analysis: exported.analysis,
      editPolicy: exported.editPolicy,
      heuristic: 'mediapipe-face-landmarker-worker-validation',
    },
  };
}

