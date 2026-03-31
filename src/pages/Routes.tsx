import { useEffect, useMemo, useRef, useState } from "react";

import AddStopDialog from "@/components/AddStopDialog";
import CreateLocationDialog from "@/components/CreateLocationDialog";
import LocationPicker from "@/components/LocationPicker";
import RouteMap from "@/components/RouteMap";
import { toast } from "@/components/ui/sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { createLocation, loadLocations, saveLocations, upsertLocation, type SavedLocation } from "@/lib/locationsStorage";
import { loadRoutes, makeId, normalizeStops, saveRoutes, type RouteModel } from "@/lib/routesStorage";
import { getTruckRouteOptions, type TruckRouteOption } from "@/lib/truckRouting";
import { AlertTriangle, ArrowDown, ArrowUp, CheckCircle2, ChevronDown, Loader2, MapPin, Plus, Trash2, XCircle } from "lucide-react";

const makeDraft = (): RouteModel => {
  const now = new Date().toISOString();
  return {
    id: makeId(),
    name: "",
    origin: null,
    destination: null,
    stops: [],
    createdAt: now,
    updatedAt: now,
  };
};

export default function Routes() {
  const [routes, setRoutes] = useState<RouteModel[]>(() => loadRoutes());
  const [locations, setLocations] = useState<SavedLocation[]>(() => loadLocations());
  const [selectedId, setSelectedId] = useState<string | null>(routes[0]?.id ?? null);
  const [draft, setDraft] = useState<RouteModel | null>(() => {
    const initial = selectedId ? routes.find((r) => r.id === selectedId) ?? null : null;
    return initial ? JSON.parse(JSON.stringify(initial)) : null;
  });
  const [savedSnapshot, setSavedSnapshot] = useState<string>(() => {
    const initial = selectedId ? routes.find((r) => r.id === selectedId) ?? null : null;
    return initial ? JSON.stringify(initial) : "";
  });

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingSelectId, setPendingSelectId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<"select" | "new" | null>(null);

  const [activeTab, setActiveTab] = useState<"editor" | "saved">("editor");

  const [addStopOpen, setAddStopOpen] = useState(false);
  const [createLocationOpen, setCreateLocationOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [routeOptions, setRouteOptions] = useState<TruckRouteOption[]>([]);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const routeAbortRef = useRef<AbortController | null>(null);

  const selectedRoute = useMemo(() => {
    if (!selectedRouteId) {
      return null;
    }
    return routeOptions.find((o) => o.id === selectedRouteId) ?? null;
  }, [routeOptions, selectedRouteId]);

  const formatDistance = (meters: number) => {
    if (!Number.isFinite(meters)) {
      return "—";
    }
    if (meters < 1000) {
      return `${Math.round(meters)} m`;
    }
    return `${(meters / 1000).toFixed(1)} km`;
  };

  const formatDuration = (seconds: number) => {
    if (!Number.isFinite(seconds)) {
      return "—";
    }
    const minutes = Math.round(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours} hr ${mins} min` : `${mins} min`;
  };

  const splitStepsIntoSections = (steps: TruckRouteOption["steps"], via: string) => {
    if (steps.length === 0) {
      return [] as Array<{ id: string; title: string; distance: number; duration: number; steps: TruckRouteOption["steps"] }>;
    }

    const firstHighwayIdx = steps.findIndex((s) => /\bTol\b|Toll|Motorway|Highway|Expressway/i.test(`${s.instruction} ${s.name}`));
    const startEnd = firstHighwayIdx > 3 ? Math.min(firstHighwayIdx, 18) : Math.min(12, Math.max(6, Math.floor(steps.length * 0.2)));
    const endStart = Math.max(startEnd, steps.length - 10);

    const sections: Array<{ id: string; title: string; distance: number; duration: number; steps: TruckRouteOption["steps"] }> = [];

    const a = steps.slice(0, startEnd);
    const b = steps.slice(startEnd, endStart);
    const c = steps.slice(endStart);

    const sum = (arr: TruckRouteOption["steps"]) => ({
      distance: arr.reduce((acc, s) => acc + (s.distanceMeters || 0), 0),
      duration: arr.reduce((acc, s) => acc + (s.durationSeconds || 0), 0),
    });

    if (a.length > 0) {
      const s = sum(a);
      sections.push({ id: "section_1", title: "Get to main road", distance: s.distance, duration: s.duration, steps: a });
    }
    if (b.length > 0) {
      const s = sum(b);
      sections.push({ id: "section_2", title: via ? `Drive via ${via}` : "Main route", distance: s.distance, duration: s.duration, steps: b });
    }
    if (c.length > 0) {
      const s = sum(c);
      sections.push({ id: "section_3", title: "Arrive", distance: s.distance, duration: s.duration, steps: c });
    }

    return sections;
  };

  const buildGuidanceSections = (steps: TruckRouteOption["steps"], via: string) => {
    const base = splitStepsIntoSections(steps, via);
    const out: Array<{ id: string; title: string; distance: number; duration: number; steps: TruckRouteOption["steps"]; kind: "main" | "stopover" }> = [];

    const sum = (arr: TruckRouteOption["steps"]) => ({
      distance: arr.reduce((acc, s) => acc + (s.distanceMeters || 0), 0),
      duration: arr.reduce((acc, s) => acc + (s.durationSeconds || 0), 0),
    });

    let stopoverIndex = 0;

    for (const section of base) {
      let buffer: TruckRouteOption["steps"] = [];

      const flushBuffer = () => {
        if (buffer.length === 0) {
          return;
        }
        const s = sum(buffer);
        out.push({
          id: `${section.id}_part_${out.length}`,
          title: section.title,
          distance: s.distance,
          duration: s.duration,
          steps: buffer,
          kind: "main",
        });
        buffer = [];
      };

      for (const step of section.steps) {
        if (step.instruction.trim().toLowerCase() === "arrive at stopover") {
          flushBuffer();
          stopoverIndex += 1;
          out.push({
            id: `stopover_${stopoverIndex}`,
            title: step.name?.trim() ? `Stopover: ${step.name.trim()}` : `Stopover ${stopoverIndex}`,
            distance: 0,
            duration: 0,
            steps: [step],
            kind: "stopover",
          });
        } else {
          buffer.push(step);
        }
      }

      flushBuffer();
    }

    return out;
  };

  const googleMapsLink = useMemo(() => {
    if (!draft?.origin || !draft.destination) {
      return "";
    }
    const origin = `${draft.origin.lat},${draft.origin.lng}`;
    const destination = `${draft.destination.lat},${draft.destination.lng}`;
    const url = new URL("https://www.google.com/maps/dir/?api=1");
    url.searchParams.set("origin", origin);
    url.searchParams.set("destination", destination);
    url.searchParams.set("travelmode", "driving");
    url.searchParams.set("dir_action", "navigate");

    const waypoints = normalizeStops(draft.stops)
      .slice(0, 8)
      .map((s) => `${s.lat},${s.lng}`)
      .join("|");
    if (waypoints.length > 0) {
      url.searchParams.set("waypoints", waypoints);
    }

    return url.toString();
  }, [draft?.destination, draft?.origin, draft?.stops]);

  const getSegmentForStep = (stepIndex: number, totalSteps: number) => {
    const segs = selectedRoute?.segments;
    if (!segs || segs.length === 0 || totalSteps <= 0) {
      return null;
    }
    const idx = Math.min(segs.length - 1, Math.max(0, Math.floor((stepIndex / totalSteps) * segs.length)));
    return segs[idx] ?? null;
  };

  const scoreColor = (seg: NonNullable<ReturnType<typeof getSegmentForStep>>) => {
    const matched =
      seg.matched !== undefined
        ? seg.matched
        : Boolean(seg.highway || seg.maxspeed || seg.maxweight || seg.maxheight || seg.lanes);

    if (!matched) {
      return "yellow" as const;
    }

    const highway = (seg.highway ?? "").toLowerCase();
    const hardUnsafe = new Set(["footway", "path", "cycleway", "track", "steps"]);
    if (hardUnsafe.has(highway)) {
      return "red" as const;
    }

    if (seg.score < 1) {
      return "yellow" as const;
    }

    if (seg.score >= 4) {
      return "green" as const;
    }

    return "yellow" as const;
  };

  const isDirty = useMemo(() => {
    if (!draft) {
      return false;
    }
    return JSON.stringify(draft) !== savedSnapshot;
  }, [draft, savedSnapshot]);

  const startNewDraft = () => {
    const next = makeDraft();
    setSelectedId(null);
    setDraft(next);
    setSavedSnapshot("");
    setFormError(null);
    setActiveTab("editor");
  };

  const requestSelect = (id: string) => {
    if (draft && isDirty) {
      setPendingSelectId(id);
      setPendingAction("select");
      setConfirmOpen(true);
      return;
    }
    const r = routes.find((x) => x.id === id) ?? null;
    setSelectedId(id);
    setDraft(r ? JSON.parse(JSON.stringify(r)) : null);
    setSavedSnapshot(r ? JSON.stringify(r) : "");
    setFormError(null);
    setActiveTab("editor");
  };

  const requestNew = () => {
    if (draft && isDirty) {
      setPendingAction("new");
      setPendingSelectId(null);
      setConfirmOpen(true);
      return;
    }
    startNewDraft();
  };

  const applyPending = () => {
    if (pendingAction === "new") {
      startNewDraft();
    }
    if (pendingAction === "select" && pendingSelectId) {
      const r = routes.find((x) => x.id === pendingSelectId) ?? null;
      setSelectedId(pendingSelectId);
      setDraft(r ? JSON.parse(JSON.stringify(r)) : null);
      setSavedSnapshot(r ? JSON.stringify(r) : "");
      setFormError(null);
      setActiveTab("editor");
    }
    setPendingAction(null);
    setPendingSelectId(null);
  };

  const canSave = !!draft?.origin && !!draft?.destination;

  const saveCurrent = () => {
    if (!draft) {
      return;
    }
    if (!draft.origin || !draft.destination) {
      setFormError("Origin and destination are required.");
      return;
    }

    const now = new Date().toISOString();
    const nextDraft: RouteModel = {
      ...draft,
      name: draft.name?.trim() || "",
      stops: normalizeStops(draft.stops),
      updatedAt: now,
      createdAt: draft.createdAt || now,
    };

    setRoutes((prev) => {
      const exists = prev.some((r) => r.id === nextDraft.id);
      const next = exists ? prev.map((r) => (r.id === nextDraft.id ? nextDraft : r)) : [nextDraft, ...prev];
      saveRoutes(next);
      return next;
    });

    setSelectedId(nextDraft.id);
    setDraft(JSON.parse(JSON.stringify(nextDraft)));
    setSavedSnapshot(JSON.stringify(nextDraft));
    setFormError(null);
    toast.success("Route saved");
  };

  const deleteSelected = () => {
    if (!draft) {
      return;
    }

    const id = draft.id;
    const exists = routes.some((r) => r.id === id);
    if (!exists) {
      const nextId = routes[0]?.id ?? null;
      setSelectedId(nextId);
      const nextRoute = nextId ? routes.find((r) => r.id === nextId) ?? null : null;
      setDraft(nextRoute ? JSON.parse(JSON.stringify(nextRoute)) : null);
      setSavedSnapshot(nextRoute ? JSON.stringify(nextRoute) : "");
      toast.success("Draft discarded");
      return;
    }

    const next = routes.filter((r) => r.id !== id);
    setRoutes(next);
    saveRoutes(next);
    const nextId = next[0]?.id ?? null;
    setSelectedId(nextId);
    const nextRoute = nextId ? next.find((r) => r.id === nextId) ?? null : null;
    setDraft(nextRoute ? JSON.parse(JSON.stringify(nextRoute)) : null);
    setSavedSnapshot(nextRoute ? JSON.stringify(nextRoute) : "");
    setFormError(null);
    toast.success("Route deleted");
  };

  const setDraftField = (patch: Partial<RouteModel>) => {
    setDraft((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  useEffect(() => {
    if (!draft?.origin || !draft.destination) {
      routeAbortRef.current?.abort();
      routeAbortRef.current = null;
      setRouteOptions([]);
      setRouteError(null);
      setRouteLoading(false);
      setSelectedRouteId(null);
      return;
    }

    routeAbortRef.current?.abort();
    const controller = new AbortController();
    routeAbortRef.current = controller;

    setRouteLoading(true);
    setRouteError(null);

    const stops = normalizeStops(draft.stops).map((s) => ({ lat: s.lat, lng: s.lng, label: s.label }));

    getTruckRouteOptions(
      { lat: draft.origin.lat, lng: draft.origin.lng },
      { lat: draft.destination.lat, lng: draft.destination.lng },
      { stops },
      controller.signal,
    )
      .then((opts) => {
        if (controller.signal.aborted) {
          return;
        }
        setRouteOptions(opts);
        setSelectedRouteId(opts[0]?.id ?? null);
      })
      .catch((e) => {
        if (controller.signal.aborted) {
          return;
        }
        setRouteOptions([]);
        setSelectedRouteId(null);
        setRouteError(e instanceof Error ? e.message : "Failed to fetch route options");
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setRouteLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [draft?.destination, draft?.origin, draft?.stops]);

  return (
    <div className="space-y-6">
      <Dialog open={routeLoading}>
        <DialogContent className="max-w-sm">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin" />
            <div>
              <p className="text-sm font-semibold text-foreground">Finding truck-safe routes</p>
              <p className="text-xs text-muted-foreground mt-0.5">Scoring roads using OSM tags…</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Routes</h1>
          <p className="text-sm text-muted-foreground mt-1">Create and save routes with origin, destination, and supporting locations.</p>
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
            <DropdownMenuItem onClick={requestNew}>Add route</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setCreateLocationOpen(true)}>Add location</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "editor" | "saved")}>
        <TabsList className="w-full">
          <TabsTrigger value="editor" className="flex-1">
            Editor
          </TabsTrigger>
          <TabsTrigger value="saved" className="flex-1">
            Saved routes ({routes.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="saved">
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">Saved routes</p>
              <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{routes.length}</span>
            </div>
            <div className="p-2 space-y-2 max-h-[calc(100vh-260px)] overflow-y-auto">
              {draft && !routes.some((r) => r.id === draft.id) ? (
                <button
                  type="button"
                  className={cn(
                    "w-full text-left rounded-lg border px-3 py-2.5 transition-colors",
                    "bg-primary/5 border-primary/30",
                  )}
                >
                  <p className="text-xs font-semibold text-foreground">Draft (unsaved)</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">
                    {draft.origin?.label ? `${draft.origin.label} → ${draft.destination?.label ?? ""}` : "Set origin and destination"}
                  </p>
                </button>
              ) : null}

              {routes.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground">
                  <MapPin className="w-7 h-7 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No routes yet</p>
                  <p className="text-xs mt-1">Create your first route to see it here.</p>
                </div>
              ) : null}

              {routes.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => requestSelect(r.id)}
                  className={cn(
                    "w-full text-left rounded-lg border px-3 py-2.5 hover:bg-muted/30 transition-colors",
                    selectedId === r.id ? "border-primary/40 bg-primary/5" : "border-border bg-background",
                  )}
                >
                  <p className="text-xs font-semibold text-foreground line-clamp-1">{r.name?.trim() ? r.name : "Untitled route"}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">
                    {(r.origin?.label ?? "Origin")} → {(r.destination?.label ?? "Destination")}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="editor">
          <div className="space-y-4">
            {draft ? (
              <div className="bg-card border border-border rounded-xl p-5 space-y-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <p className="text-sm font-semibold text-foreground">Route editor</p>
                  <p className="text-xs text-muted-foreground mt-1">Fill origin and destination, then add supporting locations.</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" onClick={deleteSelected}>
                    <Trash2 className="w-4 h-4" /> {routes.some((r) => r.id === draft.id) ? "Delete" : "Discard"}
                  </Button>
                  <Button onClick={saveCurrent} disabled={!canSave}>
                    Save
                  </Button>
                </div>
              </div>

              {formError ? (
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                  <p className="text-xs text-destructive font-medium">{formError}</p>
                </div>
              ) : null}

              <div className="grid grid-cols-1 xl:grid-cols-[1fr_520px] gap-4">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-foreground">Route title</p>
                    <Input
                      value={draft.name ?? ""}
                      onChange={(e) => setDraftField({ name: e.target.value })}
                      placeholder="e.g. Warehouse Jakarta Sudirman to Warehouse Surabaya Tegalsari"
                    />
                  </div>

                  <LocationPicker
                    label="Origin"
                    value={draft.origin}
                    locations={locations}
                    onChange={(next) => {
                      setFormError(null);
                      setDraftField({ origin: next });
                    }}
                  />

                  <div className="bg-card border border-border rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-foreground">Stopover Point</p>
                        <p className="text-xs text-muted-foreground">Add stops like rest areas.</p>
                      </div>
                      <Button variant="outline" onClick={() => setAddStopOpen(true)}>
                        <Plus className="w-4 h-4" /> Add
                      </Button>
                    </div>

                    {draft.stops.length > 0 ? (
                      <div className="space-y-2">
                        {normalizeStops(draft.stops).map((s, idx) => (
                          <div key={s.id} className="bg-background border border-border rounded-lg p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-foreground line-clamp-1">{s.label}</p>
                                <p className="text-[10px] text-muted-foreground mt-1">
                                  {s.lat.toFixed(6)}, {s.lng.toFixed(6)} • {s.source}
                                </p>
                              </div>
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  disabled={idx === 0}
                                  onClick={() => {
                                    const ordered = normalizeStops(draft.stops);
                                    const next = ordered.slice();
                                    const tmp = next[idx - 1];
                                    next[idx - 1] = next[idx];
                                    next[idx] = tmp;
                                    setDraftField({ stops: normalizeStops(next) });
                                  }}
                                  aria-label="Move up"
                                >
                                  <ArrowUp className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  disabled={idx === draft.stops.length - 1}
                                  onClick={() => {
                                    const ordered = normalizeStops(draft.stops);
                                    const next = ordered.slice();
                                    const tmp = next[idx + 1];
                                    next[idx + 1] = next[idx];
                                    next[idx] = tmp;
                                    setDraftField({ stops: normalizeStops(next) });
                                  }}
                                  aria-label="Move down"
                                >
                                  <ArrowDown className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive"
                                  onClick={() => {
                                    setDraftField({ stops: normalizeStops(draft.stops.filter((x) => x.id !== s.id)) });
                                  }}
                                  aria-label="Remove"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <LocationPicker
                    label="Destination"
                    value={draft.destination}
                    locations={locations}
                    onChange={(next) => {
                      setFormError(null);
                      setDraftField({ destination: next });
                    }}
                  />

                  {draft.origin && draft.destination ? (
                    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
                      <div>
                        <p className="text-sm font-semibold text-foreground">Recommended truck routes</p>
                        <p className="text-xs text-muted-foreground">Highway-priority options for the selected origin and destination.</p>
                      </div>

                      {routeLoading ? <p className="text-xs text-muted-foreground">Loading route options…</p> : null}
                      {routeError ? <p className="text-xs text-destructive">{routeError}</p> : null}

                      {routeOptions.length > 0 ? (
                        <div className="space-y-2">
                          {routeOptions.map((opt) => {
                            const km = opt.distanceMeters > 0 ? opt.distanceMeters / 1000 : null;
                            const minutes = opt.durationSeconds > 0 ? Math.round(opt.durationSeconds / 60) : null;
                            const hours = minutes != null ? Math.floor(minutes / 60) : 0;
                            const mins = minutes != null ? minutes % 60 : 0;
                            const durationLabel = minutes == null ? "—" : hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
                            const selected = selectedRouteId === opt.id;

                            return (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() => setSelectedRouteId(opt.id)}
                                className={cn(
                                  "w-full text-left bg-background border border-border rounded-lg p-3 hover:bg-muted/30 transition-colors",
                                  selected && "border-primary/50",
                                )}
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <p className="text-xs font-semibold text-foreground">
                                    {durationLabel} • {km == null ? "—" : km.toFixed(1)} km
                                  </p>
                                  <p className="text-[10px] text-muted-foreground">
                                    Highway score {opt.highwayScore} • Major road {opt.majorRoadScore}
                                  </p>
                                </div>
                                {opt.stepsPreview.length > 0 ? (
                                  <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2">
                                    {opt.stepsPreview.join(" • ")}
                                  </p>
                                ) : null}
                              </button>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                <div className="space-y-3">
                  <div className="bg-card border border-border rounded-xl p-4">
                    <p className="text-sm font-semibold text-foreground">Map</p>
                    <p className="text-xs text-muted-foreground mt-1">Shows the currently selected recommended route.</p>
                  </div>

                  {draft.origin && draft.destination && selectedRoute && selectedRoute.line.length > 1 ? (
                    <RouteMap
                      origin={{ lat: draft.origin.lat, lng: draft.origin.lng }}
                      destination={{ lat: draft.destination.lat, lng: draft.destination.lng }}
                      stops={normalizeStops(draft.stops).map((s) => ({ lat: s.lat, lng: s.lng }))}
                      line={selectedRoute.line}
                    />
                  ) : (
                    <div className="h-[520px] w-full rounded-xl border border-border bg-muted/20 flex items-center justify-center text-xs text-muted-foreground">
                      Select a route option to preview it on the map.
                    </div>
                  )}

                  {draft.origin && draft.destination && selectedRoute ? (
                    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-foreground">Route details</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatDuration(selectedRoute.durationSeconds)} ({formatDistance(selectedRoute.distanceMeters)})
                            {selectedRoute.via ? ` • via ${selectedRoute.via}` : ""}
                          </p>
                        </div>
                        {selectedRoute.tollLikely ? (
                          <div className="text-[10px] text-muted-foreground bg-muted px-2 py-1 rounded-md">May include tolls</div>
                        ) : null}
                      </div>

                      <div className="grid grid-cols-1 gap-2">
                        <div className="bg-muted/20 border border-border rounded-lg p-3">
                          <p className="text-[10px] text-muted-foreground">Origin</p>
                          <p className="text-xs text-foreground mt-1">{draft.origin.label}</p>
                          <p className="text-[10px] text-muted-foreground mt-1">
                            {draft.origin.lat.toFixed(6)}, {draft.origin.lng.toFixed(6)}
                          </p>
                        </div>
                        <div className="bg-muted/20 border border-border rounded-lg p-3">
                          <p className="text-[10px] text-muted-foreground">Destination</p>
                          <p className="text-xs text-foreground mt-1">{draft.destination.label}</p>
                          <p className="text-[10px] text-muted-foreground mt-1">
                            {draft.destination.lat.toFixed(6)}, {draft.destination.lng.toFixed(6)}
                          </p>
                        </div>
                      </div>

                      {googleMapsLink ? (
                        <div className="bg-muted/20 border border-border rounded-lg p-3 space-y-2">
                          <p className="text-[10px] text-muted-foreground">Google Maps directions link</p>
                          <div className="flex items-center gap-2">
                            <Input readOnly value={googleMapsLink} className="text-xs" onFocus={(e) => e.currentTarget.select()} />
                            <Button
                              type="button"
                              variant="outline"
                              onClick={async () => {
                                try {
                                  await navigator.clipboard.writeText(googleMapsLink);
                                  toast.success("Link copied");
                                } catch {
                                  toast.error("Failed to copy link");
                                }
                              }}
                            >
                              Copy
                            </Button>
                          </div>
                          <Button asChild className="w-full">
                            <a href={googleMapsLink} target="_blank" rel="noreferrer">
                              Open in Google Maps
                            </a>
                          </Button>
                        </div>
                      ) : null}

                      <Accordion type="single" collapsible className="w-full">
                        {buildGuidanceSections(selectedRoute.steps, selectedRoute.via).map((section) => (
                          <AccordionItem key={section.id} value={section.id}>
                            <AccordionTrigger className="text-sm">
                              <div className="flex flex-1 items-center justify-between gap-3">
                                <span className={cn("text-sm", section.kind === "stopover" ? "text-primary" : "text-foreground")}>
                                  {section.title}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {formatDuration(section.duration)} ({formatDistance(section.distance)})
                                </span>
                              </div>
                            </AccordionTrigger>
                            <AccordionContent>
                              <div className="max-h-[260px] overflow-y-auto pr-1 space-y-2">
                                {section.steps.map((s, idx) => {
                                  const totalSteps = selectedRoute.steps.length;
                                  const globalIndex = selectedRoute.steps.indexOf(s);
                                  const seg = getSegmentForStep(globalIndex >= 0 ? globalIndex : idx, totalSteps);
                                  const color = seg ? scoreColor(seg) : "yellow";
                                  const matched = seg
                                    ? seg.matched !== undefined
                                      ? seg.matched
                                      : Boolean(seg.highway || seg.maxspeed || seg.maxweight || seg.maxheight || seg.lanes)
                                    : false;

                                  return (
                                    <div key={`${section.id}_${idx}`} className="flex items-center justify-between gap-4">
                                      <div className="min-w-0 flex items-center gap-2">
                                        <Popover>
                                          <PopoverTrigger asChild>
                                            <button
                                              type="button"
                                              className="h-6 w-6 flex items-center justify-center"
                                              aria-label="Show segment score"
                                            >
                                              {color === "green" ? (
                                                <CheckCircle2 className="h-4 w-4 text-[hsl(var(--success))]" />
                                              ) : color === "red" ? (
                                                <XCircle className="h-4 w-4 text-[hsl(var(--destructive))]" />
                                              ) : (
                                                <AlertTriangle className="h-4 w-4 text-[hsl(var(--warning))]" />
                                              )}
                                            </button>
                                          </PopoverTrigger>
                                          <PopoverContent align="start" className="w-80">
                                            <div className="space-y-2">
                                              <p className="text-xs font-semibold text-foreground">Segment score</p>
                                              {seg ? (
                                                <>
                                                  <p className="text-[10px] text-muted-foreground">
                                                    score={seg.score} • tags={matched ? "yes" : "no"}
                                                    {seg.tagCount != null ? ` (${seg.tagCount})` : ""}
                                                    {seg.matchDistanceMeters != null ? ` • snap≈${Math.round(seg.matchDistanceMeters)}m` : ""}
                                                  </p>
                                                  <div className="bg-muted/20 border border-border rounded-lg p-2 space-y-1">
                                                    <p className="text-[10px] text-muted-foreground">highway: {seg.highway ?? "—"}</p>
                                                    <p className="text-[10px] text-muted-foreground">maxspeed: {seg.maxspeed ?? "—"}</p>
                                                    <p className="text-[10px] text-muted-foreground">lanes: {seg.lanes ?? "—"}</p>
                                                    <p className="text-[10px] text-muted-foreground">maxweight: {seg.maxweight ?? "—"}</p>
                                                    <p className="text-[10px] text-muted-foreground">maxheight: {seg.maxheight ?? "—"}</p>
                                                    <p className="text-[10px] text-muted-foreground">way: {seg.osmWayId ?? "—"}</p>
                                                  </div>
                                                </>
                                              ) : (
                                                <div className="bg-warning/10 border border-warning/20 rounded-lg p-3">
                                                  <p className="text-xs text-warning">No OSM segment match available for this step.</p>
                                                </div>
                                              )}
                                            </div>
                                          </PopoverContent>
                                        </Popover>

                                        <div className="min-w-0">
                                          <p className="text-xs text-foreground">{s.instruction}</p>
                                          {s.name?.trim() ? (
                                            <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{s.name}</p>
                                          ) : null}
                                        </div>
                                      </div>

                                      <div className="shrink-0 text-right">
                                        <p className="text-[10px] text-muted-foreground">{formatDistance(s.distanceMeters)}</p>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        ))}
                      </Accordion>
                    </div>
                  ) : null}
                </div>
              </div>

              <p className={cn("text-xs", isDirty ? "text-warning" : "text-muted-foreground")}>
                {isDirty ? "You have unsaved changes." : "All changes saved."}
              </p>
              </div>
            ) : (
              <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground">
                <MapPin className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Select a route or create a new one</p>
                <p className="text-xs mt-1">You can add locations by searching a name or pasting a Google Maps link.</p>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <AddStopDialog
        open={addStopOpen}
        onOpenChange={setAddStopOpen}
        locations={locations}
        onAdd={(stop) => {
          setDraft((prev) => {
            if (!prev) {
              return prev;
            }
            const next = {
              ...prev,
              stops: normalizeStops([
                ...prev.stops,
                {
                  id: makeId(),
                  position: prev.stops.length,
                  label: stop.label,
                  lat: stop.lat,
                  lng: stop.lng,
                  source: stop.source,
                },
              ]),
            };
            return next;
          });
        }}
      />

      <CreateLocationDialog
        open={createLocationOpen}
        onOpenChange={setCreateLocationOpen}
        locations={locations}
        onCreate={(next) => {
          setLocations((prev) => {
            const exists = prev.some((l) => l.label.trim().toLowerCase() === next.label.trim().toLowerCase() && l.kind === next.kind);
            if (exists) {
              toast.error("Location already exists", { description: `${next.kind}: ${next.label}` });
              return prev;
            }
            const created = createLocation(next);
            const updated = upsertLocation(prev, created);
            saveLocations(updated);
            toast.success("Location created", { description: `${created.kind}: ${created.label}` });
            return updated;
          });
        }}
      />

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard changes?</AlertDialogTitle>
            <AlertDialogDescription>You have unsaved changes. If you continue, your edits will be lost.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setPendingAction(null);
                setPendingSelectId(null);
              }}
            >
              Keep editing
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                applyPending();
              }}
            >
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
