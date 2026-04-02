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

export function getCenteredPassportCrop(sourceWidth, sourceHeight, targetAspectRatio = 1) {
  let cropWidth = sourceWidth;
  let cropHeight = sourceHeight;

  if (sourceWidth / sourceHeight > targetAspectRatio) {
    cropHeight = sourceHeight;
    cropWidth = cropHeight * targetAspectRatio;
  } else {
    cropWidth = sourceWidth;
    cropHeight = cropWidth / targetAspectRatio;
  }

  const offsetX = sourceWidth > cropWidth ? (sourceWidth - cropWidth) / 2 : 0;
  const extraHeight = Math.max(sourceHeight - cropHeight, 0);
  const offsetY = extraHeight ? clamp(extraHeight * 0.18, 0, extraHeight) : 0;

  return {
    x: Math.round(offsetX),
    y: Math.round(offsetY),
    width: Math.round(cropWidth),
    height: Math.round(cropHeight),
  };
}

function getRegionLuminance(ctx, x, y, width, height) {
  const data = ctx.getImageData(x, y, width, height).data;
  let total = 0;
  let pixels = 0;

  for (let index = 0; index < data.length; index += 4) {
    const red = data[index];
    const green = data[index + 1];
    const blue = data[index + 2];
    total += 0.2126 * red + 0.7152 * green + 0.0722 * blue;
    pixels += 1;
  }

  return pixels ? total / pixels : 0;
}

export function analyzeFrame(ctx, width, height) {
  const basis = Math.min(width, height);
  const sample = Math.max(12, Math.floor(basis * 0.15));
  const centerBox = Math.max(16, Math.floor(basis * 0.22));
  const corners = [
    getRegionLuminance(ctx, 0, 0, sample, sample),
    getRegionLuminance(ctx, width - sample, 0, sample, sample),
    getRegionLuminance(ctx, 0, height - sample, sample, sample),
    getRegionLuminance(ctx, width - sample, height - sample, sample, sample),
  ];

  return {
    cornerLuminance: corners.reduce((sum, value) => sum + value, 0) / corners.length,
    centerLuminance: getRegionLuminance(
      ctx,
      Math.floor((width - centerBox) / 2),
      Math.floor((height - centerBox) / 2),
      centerBox,
      centerBox,
    ),
  };
}

export function canvasToBlob(canvas, type = 'image/jpeg', quality = 0.92) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });
}
