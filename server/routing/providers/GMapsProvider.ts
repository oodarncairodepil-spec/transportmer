import type { LatLng, NormalizedSection, NormalizedTruckRoute, RouteOptions, TruckVehicle } from "../types.js";
import { fetchGoogleDirections } from "../../routeFetcher/googleDirections.js";
import { fetchOsrmFallback } from "../../routeFetcher/osrmFallback.js";
import { encodeGooglePolyline } from "../../lib/polyline.js";
import { scoreRoutes, selectBestRoute } from "../../routeSelector.js";

export class GMapsProvider {
  async calculate(origin: LatLng, destination: LatLng, vehicle: TruckVehicle, opts: RouteOptions & { stops?: Array<LatLng & { label?: string }> }) {
    const googleKey = process.env.GOOGLE_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
    const overpassUrl = process.env.OVERPASS_URL || "https://overpass-api.de/api/interpreter";

    const alternatives = opts.alternatives ?? true;
    const stops = (opts.via ?? []).map((p) => ({ lat: p.lat, lng: p.lng }));
    const labeledStops = (opts.stops ?? []).length > 0 ? opts.stops : stops;

    let candidates: Array<{
      routeId: string;
      polyline: string;
      distanceMeters?: number;
      durationSeconds?: number;
      steps?: Array<{ instruction: string; name: string; distanceMeters: number; durationSeconds: number }>;
    }> = [];

    if (googleKey) {
      const googleRoutes = await fetchGoogleDirections({
        origin,
        destination,
        alternatives,
        apiKey: googleKey,
        waypoints: labeledStops.map((s) => ({ lat: s.lat, lng: s.lng, label: (s as any).label })),
      });
      candidates = googleRoutes.map((r) => ({
        routeId: r.routeId,
        polyline: r.polyline,
        distanceMeters: r.distanceMeters,
        durationSeconds: r.durationSeconds,
        steps: r.steps,
      }));
    } else {
      try {
        const osrmRoutes = await fetchOsrmFallback({
          origin,
          destination,
          waypoints: labeledStops.map((s) => ({ lat: s.lat, lng: s.lng, label: (s as any).label })),
          alternatives,
        });
        candidates = osrmRoutes.map((r) => ({
          routeId: r.routeId,
          polyline: r.polyline,
          distanceMeters: r.distanceMeters,
          durationSeconds: r.durationSeconds,
          steps: r.steps,
        }));
      } catch {
        const fallbackLine = [origin, ...labeledStops.map((s) => ({ lat: s.lat, lng: s.lng })), destination];
        candidates = [{ routeId: "fallback_direct", polyline: encodeGooglePolyline(fallbackLine) }];
      }
    }

    const truckConfig = {
      maxWeight: typeof vehicle.weight === "number" ? vehicle.weight : 15000,
      maxHeight: typeof vehicle.height === "number" ? vehicle.height : 4.0,
    };

    const scored = await scoreRoutes({
      routes: candidates,
      truck: truckConfig,
      overpassUrl,
    });

    const sorted = scored.slice().sort((a, b) => b.score - a.score);
    const { best } = selectBestRoute(sorted, opts.minScore ?? -1);
    if (!best) {
      throw new Error("No route options");
    }

    const routes: NormalizedTruckRoute[] = sorted.map((r) => {
      const sections: NormalizedSection[] = [
        {
          summary: {
            travelTime: Number(r.durationSeconds ?? 0),
            length: Number(r.distanceMeters ?? 0),
          },
        },
      ];

      return {
        provider: "gmaps_osm",
        routeId: r.routeId,
        polyline: r.polyline,
        geometry: r.points,
        sections,
        score: r.score,
        isTruckSafe: r.isTruckSafe,
        violations: r.violations,
        segments: r.segments,
        steps: r.steps ?? [],
        distanceMeters: r.distanceMeters,
        durationSeconds: r.durationSeconds,
      };
    });

    return { bestRouteId: best.routeId, routes };
  }
}

