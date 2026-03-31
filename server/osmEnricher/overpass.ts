import { overpassCache } from "../lib/cache";
import type { LatLng } from "../lib/polyline";
import { pointToSegmentDistanceMeters } from "../lib/geo";

export type OsmWay = {
  id: number;
  tags: Record<string, string>;
  geometry: LatLng[];
};

type OverpassResponse = {
  elements: Array<{
    type: string;
    id: number;
    tags?: Record<string, string>;
    geometry?: Array<{ lat: number; lon: number }>;
  }>;
};

export async function fetchWaysForLine(points: LatLng[], opts: { overpassUrl: string; signal?: AbortSignal }) {
  const cacheKey = `around:${points.length}:${points[0]?.lat.toFixed(3)},${points[0]?.lng.toFixed(3)}:${points[points.length - 1]?.lat.toFixed(3)},${
    points[points.length - 1]?.lng.toFixed(3)
  }`;
  const cached = overpassCache.get(cacheKey);
  if (cached) {
    return cached as OsmWay[];
  }

  const radiusMeters = 200;
  const maxPoints = 25;
  const picked = pickEvenly(points, maxPoints);
  const parts = picked.map((p) => `way(around:${radiusMeters},${p.lat},${p.lng})[highway];`).join("\n");
  const query = `[out:json][timeout:25];(\n${parts}\n);out tags geom;`;

  const urls = uniq([opts.overpassUrl, "https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter", "https://overpass.nchc.org.tw/api/interpreter"]);
  const ways = await fetchOverpassWays(urls, query, opts.signal);

  overpassCache.set(cacheKey, ways);
  return ways;
}

async function fetchOverpassWays(urls: string[], query: string, signal?: AbortSignal) {
  let lastError: unknown = null;
  for (const url of urls) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      const merged = signal
        ? (AbortSignal as any).any
          ? (AbortSignal as any).any([signal, controller.signal])
          : signal
        : controller.signal;

      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ data: query }),
        signal: merged,
      });
      clearTimeout(timeout);
      if (!res.ok) {
        throw new Error(`Overpass request failed (${res.status})`);
      }
      const data = (await res.json()) as OverpassResponse;
      const dedup = new Map<number, OsmWay>();
      for (const e of data.elements || []) {
        if (e.type !== "way" || !Array.isArray(e.geometry) || e.geometry.length <= 1) {
          continue;
        }
        if (dedup.has(e.id)) {
          continue;
        }
        dedup.set(e.id, {
          id: e.id,
          tags: e.tags ?? {},
          geometry: (e.geometry ?? []).map((g) => ({ lat: g.lat, lng: g.lon })),
        });
      }
      return Array.from(dedup.values());
    } catch (e) {
      lastError = e;
      continue;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Overpass request failed");
}

function pickEvenly<T>(arr: T[], max: number) {
  if (arr.length <= max) {
    return arr;
  }
  const out: T[] = [];
  for (let i = 0; i < max; i++) {
    const idx = Math.round((i * (arr.length - 1)) / (max - 1));
    out.push(arr[idx]);
  }
  return out;
}

function uniq(arr: string[]) {
  const out: string[] = [];
  for (const v of arr) {
    if (!v) continue;
    if (!out.includes(v)) out.push(v);
  }
  return out;
}

export function nearestWayForPoint(ways: OsmWay[], point: LatLng) {
  let best: { way: OsmWay; dist: number } | null = null;
  for (const w of ways) {
    const geom = w.geometry;
    for (let i = 1; i < geom.length; i++) {
      const a = geom[i - 1];
      const b = geom[i];
      const d = pointToSegmentDistanceMeters(point, a, b);
      if (!best || d < best.dist) {
        best = { way: w, dist: d };
      }
    }
  }
  return best;
}
