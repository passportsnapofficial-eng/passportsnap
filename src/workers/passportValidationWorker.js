import { projectFaceDetectionToCrop } from '../lib/processing/faceDetection';
import { classifyEyewearFromCanvas } from '../lib/processing/eyewearClassifierRuntime';

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function round(value) {
  return Math.round(value);
}

function averagePoints(points) {
  if (!points.length) {
    return { x: 0, y: 0, z: 0 };
  }

  const total = points.reduce(
    (sum, point) => ({
      x: sum.x + Number(point?.x || 0),
      y: sum.y + Number(point?.y || 0),
      z: sum.z + Number(point?.z || 0),
    }),
    { x: 0, y: 0, z: 0 },
  );

  return {
    x: total.x / points.length,
    y: total.y / points.length,
    z: total.z / points.length,
  };
}

function getPoint(points, index) {
  return points[index] || { x: 0, y: 0, z: 0 };
}

function createCanvas(width, height) {
  if (typeof OffscreenCanvas !== 'function') {
    throw new Error('OffscreenCanvas is unavailable in this browser.');
  }

  return new OffscreenCanvas(width, height);
}

async function loadBitmap(source) {
  const response = await fetch(source);
  const blob = await response.blob();
  return createImageBitmap(blob);
}

function getFallbackCrop(sourceWidth, sourceHeight, targetAspectRatio) {
  let cropWidth = sourceWidth;
  let cropHeight = sourceHeight;

  if (sourceWidth / sourceHeight > targetAspectRatio) {
    cropHeight = sourceHeight;
    cropWidth = cropHeight * targetAspectRatio;
  } else {
    cropWidth = sourceWidth;
    cropHeight = cropWidth / targetAspectRatio;
  }

  return {
    x: round((sourceWidth - cropWidth) / 2),
    y: round(clamp((sourceHeight - cropHeight) * 0.18, 0, sourceHeight - cropHeight)),
    width: round(cropWidth),
    height: round(cropHeight),
  };
}

function getFullImageCrop(sourceWidth, sourceHeight) {
  return {
    x: 0,
    y: 0,
    width: round(sourceWidth),
    height: round(sourceHeight),
  };
}

function getPassportCrop(sourceWidth, sourceHeight, targetAspectRatio, faceDetection, options = {}) {
  const { respectSourceFraming = false } = options;

  if (respectSourceFraming) {
    return getFullImageCrop(sourceWidth, sourceHeight);
  }

  const fallbackCrop = getFallbackCrop(sourceWidth, sourceHeight, targetAspectRatio);
  const primaryFace = faceDetection?.primaryFace || null;

  if (!primaryFace) {
    return fallbackCrop;
  }

  const desiredHeadRatio = 0.7;
  let cropHeight = primaryFace.boundingBox.height / desiredHeadRatio;
  cropHeight = clamp(cropHeight, sourceHeight * 0.52, sourceHeight);
  let cropWidth = cropHeight * targetAspectRatio;

  if (cropWidth > sourceWidth) {
    cropWidth = sourceWidth;
    cropHeight = cropWidth / targetAspectRatio;
  }

  if (cropHeight > sourceHeight) {
    cropHeight = sourceHeight;
    cropWidth = cropHeight * targetAspectRatio;
  }

  const faceCenterX = primaryFace.centerX;
  const faceCenterY = primaryFace.centerY;
  const desiredFaceCenterY = cropHeight * 0.43;
  const maxOffsetX = Math.max(sourceWidth - cropWidth, 0);
  const maxOffsetY = Math.max(sourceHeight - cropHeight, 0);

  return {
    x: round(clamp(faceCenterX - cropWidth / 2, 0, maxOffsetX)),
    y: round(clamp(faceCenterY - desiredFaceCenterY, 0, maxOffsetY)),
    width: round(cropWidth),
    height: round(cropHeight),
  };
}

function getLuminance(red, green, blue) {
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function getSaturation(red, green, blue) {
  const r = red / 255;
  const g = green / 255;
  const b = blue / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);

  if (max === 0) {
    return 0;
  }

  return (max - min) / max;
}

function createSummary() {
  return {
    count: 0,
    redSum: 0,
    greenSum: 0,
    blueSum: 0,
    luminanceSum: 0,
    luminanceSquaredSum: 0,
    saturationSum: 0,
    saturationSquaredSum: 0,
    minLuminance: 255,
    maxLuminance: 0,
    darkPixels: 0,
    brightPixels: 0,
  };
}

function updateSummary(summary, red, green, blue) {
  const luminance = getLuminance(red, green, blue);
  const saturation = getSaturation(red, green, blue);

  summary.count += 1;
  summary.redSum += red;
  summary.greenSum += green;
  summary.blueSum += blue;
  summary.luminanceSum += luminance;
  summary.luminanceSquaredSum += luminance * luminance;
  summary.saturationSum += saturation;
  summary.saturationSquaredSum += saturation * saturation;
  summary.minLuminance = Math.min(summary.minLuminance, luminance);
  summary.maxLuminance = Math.max(summary.maxLuminance, luminance);

  if (luminance < 72) {
    summary.darkPixels += 1;
  }

  if (luminance > 224) {
    summary.brightPixels += 1;
  }
}

function finalizeSummary(summary) {
  if (!summary.count) {
    return {
      count: 0,
      meanRed: 0,
      meanGreen: 0,
      meanBlue: 0,
      meanLuminance: 0,
      luminanceStdDev: 0,
      meanSaturation: 0,
      saturationStdDev: 0,
      contrast: 0,
      darkRatio: 0,
      brightRatio: 0,
    };
  }

  const meanLuminance = summary.luminanceSum / summary.count;
  const meanSaturation = summary.saturationSum / summary.count;

  return {
    count: summary.count,
    meanRed: summary.redSum / summary.count,
    meanGreen: summary.greenSum / summary.count,
    meanBlue: summary.blueSum / summary.count,
    meanLuminance,
    luminanceStdDev: Math.sqrt(
      Math.max(summary.luminanceSquaredSum / summary.count - meanLuminance * meanLuminance, 0),
    ),
    meanSaturation,
    saturationStdDev: Math.sqrt(
      Math.max(summary.saturationSquaredSum / summary.count - meanSaturation * meanSaturation, 0),
    ),
    contrast: summary.maxLuminance - summary.minLuminance,
    darkRatio: summary.darkPixels / summary.count,
    brightRatio: summary.brightPixels / summary.count,
  };
}

function summarizePixels(imageData, width, height, selector) {
  const summary = createSummary();
  const data = imageData.data;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      if (!selector(x, y, index)) {
        continue;
      }

      updateSummary(summary, data[index], data[index + 1], data[index + 2]);
    }
  }

  return finalizeSummary(summary);
}

function getForegroundMaskValue(maskData, maskWidth, maskHeight, crop, sourceWidth, sourceHeight, targetX, targetY, targetWidth, targetHeight, foregroundIndexes) {
  const sourceX = crop.x + ((targetX + 0.5) / targetWidth) * crop.width;
  const sourceY = crop.y + ((targetY + 0.5) / targetHeight) * crop.height;
  const maskX = clamp(Math.floor((sourceX / sourceWidth) * maskWidth), 0, maskWidth - 1);
  const maskY = clamp(Math.floor((sourceY / sourceHeight) * maskHeight), 0, maskHeight - 1);
  const category = maskData[maskY * maskWidth + maskX];

  return foregroundIndexes.includes(category) ? 1 : 0;
}

function smoothMask(mask, width, height) {
  const smoothed = new Uint8Array(mask.length);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let count = 0;

      for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
        for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
          const nextX = x + offsetX;
          const nextY = y + offsetY;

          if (nextX < 0 || nextY < 0 || nextX >= width || nextY >= height) {
            continue;
          }

          count += mask[nextY * width + nextX];
        }
      }

      smoothed[y * width + x] = count >= 5 ? 1 : 0;
    }
  }

  return smoothed;
}

function dilateMask(mask, width, height, radius = 1) {
  if (radius <= 0) {
    return mask;
  }

  const dilated = new Uint8Array(mask.length);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let filled = 0;

      for (let offsetY = -radius; offsetY <= radius && !filled; offsetY += 1) {
        for (let offsetX = -radius; offsetX <= radius; offsetX += 1) {
          const nextX = x + offsetX;
          const nextY = y + offsetY;

          if (nextX < 0 || nextY < 0 || nextX >= width || nextY >= height) {
            continue;
          }

          if (mask[nextY * width + nextX]) {
            filled = 1;
            break;
          }
        }
      }

      dilated[y * width + x] = filled;
    }
  }

  return dilated;
}

function buildForegroundMask(segmentation, crop, sourceWidth, sourceHeight, targetWidth, targetHeight) {
  if (!segmentation?.categoryMask?.data) {
    return null;
  }

  const { data, width, height } = segmentation.categoryMask;
  const foregroundIndexes = Array.isArray(segmentation.foregroundIndexes) && segmentation.foregroundIndexes.length
    ? segmentation.foregroundIndexes
    : [1];
  const mask = new Uint8Array(targetWidth * targetHeight);

  for (let y = 0; y < targetHeight; y += 1) {
    for (let x = 0; x < targetWidth; x += 1) {
      mask[y * targetWidth + x] = getForegroundMaskValue(
        data,
        width,
        height,
        crop,
        sourceWidth,
        sourceHeight,
        x,
        y,
        targetWidth,
        targetHeight,
        foregroundIndexes,
      );
    }
  }

  return {
    width: targetWidth,
    height: targetHeight,
    data: smoothMask(mask, targetWidth, targetHeight),
  };
}

function getComponents(mask, width, height) {
  const visited = new Uint8Array(mask.length);
  const components = [];
  const queue = [];

  for (let index = 0; index < mask.length; index += 1) {
    if (!mask[index] || visited[index]) {
      continue;
    }

    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;
    let size = 0;
    visited[index] = 1;
    queue.push(index);

    while (queue.length) {
      const current = queue.pop();
      const x = current % width;
      const y = Math.floor(current / width);
      size += 1;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);

      const neighbors = [
        current - 1,
        current + 1,
        current - width,
        current + width,
      ];

      neighbors.forEach((neighbor) => {
        if (neighbor < 0 || neighbor >= mask.length || visited[neighbor] || !mask[neighbor]) {
          return;
        }

        const neighborX = neighbor % width;
        const neighborY = Math.floor(neighbor / width);

        if (Math.abs(neighborX - x) + Math.abs(neighborY - y) !== 1) {
          return;
        }

        visited[neighbor] = 1;
        queue.push(neighbor);
      });
    }

    components.push({
      size,
      boundingBox: {
        x: minX,
        y: minY,
        width: maxX - minX + 1,
        height: maxY - minY + 1,
      },
    });
  }

  return components.sort((left, right) => right.size - left.size);
}

function buildGrayscale(imageData, width, height) {
  const grayscale = new Float32Array(width * height);
  const data = imageData.data;

  for (let index = 0; index < grayscale.length; index += 1) {
    const pixelIndex = index * 4;
    grayscale[index] = getLuminance(
      data[pixelIndex],
      data[pixelIndex + 1],
      data[pixelIndex + 2],
    );
  }

  return grayscale;
}

function getRectBounds(rect, width, height) {
  const x = clamp(Math.floor(rect.x), 0, width - 1);
  const y = clamp(Math.floor(rect.y), 0, height - 1);

  return {
    x,
    y,
    width: clamp(Math.ceil(rect.width), 1, width - x),
    height: clamp(Math.ceil(rect.height), 1, height - y),
  };
}

function expandRect(rect, width, height, options = {}) {
  const {
    paddingXRatio = 0.18,
    paddingTopRatio = 0.24,
    paddingBottomRatio = 0.16,
  } = options;

  const paddingX = rect.width * paddingXRatio;
  const paddingTop = rect.height * paddingTopRatio;
  const paddingBottom = rect.height * paddingBottomRatio;

  return getRectBounds(
    {
      x: rect.x - paddingX,
      y: rect.y - paddingTop,
      width: rect.width + paddingX * 2,
      height: rect.height + paddingTop + paddingBottom,
    },
    width,
    height,
  );
}

function computeLaplacianVariance(grayscale, width, height, rect) {
  const bounds = getRectBounds(rect, width, height);
  const values = [];

  for (let y = bounds.y + 1; y < bounds.y + bounds.height - 1; y += 1) {
    for (let x = bounds.x + 1; x < bounds.x + bounds.width - 1; x += 1) {
      const center = grayscale[y * width + x];
      const laplacian =
        grayscale[(y - 1) * width + x] +
        grayscale[(y + 1) * width + x] +
        grayscale[y * width + x - 1] +
        grayscale[y * width + x + 1] -
        4 * center;

      values.push(laplacian);
    }
  }

  if (!values.length) {
    return 0;
  }

  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;

  return variance;
}

function computeSharpnessQuality({
  faceVariance,
  portraitVariance,
  faceEdgeDensity,
  portraitEdgeDensity,
}) {
  const varianceScore = clamp(
    Math.max(faceVariance / 44, portraitVariance / 58),
    0,
    1,
  );
  const edgeDensityScore = clamp(
    Math.max(faceEdgeDensity / 0.075, portraitEdgeDensity / 0.065),
    0,
    1,
  );

  return varianceScore * 0.72 + edgeDensityScore * 0.28;
}

function computeEdgeDensity(grayscale, width, height, selector) {
  let edgePixels = 0;
  let totalPixels = 0;

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      if (!selector(x, y)) {
        continue;
      }

      const center = grayscale[y * width + x];
      const diff =
        Math.abs(grayscale[y * width + x - 1] - center) +
        Math.abs(grayscale[y * width + x + 1] - center) +
        Math.abs(grayscale[(y - 1) * width + x] - center) +
        Math.abs(grayscale[(y + 1) * width + x] - center);

      totalPixels += 1;
      if (diff >= 48) {
        edgePixels += 1;
      }
    }
  }

  return totalPixels ? edgePixels / totalPixels : 0;
}

function getRectSummary(imageData, width, height, rect) {
  const bounds = getRectBounds(rect, width, height);
  return summarizePixels(
    imageData,
    width,
    height,
    (x, y) =>
      x >= bounds.x &&
      x < bounds.x + bounds.width &&
      y >= bounds.y &&
      y < bounds.y + bounds.height,
  );
}

function getRegionSummary(imageData, grayscale, width, height, selector) {
  return {
    ...summarizePixels(imageData, width, height, selector),
    edgeDensity: computeEdgeDensity(grayscale, width, height, selector),
  };
}

function buildBorderBackgroundStats(imageData, grayscale, width, height, primaryFace) {
  const subjectRect = primaryFace
    ? expandRect(primaryFace.boundingBox, width, height, {
        paddingXRatio: 0.42,
        paddingTopRatio: 0.3,
        paddingBottomRatio: 0.72,
      })
    : getRectBounds(
        {
          x: width * 0.18,
          y: height * 0.08,
          width: width * 0.64,
          height: height * 0.82,
        },
        width,
        height,
      );
  const topBandHeight = clamp(Math.round(height * 0.2), 40, Math.round(height * 0.28));
  const sideBandWidth = clamp(Math.round(width * 0.13), 28, Math.round(width * 0.2));
  const sideBandMaxY = Math.round(height * 0.8);
  const selector = (x, y) => {
    const insideSubject =
      x >= subjectRect.x &&
      x < subjectRect.x + subjectRect.width &&
      y >= subjectRect.y &&
      y < subjectRect.y + subjectRect.height;
    const inTopBand = y < topBandHeight;
    const inSideBand = y < sideBandMaxY && (x < sideBandWidth || x >= width - sideBandWidth);

    return !insideSubject && (inTopBand || inSideBand);
  };

  return getRegionSummary(imageData, grayscale, width, height, selector);
}

function chooseBackgroundReference(primaryStats, fallbackStats, minimumCount) {
  if (primaryStats.count >= minimumCount) {
    return primaryStats;
  }

  return fallbackStats;
}

function evaluateHeadShadow(shadowSummary, backgroundStats) {
  if (shadowSummary.count >= 40) {
    return shadowSummary.meanLuminance >= 92 && shadowSummary.darkRatio <= 0.58;
  }

  return (
    backgroundStats.count > 0 &&
    backgroundStats.meanLuminance >= 148 &&
    backgroundStats.darkRatio <= 0.18 &&
    backgroundStats.luminanceStdDev <= 48 &&
    backgroundStats.edgeDensity <= 0.34
  );
}

function buildLightingAnalysis(imageData, width, height, primaryFace) {
  if (!primaryFace) {
    return {
      supported: false,
      evenLighting: false,
      exposureOkay: false,
      leftMeanLuminance: 0,
      rightMeanLuminance: 0,
      balanceDelta: 0,
      faceMeanLuminance: 0,
      faceContrast: 0,
      faceMeanSaturation: 0,
      harshShadow: true,
      overexposed: false,
      underexposed: true,
      eyesVisible: false,
      eyeLevelOkay: false,
      eyeContrastMin: 0,
    };
  }

  const faceBox = primaryFace.boundingBox;
  const leftRect = {
    x: faceBox.x + faceBox.width * 0.18,
    y: faceBox.y + faceBox.height * 0.28,
    width: faceBox.width * 0.22,
    height: faceBox.height * 0.34,
  };
  const rightRect = {
    x: faceBox.x + faceBox.width * 0.6,
    y: faceBox.y + faceBox.height * 0.28,
    width: faceBox.width * 0.22,
    height: faceBox.height * 0.34,
  };
  const faceRect = {
    x: faceBox.x + faceBox.width * 0.14,
    y: faceBox.y + faceBox.height * 0.16,
    width: faceBox.width * 0.72,
    height: faceBox.height * 0.72,
  };

  const leftStats = getRectSummary(imageData, width, height, leftRect);
  const rightStats = getRectSummary(imageData, width, height, rightRect);
  const faceStats = getRectSummary(imageData, width, height, faceRect);
  const leftEyeStats = getRectSummary(imageData, width, height, {
    x: primaryFace.landmarks[33].x - faceBox.width * 0.09,
    y: primaryFace.landmarks[33].y - faceBox.height * 0.05,
    width: faceBox.width * 0.18,
    height: faceBox.height * 0.1,
  });
  const rightEyeStats = getRectSummary(imageData, width, height, {
    x: primaryFace.landmarks[263].x - faceBox.width * 0.09,
    y: primaryFace.landmarks[263].y - faceBox.height * 0.05,
    width: faceBox.width * 0.18,
    height: faceBox.height * 0.1,
  });
  const noseStats = getRectSummary(imageData, width, height, {
    x: primaryFace.landmarks[1].x - faceBox.width * 0.08,
    y: primaryFace.landmarks[1].y - faceBox.height * 0.08,
    width: faceBox.width * 0.16,
    height: faceBox.height * 0.18,
  });
  const mouthStats = getRectSummary(imageData, width, height, {
    x: primaryFace.landmarks[13].x - faceBox.width * 0.16,
    y: primaryFace.landmarks[13].y - faceBox.height * 0.05,
    width: faceBox.width * 0.32,
    height: faceBox.height * 0.16,
  });
  const balanceDelta = Math.abs(leftStats.meanLuminance - rightStats.meanLuminance);
  const eyeContrastMin = Math.min(leftEyeStats.contrast, rightEyeStats.contrast);
  const evenLighting = balanceDelta <= 24 && faceStats.luminanceStdDev <= 46;
  const overexposed = faceStats.meanLuminance >= 232 || faceStats.brightRatio >= 0.2;
  const underexposed =
    faceStats.darkRatio >= 0.52 ||
    (faceStats.meanLuminance <= 46 && faceStats.darkRatio >= 0.38 && eyeContrastMin < 12);
  const harshShadow = balanceDelta >= 36 || faceStats.contrast >= 156;
  const exposureOkay = !overexposed && !underexposed;
  const eyesVisible = eyeContrastMin >= 18 && leftEyeStats.meanLuminance >= 45 && rightEyeStats.meanLuminance >= 45;
  const noseVisible = noseStats.contrast >= 12 && noseStats.meanLuminance >= 42;
  const mouthVisible = mouthStats.contrast >= 14 && mouthStats.meanLuminance >= 36;

  return {
    supported: true,
    evenLighting,
    exposureOkay,
    leftMeanLuminance: leftStats.meanLuminance,
    rightMeanLuminance: rightStats.meanLuminance,
    balanceDelta,
    faceMeanLuminance: faceStats.meanLuminance,
    faceContrast: faceStats.contrast,
    faceMeanSaturation: faceStats.meanSaturation,
    harshShadow,
    overexposed,
    underexposed,
    eyesVisible,
    noseVisible,
    mouthVisible,
    eyeLevelOkay: primaryFace.eyesLevel,
    eyeContrastMin,
  };
}

function buildBackgroundAnalysis(imageData, width, height, foregroundMask, primaryFace) {
  const grayscale = buildGrayscale(imageData, width, height);
  const borderBackgroundStats = buildBorderBackgroundStats(imageData, grayscale, width, height, primaryFace);

  if (!foregroundMask) {
    const borderTone = classifyBackgroundTone(borderBackgroundStats);

    return {
      supported: false,
      plainBackground:
        borderBackgroundStats.count >= width * height * 0.04 &&
        [
          borderBackgroundStats.luminanceStdDev <= 40,
          borderBackgroundStats.saturationStdDev <= 0.18,
          borderBackgroundStats.edgeDensity <= 0.3,
        ].filter(Boolean).length >= 2 &&
        borderBackgroundStats.edgeDensity <= 0.34,
      lightBackground:
        borderBackgroundStats.count >= width * height * 0.04 &&
        borderBackgroundStats.meanLuminance >= 136 &&
        borderBackgroundStats.darkRatio <= 0.22,
      noShadowBehindHead: false,
      noBackgroundDistractions: true,
      meanRed: borderBackgroundStats.meanRed,
      meanGreen: borderBackgroundStats.meanGreen,
      meanBlue: borderBackgroundStats.meanBlue,
      meanLuminance: borderBackgroundStats.meanLuminance,
      luminanceStdDev: borderBackgroundStats.luminanceStdDev,
      meanSaturation: borderBackgroundStats.meanSaturation,
      saturationStdDev: borderBackgroundStats.saturationStdDev,
      edgeDensity: borderBackgroundStats.edgeDensity,
      backgroundTone: borderTone.tone,
      backgroundToneLabel: borderTone.label,
      backgroundToneConfidence: borderTone.confidence,
      channelSpread: borderTone.channelSpread,
      warmBias: borderTone.warmBias,
      backgroundSampleSource: 'border',
      shadowDarkRatio: 1,
      secondaryForegroundRatio: 1,
      shouldersVisible: false,
    };
  }

  const mask = foregroundMask.data;
  const expandedMask = dilateMask(
    mask,
    width,
    height,
    clamp(Math.round(Math.min(width, height) * 0.012), 3, 8),
  );
  const components = getComponents(mask, width, height);
  const largestComponent = components[0] || null;
  const largeComponents = components.filter((component) => component.size >= width * height * 0.01);
  const primaryComponentSize = largestComponent?.size || 1;
  const secondaryForegroundPixels = largeComponents.slice(1).reduce((sum, component) => sum + component.size, 0);
  const secondaryForegroundRatio = secondaryForegroundPixels / primaryComponentSize;
  const expandedBackgroundStats = getRegionSummary(
    imageData,
    grayscale,
    width,
    height,
    (x, y) => !expandedMask[y * width + x],
  );
  const rawBackgroundStats = getRegionSummary(
    imageData,
    grayscale,
    width,
    height,
    (x, y) => !mask[y * width + x],
  );
  const segmentationBackgroundStats = chooseBackgroundReference(
    expandedBackgroundStats,
    rawBackgroundStats,
    width * height * 0.12,
  );
  const preferredBackgroundStats = chooseBackgroundReference(
    borderBackgroundStats,
    segmentationBackgroundStats,
    width * height * 0.04,
  );

  let shadowSummary = {
    count: 0,
    meanLuminance: 0,
    darkRatio: 1,
  };

  if (primaryFace) {
    const expandedHeadRect = {
      x: primaryFace.boundingBox.x - primaryFace.boundingBox.width * 0.1,
      y: primaryFace.boundingBox.y - primaryFace.boundingBox.height * 0.08,
      width: primaryFace.boundingBox.width * 1.2,
      height: primaryFace.boundingBox.height * 0.72,
    };
    shadowSummary = summarizePixels(
      imageData,
      width,
      height,
      (x, y) => {
        const inExpandedRect =
          x >= expandedHeadRect.x &&
          x < expandedHeadRect.x + expandedHeadRect.width &&
          y >= expandedHeadRect.y &&
          y < expandedHeadRect.y + expandedHeadRect.height;
        const inFaceBox =
          x >= primaryFace.boundingBox.x &&
          x < primaryFace.boundingBox.x + primaryFace.boundingBox.width &&
          y >= primaryFace.boundingBox.y &&
          y < primaryFace.boundingBox.y + primaryFace.boundingBox.height;

        return inExpandedRect && !inFaceBox && !expandedMask[y * width + x];
      },
    );
  }

  const shouldersVisible = Boolean(
    largestComponent &&
      largestComponent.boundingBox.width >= (primaryFace?.boundingBox.width || 0) * 1.1 &&
      largestComponent.boundingBox.height >= height * 0.62,
  );
  const backgroundTone = classifyBackgroundTone(preferredBackgroundStats);
  const noShadowBehindHead = evaluateHeadShadow(shadowSummary, preferredBackgroundStats);

  return {
    supported: true,
    plainBackground:
      [
        preferredBackgroundStats.luminanceStdDev <= 40,
        preferredBackgroundStats.saturationStdDev <= 0.18,
        preferredBackgroundStats.edgeDensity <= 0.3,
      ].filter(Boolean).length >= 2 &&
      preferredBackgroundStats.edgeDensity <= 0.34,
    lightBackground:
      preferredBackgroundStats.meanLuminance >= 136 &&
      preferredBackgroundStats.darkRatio <= 0.22,
    noShadowBehindHead,
    noBackgroundDistractions: secondaryForegroundRatio <= 0.035,
    meanLuminance: preferredBackgroundStats.meanLuminance,
    meanRed: preferredBackgroundStats.meanRed,
    meanGreen: preferredBackgroundStats.meanGreen,
    meanBlue: preferredBackgroundStats.meanBlue,
    luminanceStdDev: preferredBackgroundStats.luminanceStdDev,
    meanSaturation: preferredBackgroundStats.meanSaturation,
    saturationStdDev: preferredBackgroundStats.saturationStdDev,
    edgeDensity: preferredBackgroundStats.edgeDensity,
    backgroundTone: backgroundTone.tone,
    backgroundToneLabel: backgroundTone.label,
    backgroundToneConfidence: backgroundTone.confidence,
    channelSpread: backgroundTone.channelSpread,
    warmBias: backgroundTone.warmBias,
    backgroundSampleSource:
      preferredBackgroundStats === borderBackgroundStats ? 'border' : 'segmentation',
    shadowSampleCount: shadowSummary.count,
    shadowMeanLuminance: shadowSummary.meanLuminance,
    shadowDarkRatio: shadowSummary.darkRatio,
    secondaryForegroundRatio,
    shouldersVisible,
  };
}

function getFaceRect(primaryFace) {
  if (!primaryFace) {
    return {
      x: 0,
      y: 0,
      width: 1,
      height: 1,
    };
  }

  return {
    x: primaryFace.boundingBox.x,
    y: primaryFace.boundingBox.y,
    width: primaryFace.boundingBox.width,
    height: primaryFace.boundingBox.height,
  };
}

function classifyBackgroundTone(backgroundStats) {
  const meanRed = Number(backgroundStats?.meanRed || 0);
  const meanGreen = Number(backgroundStats?.meanGreen || 0);
  const meanBlue = Number(backgroundStats?.meanBlue || 0);
  const channelSpread = Math.max(meanRed, meanGreen, meanBlue) - Math.min(meanRed, meanGreen, meanBlue);
  const warmBias = meanRed - meanBlue;
  const meanLuminance = Number(backgroundStats?.meanLuminance || 0);
  const meanSaturation = Number(backgroundStats?.meanSaturation || 0);
  const nearNeutral = meanSaturation <= 0.14 && channelSpread <= 28;
  const lightlyWarm =
    meanRed >= meanGreen &&
    meanGreen >= meanBlue &&
    warmBias >= 6 &&
    warmBias <= 52 &&
    channelSpread <= 50 &&
    meanSaturation <= 0.24;

  if (meanLuminance >= 184 && nearNeutral) {
    return {
      tone: 'white',
      label: 'White',
      confidence: 0.9,
      channelSpread,
      warmBias,
    };
  }

  if (meanLuminance >= 160 && lightlyWarm) {
    return {
      tone: 'cream',
      label: 'Light cream',
      confidence: 0.78,
      channelSpread,
      warmBias,
    };
  }

  if (meanLuminance >= 130 && nearNeutral) {
    return {
      tone: 'grey',
      label: 'Light grey',
      confidence: 0.8,
      channelSpread,
      warmBias,
    };
  }

  return {
    tone: 'other',
    label: 'Other',
    confidence: meanLuminance >= 120 ? 0.7 : 0.92,
    channelSpread,
    warmBias,
  };
}

function getRectSelector(bounds) {
  return (x, y) =>
    x >= bounds.x &&
    x < bounds.x + bounds.width &&
    y >= bounds.y &&
    y < bounds.y + bounds.height;
}

function analyzeRectRegion(imageData, grayscale, width, height, rect, thresholds = {}) {
  const bounds = getRectBounds(rect, width, height);
  const selector = getRectSelector(bounds);
  const summary = summarizePixels(imageData, width, height, selector);
  const edgeDensity = computeEdgeDensity(grayscale, width, height, selector);
  const dynamicDarkThreshold = Number.isFinite(thresholds.dynamicDarkThreshold)
    ? thresholds.dynamicDarkThreshold
    : 64;
  const highlightThreshold = Number.isFinite(thresholds.highlightThreshold)
    ? thresholds.highlightThreshold
    : 232;

  let darkPixels = 0;
  let highlightPixels = 0;
  let total = 0;

  for (let y = bounds.y; y < bounds.y + bounds.height; y += 1) {
    for (let x = bounds.x; x < bounds.x + bounds.width; x += 1) {
      const luminance = grayscale[y * width + x];
      total += 1;

      if (luminance <= dynamicDarkThreshold) {
        darkPixels += 1;
      }

      if (luminance >= highlightThreshold) {
        highlightPixels += 1;
      }
    }
  }

  return {
    ...summary,
    edgeDensity,
    dynamicDarkRatio: total ? darkPixels / total : 0,
    highlightRatio: total ? highlightPixels / total : 0,
  };
}

function buildHeuristicEyewearAnalysis(imageData, grayscale, width, height, primaryFace) {
  if (!primaryFace) {
    return {
      supported: false,
      wearingGlasses: false,
      eyewearScore: 0,
      eyeBandDarkRatio: 0,
      eyeBandEdgeDensity: 0,
      averageEyeDarkRatio: 0,
      averageEyeEdgeDensity: 0,
      averageEyeLuminance: 0,
      eyeToFaceLuminanceRatio: 1,
      bridgeDarkRatio: 0,
      bridgeEdgeDensity: 0,
      templeDarkRatio: 0,
      templeEdgeDensity: 0,
      glareRatio: 0,
      eyeContrast: 0,
    };
  }

  const points = Array.isArray(primaryFace.landmarks) ? primaryFace.landmarks : [];
  const faceBox = primaryFace.boundingBox;
  const leftEyeCenter = averagePoints([getPoint(points, 33), getPoint(points, 133), getPoint(points, 159), getPoint(points, 145)]);
  const rightEyeCenter = averagePoints([getPoint(points, 362), getPoint(points, 263), getPoint(points, 386), getPoint(points, 374)]);
  const leftTemple = getPoint(points, 127);
  const rightTemple = getPoint(points, 356);
  const faceRect = {
    x: faceBox.x + faceBox.width * 0.14,
    y: faceBox.y + faceBox.height * 0.12,
    width: faceBox.width * 0.72,
    height: faceBox.height * 0.72,
  };
  const faceStats = getRectSummary(imageData, width, height, faceRect);
  const darkThreshold = Math.max(faceStats.meanLuminance - 48, 34);
  const highlightThreshold = Math.min(faceStats.meanLuminance + 82, 252);
  const eyeBandTop = Math.min(leftEyeCenter.y, rightEyeCenter.y) - faceBox.height * 0.08;
  const eyeBandRect = {
    x: leftTemple.x + faceBox.width * 0.015,
    y: eyeBandTop,
    width: Math.max(rightTemple.x - leftTemple.x - faceBox.width * 0.03, faceBox.width * 0.4),
    height: faceBox.height * 0.24,
  };
  const leftEyeRect = {
    x: leftEyeCenter.x - faceBox.width * 0.16,
    y: leftEyeCenter.y - faceBox.height * 0.085,
    width: faceBox.width * 0.32,
    height: faceBox.height * 0.18,
  };
  const rightEyeRect = {
    x: rightEyeCenter.x - faceBox.width * 0.16,
    y: rightEyeCenter.y - faceBox.height * 0.085,
    width: faceBox.width * 0.32,
    height: faceBox.height * 0.18,
  };
  const bridgeRect = {
    x: Math.min(leftEyeCenter.x, rightEyeCenter.x) + faceBox.width * 0.06,
    y: averagePoints([leftEyeCenter, rightEyeCenter]).y - faceBox.height * 0.055,
    width: Math.max(Math.abs(rightEyeCenter.x - leftEyeCenter.x) - faceBox.width * 0.12, faceBox.width * 0.1),
    height: faceBox.height * 0.14,
  };
  const leftTempleRect = {
    x: leftTemple.x - faceBox.width * 0.02,
    y: leftEyeCenter.y - faceBox.height * 0.04,
    width: faceBox.width * 0.1,
    height: faceBox.height * 0.14,
  };
  const rightTempleRect = {
    x: rightTemple.x - faceBox.width * 0.08,
    y: rightEyeCenter.y - faceBox.height * 0.04,
    width: faceBox.width * 0.1,
    height: faceBox.height * 0.14,
  };
  const regionThresholds = {
    dynamicDarkThreshold: darkThreshold,
    highlightThreshold,
  };
  const eyeBand = analyzeRectRegion(imageData, grayscale, width, height, eyeBandRect, regionThresholds);
  const leftEye = analyzeRectRegion(imageData, grayscale, width, height, leftEyeRect, regionThresholds);
  const rightEye = analyzeRectRegion(imageData, grayscale, width, height, rightEyeRect, regionThresholds);
  const bridge = analyzeRectRegion(imageData, grayscale, width, height, bridgeRect, regionThresholds);
  const leftTempleRegion = analyzeRectRegion(imageData, grayscale, width, height, leftTempleRect, regionThresholds);
  const rightTempleRegion = analyzeRectRegion(imageData, grayscale, width, height, rightTempleRect, regionThresholds);
  const averageEyeDarkRatio = (leftEye.dynamicDarkRatio + rightEye.dynamicDarkRatio) / 2;
  const averageEyeEdgeDensity = (leftEye.edgeDensity + rightEye.edgeDensity) / 2;
  const averageEyeLuminance = (leftEye.meanLuminance + rightEye.meanLuminance) / 2;
  const eyeToFaceLuminanceRatio = averageEyeLuminance / Math.max(faceStats.meanLuminance, 1);
  const templeDarkRatio = (leftTempleRegion.dynamicDarkRatio + rightTempleRegion.dynamicDarkRatio) / 2;
  const templeEdgeDensity = (leftTempleRegion.edgeDensity + rightTempleRegion.edgeDensity) / 2;
  const glareRatio = Math.max(eyeBand.highlightRatio, leftEye.highlightRatio, rightEye.highlightRatio);
  const eyeContrast = Math.max(leftEye.contrast, rightEye.contrast, eyeBand.contrast);
  const likelyFrames =
    eyeBand.dynamicDarkRatio >= 0.13 &&
    Math.max(leftEye.edgeDensity, rightEye.edgeDensity) >= 0.09 &&
    eyeBand.edgeDensity >= 0.09;
  const likelyBridge =
    bridge.dynamicDarkRatio >= 0.13 ||
    (bridge.edgeDensity >= 0.12 && bridge.contrast >= 34);
  const likelyTemples =
    templeDarkRatio >= 0.15 ||
    (templeEdgeDensity >= 0.16 && eyeBand.dynamicDarkRatio >= 0.14);
  const likelyDarkFrames =
    eyeBand.dynamicDarkRatio >= 0.17 &&
    (bridge.dynamicDarkRatio >= 0.13 || templeDarkRatio >= 0.14);
  const likelyGlare =
    glareRatio >= 0.06 &&
    eyeBand.edgeDensity >= 0.08 &&
    (bridge.edgeDensity >= 0.06 || bridge.contrast >= 28);
  const likelyThinFrames =
    bridge.edgeDensity >= 0.14 &&
    glareRatio >= 0.045 &&
    averageEyeEdgeDensity >= 0.18;
  const likelyTempleArms =
    templeEdgeDensity >= 0.16 &&
    (bridge.dynamicDarkRatio >= 0.2 || eyeBand.dynamicDarkRatio >= 0.14);
  const likelyTintedLenses =
    bridge.dynamicDarkRatio >= 0.2 &&
    eyeToFaceLuminanceRatio <= 0.82 &&
    (
      averageEyeDarkRatio >= 0.12 ||
      templeEdgeDensity >= 0.14 ||
      eyeBand.dynamicDarkRatio >= 0.12
    );
  const eyewearScore =
    clamp(eyeBand.dynamicDarkRatio / 0.14, 0, 1) * 0.22 +
    clamp(bridge.dynamicDarkRatio / 0.12, 0, 1) * 0.18 +
    clamp(templeDarkRatio / 0.14, 0, 1) * 0.14 +
    clamp(Math.max(leftEye.edgeDensity, rightEye.edgeDensity) / 0.12, 0, 1) * 0.12 +
    clamp(glareRatio / 0.08, 0, 1) * 0.2 +
    clamp(bridge.edgeDensity / 0.1, 0, 1) * 0.08 +
    clamp(templeEdgeDensity / 0.1, 0, 1) * 0.06;
  const wearingGlasses =
    (likelyFrames && (likelyBridge || likelyTemples || likelyGlare)) ||
    (likelyBridge && likelyTemples) ||
    (likelyGlare && (likelyBridge || likelyTemples)) ||
    (likelyThinFrames && likelyBridge) ||
    (likelyTempleArms && likelyBridge) ||
    likelyTintedLenses ||
    likelyDarkFrames ||
    (eyeContrast >= 60 && likelyGlare && bridge.edgeDensity >= 0.06) ||
    eyewearScore >= 0.84;

  return {
    supported: true,
    wearingGlasses,
    eyewearScore,
    eyeBandDarkRatio: eyeBand.dynamicDarkRatio,
    eyeBandEdgeDensity: eyeBand.edgeDensity,
    averageEyeDarkRatio,
    averageEyeEdgeDensity,
    averageEyeLuminance,
    eyeToFaceLuminanceRatio,
    bridgeDarkRatio: bridge.dynamicDarkRatio,
    bridgeEdgeDensity: bridge.edgeDensity,
    templeDarkRatio,
    templeEdgeDensity,
    glareRatio,
    eyeContrast,
  };
}

async function buildEyewearAnalysis(analysisCanvas, imageData, grayscale, width, height, primaryFace) {
  const heuristic = buildHeuristicEyewearAnalysis(
    imageData,
    grayscale,
    width,
    height,
    primaryFace,
  );
  const learned = await classifyEyewearFromCanvas(
    analysisCanvas,
    primaryFace,
    width,
    height,
  );

  if (!learned?.supported || !learned.modelReady) {
    return {
      ...heuristic,
      heuristicEyewearScore: heuristic.eyewearScore,
      mlEyewearScore: 0,
      mlNoEyewearScore: 0,
      classifierSource: 'heuristic',
      classifierReady: false,
      classifierError: learned?.error || '',
      classifierMargin: 0,
      classifierDecision: false,
    };
  }

  const mlEyewearScore = Number(learned.glassesScore || 0);
  const mlNoEyewearScore = Number(learned.noGlassesScore || 0);
  const classifierMargin = Number(learned.scoreMargin || 0);
  const corroboratedHeuristic =
    heuristic.eyewearScore >= 0.62 &&
    (
      heuristic.bridgeDarkRatio >= 0.13 ||
      heuristic.templeDarkRatio >= 0.15 ||
      heuristic.glareRatio >= 0.05
    );
  const heuristicPositive = heuristic.wearingGlasses || heuristic.eyewearScore >= 0.72;
  const strongModelPositive = mlEyewearScore >= 0.9 && classifierMargin >= 0.22;
  const moderateModelPositive = mlEyewearScore >= 0.78 && classifierMargin >= 0.16;
  const strongModelNegative = mlNoEyewearScore >= 0.72 && classifierMargin <= -0.06;
  const wearingGlasses = strongModelNegative
    ? false
    : (strongModelPositive && corroboratedHeuristic) ||
      (moderateModelPositive && heuristicPositive) ||
      heuristic.eyewearScore >= 0.84 ||
      (mlEyewearScore >= 0.84 && heuristic.glareRatio >= 0.08 && heuristic.bridgeDarkRatio >= 0.15);

  return {
    ...heuristic,
    wearingGlasses,
    heuristicEyewearScore: heuristic.eyewearScore,
    mlEyewearScore,
    mlNoEyewearScore,
    classifierSource: 'ensemble',
    classifierReady: true,
    classifierError: '',
    classifierDecision: Boolean(learned.classifierDecision),
    classifierMargin,
    classifierModelPath: learned.modelPath || '',
    classifierGlassesLabel: learned.glassesLabel || 'glasses',
    classifierNoGlassesLabel: learned.noGlassesLabel || 'no_glasses',
  };
}

function buildRejectionReasons(projectedFaceDetection, lighting, background, sharpness, eyewear) {
  const reasons = [];
  const seen = new Set();
  const primaryFace = projectedFaceDetection?.primaryFace || null;

  const pushReason = (value) => {
    const normalized = String(value || '').trim();
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

  if ((projectedFaceDetection?.facesCount || 0) === 0) {
    pushReason('Face not found');
  }

  if ((projectedFaceDetection?.facesCount || 0) > 1) {
    pushReason('Multiple faces detected');
  }

  if (primaryFace) {
    if (!primaryFace.centered) {
      pushReason('Face not centered');
    }

    if (!primaryFace.eyesLevel) {
      pushReason('Eyes not level');
    }

    if (!primaryFace.headStraight || !primaryFace.lookingForward) {
      pushReason('Look straight at the camera');
    }

    if (!primaryFace.fullFaceVisible || !primaryFace.chinVisible || !primaryFace.crownVisible) {
      pushReason('Full face not visible');
    }

    if (!primaryFace.headSizeOkay) {
      pushReason(primaryFace.headRatio > 0.74 ? 'Face too large' : 'Face too small');
    }

    if (!primaryFace.eyesOpen) {
      pushReason('Eyes are not fully open');
    }

    if (!primaryFace.neutralExpression) {
      pushReason('Keep a neutral expression');
    }

    if (!primaryFace.mouthClosed) {
      pushReason('Keep your mouth closed');
    }
  }

  if (lighting?.supported) {
    if (!lighting.eyesVisible) {
      pushReason('Eyes are not clear enough');
    }

    if (!lighting.exposureOkay) {
      pushReason(lighting.overexposed ? 'Face is too bright' : 'Face is too dark');
    }

    if (!lighting.evenLighting) {
      pushReason('Lighting is uneven');
    }

    if (lighting.harshShadow) {
      pushReason('Harsh shadows on the face');
    }
  }

  if (eyewear?.supported && eyewear.wearingGlasses) {
    pushReason('Remove glasses');
  }

  if (background) {
    if (!background.plainBackground) {
      pushReason('Background is too busy');
    }

    if (!background.lightBackground) {
      pushReason('Background is too dark');
    }

    if (!background.noShadowBehindHead) {
      pushReason('Heavy shadow behind your head');
    }

    if (!background.noBackgroundDistractions) {
      pushReason('Another person or object is in the frame');
    }
  }

  if (sharpness?.supported && !sharpness.sharpEnough) {
    pushReason('Photo is too blurry');
  }

  return reasons.slice(0, 6);
}

async function blobToDataUrl(blob) {
  if (typeof globalThis.FileReaderSync === 'function') {
    const reader = new globalThis.FileReaderSync();
    return reader.readAsDataURL(blob);
  }

  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';

  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }

  return `data:${blob.type};base64,${btoa(binary)}`;
}

function postStage(stageKey, options = {}) {
  const { onStageChange, requestId } = options;

  onStageChange?.(stageKey);

  if (!requestId || typeof globalThis.postMessage !== 'function') {
    return;
  }

  globalThis.postMessage({
    type: 'stage',
    requestId,
    stageKey,
  });
}

export async function validatePassportPhotoPayload(payload, options = {}) {
  const { requestId = null, onStageChange } = options;
  const {
    source,
    exportSource = source,
    preset,
    faceDetection,
    segmentation,
    backgroundRemoval = null,
    respectSourceFraming = false,
  } = payload;

  const image = await loadBitmap(source);
  const exportImage =
    exportSource && exportSource !== source
      ? await loadBitmap(exportSource)
      : image;
  const sourceWidth = image.width;
  const sourceHeight = image.height;
  const exportScaleX = sourceWidth ? exportImage.width / sourceWidth : 1;
  const exportScaleY = sourceHeight ? exportImage.height / sourceHeight : 1;
  const targetAspectRatio = preset.outputWidth / preset.outputHeight;
  const crop = getPassportCrop(sourceWidth, sourceHeight, targetAspectRatio, faceDetection, {
    respectSourceFraming,
  });
  const analysisWidth = clamp(Math.max(preset.outputWidth, 520), 520, 760);
  const analysisHeight = round(analysisWidth / targetAspectRatio);
  const analysisCanvas = createCanvas(analysisWidth, analysisHeight);
  const analysisContext = analysisCanvas.getContext('2d', { willReadFrequently: true });

  if (!analysisContext) {
    throw new Error('Could not create the analysis canvas context.');
  }

  analysisContext.drawImage(
    image,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    analysisWidth,
    analysisHeight,
  );

  let backgroundImageData = null;
  if (backgroundRemoval?.applied) {
    const backgroundCanvas = createCanvas(analysisWidth, analysisHeight);
    const backgroundContext = backgroundCanvas.getContext('2d', { willReadFrequently: true });

    if (backgroundContext) {
      backgroundContext.drawImage(
        exportImage,
        crop.x * exportScaleX,
        crop.y * exportScaleY,
        crop.width * exportScaleX,
        crop.height * exportScaleY,
        0,
        0,
        analysisWidth,
        analysisHeight,
      );
      backgroundImageData = backgroundContext.getImageData(0, 0, analysisWidth, analysisHeight);
    }
  }

  const projectedFaceDetection = projectFaceDetectionToCrop(
    faceDetection,
    crop,
    analysisWidth,
    analysisHeight,
  );
  const primaryFace = projectedFaceDetection.primaryFace || null;
  const foregroundMask = buildForegroundMask(
    segmentation,
    crop,
    sourceWidth,
    sourceHeight,
    analysisWidth,
    analysisHeight,
  );
  const analysisImageData = analysisContext.getImageData(0, 0, analysisWidth, analysisHeight);

  postStage('validate-face', { requestId, onStageChange });
  const faceRect = getFaceRect(primaryFace);
  const grayscale = buildGrayscale(analysisImageData, analysisWidth, analysisHeight);

  postStage('analyze-lighting', { requestId, onStageChange });
  const lighting = buildLightingAnalysis(analysisImageData, analysisWidth, analysisHeight, primaryFace);
  const background = buildBackgroundAnalysis(
    backgroundImageData || analysisImageData,
    analysisWidth,
    analysisHeight,
    foregroundMask,
    primaryFace,
  );
  const eyewear = await buildEyewearAnalysis(
    analysisCanvas,
    analysisImageData,
    grayscale,
    analysisWidth,
    analysisHeight,
    primaryFace,
  );
  const rejectionReasons = buildRejectionReasons(
    projectedFaceDetection,
    lighting,
    background,
    null,
    eyewear,
  );

  postStage('detect-blur', { requestId, onStageChange });
  const portraitRect = expandRect(faceRect, analysisWidth, analysisHeight);
  const faceVariance = computeLaplacianVariance(grayscale, analysisWidth, analysisHeight, faceRect);
  const portraitVariance = computeLaplacianVariance(grayscale, analysisWidth, analysisHeight, portraitRect);
  const faceEdgeDensity = computeEdgeDensity(
    grayscale,
    analysisWidth,
    analysisHeight,
    (x, y) =>
      x >= faceRect.x &&
      x < faceRect.x + faceRect.width &&
      y >= faceRect.y &&
      y < faceRect.y + faceRect.height,
  );
  const portraitEdgeDensity = computeEdgeDensity(
    grayscale,
    analysisWidth,
    analysisHeight,
    (x, y) =>
      x >= portraitRect.x &&
      x < portraitRect.x + portraitRect.width &&
      y >= portraitRect.y &&
      y < portraitRect.y + portraitRect.height,
  );
  const qualityScore = computeSharpnessQuality({
    faceVariance,
    portraitVariance,
    faceEdgeDensity,
    portraitEdgeDensity,
  });
  const sharpness = {
    supported: true,
    laplacianVariance: faceVariance,
    faceLaplacianVariance: faceVariance,
    portraitLaplacianVariance: portraitVariance,
    faceEdgeDensity,
    portraitEdgeDensity,
    qualityScore,
    sharpEnough:
      qualityScore >= 0.18 ||
      faceVariance >= 18 ||
      portraitVariance >= 24 ||
      portraitEdgeDensity >= 0.02 ||
      (faceVariance >= 10 && faceEdgeDensity >= 0.025),
  };
  const finalRejectionReasons = buildRejectionReasons(
    projectedFaceDetection,
    lighting,
    background,
    sharpness,
    eyewear,
  );

  postStage('build-canvas', { requestId, onStageChange });
  // Render the delivered photo at a higher pixel density than the spec size so
  // detail from the high-res source survives. The spec dimensions
  // (preset.outputWidth/Height) still drive aspect ratio and source-resolution
  // validation; only the delivered pixels are denser (600px @ 300 DPI spec ->
  // 1200px @ 600 DPI delivered for the US 2x2in photo).
  const EXPORT_RESOLUTION_SCALE = 2;
  const exportWidth = Math.round(preset.outputWidth * EXPORT_RESOLUTION_SCALE);
  const exportHeight = Math.round(preset.outputHeight * EXPORT_RESOLUTION_SCALE);
  const exportCanvas = createCanvas(exportWidth, exportHeight);
  const exportContext = exportCanvas.getContext('2d');

  if (!exportContext) {
    throw new Error('Could not create the export canvas context.');
  }

  exportContext.fillStyle = '#ffffff';
  exportContext.fillRect(0, 0, exportWidth, exportHeight);
  exportContext.imageSmoothingEnabled = true;
  exportContext.imageSmoothingQuality = 'high';
  exportContext.drawImage(
    exportImage,
    crop.x * exportScaleX,
    crop.y * exportScaleY,
    crop.width * exportScaleX,
    crop.height * exportScaleY,
    0,
    0,
    exportWidth,
    exportHeight,
  );

  postStage('check-output', { requestId, onStageChange });
  const exportBlob = await exportCanvas.convertToBlob({
    type: 'image/png',
  });
  const exportDataUrl = await blobToDataUrl(exportBlob);

  return {
    dataUrl: exportDataUrl,
    blob: exportBlob,
    outputWidth: exportWidth,
    outputHeight: exportHeight,
    targetAspectRatio,
    sourceWidth,
    sourceHeight,
    crop,
    rejectionReasons: finalRejectionReasons.length ? finalRejectionReasons : rejectionReasons,
    analysis: {
      faceDetection: projectedFaceDetection,
      background: {
        ...background,
        segmentationError: segmentation?.error || null,
      },
      eyewear,
      lighting,
      sharpness,
      backgroundRemoval: {
        attempted: Boolean(backgroundRemoval?.attempted),
        applied: Boolean(backgroundRemoval?.applied),
        model: backgroundRemoval?.model || null,
        maskQuality: Number(backgroundRemoval?.maskQuality || 0),
        transparentRatio: Number(backgroundRemoval?.transparentRatio || 0),
        foregroundRatio: Number(backgroundRemoval?.foregroundRatio || 0),
        featherRatio: Number(backgroundRemoval?.featherRatio || 0),
        usedForExport: Boolean(backgroundRemoval?.applied),
        fallbackUsed: Boolean(backgroundRemoval?.fallbackUsed),
        policyRestricted: Boolean(backgroundRemoval?.policyRestricted),
      },
      framing: {
        faceDetected: projectedFaceDetection.facesCount >= 1,
        multipleFaces: projectedFaceDetection.facesCount > 1,
        headRatio: primaryFace?.headRatio || 0,
        headSizeOkay: Boolean(primaryFace?.headSizeOkay),
        faceCentered: Boolean(primaryFace?.centered),
        headStraight: Boolean(primaryFace?.headStraight),
        lookingForward: Boolean(primaryFace?.lookingForward),
        fullFaceVisible: Boolean(primaryFace?.fullFaceVisible),
        sideFaceVisible: Boolean(primaryFace?.sideFaceVisible),
        facialFeaturesClear: Boolean(lighting.eyesVisible && lighting.noseVisible && lighting.mouthVisible),
        chinVisible: Boolean(primaryFace?.chinVisible),
        crownVisible: Boolean(primaryFace?.crownVisible),
        shouldersVisible: background.shouldersVisible,
        positionedWell: Boolean(primaryFace?.positionedWell),
      },
      technical: {
        sourceWidth,
        sourceHeight,
        outputWidth: exportWidth,
        outputHeight: exportHeight,
        outputAspectRatio: preset.outputWidth / preset.outputHeight,
      },
    },
  };
}

const isWorkerRuntime =
  typeof globalThis.WorkerGlobalScope !== 'undefined' &&
  globalThis instanceof globalThis.WorkerGlobalScope;

if (isWorkerRuntime) {
  globalThis.onmessage = async (event) => {
    const { data } = event;

    if (!data || data.type !== 'validate') {
      return;
    }

    try {
      const result = await validatePassportPhotoPayload(data.payload, {
        requestId: data.requestId,
      });
      globalThis.postMessage({
        type: 'result',
        requestId: data.requestId,
        result,
      });
    } catch (error) {
      globalThis.postMessage({
        type: 'error',
        requestId: data.requestId,
        error: error instanceof Error ? error.message : 'Validation worker failed.',
      });
    }
  };
}
