import { US_PASSPORT_PRESET } from '../../data/sizePresets';
import {
  buildComplianceChecks,
  buildRetakeGuidance,
  summarizeCompliance,
} from './complianceChecks';
import { exportPassportImage } from './exportPassportImage';

export async function processPassportPhoto(sourcePhoto, options = {}) {
  const preset = options.preset || US_PASSPORT_PRESET;
  const documentType = options.documentType;
  const countryLabel = options.countryLabel || documentType?.countryLabel || preset.defaultCountry;
  const exported = await exportPassportImage(sourcePhoto, preset);
  const checks = buildComplianceChecks(exported, preset);
  const summary = summarizeCompliance(checks);

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
    checks,
    failedChecks: summary.failedChecks,
    headline:
      summary.status === 'passed' ? 'Initial check passed' : 'Retake recommended',
    message:
      summary.status === 'passed'
        ? `We prepared a ${preset.officialSize || preset.label} export for ${countryLabel} and ran an automated first-pass review.`
        : buildRetakeGuidance(summary.failedChecks),
    detail:
      summary.status === 'passed'
        ? 'This is an automated initial compliance check. Review the result before checkout.'
        : 'Retake with your shoulders squared, your face centered, and more even light on the background.',
    metadata: {
      sourceWidth: exported.sourceWidth,
      sourceHeight: exported.sourceHeight,
      outputWidth: exported.outputWidth,
      outputHeight: exported.outputHeight,
      crop: exported.crop,
      analysis: exported.analysis,
      heuristic: 'center-crop-mvp',
    },
  };
}
