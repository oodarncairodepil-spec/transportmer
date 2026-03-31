import { scheduleEvents as mockEvents } from "@/data/mockData";
import { makeId } from "@/lib/routesStorage";

export type ScheduleDay = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";
export type ScheduleType = "shift" | "leave";

export type ScheduleEvent = {
  id: string;
  driverId: string;
  type: ScheduleType;
  title: string;
  date: string;
  start: string;
  end: string;
};

const STORAGE_KEY = "transportmer.scheduling.events.v1";

const dayToOffset: Record<ScheduleDay, number> = {
  Mon: 0,
  Tue: 1,
  Wed: 2,
  Thu: 3,
  Fri: 4,
  Sat: 5,
  Sun: 6,
};

function toIsoDate(d: Date) {
  return d.toISOString().split("T")[0];
}

function addDays(base: Date, days: number) {
  const copy = new Date(base.getTime());
  copy.setDate(copy.getDate() + days);
  return copy;
}

function startOfWeekMonday(d: Date) {
  const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const jsDay = copy.getDay();
  const diff = jsDay === 0 ? -6 : 1 - jsDay;
  copy.setDate(copy.getDate() + diff);
  return copy;
}

function normalizeEvent(raw: unknown, fallbackWeekStart: Date): ScheduleEvent | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === "string" ? r.id : makeId();
  const driverId = typeof r.driverId === "string" ? r.driverId : "";
  const type = r.type === "shift" || r.type === "leave" ? r.type : "shift";
  const title = typeof r.title === "string" ? r.title : "";
  const start = typeof r.start === "string" ? r.start : "";
  const end = typeof r.end === "string" ? r.end : "";

  let date = typeof r.date === "string" ? r.date : "";
  if (!date) {
    const day = typeof r.day === "string" ? (r.day as ScheduleDay) : undefined;
    if (day && day in dayToOffset) {
      date = toIsoDate(addDays(fallbackWeekStart, dayToOffset[day]));
    }
  }

  if (!driverId || !date) return null;

  return {
    id,
    driverId,
    type,
    title: title.trim(),
    date,
    start,
    end,
  };
}

function normalizeEvents(input: unknown): ScheduleEvent[] {
  const fallbackWeekStart = startOfWeekMonday(new Date());
  if (!Array.isArray(input)) return [];
  const out: ScheduleEvent[] = [];
  for (const item of input) {
    const normalized = normalizeEvent(item, fallbackWeekStart);
    if (normalized) out.push(normalized);
  }
  return out;
}

export function loadScheduleEvents(): ScheduleEvent[] {
  if (typeof window === "undefined") {
    return normalizeEvents(mockEvents);
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return normalizeEvents(mockEvents);
    }

    const parsed = JSON.parse(raw);
    const normalized = normalizeEvents(parsed);
    if (normalized.length > 0) {
      return normalized;
    }
    return normalizeEvents(mockEvents);
  } catch {
    return normalizeEvents(mockEvents);
  }
}

export function saveScheduleEvents(next: ScheduleEvent[]) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    return;
  }
}

export function upsertScheduleEvent(existing: ScheduleEvent[], input: Omit<ScheduleEvent, "id"> & { id?: string }) {
  const normalized: ScheduleEvent = {
    id: input.id ?? makeId(),
    driverId: input.driverId,
    type: input.type,
    title: input.title.trim(),
    date: input.date,
    start: input.start,
    end: input.end,
  };

  const idx = existing.findIndex((e) => e.driverId === normalized.driverId && e.date === normalized.date);
  if (idx === -1) {
    return [normalized, ...existing];
  }

  const copy = existing.slice();
  copy[idx] = normalized;
  return copy;
}
