import { makeId } from "@/lib/routesStorage";

export type LocationKind = "Warehouse" | "Rest Area" | "Gas Station" | "Other";

export type SavedLocation = {
  id: string;
  kind: LocationKind;
  label: string;
  lat: number;
  lng: number;
  source: "search" | "google_link" | "library";
  createdAt: string;
  updatedAt: string;
};

const STORAGE_KEY = "transportmer.locations.v1";

export function loadLocations(): SavedLocation[] {
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

    return parsed as SavedLocation[];
  } catch {
    return [];
  }
}

export function saveLocations(next: SavedLocation[]) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    return;
  }
}

export function createLocation(input: {
  kind: LocationKind;
  label: string;
  lat: number;
  lng: number;
  source: SavedLocation["source"];
}): SavedLocation {
  const now = new Date().toISOString();
  return {
    id: makeId(),
    kind: input.kind,
    label: input.label.trim(),
    lat: input.lat,
    lng: input.lng,
    source: input.source,
    createdAt: now,
    updatedAt: now,
  };
}

export function upsertLocation(existing: SavedLocation[], next: SavedLocation): SavedLocation[] {
  const now = new Date().toISOString();
  const normalized: SavedLocation = {
    ...next,
    label: next.label.trim(),
    updatedAt: now,
    createdAt: next.createdAt || now,
  };
  const idx = existing.findIndex((l) => l.id === normalized.id);
  if (idx === -1) {
    return [normalized, ...existing];
  }
  const copy = existing.slice();
  copy[idx] = normalized;
  return copy;
}

export function deleteLocation(existing: SavedLocation[], id: string): SavedLocation[] {
  return existing.filter((l) => l.id !== id);
}
