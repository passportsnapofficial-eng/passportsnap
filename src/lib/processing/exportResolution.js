export const MIN_EXPORT_DPI = 600;
export const HIGH_RES_EXPORT_DPI = 600;

function normalizePositiveNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function resolveHighResolutionExport(preset = {}) {
  const presetDpi = normalizePositiveNumber(preset.dpi, MIN_EXPORT_DPI);
  const dpi = Math.max(MIN_EXPORT_DPI, HIGH_RES_EXPORT_DPI, presetDpi);
  const resolutionScale = dpi / presetDpi;
  const width = Math.max(1, Math.round(normalizePositiveNumber(preset.outputWidth, 1) * resolutionScale));
  const height = Math.max(1, Math.round(normalizePositiveNumber(preset.outputHeight, 1) * resolutionScale));

  return {
    dpi,
    width,
    height,
    resolutionScale,
  };
}
