import { MIN_EXPORT_DPI } from './exportResolution.js';

const JPEG_START_OF_IMAGE = [0xff, 0xd8];
const JFIF_APP0_SEGMENT_LENGTH = 18;

function normalizeDpi(value) {
  const parsed = Math.round(Number(value));
  return Math.min(65535, Math.max(MIN_EXPORT_DPI, Number.isFinite(parsed) ? parsed : MIN_EXPORT_DPI));
}

function isJpeg(bytes) {
  return bytes.length >= 2 &&
    bytes[0] === JPEG_START_OF_IMAGE[0] &&
    bytes[1] === JPEG_START_OF_IMAGE[1];
}

function isJfifSegment(bytes, offset) {
  return bytes[offset] === 0xff &&
    bytes[offset + 1] === 0xe0 &&
    bytes[offset + 4] === 0x4a &&
    bytes[offset + 5] === 0x46 &&
    bytes[offset + 6] === 0x49 &&
    bytes[offset + 7] === 0x46 &&
    bytes[offset + 8] === 0x00;
}

function findJfifSegment(bytes) {
  let offset = 2;

  while (offset + 4 <= bytes.length && bytes[offset] === 0xff) {
    const marker = bytes[offset + 1];
    if (marker === 0xda || marker === 0xd9) {
      break;
    }

    const segmentLength = (bytes[offset + 2] << 8) | bytes[offset + 3];
    if (segmentLength < 2 || offset + segmentLength + 2 > bytes.length) {
      break;
    }

    if (isJfifSegment(bytes, offset)) {
      return offset;
    }

    offset += segmentLength + 2;
  }

  return -1;
}

function writeDensity(bytes, markerOffset, dpi) {
  bytes[markerOffset + 11] = 1;
  bytes[markerOffset + 12] = (dpi >> 8) & 0xff;
  bytes[markerOffset + 13] = dpi & 0xff;
  bytes[markerOffset + 14] = (dpi >> 8) & 0xff;
  bytes[markerOffset + 15] = dpi & 0xff;
}

function createJfifSegment(dpi) {
  const segment = new Uint8Array(JFIF_APP0_SEGMENT_LENGTH);
  segment.set([
    0xff, 0xe0,
    0x00, 0x10,
    0x4a, 0x46, 0x49, 0x46, 0x00,
    0x01, 0x02,
    0x01,
    0x00, 0x00,
    0x00, 0x00,
    0x00, 0x00,
  ]);
  writeDensity(segment, 0, dpi);
  return segment;
}

export async function setJpegDpi(blob, requestedDpi = MIN_EXPORT_DPI) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  if (!isJpeg(bytes)) {
    throw new Error('DPI metadata can only be added to a JPEG image.');
  }

  const dpi = normalizeDpi(requestedDpi);
  const jfifOffset = findJfifSegment(bytes);

  if (jfifOffset >= 0) {
    const updatedBytes = bytes.slice();
    writeDensity(updatedBytes, jfifOffset, dpi);
    return new Blob([updatedBytes], { type: 'image/jpeg' });
  }

  const segment = createJfifSegment(dpi);
  const updatedBytes = new Uint8Array(bytes.length + segment.length);
  updatedBytes.set(bytes.subarray(0, 2), 0);
  updatedBytes.set(segment, 2);
  updatedBytes.set(bytes.subarray(2), 2 + segment.length);
  return new Blob([updatedBytes], { type: 'image/jpeg' });
}

export async function readJpegDpi(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const jfifOffset = findJfifSegment(bytes);
  if (jfifOffset < 0 || bytes[jfifOffset + 11] !== 1) {
    return null;
  }

  return {
    x: (bytes[jfifOffset + 12] << 8) | bytes[jfifOffset + 13],
    y: (bytes[jfifOffset + 14] << 8) | bytes[jfifOffset + 15],
    unit: 'dpi',
  };
}
