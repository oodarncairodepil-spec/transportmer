import { maintenanceRecords as mockRecords, type MaintenanceRecord } from "@/data/mockData";
import { makeId } from "@/lib/routesStorage";

const STORAGE_KEY = "transportmer.maintenance.records.v1";

export function loadMaintenanceRecords(): MaintenanceRecord[] {
  if (typeof window === "undefined") {
    return mockRecords;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return mockRecords;
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return mockRecords;
    }

    return parsed as MaintenanceRecord[];
  } catch {
    return mockRecords;
  }
}

export function saveMaintenanceRecords(next: MaintenanceRecord[]) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    return;
  }
}

export function createMaintenanceRecord(input: Omit<MaintenanceRecord, "id">): MaintenanceRecord {
  return {
    ...input,
    id: makeId(),
  };
}

