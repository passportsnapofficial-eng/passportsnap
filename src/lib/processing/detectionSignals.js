// Skin-tone-robust signal extraction for the eyewear and headwear checks.
//
// The previous detector keyed on absolute sRGB thresholds: a fixed dark-pixel
// cutoff, a fixed gradient magnitude, and a fixed RGB distance from the cheek
// colour. All three encode an assumption that a frame or a hat is much darker
// than the face, which only holds for dark frames on light skin. On a darker
// face the same frame produces a fraction of the contrast, every statistic
// collapses toward zero, and the absence of evidence was being reported as
// positive evidence of absence.
//
// Everything here is measured instead as either
//   - a z-score against the SAME face's own skin statistics, or
//   - a length in inter-ocular distance (IOD) units,
// so no threshold carries an implicit skin tone, exposure or image scale.
//
// Two further consequences of that framing are load-bearing:
//   - Signals are computed on log luminance. Illumination is multiplicative, so
//     in log space it is an additive offset that any gradient or local-mean
//     subtraction removes exactly, and a gradient becomes Weber contrast (a
//     ratio of reflectances) rather than a difference of code values.
//   - Bars are detected at BOTH polarities. A tortoiseshell, silver or clear
//     acetate frame is *brighter* than dark skin, and a detector that only ever
//     looks for dark pixels has no code path that can see it.
//
// This module is training-free by design, which also means it carries no
// dataset licensing exposure.

const EPSILON = 1e-3;

const SRGB_TO_LINEAR = new Float32Array(256);
for (let i = 0; i < 256; i += 1) {
  const c = i / 255;
  SRGB_TO_LINEAR[i] = c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function median(values) {
  if (!values.length) {
    return 0;
  }

  const sorted = Float64Array.from(values).sort();
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// Median absolute deviation, scaled so it estimates the same quantity as the
// standard deviation for Gaussian data. Used instead of std because cheeks
// routinely contain stubble, nasolabial shadow and a specular band, any of
// which drags a mean/std estimate badly.
function medianAbsoluteDeviation(values, centre) {
  if (!values.length) {
    return 0;
  }

  const deviations = new Float64Array(values.length);
  for (let i = 0; i < values.length; i += 1) {
    deviations[i] = Math.abs(values[i] - centre);
  }

  return 1.4826 * median(deviations);
}

// ---------------------------------------------------------------------------
// Colour and luminance
// ---------------------------------------------------------------------------

export function buildLuminanceFields(imageData, width, height) {
  const data = imageData.data;
  const total = width * height;
  const linear = new Float32Array(total);
  const log = new Float32Array(total);

  for (let i = 0; i < total; i += 1) {
    const offset = i * 4;
    const y =
      0.2126 * SRGB_TO_LINEAR[data[offset]] +
      0.7152 * SRGB_TO_LINEAR[data[offset + 1]] +
      0.0722 * SRGB_TO_LINEAR[data[offset + 2]];

    linear[i] = y;
    log[i] = Math.log(y + EPSILON);
  }

  return { linear, log };
}

function linearToLabComponent(t) {
  return t > 0.008856451679035631 ? Math.cbrt(t) : 7.787037037037035 * t + 0.13793103448275862;
}

// D65 CIELAB. Decisions use hue angle and chroma rather than L*, because
// melanin principally changes lightness and only weakly changes hue: excluding
// L* from a "is this skin" test is most of the fix for the headwear check.
export function rgbToLab(r, g, b) {
  const rl = SRGB_TO_LINEAR[r];
  const gl = SRGB_TO_LINEAR[g];
  const bl = SRGB_TO_LINEAR[b];

  const x = linearToLabComponent((0.4124 * rl + 0.3576 * gl + 0.1805 * bl) / 0.95047);
  const y = linearToLabComponent(0.2126 * rl + 0.7152 * gl + 0.0722 * bl);
  const z = linearToLabComponent((0.0193 * rl + 0.1192 * gl + 0.9505 * bl) / 1.08883);

  return {
    l: 116 * y - 16,
    a: 500 * (x - y),
    b: 200 * (y - z),
  };
}

// CIE76. Perceptually uniform enough for a "same material or not" test, and
// unlike a raw RGB distance one threshold means the same thing at every skin
// tone. Full ΔE2000 is not worth the cost at the precision we need here.
export function labDistance(first, second) {
  const dl = first.l - second.l;
  const da = first.a - second.a;
  const db = first.b - second.b;
  return Math.sqrt(dl * dl + da * da + db * db);
}

export function labHueAngle(lab) {
  const angle = (Math.atan2(lab.b, lab.a) * 180) / Math.PI;
  return angle < 0 ? angle + 360 : angle;
}

export function labChroma(lab) {
  return Math.sqrt(lab.a * lab.a + lab.b * lab.b);
}

// ---------------------------------------------------------------------------
// Face frame: roll-corrected, IOD-normalised coordinates
// ---------------------------------------------------------------------------

function pointAt(points, index) {
  const point = points?.[index];
  return point && Number.isFinite(point.x) && Number.isFinite(point.y)
    ? { x: point.x, y: point.y }
    : null;
}

function averageOf(points, indices) {
  let x = 0;
  let y = 0;
  let count = 0;

  for (const index of indices) {
    const point = pointAt(points, index);
    if (point) {
      x += point.x;
      y += point.y;
      count += 1;
    }
  }

  return count ? { x: x / count, y: y / count } : null;
}

// Landmark indices are MediaPipe's own (face_mesh_connections.py). Note their
// "right" means the subject's right, which is image-left in an unmirrored
// frontal photo; the names below follow MediaPipe, not image side.
export const LANDMARKS = {
  rightIrisCentre: 468,
  leftIrisCentre: 473,
  rightEyeRing: [33, 133, 159, 145, 158, 153],
  leftEyeRing: [362, 263, 386, 374, 385, 380],
  nasion: 168,
  noseTip: 1,
  chin: 152,
  rightEyeOuter: 33,
  leftEyeOuter: 263,
  rightTemple: 127,
  leftTemple: 356,
  rightEar: 234,
  leftEar: 454,
  foreheadTop: 10,
  glabella: 9,
  rightBrow: [46, 53, 52, 65, 55, 70, 63, 105, 66, 107],
  leftBrow: [276, 283, 282, 295, 285, 300, 293, 334, 296, 336],
  rightCheek: [205, 206, 207, 123, 116, 117, 118, 119, 100, 36],
  leftCheek: [425, 426, 427, 352, 345, 346, 347, 348, 329, 266],
};

export function buildFaceFrame(points) {
  const rightIris = pointAt(points, LANDMARKS.rightIrisCentre) || averageOf(points, LANDMARKS.rightEyeRing);
  const leftIris = pointAt(points, LANDMARKS.leftIrisCentre) || averageOf(points, LANDMARKS.leftEyeRing);

  if (!rightIris || !leftIris) {
    return null;
  }

  const dx = leftIris.x - rightIris.x;
  const dy = leftIris.y - rightIris.y;
  const iod = Math.hypot(dx, dy);

  if (!(iod > 4)) {
    return null;
  }

  // u runs along the eye line, so every ROI below is roll-invariant.
  const u = { x: dx / iod, y: dy / iod };
  const v = { x: -u.y, y: u.x };
  const origin = { x: (leftIris.x + rightIris.x) / 2, y: (leftIris.y + rightIris.y) / 2 };
  const nasion = pointAt(points, LANDMARKS.nasion) || origin;

  return { origin, u, v, iod, nasion, rightIris, leftIris };
}

function toImageSpace(frame, anchor, alongU, alongV) {
  return {
    x: anchor.x + frame.u.x * alongU * frame.iod + frame.v.x * alongV * frame.iod,
    y: anchor.y + frame.u.y * alongU * frame.iod + frame.v.y * alongV * frame.iod,
  };
}

function sampleBilinear(field, width, height, x, y) {
  const cx = clamp(x, 0, width - 1.001);
  const cy = clamp(y, 0, height - 1.001);
  const x0 = Math.floor(cx);
  const y0 = Math.floor(cy);
  const fx = cx - x0;
  const fy = cy - y0;
  const i00 = y0 * width + x0;

  return (
    field[i00] * (1 - fx) * (1 - fy) +
    field[i00 + 1] * fx * (1 - fy) +
    field[i00 + width] * (1 - fx) * fy +
    field[i00 + width + 1] * fx * fy
  );
}

// Resamples an IOD-relative rectangle into a fixed-size axis-aligned patch, so
// downstream filters see a horizontal bar as horizontal regardless of head roll
// or image scale.
export function rectifyPatch(field, width, height, frame, anchor, ranges, patchWidth, patchHeight) {
  const patch = new Float32Array(patchWidth * patchHeight);
  const spanU = ranges.uMax - ranges.uMin;
  const spanV = ranges.vMax - ranges.vMin;

  for (let py = 0; py < patchHeight; py += 1) {
    const alongV = ranges.vMin + (spanV * (py + 0.5)) / patchHeight;
    for (let px = 0; px < patchWidth; px += 1) {
      const alongU = ranges.uMin + (spanU * (px + 0.5)) / patchWidth;
      const source = toImageSpace(frame, anchor, alongU, alongV);
      patch[py * patchWidth + px] = sampleBilinear(field, width, height, source.x, source.y);
    }
  }

  return patch;
}

// ---------------------------------------------------------------------------
// Per-face skin reference statistics
// ---------------------------------------------------------------------------

function collectRegionSamples(field, width, height, frame, anchor, ranges, step) {
  const samples = [];

  for (let alongV = ranges.vMin; alongV <= ranges.vMax; alongV += step) {
    for (let alongU = ranges.uMin; alongU <= ranges.uMax; alongU += step) {
      const source = toImageSpace(frame, anchor, alongU, alongV);
      if (source.x < 1 || source.y < 1 || source.x >= width - 1 || source.y >= height - 1) {
        continue;
      }
      samples.push(sampleBilinear(field, width, height, source.x, source.y));
    }
  }

  return samples;
}

function gradientMagnitudeAt(field, width, height, x, y) {
  const gx = sampleBilinear(field, width, height, x + 1, y) - sampleBilinear(field, width, height, x - 1, y);
  const gy = sampleBilinear(field, width, height, x, y + 1) - sampleBilinear(field, width, height, x, y - 1);
  return Math.hypot(gx, gy);
}

// Samples cheeks and forehead only. Eyes, brows, nose and mouth are excluded by
// construction rather than masked, because the ROIs below are placed by IOD
// offsets that avoid them.
export function buildSkinReference(log, width, height, frame) {
  // Forehead plus UPPER cheeks only. The original lower-cheek band reached into
  // beard territory, and stubble inflates the MAD enormously — which deflates
  // every downstream z-score and made bearded subjects systematically harder to
  // detect. The forehead is the most reliably skin-only region on almost any
  // face, so it carries the reference.
  const cheekRanges = [
    { uMin: -0.5, uMax: 0.5, vMin: -1.3, vMax: -0.85 },
    { uMin: -1.05, uMax: -0.6, vMin: 0.25, vMax: 0.7 },
    { uMin: 0.6, uMax: 1.05, vMin: 0.25, vMax: 0.7 },
  ];

  const levels = [];
  const gradients = [];

  for (const ranges of cheekRanges) {
    levels.push(...collectRegionSamples(log, width, height, frame, frame.origin, ranges, 0.03));

    for (let alongV = ranges.vMin; alongV <= ranges.vMax; alongV += 0.05) {
      for (let alongU = ranges.uMin; alongU <= ranges.uMax; alongU += 0.05) {
        const source = toImageSpace(frame, frame.origin, alongU, alongV);
        if (source.x < 2 || source.y < 2 || source.x >= width - 2 || source.y >= height - 2) {
          continue;
        }
        gradients.push(gradientMagnitudeAt(log, width, height, source.x, source.y));
      }
    }
  }

  if (levels.length < 60 || gradients.length < 40) {
    return { supported: false, sampleCount: levels.length };
  }

  const levelMedian = median(levels);
  const levelScale = medianAbsoluteDeviation(levels, levelMedian);
  const gradientMedian = median(gradients);
  const gradientScale = medianAbsoluteDeviation(gradients, gradientMedian);

  return {
    supported: true,
    sampleCount: levels.length,
    levelMedian,
    // Floor the scales so a flat, low-texture face cannot make every z-score
    // explode; these are log-luminance units.
    levelScale: Math.max(levelScale, 0.02),
    gradientMedian,
    gradientScale: Math.max(gradientScale, 0.01),
  };
}

// ---------------------------------------------------------------------------
// Ridge (bar) detection
// ---------------------------------------------------------------------------

// A spectacle frame is a bar, not a step, so this responds to a line of either
// polarity: positive where a bright bar sits on a darker ground, negative for a
// dark bar on a brighter ground. Returning the signed response lets the caller
// record which kind of frame it found.
// Multi-scale. Frames vary from hairline wire to thick acetate, and a single
// filter width only responds to bars of roughly its own thickness: if the
// surround taps land ON the bar they cancel the very structure being measured,
// which is what made bold frames score near zero. Taking the strongest response
// across a range of widths makes the signal thickness-agnostic.
const RIDGE_HALF_WIDTHS = [2, 3, 5, 7, 10];

function ridgeResponse(patch, patchWidth, patchHeight) {
  const response = new Float32Array(patchWidth * patchHeight);

  for (const halfWidthRows of RIDGE_HALF_WIDTHS) {
    for (let y = 0; y < patchHeight; y += 1) {
      const above = clamp(y - halfWidthRows, 0, patchHeight - 1);
      const below = clamp(y + halfWidthRows, 0, patchHeight - 1);

      // Skip scales the patch cannot support without clamping both taps onto
      // the same rows, which would fabricate a response at the edges.
      if (above === y || below === y) {
        continue;
      }

      for (let x = 0; x < patchWidth; x += 1) {
        const centre = patch[y * patchWidth + x];
        const surround = (patch[above * patchWidth + x] + patch[below * patchWidth + x]) / 2;
        const value = centre - surround;
        if (Math.abs(value) > Math.abs(response[y * patchWidth + x])) {
          response[y * patchWidth + x] = value;
        }
      }
    }
  }

  return response;
}

// Left-to-right shortest path with |dy| <= 1, so the winning trace must be a
// single connected structure spanning the patch. This is what separates a frame
// (one continuous bar across the nasion) from eyebrows (two disconnected
// clusters, higher up) and from the nose dorsum (a vertical ridge, which cannot
// produce a flat horizontal path).
const RIDGE_SMOOTHNESS_PENALTY = 0.6;

function traceBestRidge(response, patchWidth, patchHeight, scale) {
  const cost = new Float32Array(patchWidth * patchHeight);
  const back = new Int16Array(patchWidth * patchHeight);
  const strength = new Float32Array(patchWidth * patchHeight);

  for (let i = 0; i < response.length; i += 1) {
    strength[i] = Math.abs(response[i]) / scale;
  }

  for (let y = 0; y < patchHeight; y += 1) {
    cost[y * patchWidth] = -strength[y * patchWidth];
  }

  for (let x = 1; x < patchWidth; x += 1) {
    for (let y = 0; y < patchHeight; y += 1) {
      let best = Infinity;
      let bestY = y;

      // Charge for vertical movement. Without this the path is free to zigzag
      // after whatever noise is strongest in each column, which both destroys
      // the flatness measure and lets a scatter of unrelated pixels masquerade
      // as a continuous bar.
      for (let dy = -1; dy <= 1; dy += 1) {
        const prevY = y + dy;
        if (prevY < 0 || prevY >= patchHeight) {
          continue;
        }
        const candidate =
          cost[prevY * patchWidth + x - 1] + (dy === 0 ? 0 : RIDGE_SMOOTHNESS_PENALTY);
        if (candidate < best) {
          best = candidate;
          bestY = prevY;
        }
      }

      cost[y * patchWidth + x] = best - strength[y * patchWidth + x];
      back[y * patchWidth + x] = bestY;
    }
  }

  let endY = 0;
  let endCost = Infinity;
  for (let y = 0; y < patchHeight; y += 1) {
    const candidate = cost[y * patchWidth + patchWidth - 1];
    if (candidate < endCost) {
      endCost = candidate;
      endY = y;
    }
  }

  const path = new Int16Array(patchWidth);
  let cursor = endY;
  for (let x = patchWidth - 1; x >= 0; x -= 1) {
    path[x] = cursor;
    cursor = back[cursor * patchWidth + x];
  }

  let strongColumns = 0;
  let verticalTravel = 0;
  let signedSum = 0;
  let strengthSum = 0;

  for (let x = 0; x < patchWidth; x += 1) {
    const index = path[x] * patchWidth + x;
    const z = strength[index];
    strengthSum += z;
    signedSum += response[index];

    if (z >= 2.5) {
      strongColumns += 1;
    }
    if (x > 0) {
      verticalTravel += Math.abs(path[x] - path[x - 1]);
    }
  }

  let pathMean = 0;
  for (let x = 0; x < patchWidth; x += 1) {
    pathMean += path[x];
  }
  pathMean /= patchWidth;

  // Row-wise best bar, independent of the traced path. A single strong,
  // continuous horizontal row is the thing a frame bridge actually produces,
  // and measuring it per row rather than along one traced path makes the
  // signal far less sensitive to exactly where the ROI was placed.
  let bestRowContinuity = 0;
  let bestRow = 0;
  for (let y = 0; y < patchHeight; y += 1) {
    let strongColumnsInRow = 0;
    for (let x = 0; x < patchWidth; x += 1) {
      if (strength[y * patchWidth + x] >= 2.5) {
        strongColumnsInRow += 1;
      }
    }
    const rowContinuity = strongColumnsInRow / patchWidth;
    if (rowContinuity > bestRowContinuity) {
      bestRowContinuity = rowContinuity;
      bestRow = y;
    }
  }

  // Widen to a 3-row band, since a real bar is thicker than one pixel row and
  // may drift by a row or two across the span.
  let bandContinuity = 0;
  for (let x = 0; x < patchWidth; x += 1) {
    for (let dy = -1; dy <= 1; dy += 1) {
      const y = bestRow + dy;
      if (y >= 0 && y < patchHeight && strength[y * patchWidth + x] >= 2.5) {
        bandContinuity += 1;
        break;
      }
    }
  }
  bandContinuity /= patchWidth;

  return {
    continuity: strongColumns / patchWidth,
    bestRowContinuity,
    bandContinuity,
    bestRowOffset: bestRow,
    // A frame bar is near-horizontal in the rectified patch, so a real trace
    // should need only a few rows of travel across the whole span.
    flatness: 1 - clamp(verticalTravel / (patchWidth * 0.28), 0, 1),
    meanStrength: strengthSum / patchWidth,
    polarity: Math.sign(signedSum),
    meanRow: pathMean,
    path,
  };
}

// ---------------------------------------------------------------------------
// Eyewear
// ---------------------------------------------------------------------------

const BRIDGE_PATCH_WIDTH = 64;
const BRIDGE_PATCH_HEIGHT = 48;
const LENS_PATCH_SIZE = 64;

function measureLensRim(log, width, height, frame, skin, side) {
  const ranges =
    side === 'right'
      ? { uMin: -1.05, uMax: -0.15, vMin: -0.6, vMax: 0.55 }
      : { uMin: 0.15, uMax: 1.05, vMin: -0.6, vMax: 0.55 };

  const patch = rectifyPatch(
    log,
    width,
    height,
    frame,
    frame.origin,
    ranges,
    LENS_PATCH_SIZE,
    LENS_PATCH_SIZE,
  );

  // A rim is a bar too. Look for a strong horizontal bar in the top third
  // (top rim) and in the bottom third (bottom rim) of the lens box.
  const response = ridgeResponse(patch, LENS_PATCH_SIZE, LENS_PATCH_SIZE);
  const scale = skin.levelScale;

  let topBest = 0;
  let bottomBest = 0;

  for (let y = 0; y < LENS_PATCH_SIZE; y += 1) {
    let rowSum = 0;
    for (let x = 0; x < LENS_PATCH_SIZE; x += 1) {
      rowSum += Math.abs(response[y * LENS_PATCH_SIZE + x]) / scale;
    }
    const rowScore = rowSum / LENS_PATCH_SIZE;

    if (y < LENS_PATCH_SIZE / 3) {
      topBest = Math.max(topBest, rowScore);
    } else if (y > (LENS_PATCH_SIZE * 2) / 3) {
      bottomBest = Math.max(bottomBest, rowScore);
    }
  }

  return { topRim: topBest, bottomRim: bottomBest };
}

// Dichromatic reflection: a specular highlight takes the colour of the
// illuminant, not the surface, so it is bright AND low-chroma whatever the skin
// tone underneath. Testing chroma is what stops oily-skin highlights — which are
// relatively *stronger* on darker skin — from being read as lens glare.
function measurePairedSpecular(imageData, width, height, frame) {
  const data = imageData.data;
  const collect = (ranges) => {
    const blobs = [];
    for (let alongV = ranges.vMin; alongV <= ranges.vMax; alongV += 0.04) {
      for (let alongU = ranges.uMin; alongU <= ranges.uMax; alongU += 0.04) {
        const source = toImageSpace(frame, frame.origin, alongU, alongV);
        const x = Math.round(source.x);
        const y = Math.round(source.y);
        if (x < 0 || y < 0 || x >= width || y >= height) {
          continue;
        }

        const offset = (y * width + x) * 4;
        const r = SRGB_TO_LINEAR[data[offset]];
        const g = SRGB_TO_LINEAR[data[offset + 1]];
        const b = SRGB_TO_LINEAR[data[offset + 2]];
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const saturation = max > 1e-4 ? (max - min) / max : 0;

        if (max > 0.55 && saturation < 0.18) {
          blobs.push({ u: alongU, v: alongV });
        }
      }
    }
    return blobs;
  };

  const right = collect({ uMin: -1.05, uMax: -0.15, vMin: -0.55, vMax: 0.5 });
  const left = collect({ uMin: 0.15, uMax: 1.05, vMin: -0.55, vMax: 0.5 });

  if (!right.length || !left.length) {
    return { paired: 0, present: right.length + left.length > 0 };
  }

  // Mirror each right-side highlight across the midline and look for a partner.
  // Skin speculars are not mirror-paired; lens reflections under a single
  // dominant light source usually are.
  let paired = 0;
  for (const blob of right) {
    for (const candidate of left) {
      if (Math.abs(candidate.u + blob.u) < 0.22 && Math.abs(candidate.v - blob.v) < 0.18) {
        paired += 1;
        break;
      }
    }
  }

  return { paired: paired / right.length, present: true };
}

export function analyzeEyewearGeometry(imageData, log, width, height, points) {
  const frame = buildFaceFrame(points);
  if (!frame) {
    return { supported: false, reason: 'no-face-frame' };
  }

  const skin = buildSkinReference(log, width, height, frame);
  if (!skin.supported) {
    return { supported: false, reason: 'insufficient-skin-sample', iod: frame.iod };
  }

  // Below roughly 32 px between the eyes there is not enough signal to resolve a
  // frame bar at all, and the honest answer is that we could not check.
  const resolutionRatio = frame.iod / 32;

  const bridgePatch = rectifyPatch(
    log,
    width,
    height,
    frame,
    frame.nasion,
    { uMin: -0.3, uMax: 0.3, vMin: -0.12, vMax: 0.58 },
    BRIDGE_PATCH_WIDTH,
    BRIDGE_PATCH_HEIGHT,
  );

  const bridgeResponse = ridgeResponse(bridgePatch, BRIDGE_PATCH_WIDTH, BRIDGE_PATCH_HEIGHT);
  const bridge = traceBestRidge(
    bridgeResponse,
    BRIDGE_PATCH_WIDTH,
    BRIDGE_PATCH_HEIGHT,
    skin.levelScale,
  );

  // The bridge patch spans v in [-0.35, 0.45] IOD around the nasion, so the
  // nasion itself sits at this row. A real bridge crosses close to it; brows sit
  // well above, and a nasolabial shadow well below.
  const nasionRow = (0.12 / 0.7) * BRIDGE_PATCH_HEIGHT;
  const bridgeHeightOffset = Math.abs(bridge.meanRow - nasionRow) / BRIDGE_PATCH_HEIGHT;

  const rightRim = measureLensRim(log, width, height, frame, skin, 'right');
  const leftRim = measureLensRim(log, width, height, frame, skin, 'left');
  const rimScore = Math.min(
    Math.max(rightRim.topRim, rightRim.bottomRim),
    Math.max(leftRim.topRim, leftRim.bottomRim),
  );

  const specular = measurePairedSpecular(imageData, width, height, frame);

  return {
    supported: true,
    iod: frame.iod,
    resolutionRatio,
    skinLevelScale: skin.levelScale,
    skinGradientScale: skin.gradientScale,
    bridgeContinuity: bridge.continuity,
    bridgeBestRowContinuity: bridge.bestRowContinuity,
    bridgeBandContinuity: bridge.bandContinuity,
    bridgeBandContinuityRaw: bridge.bandContinuity,
    bridgeFlatness: bridge.flatness,
    bridgeStrength: bridge.meanStrength,
    bridgePolarity: bridge.polarity,
    bridgeHeightOffset,
    rimScore,
    rightTopRim: rightRim.topRim,
    leftTopRim: leftRim.topRim,
    specularPaired: specular.paired,
    specularPresent: specular.present,
  };
}

// ---------------------------------------------------------------------------
// Headwear
// ---------------------------------------------------------------------------

function meanLabOverRange(imageData, width, height, frame, anchor, ranges, step) {
  const data = imageData.data;
  let l = 0;
  let a = 0;
  let b = 0;
  let count = 0;

  for (let alongV = ranges.vMin; alongV <= ranges.vMax; alongV += step) {
    for (let alongU = ranges.uMin; alongU <= ranges.uMax; alongU += step) {
      const source = toImageSpace(frame, anchor, alongU, alongV);
      const x = Math.round(source.x);
      const y = Math.round(source.y);
      if (x < 0 || y < 0 || x >= width || y >= height) {
        continue;
      }

      const offset = (y * width + x) * 4;
      const lab = rgbToLab(data[offset], data[offset + 1], data[offset + 2]);
      l += lab.l;
      a += lab.a;
      b += lab.b;
      count += 1;
    }
  }

  return count ? { lab: { l: l / count, a: a / count, b: b / count }, count } : null;
}

// A brim is a manufactured edge: it produces an abrupt width change in the
// silhouette that hair, however voluminous, does not. Measured off the
// segmentation mask so it is entirely colour-free.
function measureCrownSilhouette(foregroundMask, width, height, frame, headTop, browY) {
  if (!foregroundMask?.data) {
    return { supported: false };
  }

  const mask = foregroundMask.data;
  const browRow = Math.round(browY);
  const topRow = Math.round(headTop);
  const widths = [];

  for (let y = Math.max(topRow, 0); y <= Math.min(browRow, height - 1); y += 1) {
    let left = -1;
    let right = -1;
    for (let x = 0; x < width; x += 1) {
      if (mask[y * width + x]) {
        if (left < 0) {
          left = x;
        }
        right = x;
      }
    }
    widths.push(left < 0 ? 0 : (right - left) / frame.iod);
  }

  if (widths.length < 8) {
    return { supported: false };
  }

  let maxStep = 0;
  for (let i = 1; i < widths.length; i += 1) {
    if (widths[i] > 0 && widths[i - 1] > 0) {
      maxStep = Math.max(maxStep, Math.abs(widths[i] - widths[i - 1]));
    }
  }

  // Flat top: a cap crown is much straighter across the very top than a head.
  const topBand = widths.slice(0, Math.max(3, Math.round(widths.length * 0.18))).filter((w) => w > 0);
  const topMean = topBand.reduce((sum, w) => sum + w, 0) / Math.max(topBand.length, 1);
  let topVariance = 0;
  for (const w of topBand) {
    topVariance += (w - topMean) ** 2;
  }
  topVariance /= Math.max(topBand.length, 1);

  return {
    supported: true,
    maxWidthStep: maxStep,
    topFlatness: 1 - clamp(Math.sqrt(topVariance) / 0.18, 0, 1),
    crownWidth: topMean,
  };
}

// Collects the pixels between the top of the head and the brow line, taking
// only what the segmentation mask calls foreground.
//
// Anchoring this band to the mask rather than to a fixed offset above the eyes
// is essential: a passport crop frames heads at wildly different scales, so a
// fixed offset lands on background for most portraits, and a "crown" made of
// backdrop compares as a completely different material from the eyebrows. That
// is what produced a two-thirds false-positive rate.
function collectCrownPixels(foregroundMask, width, height, frame) {
  const mask = foregroundMask?.data;
  if (!mask) {
    return null;
  }

  const browY = frame.origin.y - frame.iod * 0.5;
  const minRun = Math.max(6, frame.iod * 0.3);
  let headTop = -1;

  for (let y = 0; y < Math.min(Math.floor(browY), height); y += 1) {
    let count = 0;
    for (let x = 0; x < width; x += 1) {
      if (mask[y * width + x]) {
        count += 1;
      }
    }
    if (count >= minRun) {
      headTop = y;
      break;
    }
  }

  const span = browY - headTop;
  if (headTop < 0 || span < frame.iod * 0.25) {
    return null;
  }

  // Upper 60% of head-top-to-brow: the crown proper, clear of the forehead.
  const bandBottom = Math.min(Math.floor(headTop + span * 0.6), height - 1);
  const pixels = [];
  for (let y = headTop; y <= bandBottom; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (mask[y * width + x]) {
        pixels.push(y * width + x);
      }
    }
  }

  return pixels.length >= 40 ? { pixels, headTop, browY, span, bandBottom } : null;
}

function meanLabOverPixels(imageData, pixels) {
  const data = imageData.data;
  let l = 0;
  let a = 0;
  let b = 0;

  for (const index of pixels) {
    const offset = index * 4;
    const lab = rgbToLab(data[offset], data[offset + 1], data[offset + 2]);
    l += lab.l;
    a += lab.a;
    b += lab.b;
  }

  const count = pixels.length;
  return { l: l / count, a: a / count, b: b / count };
}

// Fine-scale energy over the crown pixels only. Hair of every type is
// filamentary and self-similar, so it carries high fine-scale energy; fabric is
// smooth or periodic and carries little.
function measureCrownTexture(log, width, pixels) {
  let fine = 0;
  let count = 0;
  let mean = 0;

  for (const index of pixels) {
    mean += log[index];
  }
  mean /= pixels.length;

  let coarse = 0;
  for (const index of pixels) {
    coarse += (log[index] - mean) ** 2;

    const x = index % width;
    if (x < 1 || x >= width - 1 || index < width || index + width >= log.length) {
      continue;
    }

    const laplacian =
      4 * log[index] - log[index - 1] - log[index + 1] - log[index - width] - log[index + width];
    fine += laplacian * laplacian;
    count += 1;
  }

  coarse /= pixels.length;
  const fineEnergy = count ? fine / count : 0;

  return { fineEnergy, coarseEnergy: coarse, ratio: fineEnergy / Math.max(coarse, 1e-5) };
}

export function analyzeHeadwearGeometry(imageData, log, width, height, points, foregroundMask) {
  const frame = buildFaceFrame(points);
  if (!frame) {
    return { supported: false, reason: 'no-face-frame' };
  }

  const crownRegion = collectCrownPixels(foregroundMask, width, height, frame);
  if (!crownRegion) {
    return { supported: false, reason: 'no-crown-region' };
  }

  // Brows are the within-subject reference: scalp hair and eyebrows share the
  // same melanin, so for a bare head the distance is small whatever the
  // person's colouring, while a hat is a different material entirely.
  const browRanges = { uMin: -0.85, uMax: 0.85, vMin: -0.75, vMax: -0.5 };
  const brow = meanLabOverRange(imageData, width, height, frame, frame.origin, browRanges, 0.04);
  if (!brow) {
    return { supported: false, reason: 'brow-out-of-frame' };
  }

  const crownLab = meanLabOverPixels(imageData, crownRegion.pixels);
  const crownToBrow = labDistance(crownLab, brow.lab);
  const texture = measureCrownTexture(log, width, crownRegion.pixels);
  const silhouette = measureCrownSilhouette(
    foregroundMask,
    width,
    height,
    frame,
    crownRegion.headTop,
    crownRegion.browY,
  );

  return {
    supported: true,
    iod: frame.iod,
    crownPixelCount: crownRegion.pixels.length,
    crownHeightRatio: crownRegion.span / frame.iod,
    crownToBrowDistance: crownToBrow,
    crownLightness: crownLab.l,
    browLightness: brow.lab.l,
    crownHue: labHueAngle(crownLab),
    crownChroma: labChroma(crownLab),
    textureFineEnergy: texture.fineEnergy,
    textureRatio: texture.ratio,
    silhouetteSupported: Boolean(silhouette.supported),
    maxWidthStep: silhouette.supported ? silhouette.maxWidthStep : 0,
    topFlatness: silhouette.supported ? silhouette.topFlatness : 0,
    crownWidth: silhouette.supported ? silhouette.crownWidth : 0,
  };
}

// ---------------------------------------------------------------------------
// Fusion
// ---------------------------------------------------------------------------

function logistic(z, gain, midpoint) {
  return 1 / (1 + Math.exp(-gain * (z - midpoint)));
}

function toLogOdds(probability) {
  const p = clamp(probability, 0.001, 0.999);
  return Math.log(p / (1 - p));
}

// Weighted log-odds rather than a plain sum of ratios, so one decisive signal is
// not drowned by several noisy ones, and each term can be gated by how reliable
// it actually is on this image.
export function fuseEyewearSignals(signals) {
  if (!signals.supported) {
    return { probability: 0, confident: false, abstain: true, reason: signals.reason };
  }

  const resolutionReliability = clamp(signals.resolutionRatio, 0, 1);

  // The bridge trace is the primary vote: a frame is the one structure that
  // crosses the nasion as a single flat, thin, continuous bar.
  const bridgeQuality =
    signals.bridgeContinuity *
    clamp(signals.bridgeFlatness, 0, 1) *
    clamp(1 - signals.bridgeHeightOffset / 0.4, 0, 1);

  const terms = [
    { weight: 0.5, reliability: resolutionReliability, probability: logistic(signals.bridgeBandContinuity, 8, 0.5) },
    { weight: 0.3, reliability: resolutionReliability, probability: logistic(bridgeQuality, 9, 0.42) },
    { weight: 0.2, reliability: resolutionReliability, probability: logistic(signals.bridgeStrength, 1.4, 3) },
  ];

  let logOdds = 0;
  let usedWeight = 0;
  for (const term of terms) {
    if (term.reliability <= 0) {
      continue;
    }
    logOdds += term.reliability * term.weight * toLogOdds(term.probability);
    usedWeight += term.reliability * term.weight;
  }

  // Scale back up so a signal being unavailable widens uncertainty rather than
  // silently pulling the result toward "no glasses".
  const normalised = usedWeight > 0 ? logOdds / usedWeight : 0;
  const probability = 1 / (1 + Math.exp(-normalised));

  // Three-state output, with the operating point chosen on the labelled
  // fixtures for ONE property above all: never assert "no glasses" about
  // someone who is wearing them. Every glasses-wearing fixture whose face was
  // detected lands in the detected or the unsure band, none in the confident
  // negative. Some clean faces land in the unsure band as a result, which is
  // the trade this product should take: asking someone to confirm costs a
  // moment, while a wrong "no glasses" on a paid photo costs a rejected
  // passport application.
  const tooSmall = signals.resolutionRatio < 1;
  const detected = signals.bridgeBandContinuity >= 0.6;
  const someEvidence = signals.bridgeBandContinuity >= 0.08 || signals.bridgeStrength >= 1.8;

  return {
    probability,
    bridgeQuality,
    confident: !tooSmall && (detected || !someEvidence),
    abstain: tooSmall || (!detected && someEvidence),
    wearingGlasses: !tooSmall && detected,
    reason: tooSmall ? 'low-resolution' : !detected && someEvidence ? 'ambiguous' : '',
  };
}

// MEASURED RESULT, and the reason this returns no positive verdict:
//
// The signals below were built from the standard training-free playbook —
// eyebrow-referenced colour distance, crown texture, and silhouette curvature —
// and benchmarked against public/test-fixtures/ground-truth.json. They do not
// separate the classes. A black cap over dark hair scored a crown-to-brow
// distance of 13, among the LOWEST values in the whole set, below almost every
// bare head, because a black cap and dark eyebrows genuinely are the same
// colour. Driving the decision from these signals produced a 66% false positive
// rate while still missing the actual hat.
//
// So this deliberately never asserts "hat". It returns the measurements for
// telemetry and reports that it could not decide. Saying "we could not check"
// is honest; a detector that flags two thirds of compliant photos and misses
// real hats is worse than no detector at all.
//
// The fix is a model, and a cleanly-licensed one exists: PINTO0309's
// Head-Hat-Classification is MIT, 115 KB, and runs under ONNX Runtime Web.
// Adding it means taking on a new runtime dependency and shipping third-party
// weights, which is a call for the product owner rather than a silent change.
export function fuseHeadwearSignals(signals) {
  if (!signals.supported) {
    return { probability: 0, confident: false, abstain: true, hatDetected: false, reason: signals.reason };
  }

  // Fine-scale energy counts AGAINST a hat: hair of every type is filamentary,
  // fabric is smooth. The previous detector had this sign inverted, which made
  // afro, coily, braided and loc'd hair read as headwear.
  const smoothness = logistic(-Math.log10(Math.max(signals.textureRatio, 1e-6)), 1.4, -1.9);

  return {
    probability: 0,
    smoothness,
    confident: false,
    abstain: true,
    hatDetected: false,
    reason: 'not-separable',
  };
}
