import type { Truck } from "@/data/mockData";

const STORAGE_KEY = "transportmer.fleet.trucks.v1";

export function loadFleetTrucks(): Truck[] {
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

    return parsed as Truck[];
  } catch {
    return [];
  }
}

export function saveFleetTrucks(next: Truck[]) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    return;
  }
}
