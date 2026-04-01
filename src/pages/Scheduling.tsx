import { useEffect, useMemo, useState } from "react";
import { addDays, addWeeks, format, startOfWeek } from "date-fns";
import CreateScheduleEventDialog, { type CreateScheduleEventValues } from "@/components/CreateScheduleEventDialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { upsertScheduleEvent, type ScheduleDay, type ScheduleEvent } from "@/lib/schedulingStorage";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import ManageScheduleTypesDialog from "@/components/ManageScheduleTypesDialog";
import { useAuth } from "@/components/AuthProvider";
import { apiFetchJson } from "@/lib/apiFetch";
import { getSupabaseClient } from "@/lib/supabaseClient";
import type { Driver } from "@/data/mockData";
import type { ScheduleTemplate } from "@/lib/scheduleTemplatesStorage";

const days: ScheduleDay[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export default function Scheduling() {
  const { session, signOut } = useAuth();
  const token = session?.access_token ?? "";
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [driversLoading, setDriversLoading] = useState(false);
  const [templates, setTemplates] = useState<ScheduleTemplate[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [createPrefill, setCreatePrefill] = useState<Partial<CreateScheduleEventValues> | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<{ event: ScheduleEvent; day: ScheduleDay } | null>(null);
  const [manageTypesOpen, setManageTypesOpen] = useState(false);
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));

  useEffect(() => {
    if (!token) {
      setDrivers([]);
      return;
    }
    setDriversLoading(true);
    apiFetchJson<{ success: boolean; drivers: Array<any> }>(
      "/api/drivers",
      { headers: { Authorization: `Bearer ${token}` } },
      { label: "GET /api/drivers (Scheduling)" },
    )
      .then(async (result) => {
        if (result.ok === false) {
          if (result.status === 401) {
            await signOut();
          }
          toast.error("Failed to load drivers", { description: result.error });
          setDrivers([]);
          setDriversLoading(false);
          return;
        }

        const mapped = (result.data.drivers ?? []).map((r: any) => {
          const name = String(r.name ?? "");
          const derivedAvatar = name
            .trim()
            .split(/\s+/g)
            .filter(Boolean)
            .slice(0, 2)
            .map((p: string) => p[0]?.toUpperCase())
            .join("")
            .slice(0, 2);
          const avatar = String(r.avatar ?? (derivedAvatar || "DR"));
          return {
            id: String(r.legacy_id ?? r.legacyId ?? `DRV-${String(r.id).slice(0, 6)}`),
            name,
            licenseType: String(r.license_type ?? r.licenseType ?? ""),
            licenseValidMonth: r.license_valid_month ?? r.licenseValidMonth ?? undefined,
            licenseValidYear: r.license_valid_year ?? r.licenseValidYear ?? undefined,
            status: (String(r.status ?? "Active") as any) === "Inactive" ? "Inactive" : "Active",
            phone: String(r.phone ?? ""),
            rating: Number(r.rating ?? 0),
            totalTrips: Number(r.total_trips ?? r.totalTrips ?? 0),
            assignedTruck: null,
            avatar,
          } satisfies Driver;
        });

        setDrivers(mapped);
        setDriversLoading(false);
      })
      .catch((e) => {
        toast.error("Failed to load drivers", { description: e instanceof Error ? e.message : "Unknown error" });
        setDrivers([]);
        setDriversLoading(false);
      });
  }, [token]);

  useEffect(() => {
    if (!token) {
      setTemplates([]);
      return;
    }
    const supabase = getSupabaseClient();
    if (!supabase) {
      return;
    }

    supabase
      .from("schedule_templates")
      .select("id,type,title,start_time,end_time,created_at")
      .order("type", { ascending: true })
      .order("title", { ascending: true })
      .then(({ data, error }) => {
        if (error) {
          return;
        }
        const mapped: ScheduleTemplate[] = (data ?? []).map((r: any) => ({
          id: String(r.id),
          type: r.type === "leave" ? "leave" : "shift",
          title: String(r.title ?? ""),
          start: String(r.start_time ?? ""),
          end: String(r.end_time ?? ""),
        }));
        setTemplates(mapped);
      });
  }, [token]);

  useEffect(() => {
    if (!token) {
      setEvents([]);
      return;
    }
    const supabase = getSupabaseClient();
    if (!supabase) {
      return;
    }

    const startIso = format(weekStart, "yyyy-MM-dd");
    const endIso = format(addDays(weekStart, 6), "yyyy-MM-dd");
    let cancelled = false;

    (async () => {
      const { data: rows, error } = await supabase
        .from("schedule_events")
        .select("id,driver_id,type,title,date,start_time,end_time,created_at,updated_at")
        .gte("date", startIso)
        .lte("date", endIso)
        .order("date", { ascending: true });
      if (cancelled) {
        return;
      }
      if (error) {
        toast.error("Failed to load schedules", { description: error.message });
        setEvents([]);
        return;
      }

      const driverIds = Array.from(new Set((rows ?? []).map((r: any) => String(r.driver_id)).filter(Boolean)));
      const legacyById = new Map<string, string>();
      if (driverIds.length > 0) {
        const { data: driverRows } = await supabase.from("drivers").select("id,legacy_id").in("id", driverIds);
        for (const d of driverRows ?? []) {
          legacyById.set(String((d as any).id), String((d as any).legacy_id ?? ""));
        }
      }

      const mapped: ScheduleEvent[] = (rows ?? [])
        .map((r: any) => {
          const legacy = legacyById.get(String(r.driver_id)) ?? "";
          if (!legacy) {
            return null;
          }
          return {
            id: String(r.id),
            driverId: legacy,
            type: r.type === "leave" ? "leave" : "shift",
            title: String(r.title ?? ""),
            date: String(r.date ?? ""),
            start: String(r.start_time ?? ""),
            end: String(r.end_time ?? ""),
          } satisfies ScheduleEvent;
        })
        .filter(Boolean) as ScheduleEvent[];
      setEvents(mapped);
    })();

    return () => {
      cancelled = true;
    };
  }, [token, weekStart]);

  const weekDays = useMemo(() => {
    return days.map((day, idx) => {
      const date = addDays(weekStart, idx);
      return { day, date, iso: format(date, "yyyy-MM-dd") };
    });
  }, [weekStart]);

  const displayDrivers = useMemo(() => {
    const weekIsos = new Set<string>(weekDays.map((d) => d.iso));
    const activeCount = new Map<string, number>();
    for (const e of events) {
      if (!weekIsos.has(e.date)) {
        continue;
      }
      if (e.type !== "shift") {
        continue;
      }
      activeCount.set(e.driverId, (activeCount.get(e.driverId) ?? 0) + 1);
    }

    return drivers
      .slice()
      .sort((a, b) => {
        const aCount = activeCount.get(a.id) ?? 0;
        const bCount = activeCount.get(b.id) ?? 0;
        if (aCount !== bCount) {
          return bCount - aCount;
        }
        return a.name.localeCompare(b.name);
      })
      .slice(0, 10);
  }, [drivers, events, weekDays]);

  const weekRangeLabel = useMemo(() => {
    const startLabel = format(weekStart, "MMM d, yyyy");
    const endLabel = format(addDays(weekStart, 6), "MMM d, yyyy");
    return `${startLabel} - ${endLabel}`;
  }, [weekStart]);

  const eventsByKey = useMemo(() => {
    const map = new Map<string, ScheduleEvent>();
    for (const e of events) {
      map.set(`${e.driverId}|${e.date}`, e);
    }
    return map;
  }, [events]);

  const handleCreate = async (values: CreateScheduleEventValues) => {
    const dayEntry = weekDays.find((d) => d.day === values.day);
    if (!dayEntry) {
      return;
    }
    const supabase = getSupabaseClient();
    if (!supabase) {
      toast.error("Supabase client not configured");
      return;
    }

    const { data: driverRow, error: driverErr } = await supabase.from("drivers").select("id").eq("legacy_id", values.driverId).maybeSingle();
    if (driverErr || !driverRow) {
      toast.error("Driver not found");
      return;
    }

    const payloadBase: any = {
      driver_id: (driverRow as any).id,
      date: dayEntry.iso,
      type: values.type,
      title: values.title.trim(),
      start_time: values.type === "leave" ? null : (values.start ?? ""),
      end_time: values.type === "leave" ? null : (values.end ?? ""),
    };

    const { data: existing } = await supabase
      .from("schedule_events")
      .select("id")
      .eq("driver_id", (driverRow as any).id)
      .eq("date", dayEntry.iso)
      .maybeSingle();

    if (existing?.id) {
      const { error: updErr } = await supabase.from("schedule_events").update(payloadBase).eq("id", existing.id);
      if (updErr) {
        toast.error("Failed to save schedule", { description: updErr.message });
        return;
      }
    } else {
      const first = await supabase.from("schedule_events").insert(payloadBase).select("id").single();
      if (first.error) {
        const msg = String(first.error.message ?? "").toLowerCase();
        if (msg.includes("user_id") && msg.includes("null value")) {
          const second = await supabase
            .from("schedule_events")
            .insert({ ...payloadBase, user_id: session?.user?.id } as any)
            .select("id")
            .single();
          if (second.error) {
            toast.error("Failed to save schedule", { description: second.error.message });
            return;
          }
        } else {
          toast.error("Failed to save schedule", { description: first.error.message });
          return;
        }
      }
    }

    setEvents((prev) =>
      upsertScheduleEvent(prev, {
        driverId: values.driverId,
        date: dayEntry.iso,
        type: values.type,
        title: values.title,
        start: values.type === "leave" ? "" : (values.start ?? ""),
        end: values.type === "leave" ? "" : (values.end ?? ""),
      }),
    );
    toast.success("Schedule saved");
    setCreateOpen(false);
  };

  const handleUpdate = async (values: CreateScheduleEventValues) => {
    if (!editing) {
      return;
    }
    const dayEntry = weekDays.find((d) => d.day === values.day);
    if (!dayEntry) {
      return;
    }
    const supabase = getSupabaseClient();
    if (!supabase) {
      toast.error("Supabase client not configured");
      return;
    }

    const { data: driverRow, error: driverErr } = await supabase.from("drivers").select("id").eq("legacy_id", values.driverId).maybeSingle();
    if (driverErr || !driverRow) {
      toast.error("Driver not found");
      return;
    }

    const payloadBase: any = {
      driver_id: (driverRow as any).id,
      date: dayEntry.iso,
      type: values.type,
      title: values.title.trim(),
      start_time: values.type === "leave" ? null : (values.start ?? ""),
      end_time: values.type === "leave" ? null : (values.end ?? ""),
    };

    const { error: updErr } = await supabase.from("schedule_events").update(payloadBase).eq("id", editing.event.id);
    if (updErr) {
      toast.error("Failed to update schedule", { description: updErr.message });
      return;
    }

    setEvents((prev) => {
      const withoutOld = prev.filter((e) => !(e.driverId === editing.event.driverId && e.date === editing.event.date));
      return upsertScheduleEvent(withoutOld, {
        id: editing.event.id,
        driverId: values.driverId,
        date: dayEntry.iso,
        type: values.type,
        title: values.title,
        start: values.type === "leave" ? "" : (values.start ?? ""),
        end: values.type === "leave" ? "" : (values.end ?? ""),
      });
    });
    toast.success("Schedule updated");
    setEditOpen(false);
    setEditing(null);
  };

  const handleDelete = () => {
    if (!editing) {
      return;
    }
    const supabase = getSupabaseClient();
    if (!supabase) {
      toast.error("Supabase client not configured");
      return;
    }
    supabase
      .from("schedule_events")
      .delete()
      .eq("id", editing.event.id)
      .then(({ error }) => {
        if (error) {
          toast.error("Failed to delete schedule", { description: error.message });
          return;
        }
        setEvents((prev) => prev.filter((e) => !(e.driverId === editing.event.driverId && e.date === editing.event.date)));
        toast.success("Schedule deleted");
        setEditOpen(false);
        setEditing(null);
      });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Driver Scheduling</h1>
          <p className="text-sm text-muted-foreground mt-1">Weekly schedule — {weekRangeLabel}</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button>
              <Plus className="w-4 h-4" /> Add <ChevronDown className="h-4 w-4 opacity-80" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Create</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                setCreatePrefill(null);
                setCreateOpen(true);
              }}
            >
              Add schedule
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setManageTypesOpen(true)}>Manage schedule types</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex items-center gap-4 text-xs">
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-primary/20 border border-primary/40" /> Shift</div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-warning/20 border border-warning/40" /> Leave</div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-muted border border-border" /> Off</div>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden overflow-x-auto">
        <table className="w-full min-w-[980px]">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th colSpan={8} className="px-4 py-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-muted-foreground">{weekRangeLabel}</span>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setWeekStart((prev) => addWeeks(prev, -1))}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Prev
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setWeekStart(() => startOfWeek(new Date(), { weekStartsOn: 1 }))}
                    >
                      This week
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setWeekStart((prev) => addWeeks(prev, 1))}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </th>
            </tr>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 w-44">Driver</th>
              {weekDays.map(({ day, date, iso }) => (
                <th key={iso} className="text-center text-xs font-medium text-muted-foreground px-4 py-3">
                  <div className="flex flex-col items-center leading-tight">
                    <span>{day}</span>
                    <span className="text-[10px] text-muted-foreground">{format(date, "dd MMM")}</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {displayDrivers.map((driver) => (
              <tr key={driver.id} className="hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold">
                      {driver.avatar}
                    </div>
                    <div>
                      <p className="text-xs font-medium text-foreground">{driver.name}</p>
                      <p className="text-[10px] text-muted-foreground">{driver.id}</p>
                    </div>
                  </div>
                </td>
                {weekDays.map(({ iso, day }) => {
                  const event = eventsByKey.get(`${driver.id}|${iso}`);
                  const isDayOff = event?.title.trim().toLowerCase() === "day off";
                  return (
                    <td key={iso} className="px-2 py-2 text-center">
                      {event ? (
                        <div
                          role="button"
                          tabIndex={0}
                          className={cn(
                            "rounded-lg px-2 py-1.5 text-[10px] font-medium cursor-pointer",
                            isDayOff
                              ? "bg-muted/30 text-muted-foreground border border-border"
                              : event.type === "leave"
                                ? "bg-warning/10 text-warning border border-warning/20"
                                : "bg-primary/10 text-primary border border-primary/20",
                          )}
                          onClick={() => {
                            const dayEntry = weekDays.find((d) => d.iso === iso);
                            if (!dayEntry) {
                              return;
                            }
                            setEditing({ event, day: dayEntry.day });
                            setEditOpen(true);
                          }}
                          onKeyDown={(e) => {
                            if (e.key !== "Enter" && e.key !== " ") {
                              return;
                            }
                            e.preventDefault();
                            const dayEntry = weekDays.find((d) => d.iso === iso);
                            if (!dayEntry) {
                              return;
                            }
                            setEditing({ event, day: dayEntry.day });
                            setEditOpen(true);
                          }}
                        >
                          <p>{event.title}</p>
                          {event.start && !isDayOff && <p className="text-[9px] opacity-70">{event.start}-{event.end}</p>}
                        </div>
                      ) : (
                        <div
                          role="button"
                          tabIndex={0}
                          className="rounded-lg px-2 py-1.5 text-[10px] text-muted-foreground bg-muted/30 cursor-pointer"
                          onClick={() => {
                            setCreatePrefill({ driverId: driver.id, day });
                            setCreateOpen(true);
                          }}
                          onKeyDown={(e) => {
                            if (e.key !== "Enter" && e.key !== " ") {
                              return;
                            }
                            e.preventDefault();
                            setCreatePrefill({ driverId: driver.id, day });
                            setCreateOpen(true);
                          }}
                        >
                          —
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
            {displayDrivers.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  {driversLoading ? "Loading…" : "No drivers yet. Please add drivers first."}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <CreateScheduleEventDialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) {
            setCreatePrefill(null);
          }
        }}
        drivers={drivers}
        templates={templates}
        onCreate={handleCreate}
        mode="create"
        initialValues={createPrefill ?? undefined}
      />
      <CreateScheduleEventDialog
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open);
          if (!open) {
            setEditing(null);
          }
        }}
        drivers={drivers}
        templates={templates}
        onCreate={handleUpdate}
        mode="edit"
        onDelete={handleDelete}
        initialValues={
          editing
            ? {
                driverId: editing.event.driverId,
                day: editing.day,
                type: editing.event.type,
                title: editing.event.title,
                start: editing.event.start,
                end: editing.event.end,
              }
            : undefined
        }
      />

      <ManageScheduleTypesDialog
        open={manageTypesOpen}
        onOpenChange={setManageTypesOpen}
        onChanged={setTemplates}
      />
    </div>
  );
}
