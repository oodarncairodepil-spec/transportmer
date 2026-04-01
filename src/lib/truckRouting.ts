import type { LatLng } from "@/lib/routesStorage";
import { apiFetchJson } from "@/lib/apiFetch";

export type TruckRouteStep = {
  instruction: string;
  name: string;
  distanceMeters: number;
  durationSeconds: number;
};

export type TruckRouteOption = {
  id: string;
  distanceMeters: number;
  durationSeconds: number;
  score?: number;
  isTruckSafe?: boolean;
  violations?: Array<{ type: string; location: [number, number] }>;
  highwayScore: number;
  majorRoadScore: number;
  via: string;
  tollLikely: boolean;
  stepsPreview: string[];
  steps: TruckRouteStep[];
  line: Array<{ lat: number; lng: number }>;
  segments?: Array<{
    highway?: string;
    maxspeed?: string;
    maxweight?: string;
    maxheight?: string;
    lanes?: string;
    osmWayId?: number;
    matched?: boolean;
    matchDistanceMeters?: number;
    tagCount?: number;
    score: number;
  }>;
  provider: "osrm" | "backend";
};

type BackendResponse = {
  bestRouteId: string;
  routes: Array<{
    routeId: string;
    score: number;
    isTruckSafe: boolean;
    violations: Array<{ type: string; location: [number, number] }>;
    polyline: string;
    distanceMeters?: number;
    durationSeconds?: number;
    steps?: Array<{
      instruction: string;
      name: string;
      distanceMeters: number;
      durationSeconds: number;
    }>;
    geometry: Array<{ lat: number; lng: number }>;
    segments: Array<{
      highway?: string;
      maxspeed?: string;
      maxweight?: string;
      maxheight?: string;
      lanes?: string;
      osmWayId?: number;
      matched?: boolean;
      matchDistanceMeters?: number;
      tagCount?: number;
      score: number;
    }>;
  }>;
};

function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
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

function lineDistanceMeters(line: Array<{ lat: number; lng: number }>) {
  let sum = 0;
  for (let i = 1; i < line.length; i++) {
    sum += haversineMeters(line[i - 1], line[i]);
  }
  return sum;
}

type OsrmResponse = {
  code: string;
  routes: Array<{
    distance: number;
    duration: number;
    geometry?: {
      coordinates: number[][];
      type: string;
    };
    legs: Array<{
      steps: Array<{
        distance: number;
        duration: number;
        name: string;
        maneuver: {
          type: string;
          modifier?: string;
        };
      }>;
    }>;
  }>;
};

const highwayRegex = /(\bTol\b|Jl\.?\s*Tol|Motorway|Highway|Expressway|Toll)/i;
const majorRoadRegex = /(\bJl\b|Jalan|Rd\b|Road\b|Route\b|Bypass|Trunk)/i;

function buildInstruction(step: { maneuver: { type: string; modifier?: string }; name: string }) {
  const name = step.name?.trim();
  const modifier = step.maneuver.modifier;
  const type = step.maneuver.type;

  const mod = modifier ? modifier.replace(/_/g, " ") : "";
  const prettyMod = mod.length > 0 ? mod[0].toUpperCase() + mod.slice(1) : "";

  if (type === "depart") {
    return "Head out";
  }
  if (type === "arrive") {
    return "Arrive at destination";
  }
  if (type === "roundabout") {
    return "Enter roundabout";
  }
  if (type === "rotary") {
    return "Enter rotary";
  }
  if (type === "merge") {
    return name ? `Merge onto ${name}` : "Merge";
  }
  if (type === "on ramp") {
    return name ? `Take the ramp to ${name}` : "Take the ramp";
  }
  if (type === "off ramp") {
    return name ? `Take the exit toward ${name}` : "Take the exit";
  }
  if (type === "fork") {
    return prettyMod ? `Keep ${prettyMod}` : "Keep left/right";
  }
  if (type === "end of road") {
    return prettyMod ? `Turn ${prettyMod} at the end of the road` : "Turn at end of road";
  }
  if (type === "new name") {
    return name ? `Continue onto ${name}` : "Continue";
  }
  if (type === "continue") {
    return name ? `Continue on ${name}` : "Continue";
  }
  if (type === "turn") {
    if (prettyMod && name) {
      return `Turn ${prettyMod} onto ${name}`;
    }
    if (prettyMod) {
      return `Turn ${prettyMod}`;
    }
    return name ? `Turn onto ${name}` : "Turn";
  }

  return name ? `Continue on ${name}` : "Continue";
}

function summarizeVia(roadNames: string[]) {
  const cleaned = roadNames.map((s) => s.trim()).filter((s) => s.length > 0);
  const preferred = cleaned.filter((n) => highwayRegex.test(n)).concat(cleaned.filter((n) => majorRoadRegex.test(n)));
  const unique: string[] = [];
  for (const n of preferred) {
    if (!unique.includes(n)) {
      unique.push(n);
    }
    if (unique.length >= 2) {
      break;
    }
  }
  return unique.length > 0 ? unique.join(" and ") : cleaned.slice(0, 2).join(" and ");
}

export async function getTruckRouteOptions(
  origin: LatLng,
  destination: LatLng,
  opts?: { stops?: Array<{ lat: number; lng: number; label?: string }> },
  signal?: AbortSignal,
) {
  try {
    const result = await apiFetchJson<BackendResponse>(
      "/api/truck-route",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          origin,
          destination,
          stops: opts?.stops ?? [],
          alternatives: true,
          minScore: -1,
          truckConfig: { maxWeight: 15000, maxHeight: 4.0 },
        }),
        signal,
      },
      { label: "POST /api/truck-route" },
    );

    if (result.ok) {
      const data = result.data;
      if (data && Array.isArray(data.routes) && data.routes.length > 0) {
        const mapped = data.routes.map((r) => {
          const steps = Array.isArray(r.steps) ? r.steps : [];
          const stepsPreview = steps
            .map((s) => (s.name?.trim() ? s.name.trim() : s.instruction.trim()))
            .filter((s) => s.length > 0)
            .slice(0, 4);

          const segs = r.segments ?? [];
          const highwayScore = segs.filter((s) => /(motorway|trunk|primary)/i.test(s.highway ?? "")).length;
          const majorRoadScore = segs.filter((s) => /(secondary|tertiary)/i.test(s.highway ?? "")).length;
          const via = segs
            .map((s) => s.highway)
            .filter((v): v is string => typeof v === "string" && v.length > 0)
            .filter((v, i, a) => a.indexOf(v) === i)
            .slice(0, 2)
            .join(" and ");

          const line = Array.isArray(r.geometry) ? r.geometry : [];
          const dist = r.distanceMeters && r.distanceMeters > 0 ? r.distanceMeters : lineDistanceMeters(line);
          const dur = r.durationSeconds && r.durationSeconds > 0 ? r.durationSeconds : dist > 0 ? (dist / 1000 / 60) * 3600 : 0;
          return {
            id: r.routeId,
            distanceMeters: dist,
            durationSeconds: dur,
            score: r.score,
            isTruckSafe: r.isTruckSafe,
            violations: r.violations,
            highwayScore,
            majorRoadScore,
            via,
            tollLikely: false,
            stepsPreview,
            steps,
            line,
            segments: segs,
            provider: "backend" as const,
          } satisfies TruckRouteOption;
        });

        const bestFirst = mapped
          .slice()
          .sort((a, b) => (b.id === data.bestRouteId ? 1 : 0) - (a.id === data.bestRouteId ? 1 : 0));
        return bestFirst.slice(0, 3);
      }
    }
  } catch {
    // fall back to OSRM below
  }

  const url = new URL(
    `https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}`,
  );
  url.searchParams.set("alternatives", "true");
  url.searchParams.set("steps", "true");
  url.searchParams.set("overview", "full");
  url.searchParams.set("geometries", "geojson");

  const res = await fetch(url.toString(), { signal });
  if (!res.ok) {
    throw new Error("Failed to fetch route options");
  }

  const data = (await res.json()) as OsrmResponse;
  if (data.code !== "Ok" || !Array.isArray(data.routes)) {
    throw new Error("No route options found");
  }

  const routes = data.routes.slice(0, 5).map((r, idx) => {
    const steps = r.legs?.[0]?.steps ?? [];
    const names = steps
      .map((s) => s.name)
      .map((s) => (typeof s === "string" ? s.trim() : ""))
      .filter((s) => s.length > 0);

    const highwayHits = names.filter((n) => highwayRegex.test(n)).length;
    const majorHits = names.filter((n) => majorRoadRegex.test(n)).length;
    const stepsPreview = names.slice(0, 4);

    const fullSteps: TruckRouteStep[] = steps.map((s) => ({
      instruction: buildInstruction(s),
      name: s.name ?? "",
      distanceMeters: s.distance,
      durationSeconds: s.duration,
    }));

    const tollLikely = names.some((n) => highwayRegex.test(n));
    const via = summarizeVia(names);

    const coords = r.geometry?.coordinates ?? [];
    const line = coords
      .filter((c) => Array.isArray(c) && c.length >= 2)
      .map((c) => ({ lng: Number(c[0]), lat: Number(c[1]) }))
      .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));

    return {
      id: `osrm_${idx}`,
      distanceMeters: r.distance,
      durationSeconds: r.duration,
      highwayScore: highwayHits,
      majorRoadScore: majorHits,
      via,
      tollLikely,
      stepsPreview,
      steps: fullSteps,
      line,
      provider: "osrm" as const,
    } satisfies TruckRouteOption;
  });

  const highwayPreferred = routes
    .slice()
    .sort((a, b) => b.highwayScore - a.highwayScore || b.majorRoadScore - a.majorRoadScore || a.durationSeconds - b.durationSeconds)
    .filter((r) => r.highwayScore > 0 || r.majorRoadScore > 0);

  if (highwayPreferred.length > 0) {
    return highwayPreferred.slice(0, 3);
  }

  return routes.slice(0, 1);
}
