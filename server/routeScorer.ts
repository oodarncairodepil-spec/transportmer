export type TruckConfig = {
  maxWeight: number;
  maxHeight: number;
};

export const ROAD_SCORE: Record<string, number> = {
  motorway: 6,
  motorway_link: 5,
  trunk: 5,
  trunk_link: 4,
  primary: 4,
  primary_link: 3,
  secondary: 2,
  secondary_link: 1,
  tertiary: 1,
  tertiary_link: 0,
  residential: -5,
  living_street: -6,
  service: -8,
  unclassified: -6,
  track: -9,
  path: -10,
  footway: -10,
  cycleway: -10,
};

export type SegmentTag = {
  highway?: string;
  maxspeed?: string;
  maxweight?: string;
  maxheight?: string;
  lanes?: string;
};

export type RouteViolation = {
  type: "low_maxweight" | "low_maxheight" | "bad_road" | "unknown_road";
  location: [number, number];
};

export type ScoredSegment = {
  highway?: string;
  maxspeed?: string;
  maxweight?: string;
  maxheight?: string;
  lanes?: string;
  osmWayId?: number;
  matched: boolean;
  matchDistanceMeters?: number;
  tagCount: number;
  score: number;
};

export function parseMaxWeightKg(raw?: string) {
  if (!raw) return null;
  const s = raw.trim().toLowerCase();
  const n = Number(s.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(n)) return null;
  if (s.includes("t") || n <= 100) {
    return n * 1000;
  }
  return n;
}

export function parseMaxHeightM(raw?: string) {
  if (!raw) return null;
  const s = raw.trim().toLowerCase();
  const n = Number(s.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(n)) return null;
  if (s.includes("cm")) return n / 100;
  return n;
}

export function parseMaxSpeedKmh(raw?: string) {
  if (!raw) return null;
  const s = raw.trim().toLowerCase();
  const n = Number(s.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(n)) return null;
  if (s.includes("mph")) return n * 1.60934;
  return n;
}

export function scoreSegment(tags: SegmentTag, truck: TruckConfig, midpoint: { lat: number; lng: number }) {
  const violations: RouteViolation[] = [];
  let score = 0;

  const highway = tags.highway;
  if (highway) {
    const hs = ROAD_SCORE[highway] ?? 0;
    score += hs;
    if (hs < 0) {
      violations.push({ type: "bad_road", location: [midpoint.lat, midpoint.lng] });
    }
  } else {
    const maxspeed = parseMaxSpeedKmh(tags.maxspeed);
    if (maxspeed != null) {
      if (maxspeed > 60) score += 1;
      else if (maxspeed < 30) score -= 2;
    } else {
      score -= 2;
      violations.push({ type: "unknown_road", location: [midpoint.lat, midpoint.lng] });
    }
  }

  const maxW = parseMaxWeightKg(tags.maxweight);
  if (maxW != null && maxW < truck.maxWeight) {
    violations.push({ type: "low_maxweight", location: [midpoint.lat, midpoint.lng] });
    score -= 5;
  }
  const maxH = parseMaxHeightM(tags.maxheight);
  if (maxH != null && maxH < truck.maxHeight) {
    violations.push({ type: "low_maxheight", location: [midpoint.lat, midpoint.lng] });
    score -= 5;
  }

  return { score, violations };
}

export function finalizeRouteScore(segmentScores: number[], penaltyCount: number) {
  const avg = segmentScores.length > 0 ? segmentScores.reduce((a, b) => a + b, 0) / segmentScores.length : -999;
  return avg - penaltyCount * 2;
}
