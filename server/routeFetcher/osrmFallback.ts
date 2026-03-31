import type { LatLng } from "../lib/polyline";
import { encodeGooglePolyline } from "../lib/polyline";

type OsrmResponse = {
  code: string;
  routes: Array<{
    distance: number;
    duration: number;
    geometry?: {
      coordinates: number[][];
      type: string;
    };
    legs?: Array<{
      steps?: Array<{
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

export async function fetchOsrmFallback(params: {
  origin: LatLng;
  destination: LatLng;
  waypoints?: Array<LatLng & { label?: string }>;
  alternatives: boolean;
  signal?: AbortSignal;
}) {
  const coords = [params.origin, ...(params.waypoints ?? []), params.destination]
    .map((p) => `${p.lng},${p.lat}`)
    .join(";");
  const url = new URL(
    `https://router.project-osrm.org/route/v1/driving/${coords}`,
  );
  url.searchParams.set("alternatives", params.alternatives ? "true" : "false");
  url.searchParams.set("steps", "true");
  url.searchParams.set("overview", "full");
  url.searchParams.set("geometries", "geojson");

  const res = await fetch(url.toString(), { signal: params.signal });
  if (!res.ok) {
    throw new Error("OSRM fallback failed");
  }
  const data = (await res.json()) as OsrmResponse;
  if (data.code !== "Ok") {
    throw new Error("OSRM fallback error");
  }

  return (data.routes || []).slice(0, 3).map((r, idx) => {
    const coords = r.geometry?.coordinates ?? [];
    const line = coords
      .filter((c) => Array.isArray(c) && c.length >= 2)
      .map((c) => ({ lng: Number(c[0]), lat: Number(c[1]) }))
      .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
    const polyline = encodeGooglePolyline(line);
    const legsRaw = r.legs ?? [];
    const steps = legsRaw.flatMap((leg, legIndex) => {
      const rawSteps = leg.steps ?? [];
      const legSteps = rawSteps.map((s) => ({
        instruction: buildInstruction(s),
        name: s.name ?? "",
        distanceMeters: s.distance,
        durationSeconds: s.duration,
      }));

      const isStopoverLeg = legIndex < legsRaw.length - 1;
      if (!isStopoverLeg) {
        return legSteps;
      }

      const stopLabel = params.waypoints?.[legIndex]?.label;
      const name = stopLabel?.trim() || `Stopover ${legIndex + 1}`;
      return legSteps.concat({ instruction: "Arrive at stopover", name, distanceMeters: 0, durationSeconds: 0 });
    });
    return {
      routeId: `osrm_${idx}`,
      polyline,
      distanceMeters: r.distance,
      durationSeconds: r.duration,
      steps,
    };
  });
}

function buildInstruction(step: { maneuver: { type: string; modifier?: string }; name: string }) {
  const name = step.name?.trim();
  const modifier = step.maneuver.modifier;
  const type = step.maneuver.type;

  const mod = modifier ? modifier.replaceAll("_", " ") : "";
  const prettyMod = mod.length > 0 ? mod[0].toUpperCase() + mod.slice(1) : "";

  if (type === "depart") return "Head out";
  if (type === "arrive") return "Arrive at destination";
  if (type === "merge") return name ? `Merge onto ${name}` : "Merge";
  if (type === "on ramp") return name ? `Take the ramp to ${name}` : "Take the ramp";
  if (type === "off ramp") return name ? `Take the exit toward ${name}` : "Take the exit";
  if (type === "fork") return prettyMod ? `Keep ${prettyMod}` : "Keep left/right";
  if (type === "new name") return name ? `Continue onto ${name}` : "Continue";
  if (type === "continue") return name ? `Continue on ${name}` : "Continue";
  if (type === "turn") {
    if (prettyMod && name) return `Turn ${prettyMod} onto ${name}`;
    if (prettyMod) return `Turn ${prettyMod}`;
    return name ? `Turn onto ${name}` : "Turn";
  }
  return name ? `Continue on ${name}` : "Continue";
}
