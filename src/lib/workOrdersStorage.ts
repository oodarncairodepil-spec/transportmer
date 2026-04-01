import type { WorkOrder } from "@/data/mockData";

const STORAGE_KEY = "transportmer.fleet.workorders.v1";

export function loadWorkOrders(): WorkOrder[] {
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

    return parsed as WorkOrder[];
  } catch {
    return [];
  }
}

export function saveWorkOrders(next: WorkOrder[]) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    return;
  }
}

export function createWorkOrderId(existing: WorkOrder[]) {
  const max = existing
    .map((wo) => wo.id)
    .map((id) => {
      const m = /^WO-(\d+)$/i.exec(id.trim());
      return m ? Number(m[1]) : 0;
    })
    .filter((n) => Number.isFinite(n))
    .reduce((acc, n) => Math.max(acc, n), 0);

  const next = String(max + 1).padStart(3, "0");
  return `WO-${next}`;
}
