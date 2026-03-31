export type LatLng = { lat: number; lng: number };

export type LocationInput = {
  label: string;
  lat: number;
  lng: number;
  source: "search" | "google_link" | "library";
  locationId?: string;
};

export type RouteStop = LocationInput & {
  id: string;
  position: number;
};

export type RouteModel = {
  id: string;
  name?: string;
  origin: LocationInput | null;
  destination: LocationInput | null;
  stops: RouteStop[];
  createdAt: string;
  updatedAt: string;
};

const STORAGE_KEY = "transportmer.routes.v1";

export function loadRoutes(): RouteModel[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed as RouteModel[];
  } catch {
    return [];
  }
}

export function saveRoutes(next: RouteModel[]) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    return;
  }
}

export function makeId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `id_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

export function normalizeStops(stops: RouteStop[]): RouteStop[] {
  return stops
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((s, i) => ({ ...s, position: i }));
}
