import { LRUCache } from "lru-cache";

import type { LatLng, NormalizedSection, NormalizedTruckRoute, RouteOptions, TruckVehicle } from "../types";
import { decodeHereFlexiblePolyline } from "../hereFlexiblePolyline";
import { encodeGooglePolyline } from "../../lib/polyline";

type HereRouteResponse = {
  routes?: Array<{
    id?: string;
    routeHandle?: string;
    sections?: Array<{
      id?: string;
      polyline?: string;
      summary?: { travelTime?: number; duration?: number; length?: number };
      tolls?: unknown;
      truckRoadTypes?: unknown;
    }>;
  }>;
};

const hereCache = new LRUCache<string, { at: number; result: { bestRouteId: string; routes: NormalizedTruckRoute[] } }>({
  max: 200,
  ttl: 1000 * 60 * 10,
});

function uniq(arr: Array<string | undefined | null>) {
  const out: string[] = [];
  for (const v of arr) {
    if (!v) continue;
    if (!out.includes(v)) out.push(v);
  }
  return out;
}

function buildSignature(origin: LatLng, destination: LatLng, vehicle: TruckVehicle, opts: RouteOptions) {
  return JSON.stringify({
    o: [origin.lat, origin.lng],
    d: [destination.lat, destination.lng],
    v: opts.via?.map((p) => [p.lat, p.lng]) ?? [],
    veh: vehicle,
    opts: {
      source: opts.source,
      routingMode: opts.routingMode,
      departureTime: opts.departureTime,
      traffic: opts.traffic,
      units: opts.units,
      lang: opts.lang,
      avoid: opts.avoid,
      networkRestrictedTruck: opts.networkRestrictedTruck,
      permittedNetworks: opts.permittedNetworks,
      alternatives: opts.alternatives,
    },
  });
}

function withTimeout(ms: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, clear: () => clearTimeout(timeout) };
}

export class HEREProvider {
  async calculate(origin: LatLng, destination: LatLng, vehicle: TruckVehicle, opts: RouteOptions) {
    const signature = buildSignature(origin, destination, vehicle, opts);
    const cached = hereCache.get(signature);
    if (cached) {
      return cached.result;
    }

    const apiKey = process.env.HERE_API_KEY;
    if (!apiKey) {
      throw new Error("HERE_API_KEY not configured");
    }

    const baseUrl = process.env.HERE_ROUTING_BASE_URL || "https://router.hereapi.com/v8/routes";

    const params = new URLSearchParams();
    params.set("apikey", apiKey);
    params.set("transportMode", opts.networkRestrictedTruck ? "networkRestrictedTruck" : "truck");
    params.set("origin", `${origin.lat},${origin.lng}`);
    params.set("destination", `${destination.lat},${destination.lng}`);

    if (opts.via && opts.via.length > 0) {
      for (const p of opts.via) {
        params.append("via", `${p.lat},${p.lng}`);
      }
    }

    if (opts.routingMode) params.set("routingMode", opts.routingMode);
    if (opts.departureTime) params.set("departureTime", opts.departureTime);
    if (opts.traffic) params.set("traffic", "enabled");
    if (opts.units) params.set("units", opts.units);
    if (opts.lang) params.set("lang", opts.lang);

    if (opts.permittedNetworks && opts.permittedNetworks.length > 0 && opts.networkRestrictedTruck) {
      params.set("networkRestrictedTruck[permittedNetworks]", opts.permittedNetworks.join(","));
    }

    if (vehicle.height != null) params.set("vehicle[height]", String(vehicle.height));
    if (vehicle.width != null) params.set("vehicle[width]", String(vehicle.width));
    if (vehicle.length != null) params.set("vehicle[length]", String(vehicle.length));
    if (vehicle.weight != null) params.set("vehicle[weight]", String(vehicle.weight));
    if (vehicle.axleCount != null) params.set("vehicle[axleCount]", String(vehicle.axleCount));
    if (vehicle.trailerCount != null) params.set("vehicle[trailerCount]", String(vehicle.trailerCount));
    if (vehicle.engineType) params.set("vehicle[engineType]", String(vehicle.engineType));
    if (vehicle.category) params.set("vehicle[category]", String(vehicle.category));

    if (opts.avoid?.features && opts.avoid.features.length > 0) {
      params.set("avoid[features]", uniq(opts.avoid.features).join(","));
    }
    if (opts.avoid?.truckRoadTypes && opts.avoid.truckRoadTypes.length > 0) {
      params.set("avoid[truckRoadTypes]", uniq(opts.avoid.truckRoadTypes).join(","));
    }
    if (opts.avoid?.areas && opts.avoid.areas.length > 0) {
      params.set("avoid[areas]", uniq(opts.avoid.areas).join("|"));
    }

    if (opts.alternatives) {
      params.set("alternatives", "3");
    }

    params.set("return", "polyline,summary,tolls,truckRoadTypes");

    const url = `${baseUrl}?${params.toString()}`;
    const t = withTimeout(15000);
    const res = await fetch(url, {
      method: "GET",
      headers: { accept: "application/json", "user-agent": "transportmer/1.0" },
      signal: t.signal,
    });
    t.clear();

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`HERE routing failed (${res.status}): ${text.slice(0, 300)}`);
    }

    const json = (await res.json()) as HereRouteResponse;
    const hereRoutes = json.routes ?? [];
    if (hereRoutes.length === 0) {
      throw new Error("HERE returned no routes");
    }

    const normalizedRoutes: NormalizedTruckRoute[] = hereRoutes.map((r, idx) => {
      const sections = (r.sections ?? []).map((s) => {
        const travelTime = Number(s.summary?.travelTime ?? s.summary?.duration ?? 0);
        const length = Number(s.summary?.length ?? 0);
        const out: NormalizedSection = { summary: { travelTime, length } };
        if (s.tolls != null) out.tolls = s.tolls;
        if (s.truckRoadTypes != null) out.truckRoadTypes = s.truckRoadTypes;
        return out;
      });

      const polylines = (r.sections ?? []).map((s) => s.polyline).filter(Boolean) as string[];
      const mergedGeometry: LatLng[] = [];
      for (const p of polylines) {
        const decoded = decodeHereFlexiblePolyline(p);
        for (const pt of decoded) {
          mergedGeometry.push(pt);
        }
      }

      const googlePolyline = mergedGeometry.length > 0 ? encodeGooglePolyline(mergedGeometry) : "";

      return {
        provider: "here",
        routeId: String(r.id ?? `here_${idx}`),
        routeHandle: r.routeHandle,
        polyline: googlePolyline,
        geometry: mergedGeometry,
        sections,
        distanceMeters: sections.reduce((acc, s) => acc + Number(s.summary.length ?? 0), 0),
        durationSeconds: sections.reduce((acc, s) => acc + Number(s.summary.travelTime ?? 0), 0),
      };
    });

    const bestRouteId = normalizedRoutes[0].routeId;
    const result = { bestRouteId, routes: normalizedRoutes };
    hereCache.set(signature, { at: Date.now(), result });
    return result;
  }
}

