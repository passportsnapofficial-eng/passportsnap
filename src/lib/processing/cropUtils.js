function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function loadImageElement(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = source;
  });
}

export function getCenteredPassportCrop(sourceWidth, sourceHeight, targetAspectRatio = 1, options = {}) {
  let cropWidth = sourceWidth;
  let cropHeight = sourceHeight;

  if (sourceWidth / sourceHeight > targetAspectRatio) {
    cropHeight = sourceHeight;
    cropWidth = cropHeight * targetAspectRatio;
  } else {
    cropWidth = sourceWidth;
    cropHeight = cropWidth / targetAspectRatio;
  }

  const focusBox = options.focusBox || null;
  const maxOffsetX = Math.max(sourceWidth - cropWidth, 0);
  const maxOffsetY = Math.max(sourceHeight - cropHeight, 0);
  const defaultOffsetX = maxOffsetX / 2;
  const defaultOffsetY = maxOffsetY ? clamp(maxOffsetY * 0.18, 0, maxOffsetY) : 0;
  let offsetX = defaultOffsetX;
  let offsetY = defaultOffsetY;

  if (focusBox) {
    const faceCenterX = focusBox.x + focusBox.width / 2;
    const faceCenterY = focusBox.y + focusBox.height / 2;
    offsetX = clamp(faceCenterX - cropWidth / 2, 0, maxOffsetX);
    offsetY = clamp(faceCenterY - cropHeight * 0.42, 0, maxOffsetY);
  }

  return {
    x: Math.round(offsetX),
    y: Math.round(offsetY),
    width: Math.round(cropWidth),
    height: Math.round(cropHeight),
  };
}

function getRegionStats(ctx, x, y, width, height) {
  const data = ctx.getImageData(x, y, width, height).data;
  let total = 0;
  let pixels = 0;
  let min = 255;
  let max = 0;
  let darkPixels = 0;
  let brightPixels = 0;

  for (let index = 0; index < data.length; index += 4) {
    const red = data[index];
    const green = data[index + 1];
    const blue = data[index + 2];
    const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
    total += luminance;
    pixels += 1;
    min = Math.min(min, luminance);
    max = Math.max(max, luminance);

    if (luminance < 55) {
      darkPixels += 1;
    }

    if (luminance > 220) {
      brightPixels += 1;
    }
  }

  if (!pixels) {
    return {
      average: 0,
      min: 0,
      max: 0,
      contrast: 0,
      darkRatio: 0,
      brightRatio: 0,
    };
  }

  return {
    average: total / pixels,
    min,
    max,
    contrast: max - min,
    darkRatio: darkPixels / pixels,
    brightRatio: brightPixels / pixels,
  };
}

export function analyzeFrame(ctx, width, height) {
  const basis = Math.min(width, height);
  const sample = Math.max(12, Math.floor(basis * 0.15));
  const centerBox = Math.max(16, Math.floor(basis * 0.22));
  const corners = [
    getRegionStats(ctx, 0, 0, sample, sample),
    getRegionStats(ctx, width - sample, 0, sample, sample),
    getRegionStats(ctx, 0, height - sample, sample, sample),
    getRegionStats(ctx, width - sample, height - sample, sample, sample),
  ];
  const center = getRegionStats(
    ctx,
    Math.floor((width - centerBox) / 2),
    Math.floor((height - centerBox) / 2),
    centerBox,
    centerBox,
  );
  const overall = getRegionStats(ctx, 0, 0, width, height);
  const cornerAverages = corners.map((corner) => corner.average);
  const cornerMins = corners.map((corner) => corner.min);
  const cornerContrasts = corners.map((corner) => corner.contrast);

  return {
    cornerLuminance: cornerAverages.reduce((sum, value) => sum + value, 0) / cornerAverages.length,
    cornerMinLuminance: Math.min(...cornerMins),
    cornerSpread: Math.max(...cornerAverages) - Math.min(...cornerAverages),
    cornerContrast: cornerContrasts.reduce((sum, value) => sum + value, 0) / cornerContrasts.length,
    centerLuminance: center.average,
    centerContrast: center.contrast,
    centerDarkRatio: center.darkRatio,
    centerBrightRatio: center.brightRatio,
    overallLuminance: overall.average,
    overallDarkRatio: overall.darkRatio,
    overallBrightRatio: overall.brightRatio,
  };
}

export function canvasToBlob(canvas, type = 'image/jpeg', quality = 0.92) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });
}
