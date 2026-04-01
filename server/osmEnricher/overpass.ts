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
  const cacheKey = `around:${hashPoints(points)}`;
  const cached = overpassCache.get(cacheKey);
  if (cached) {
    return cached as OsmWay[];
  }

  const urls = uniq([opts.overpassUrl, "https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter", "https://overpass.nchc.org.tw/api/interpreter"]);
  const radiusMeters = 200;
  const maxPointsPerQuery = 25;
  const maxQueryPoints = 250;
  const maxQueries = 10;

  const queryPoints = points.length > maxQueryPoints ? pickEvenly(points, maxQueryPoints) : points;
  const chunks = chunk(queryPoints, maxPointsPerQuery).slice(0, maxQueries);

  const dedup = new Map<number, OsmWay>();
  for (const c of chunks) {
    if (c.length === 0) continue;
    const parts = c.map((p) => `way(around:${radiusMeters},${p.lat},${p.lng})[highway];`).join("\n");
    const query = `[out:json][timeout:25];(\n${parts}\n);out tags geom qt;`;
    try {
      const ways = await fetchOverpassWays(urls, query, opts.signal);
      for (const w of ways) {
        if (!dedup.has(w.id)) {
          dedup.set(w.id, w);
        }
      }
    } catch {
      continue;
    }
  }

  const ways = Array.from(dedup.values());

  overpassCache.set(cacheKey, ways);
  return ways;
}

async function fetchOverpassWays(urls: string[], query: string, signal?: AbortSignal) {
  let lastError: unknown = null;
  for (const url of urls) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 9000);
      const merged = signal
        ? (AbortSignal as any).any
          ? (AbortSignal as any).any([signal, controller.signal])
          : signal
        : controller.signal;

      const res = await fetch(url, {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/x-www-form-urlencoded",
          "user-agent": "transportmer/1.0",
        },
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

function hashPoints(points: LatLng[]) {
  if (points.length === 0) {
    return "empty";
  }

  const joined = points
    .map((p) => `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`)
    .join("|");

  let h = 2166136261;
  for (let i = 0; i < joined.length; i++) {
    h ^= joined.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `${points.length}:${(h >>> 0).toString(16)}`;
}

function chunk<T>(arr: T[], size: number) {
  if (size <= 0) {
    return [arr];
  }
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
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
