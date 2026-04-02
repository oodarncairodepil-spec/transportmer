export type LatLng = { lat: number; lng: number };

export type TruckVehicle = {
  height?: number;
  width?: number;
  length?: number;
  weight?: number;
  axleCount?: number;
  trailerCount?: number;
  engineType?: string;
  category?: string;
};

export type RouteAvoidOptions = {
  features?: string[];
  truckRoadTypes?: string[];
  areas?: string[];
};

export type RouteOptions = {
  source: "gmaps_osm" | "here_osm" | "here";
  alternatives?: boolean;
  minScore?: number;
  via?: LatLng[];
  routingMode?: "fast" | "short";
  departureTime?: string;
  traffic?: boolean;
  units?: "metric" | "imperial";
  lang?: string;
  avoid?: RouteAvoidOptions;
  networkRestrictedTruck?: boolean;
  permittedNetworks?: string[];
  fallback?: "none" | "gmaps_osm" | "osm";
};

export type NormalizedSection = {
  summary: { travelTime: number; length: number };
  tolls?: unknown;
  truckRoadTypes?: unknown;
};

export type NormalizedTruckRoute = {
  provider: "gmaps_osm" | "here_osm" | "here";
  routeId: string;
  polyline: string;
  geometry: LatLng[];
  sections: NormalizedSection[];
  routeHandle?: string;
  score?: number;
  isTruckSafe?: boolean;
  violations?: unknown[];
  segments?: unknown[];
  steps?: Array<{ instruction: string; name: string; distanceMeters: number; durationSeconds: number }>;
  distanceMeters?: number;
  durationSeconds?: number;
};

export type TruckRoutingResult = {
  bestRouteId: string;
  routes: NormalizedTruckRoute[];
};

