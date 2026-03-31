import { makeId } from "@/lib/routesStorage";
import type { ScheduleType } from "@/lib/schedulingStorage";

export type ScheduleTemplate = {
  id: string;
  type: ScheduleType;
  title: string;
  start: string;
  end: string;
};

const STORAGE_KEY = "transportmer.scheduling.templates.v1";

const defaultTemplates: ScheduleTemplate[] = [
  { id: "TPL-001", type: "shift", title: "Morning Shift", start: "06:00", end: "18:00" },
  { id: "TPL-002", type: "shift", title: "Afternoon Shift", start: "12:00", end: "00:00" },
  { id: "TPL-003", type: "shift", title: "Night Shift", start: "18:00", end: "06:00" },
  { id: "TPL-004", type: "leave", title: "Annual Leave", start: "", end: "" },
  { id: "TPL-005", type: "leave", title: "Sick Leave", start: "", end: "" },
  { id: "TPL-006", type: "leave", title: "Holiday", start: "", end: "" },
];

export function loadScheduleTemplates(): ScheduleTemplate[] {
  if (typeof window === "undefined") {
    return defaultTemplates;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return defaultTemplates;
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return defaultTemplates;
    }

    return parsed as ScheduleTemplate[];
  } catch {
    return defaultTemplates;
  }
}

export function saveScheduleTemplates(next: ScheduleTemplate[]) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    return;
  }
}

export function upsertScheduleTemplate(
  existing: ScheduleTemplate[],
  input: Omit<ScheduleTemplate, "id"> & { id?: string },
) {
  const normalizedTitle = input.title.trim();
  const normalized: ScheduleTemplate = {
    id: input.id ?? makeId(),
    type: input.type,
    title: normalizedTitle,
    start: input.type === "leave" ? "" : input.start,
    end: input.type === "leave" ? "" : input.end,
  };

  const idx = existing.findIndex(
    (t) => t.type === normalized.type && t.title.trim().toLowerCase() === normalizedTitle.toLowerCase(),
  );
  if (idx === -1) {
    return [normalized, ...existing];
  }

  const copy = existing.slice();
  copy[idx] = { ...copy[idx], ...normalized, id: copy[idx].id };
  return copy;
}
