import type { Driver } from "@/data/mockData";
import { drivers as mockDrivers } from "@/data/mockData";

const STORAGE_KEY = "transportmer.fleet.drivers.v1";

export function loadDrivers(): Driver[] {
  if (typeof window === "undefined") {
    return normalizeDrivers(mockDrivers);
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return normalizeDrivers(mockDrivers);
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return normalizeDrivers(mockDrivers);
    }

    return normalizeDrivers(parsed as Driver[]);
  } catch {
    return normalizeDrivers(mockDrivers);
  }
}

function normalizeDrivers(input: Driver[]): Driver[] {
  return input.map((d) => {
    const rawStatus = (d as any).status as string;
    const lower = (rawStatus ?? "").toString().trim().toLowerCase();
    const normalizedStatus: Driver["status"] =
      lower === "inactive" || lower === "off-duty" || lower === "off duty" ? "Inactive" : "Active";

    const licenseValidMonth = (d as any).licenseValidMonth as string | undefined;
    const licenseValidYear = (d as any).licenseValidYear as string | undefined;

    return {
      ...d,
      status: normalizedStatus,
      licenseValidMonth,
      licenseValidYear,
    };
  });
}

export function saveDrivers(next: Driver[]) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    return;
  }
}

export function createDriverId(existing: Driver[]) {
  const max = existing
    .map((d) => d.id)
    .map((id) => {
      const m = /^DRV-(\d+)$/i.exec(id.trim());
      return m ? Number(m[1]) : 0;
    })
    .filter((n) => Number.isFinite(n))
    .reduce((acc, n) => Math.max(acc, n), 0);

  const next = String(max + 1).padStart(3, "0");
  return `DRV-${next}`;
}
