import type { LatLng } from "./lib/polyline";
import { decodeGooglePolyline } from "./lib/polyline";
import { sampleEveryMeters } from "./lib/geo";
import { fetchWaysForLine, nearestWayForPoint } from "./osmEnricher/overpass";
import type { TruckConfig, RouteViolation, ScoredSegment } from "./routeScorer";
import { finalizeRouteScore, scoreSegment } from "./routeScorer";

export type CandidateRoute = {
  routeId: string;
  polyline: string;
  distanceMeters?: number;
  durationSeconds?: number;
  steps?: Array<{
    instruction: string;
    name: string;
    distanceMeters: number;
    durationSeconds: number;
  }>;
};

export type ScoredRoute = {
  routeId: string;
  score: number;
  isTruckSafe: boolean;
  violations: RouteViolation[];
  polyline: string;
  distanceMeters?: number;
  durationSeconds?: number;
  steps?: Array<{
    instruction: string;
    name: string;
    distanceMeters: number;
    durationSeconds: number;
  }>;
  segments: ScoredSegment[];
  points: LatLng[];
};

export async function scoreRoutes(params: {
  routes: CandidateRoute[];
  truck: TruckConfig;
  overpassUrl: string;
  signal?: AbortSignal;
}) {
  const results = await Promise.all(
    params.routes.map(async (r) => {
      const decoded = decodeGooglePolyline(r.polyline);
      const sampled = sampleEveryMeters(decoded, 400);
      let ways = [] as Awaited<ReturnType<typeof fetchWaysForLine>>;
      try {
        ways = await fetchWaysForLine(sampled, { overpassUrl: params.overpassUrl, signal: params.signal });
      } catch {
        ways = [];
      }

      const segments: ScoredSegment[] = [];
      const violations: RouteViolation[] = [];
      const segmentScores: number[] = [];
      let penaltyCount = 0;

      for (let i = 1; i < sampled.length; i++) {
        const a = sampled[i - 1];
        const b = sampled[i];
        const midpoint = { lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2 };
      const nearest = nearestWayForPoint(ways, midpoint);
      const matched = !!nearest && nearest.dist <= 250;
      const tags = matched ? nearest.way.tags : {};

        const { score, violations: v } = scoreSegment(
          {
            highway: tags.highway,
            maxspeed: tags.maxspeed,
            maxweight: tags.maxweight,
            maxheight: tags.maxheight,
            lanes: tags.lanes,
          },
          params.truck,
          midpoint,
        );

        const seg: ScoredSegment = {
          highway: tags.highway,
          maxspeed: tags.maxspeed,
          maxweight: tags.maxweight,
          maxheight: tags.maxheight,
          lanes: tags.lanes,
        osmWayId: matched ? nearest.way.id : undefined,
        matched,
        matchDistanceMeters: nearest?.dist,
        tagCount: Object.keys(tags).length,
          score,
        };
        segments.push(seg);
        segmentScores.push(score);
        if (v.some((x) => x.type !== "unknown_road") || score < 0) penaltyCount += 1;
        violations.push(...v);
      }

      const finalScore = finalizeRouteScore(segmentScores, penaltyCount);
      return {
        routeId: r.routeId,
        score: finalScore,
        isTruckSafe: finalScore >= 0 && violations.length === 0,
        violations,
        polyline: r.polyline,
        distanceMeters: r.distanceMeters,
        durationSeconds: r.durationSeconds,
        steps: r.steps,
        segments,
        points: sampled,
      } satisfies ScoredRoute;
    }),
  );

  return results;
}

export function selectBestRoute(scored: ScoredRoute[], minScore: number) {
  const sorted = scored.slice().sort((a, b) => b.score - a.score);
  const best = sorted[0] ?? null;
  if (!best) {
    return { best: null, rejected: [] as ScoredRoute[] };
  }
  const rejected = sorted.filter((r) => r.score < minScore);
  if (best.score < minScore) {
    return { best, rejected: sorted };
  }
  return { best, rejected };
}
