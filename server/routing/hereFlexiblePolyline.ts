import type { LatLng } from "./types";

const DECODING_TABLE: Record<string, number> = (() => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  const out: Record<string, number> = {};
  for (let i = 0; i < chars.length; i++) {
    out[chars[i]] = i;
  }
  return out;
})();

function decodeUnsignedVarint(encoded: string, idx: { v: number }) {
  let result = 0;
  let shift = 0;
  while (idx.v < encoded.length) {
    const c = encoded[idx.v++];
    const val = DECODING_TABLE[c];
    if (val === undefined) {
      throw new Error("Invalid flexible polyline");
    }
    result |= (val & 0x1f) << shift;
    if ((val & 0x20) === 0) {
      break;
    }
    shift += 5;
  }
  return result >>> 0;
}

function zigZagDecode(u: number) {
  return (u >> 1) ^ (-(u & 1) as any);
}

export function decodeHereFlexiblePolyline(polyline: string): LatLng[] {
  const idx = { v: 0 };
  const version = decodeUnsignedVarint(polyline, idx);
  if (version !== 1) {
    throw new Error(`Unsupported flexible polyline version: ${version}`);
  }

  const header = decodeUnsignedVarint(polyline, idx);
  const precision = header & 0x0f;
  const thirdDim = (header >> 4) & 0x07;
  const thirdDimPrecision = (header >> 7) & 0x0f;

  const factor = Math.pow(10, precision);
  const thirdFactor = Math.pow(10, thirdDimPrecision);

  let lastLat = 0;
  let lastLng = 0;
  let lastZ = 0;
  const out: LatLng[] = [];

  while (idx.v < polyline.length) {
    const dLat = zigZagDecode(decodeUnsignedVarint(polyline, idx));
    const dLng = zigZagDecode(decodeUnsignedVarint(polyline, idx));
    lastLat += dLat;
    lastLng += dLng;

    if (thirdDim !== 0) {
      const dZ = zigZagDecode(decodeUnsignedVarint(polyline, idx));
      lastZ += dZ;
      void thirdFactor;
      void lastZ;
    }

    out.push({ lat: lastLat / factor, lng: lastLng / factor });
  }

  return out;
}
