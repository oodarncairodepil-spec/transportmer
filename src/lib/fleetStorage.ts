import type { Truck } from "@/data/mockData";
import { trucks as mockTrucks } from "@/data/mockData";

const STORAGE_KEY = "transportmer.fleet.trucks.v1";

export function loadFleetTrucks(): Truck[] {
  if (typeof window === "undefined") {
    return mockTrucks;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return mockTrucks;
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return mockTrucks;
    }

    return parsed as Truck[];
  } catch {
    return mockTrucks;
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

