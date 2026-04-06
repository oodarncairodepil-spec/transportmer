import type { LatLng } from "../lib/polyline.js";

export type GoogleRoute = {
  routeId: string;
  polyline: string;
  summary: string;
  distanceMeters: number;
  durationSeconds: number;
  steps: Array<{
    instruction: string;
    name: string;
    distanceMeters: number;
    durationSeconds: number;
  }>;
  legs: Array<{
    distanceMeters: number;
    durationSeconds: number;
    startAddress?: string;
    endAddress?: string;
  }>;
};

export async function fetchGoogleDirections(params: {
  origin: LatLng;
  destination: LatLng;
  alternatives: boolean;
  apiKey: string;
  waypoints?: Array<LatLng & { label?: string }>;
  signal?: AbortSignal;
}) {
  const origin = `${params.origin.lat},${params.origin.lng}`;
  const destination = `${params.destination.lat},${params.destination.lng}`;
  const url = new URL("https://maps.googleapis.com/maps/api/directions/json");
  url.searchParams.set("origin", origin);
  url.searchParams.set("destination", destination);
  url.searchParams.set("mode", "driving");
  url.searchParams.set("alternatives", params.alternatives ? "true" : "false");
  url.searchParams.set("key", params.apiKey);

  if (params.waypoints && params.waypoints.length > 0) {
    const wp = params.waypoints.map((p) => `${p.lat},${p.lng}`).join("|");
    url.searchParams.set("waypoints", wp);
  }

  const res = await fetch(url.toString(), { signal: params.signal });
  if (!res.ok) {
    throw new Error("Google Directions request failed");
  }

  const data = (await res.json()) as any;
  if (data.status !== "OK") {
    throw new Error(data.error_message || `Google Directions error: ${data.status}`);
  }

  const routes: GoogleRoute[] = (data.routes || []).map((r: any, idx: number) => {
    const polyline = r.overview_polyline?.points;
    const legsRaw = r.legs || [];
    const steps = legsRaw.flatMap((l: any, legIndex: number) => {
      const legSteps = (l.steps || [])
        .map((s: any) => {
          const html = String(s.html_instructions || "");
          const instruction = stripHtml(html);
          return {
            instruction: instruction || "Continue",
            name: "",
            distanceMeters: Number(s.distance?.value ?? 0),
            durationSeconds: Number(s.duration?.value ?? 0),
          };
        })
        .filter((s: any) => s.instruction);

      const isStopoverLeg = legIndex < legsRaw.length - 1;
      if (!isStopoverLeg) {
        return legSteps;
      }

      const stopLabel = params.waypoints?.[legIndex]?.label;
      const endAddress = String(l.end_address || "").trim();
      const name = stopLabel?.trim() || endAddress || `Stopover ${legIndex + 1}`;
      return legSteps.concat({
        instruction: "Arrive at stopover",
        name,
        distanceMeters: 0,
        durationSeconds: 0,
      });
    });
    const legs = (r.legs || []).map((l: any) => ({
      distanceMeters: Number(l.distance?.value ?? 0),
      durationSeconds: Number(l.duration?.value ?? 0),
      startAddress: l.start_address,
      endAddress: l.end_address,
    }));
    const distanceMeters = legs.reduce((acc, l) => acc + l.distanceMeters, 0);
    const durationSeconds = legs.reduce((acc, l) => acc + l.durationSeconds, 0);
    return {
      routeId: String(r.summary || `google_${idx}`),
      polyline,
      summary: String(r.summary || ""),
      distanceMeters,
      durationSeconds,
      steps,
      legs,
    };
  });

  return routes.filter((r) => typeof r.polyline === "string" && r.polyline.length > 0);
}

function stripHtml(html: string) {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}
