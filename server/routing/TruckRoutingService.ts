import type { LatLng, RouteOptions, TruckRoutingResult, TruckVehicle } from "./types.js";
import { GMapsProvider } from "./providers/GMapsProvider.js";
import { HEREProvider } from "./providers/HEREProvider.js";
import { OSMProvider } from "./providers/OSMProvider.js";

export class TruckRoutingService {
  private gmaps = new GMapsProvider();
  private here = new HEREProvider();
  private osm = new OSMProvider();

  /**
   * Switch between routing modes by setting options.source:
   * - "gmaps_osm": existing behavior (Google/OSRM candidates + OSM scoring)
   * - "here_osm": HERE route calculation + OSM scoring/enrichment
   * - "here": HERE route calculation only (no OSM enrichment)
   */
  async calculate_route(origin: LatLng, destination: LatLng, vehicle: TruckVehicle, options: RouteOptions): Promise<TruckRoutingResult> {
    const source = options.source;

    if (source === "gmaps_osm") {
      return await this.gmaps.calculate(origin, destination, vehicle, options);
    }

    if (source === "here") {
      const fallback = options.fallback ?? "none";
      try {
        const result = await this.here.calculate(origin, destination, vehicle, options);
        return {
          bestRouteId: result.bestRouteId,
          routes: result.routes.map((r) => ({ ...r, provider: "here" })),
        };
      } catch (e) {
        if (fallback === "gmaps_osm") {
          return await this.gmaps.calculate(origin, destination, vehicle, { ...options, source: "gmaps_osm" });
        }
        throw e instanceof Error ? e : new Error("Routing failed");
      }
    }

    const fallback = options.fallback ?? "gmaps_osm";
    try {
      const hereResult = await this.here.calculate(origin, destination, vehicle, options);
      const candidates = hereResult.routes.map((r) => ({
        routeId: r.routeId,
        polyline: r.polyline,
        distanceMeters: r.distanceMeters,
        durationSeconds: r.durationSeconds,
      }));
      const enriched = await this.osm.enrichWithOsm(candidates, vehicle);
      const merged = hereResult.routes.map((r) => {
        const extra = enriched.find((e) => e.routeId === r.routeId);
        const nextGeometry = extra?.geometry && extra.geometry.length > 1 ? extra.geometry : r.geometry;
        return { ...r, ...extra, geometry: nextGeometry, provider: "here_osm" as const };
      });

      const sorted = merged
        .slice()
        .sort((a, b) => Number(b.score ?? -Infinity) - Number(a.score ?? -Infinity));
      const best = sorted.find((r) => r.score != null) ?? sorted[0];
      return {
        bestRouteId: best?.routeId ?? merged[0]?.routeId ?? "",
        routes: merged,
      };
    } catch (e) {
      if (fallback === "gmaps_osm") {
        return await this.gmaps.calculate(origin, destination, vehicle, { ...options, source: "gmaps_osm" });
      }
      throw e instanceof Error ? e : new Error("Routing failed");
    }
  }
}
