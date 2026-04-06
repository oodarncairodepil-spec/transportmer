import type { LatLng, NormalizedTruckRoute, TruckVehicle } from "../types.js";
import { scoreRoutes } from "../../routeSelector.js";

export class OSMProvider {
  async enrichWithOsm(routes: Array<{ routeId: string; polyline: string; distanceMeters?: number; durationSeconds?: number }>, vehicle: TruckVehicle) {
    const overpassUrl = process.env.OVERPASS_URL || "https://overpass-api.de/api/interpreter";
    const truckConfig = {
      maxWeight: typeof vehicle.weight === "number" ? vehicle.weight : 15000,
      maxHeight: typeof vehicle.height === "number" ? vehicle.height : 4.0,
    };

    const scored = await scoreRoutes({
      routes,
      truck: truckConfig,
      overpassUrl,
    });

    return scored.map((r) => {
      const out: Partial<NormalizedTruckRoute> = {
        routeId: r.routeId,
        score: r.score,
        isTruckSafe: r.isTruckSafe,
        violations: r.violations,
        segments: r.segments,
        geometry: r.points as LatLng[],
      };
      return out;
    });
  }
}
