export type LatLng = { lat: number; lng: number };

export function haversineMeters(a: LatLng, b: LatLng) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const s =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

export function pointToSegmentDistanceMeters(p: LatLng, a: LatLng, b: LatLng) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const avgLat = toRad((a.lat + b.lat) / 2);
  const kx = 111320 * Math.cos(avgLat);
  const ky = 111320;

  const ax = a.lng * kx;
  const ay = a.lat * ky;
  const bx = b.lng * kx;
  const by = b.lat * ky;
  const px = p.lng * kx;
  const py = p.lat * ky;

  const abx = bx - ax;
  const aby = by - ay;
  const apx = px - ax;
  const apy = py - ay;
  const ab2 = abx * abx + aby * aby;
  if (ab2 === 0) {
    const dx = px - ax;
    const dy = py - ay;
    return Math.sqrt(dx * dx + dy * dy);
  }
  let t = (apx * abx + apy * aby) / ab2;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * abx;
  const cy = ay + t * aby;
  const dx = px - cx;
  const dy = py - cy;
  return Math.sqrt(dx * dx + dy * dy);
}

export function bbox(points: LatLng[]) {
  let minLat = Infinity;
  let minLng = Infinity;
  let maxLat = -Infinity;
  let maxLng = -Infinity;
  for (const p of points) {
    minLat = Math.min(minLat, p.lat);
    minLng = Math.min(minLng, p.lng);
    maxLat = Math.max(maxLat, p.lat);
    maxLng = Math.max(maxLng, p.lng);
  }
  return { minLat, minLng, maxLat, maxLng };
}

export function expandBbox(b: { minLat: number; minLng: number; maxLat: number; maxLng: number }, meters: number) {
  const latDelta = meters / 111320;
  const avgLat = (b.minLat + b.maxLat) / 2;
  const lngDelta = meters / (111320 * Math.cos((avgLat * Math.PI) / 180));
  return {
    minLat: b.minLat - latDelta,
    minLng: b.minLng - lngDelta,
    maxLat: b.maxLat + latDelta,
    maxLng: b.maxLng + lngDelta,
  };
}

export function sampleEveryMeters(points: LatLng[], stepMeters: number) {
  if (points.length <= 2) {
    return points;
  }
  const out: LatLng[] = [points[0]];
  let acc = 0;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const cur = points[i];
    const d = haversineMeters(prev, cur);
    acc += d;
    if (acc >= stepMeters) {
      out.push(cur);
      acc = 0;
    }
  }
  if (out[out.length - 1] !== points[points.length - 1]) {
    out.push(points[points.length - 1]);
  }
  return out;
}
