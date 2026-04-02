import { COUNTRY_FORMATS } from './countryFormats';

export const SIZE_PRESETS = COUNTRY_FORMATS.map((format) => ({
  ...format.preset,
  flagPath: format.flagPath,
  authority: format.authority,
  sourceUrl: format.sourceUrl,
  sourceLabel: format.sourceLabel,
  countryLabel: format.countryLabel,
  requirements: format.rules,
}));

export const US_PASSPORT_PRESET =
  SIZE_PRESETS.find((preset) => preset.id === 'us-passport-2x2') || SIZE_PRESETS[0];

export function getSizePresetById(presetId) {
  return SIZE_PRESETS.find((preset) => preset.id === presetId) || US_PASSPORT_PRESET;
}

export function getPresetAspectRatio(presetId) {
  const preset = getSizePresetById(presetId);
  return preset.outputWidth / preset.outputHeight;
}
