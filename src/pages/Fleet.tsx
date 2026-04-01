import { useEffect, useMemo, useState } from "react";
import { addMonths, format } from "date-fns";
import { type Truck } from "@/data/mockData";
import { loadDrivers } from "@/lib/driversStorage";
import StatusBadge from "@/components/StatusBadge";
import CreateTruckDialog, { type CreateTruckValues } from "@/components/CreateTruckDialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/components/ui/sonner";
import { loadMaintenanceRecords } from "@/lib/maintenanceStorage";
import { ChevronDown, Fuel, LayoutGrid, Plus, Search, Table2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetchJson } from "@/lib/apiFetch";
import { useAuth } from "@/components/AuthProvider";

type FleetTruck = Truck & { dbId: string };

export default function Fleet() {
  const { session, signOut } = useAuth();
  const token = session?.access_token ?? "";
  const drivers = useMemo(() => loadDrivers(), []);
  const maintenanceRecords = useMemo(() => loadMaintenanceRecords(), []);
  const [search, setSearch] = useState("");
  const allStatuses: Truck["status"][] = ["Active", "In Maintenance", "Idle"];
  const [selectedStatuses, setSelectedStatuses] = useState<Truck["status"][]>(allStatuses);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingTruck, setEditingTruck] = useState<FleetTruck | null>(null);
  const [fleetTrucks, setFleetTrucks] = useState<FleetTruck[]>([]);
  const [viewMode, setViewMode] = useState<"grid" | "table">("table");
  const [loading, setLoading] = useState(false);

  const filtered = useMemo(() => {
    return fleetTrucks.filter((t) => {
      const matchSearch =
        t.plateNumber.toLowerCase().includes(search.toLowerCase()) ||
        t.id.toLowerCase().includes(search.toLowerCase()) ||
        t.type.toLowerCase().includes(search.toLowerCase());
      const matchStatus = selectedStatuses.length === 0 || selectedStatuses.includes(t.status);
      return matchSearch && matchStatus;
    });
  }, [fleetTrucks, search, selectedStatuses]);

  const lastServiceByTruckId = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of maintenanceRecords) {
      if (r.status !== "Completed") {
        continue;
      }
      const prev = map.get(r.truckId);
      if (!prev || r.date > prev) {
        map.set(r.truckId, r.date);
      }
    }
    return map;
  }, [maintenanceRecords]);

  const toggleStatus = (status: Truck["status"], checked: boolean) => {
    setSelectedStatuses((prev) => {
      const next = checked ? Array.from(new Set([...prev, status])) : prev.filter((s) => s !== status);
      return next.length === 0 ? allStatuses : next;
    });
  };

  const isAllSelected = selectedStatuses.length === allStatuses.length;
  const statusLabel = isAllSelected ? "All" : `${selectedStatuses.length} selected`;

  const getNextTruckId = (existing: Truck[]) => {
    const max = existing.reduce((acc, t) => {
      const match = /^TRK-(\d+)$/.exec(t.id);
      if (!match) {
        return acc;
      }
      return Math.max(acc, Number(match[1]));
    }, 0);
    return `TRK-${String(max + 1).padStart(3, "0")}`;
  };

  const loadFleet = useMemo(() => {
    return async () => {
      if (!token) return;
      setLoading(true);
      try {
        const result = await apiFetchJson<{ success: boolean; trucks: Array<any> }>(
          "/api/fleet",
          { headers: { Authorization: `Bearer ${token}` } },
          { label: "GET /api/fleet (Fleet)" },
        );
        if (result.ok === false) {
          if (result.status === 401) {
            await signOut();
          }
          toast.error("Failed to load fleet", { description: result.error });
          setFleetTrucks([]);
          setLoading(false);
          return;
        }

        const mapped: FleetTruck[] = (result.data.trucks ?? []).map((r: any) => {
          const id = String(r.legacy_id || r.legacyId || r.id || "");
          return {
            dbId: String(r.id),
            id,
            plateNumber: String(r.plate_number ?? r.plateNumber ?? ""),
            plateMonth: r.plate_month ?? r.plateMonth ?? undefined,
            plateYear: r.plate_year ?? r.plateYear ?? undefined,
            type: r.type,
            capacity: "—",
            status: r.status,
            assignedDrivers: [],
            mileage: Number(r.mileage ?? 0),
            fuelLevel: Number(r.fuel_level ?? 0),
            lastService: r.last_service ? String(r.last_service) : "",
            nextService: r.next_service ? String(r.next_service) : "",
            lat: Number(r.lat ?? 0),
            lng: Number(r.lng ?? 0),
            location: String(r.location ?? ""),
          } satisfies FleetTruck;
        });

        setFleetTrucks(mapped);
        setLoading(false);
      } catch (e) {
        toast.error("Failed to load fleet", { description: e instanceof Error ? e.message : "Unknown error" });
        setFleetTrucks([]);
        setLoading(false);
      }
    };
  }, [token]);

  useEffect(() => {
    void loadFleet();
  }, [loadFleet]);

  const handleCreate = async (values: CreateTruckValues) => {
    if (!token) return;
    const isDuplicate = fleetTrucks.some((t) => t.plateNumber.trim().toLowerCase() === values.plateNumber.trim().toLowerCase());
    if (isDuplicate) {
      toast.error("Plate number already exists", { description: values.plateNumber });
      return;
    }

    const legacyId = getNextTruckId(fleetTrucks);
    const today = new Date();
    const result = await apiFetchJson<{ success: boolean; truck: any }>(
      "/api/fleet/create",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          legacyId,
          plateNumber: values.plateNumber.trim(),
          plateMonth: values.plateMonth,
          plateYear: values.plateYear,
          type: values.type,
          status: values.status,
          location: values.location.trim(),
          mileage: 0,
          fuelLevel: 100,
          lastService: format(today, "yyyy-MM-dd"),
          nextService: format(addMonths(today, 2), "yyyy-MM-dd"),
          lat: 0,
          lng: 0,
        }),
      },
      { label: "POST /api/fleet/create (Fleet)" },
    );

    if (result.ok === false) {
      if (result.status === 401) {
        await signOut();
      }
      toast.error("Failed to create vehicle", { description: result.error });
      return;
    }

    toast.success("Vehicle created", { description: `${values.plateNumber.trim()} • ${values.type}` });
    setCreateOpen(false);
    await loadFleet();
  };

  const handleUpdate = (values: CreateTruckValues) => {
    if (!editingTruck) {
      return;
    }

    void (async () => {
      if (!token) return;
      const isDuplicate = fleetTrucks.some(
        (t) => t.dbId !== editingTruck.dbId && t.plateNumber.trim().toLowerCase() === values.plateNumber.trim().toLowerCase(),
      );
      if (isDuplicate) {
        toast.error("Plate number already exists", { description: values.plateNumber });
        return;
      }

      const result = await apiFetchJson<{ success: boolean; truck: any }>(
        "/api/fleet/update",
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            id: editingTruck.dbId,
            plateNumber: values.plateNumber.trim(),
            plateMonth: values.plateMonth,
            plateYear: values.plateYear,
            type: values.type,
            status: values.status,
            location: values.location.trim(),
          }),
        },
        { label: "POST /api/fleet/update (Fleet)" },
      );

      if (result.ok === false) {
        if (result.status === 401) {
          await signOut();
        }
        toast.error("Failed to update vehicle", { description: result.error });
        return;
      }

      toast.success("Vehicle updated", { description: `${values.plateNumber.trim()} • ${values.type}` });
      setEditOpen(false);
      setEditingTruck(null);
      await loadFleet();
    })();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Fleet Management</h1>
          <p className="text-sm text-muted-foreground mt-1">{fleetTrucks.length} vehicles registered</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="w-4 h-4" /> Add
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by plate, ID, type..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-card border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" className="justify-between gap-2">
              Status: {statusLabel}
              <ChevronDown className="h-4 w-4 opacity-70" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel>Status</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuCheckboxItem
              checked={isAllSelected}
              onCheckedChange={() => setSelectedStatuses(allStatuses)}
            >
              All
            </DropdownMenuCheckboxItem>
            <DropdownMenuSeparator />
            {allStatuses.map((s) => (
              <DropdownMenuCheckboxItem
                key={s}
                checked={selectedStatuses.includes(s)}
                onCheckedChange={(v) => toggleStatus(s, Boolean(v))}
              >
                {s}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="ml-auto flex items-center gap-2">
          <Button
            type="button"
            size="icon"
            variant="outline"
            onClick={() => setViewMode((prev) => (prev === "table" ? "grid" : "table"))}
            aria-label={viewMode === "table" ? "Switch to grid view" : "Switch to table view"}
          >
            {viewMode === "table" ? <LayoutGrid className="h-4 w-4" /> : <Table2 className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {viewMode === "grid" ? (
        filtered.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-8 text-center text-sm text-muted-foreground">
            {loading ? "Loading…" : "No vehicles yet. Click Add to create your first fleet vehicle."}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((truck) => {
              const assignedDrivers = drivers.filter((d) => truck.assignedDrivers.includes(d.id));
              return (
                <div key={truck.dbId} className="bg-card border border-border rounded-xl p-5 card-hover">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-sm font-bold text-foreground">{truck.plateNumber}</p>
                      <p className="text-xs text-muted-foreground">
                        {truck.id} • {truck.type}
                      </p>
                    </div>
                    <StatusBadge status={truck.status} />
                  </div>
                  <div className="space-y-2.5 mt-4">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Location</span>
                      <span className="text-foreground font-medium">{truck.location}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Mileage</span>
                      <span className="text-foreground font-medium">{truck.mileage.toLocaleString()} km</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Driver</span>
                      <span className="text-foreground font-medium">
                        {assignedDrivers.length > 0 ? assignedDrivers.map((d) => d.name).join(", ") : "—"}
                      </span>
                    </div>
                    <div className="pt-2">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-muted-foreground flex items-center gap-1">
                          <Fuel className="w-3 h-3" /> Fuel
                        </span>
                        <span
                          className={cn(
                            "font-medium",
                            truck.fuelLevel < 30
                              ? "text-destructive"
                              : truck.fuelLevel < 50
                                ? "text-warning"
                                : "text-success",
                          )}
                        >
                          {truck.fuelLevel}%
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            truck.fuelLevel < 30
                              ? "bg-destructive"
                              : truck.fuelLevel < 50
                                ? "bg-warning"
                                : "bg-success",
                          )}
                          style={{ width: `${truck.fuelLevel}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Plate</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Last Service</TableHead>
                <TableHead className="text-right">Mileage</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                    {loading ? "Loading…" : "No vehicles yet. Click Add to create your first fleet vehicle."}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((truck) => {
                  const lastService = lastServiceByTruckId.get(truck.id) ?? truck.lastService;
                  return (
                    <TableRow
                      key={truck.dbId}
                      className="cursor-pointer"
                      onClick={() => {
                        setEditingTruck(truck);
                        setEditOpen(true);
                      }}
                    >
                      <TableCell className="font-mono text-xs text-muted-foreground">{truck.id}</TableCell>
                      <TableCell className="font-medium">{truck.plateNumber}</TableCell>
                      <TableCell>{truck.type}</TableCell>
                      <TableCell>
                        <StatusBadge status={truck.status} />
                      </TableCell>
                      <TableCell className="max-w-[240px] truncate">{truck.location}</TableCell>
                      <TableCell className="whitespace-nowrap">{lastService || "—"}</TableCell>
                      <TableCell className="text-right">{truck.mileage.toLocaleString()} km</TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <CreateTruckDialog open={createOpen} onOpenChange={setCreateOpen} onSubmit={handleCreate} mode="create" />
      <CreateTruckDialog
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open);
          if (!open) {
            setEditingTruck(null);
          }
        }}
        onSubmit={handleUpdate}
        mode="edit"
        initialData={editingTruck ?? undefined}
      />
    </div>
  );
}
