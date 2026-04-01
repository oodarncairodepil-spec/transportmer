import { useEffect, useMemo, useState } from "react";
import { createWorkOrderId } from "@/lib/workOrdersStorage";
import { loadRoutes } from "@/lib/routesStorage";
import type { Driver, Truck, WorkOrder } from "@/data/mockData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import StatusBadge from "@/components/StatusBadge";
import { cn } from "@/lib/utils";
import { Filter, LayoutGrid, Plus, Table2 } from "lucide-react";
import CreateWorkOrderDialog, { type CreateWorkOrderValues } from "@/components/CreateWorkOrderDialog";
import { apiFetchJson } from "@/lib/apiFetch";
import { useAuth } from "@/components/AuthProvider";
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

const columns = [
  { key: "Pending", label: "Pending", color: "border-warning" },
  { key: "In Progress", label: "In Progress", color: "border-primary" },
  { key: "Completed", label: "Completed", color: "border-success" },
  { key: "Cancelled", label: "Cancelled", color: "border-destructive" },
] as const;

type ColumnKey = (typeof columns)[number]["key"];

type ColumnFilters = {
  query: string;
  driverId: string;
  origin: string;
  destination: string;
  dueFrom: string;
  dueTo: string;
};

const priorityColors: Record<string, string> = {
  High: "text-destructive",
  Medium: "text-warning",
  Low: "text-muted-foreground",
};

export default function WorkOrders() {
  const { session, signOut } = useAuth();
  const token = session?.access_token ?? "";

  const [workOrderList, setWorkOrderList] = useState<Array<WorkOrder & { dbId: string }>>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingWorkOrder, setEditingWorkOrder] = useState<(WorkOrder & { dbId: string }) | null>(null);
  const [viewMode, setViewMode] = useState<"kanban" | "table">("kanban");
  const [loading, setLoading] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingWorkOrder, setDeletingWorkOrder] = useState<(WorkOrder & { dbId: string }) | null>(null);

  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const routes = useMemo(() => loadRoutes(), []);
  const getEmptyFilters = (): ColumnFilters => ({
    query: "",
    driverId: "all",
    origin: "",
    destination: "",
    dueFrom: "",
    dueTo: "",
  });

  const [filtersByColumn, setFiltersByColumn] = useState<Record<ColumnKey, ColumnFilters>>(() => {
    const entries = columns.map((c) => [c.key, getEmptyFilters()] as const);
    return Object.fromEntries(entries) as Record<ColumnKey, ColumnFilters>;
  });

  const [filtersOpenByColumn, setFiltersOpenByColumn] = useState<Record<ColumnKey, boolean>>(() => {
    const entries = columns.map((c) => [c.key, false] as const);
    return Object.fromEntries(entries) as Record<ColumnKey, boolean>;
  });

  const driverOptions = drivers
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((d) => ({ id: d.id, name: d.name }));

  const updateFilters = (key: ColumnKey, patch: Partial<ColumnFilters>) => {
    setFiltersByColumn((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        ...patch,
      },
    }));
  };

  const toggleFilters = (key: ColumnKey) => {
    setFiltersOpenByColumn((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const clearFilters = (key: ColumnKey) => {
    updateFilters(key, getEmptyFilters());
  };

  const hasActiveFilters = (f: ColumnFilters) => {
    return (
      f.query.trim().length > 0 ||
      f.driverId !== "all" ||
      f.origin.trim().length > 0 ||
      f.destination.trim().length > 0 ||
      f.dueFrom.trim().length > 0 ||
      f.dueTo.trim().length > 0
    );
  };

  const sortedForTable = useMemo(() => {
    return workOrderList
      .slice()
      .sort((a, b) => {
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return b.dueDate.localeCompare(a.dueDate);
      });
  }, [workOrderList]);

  const loadDependencies = useMemo(() => {
    return async () => {
      if (!token) return;
      try {
        const [driversResult, fleetResult] = await Promise.all([
          apiFetchJson<{ success: boolean; drivers: Array<any> }>(
            "/api/drivers",
            { headers: { Authorization: `Bearer ${token}` } },
            { label: "GET /api/drivers (WorkOrders)" },
          ),
          apiFetchJson<{ success: boolean; trucks: Array<any> }>(
            "/api/fleet",
            { headers: { Authorization: `Bearer ${token}` } },
            { label: "GET /api/fleet (WorkOrders)" },
          ),
        ]);

        if (driversResult.ok === false || fleetResult.ok === false) {
          if (driversResult.ok === false && driversResult.status === 401) {
            await signOut();
          }
          if (fleetResult.ok === false && fleetResult.status === 401) {
            await signOut();
          }
          return;
        }

        const nextDrivers: Driver[] = (driversResult.data.drivers ?? []).map((d: any) => ({
          id: String(d.legacy_id ?? d.legacyId ?? ""),
          name: String(d.name ?? ""),
          licenseType: String(d.license_type ?? ""),
          licenseValidMonth: d.license_valid_month ?? undefined,
          licenseValidYear: d.license_valid_year ?? undefined,
          status: (String(d.status ?? "Active") as any) === "Inactive" ? "Inactive" : "Active",
          phone: String(d.phone ?? ""),
          rating: Number(d.rating ?? 0),
          totalTrips: Number(d.total_trips ?? 0),
          assignedTruck: null,
          avatar: String(d.avatar ?? ""),
        }));

        const nextTrucks: Truck[] = (fleetResult.data.trucks ?? []).map((t: any) => ({
          id: String(t.legacy_id ?? ""),
          plateNumber: String(t.plate_number ?? ""),
          plateMonth: t.plate_month ?? undefined,
          plateYear: t.plate_year ?? undefined,
          type: String(t.type ?? ""),
          capacity: "—",
          status: t.status,
          assignedDrivers: [],
          mileage: Number(t.mileage ?? 0),
          fuelLevel: Number(t.fuel_level ?? 0),
          lastService: String(t.last_service ?? ""),
          nextService: String(t.next_service ?? ""),
          lat: Number(t.lat ?? 0),
          lng: Number(t.lng ?? 0),
          location: String(t.location ?? ""),
        }));

        setDrivers(nextDrivers);
        setTrucks(nextTrucks);
      } catch {
        return;
      }
    };
  }, [token]);

  const loadWorkOrdersFromApi = useMemo(() => {
    return async () => {
      if (!token) return;
      setLoading(true);
      try {
        const result = await apiFetchJson<{ success: boolean; workOrders: Array<any> }>(
          "/api/work-orders",
          { headers: { Authorization: `Bearer ${token}` } },
          { label: "GET /api/work-orders (WorkOrders)" },
        );
        if (result.ok === false) {
          if (result.status === 401) {
            await signOut();
          }
          toast.error("Failed to load work orders", { description: result.error });
          setWorkOrderList([]);
          setLoading(false);
          return;
        }

        setWorkOrderList(result.data.workOrders ?? []);
        setLoading(false);
      } catch (e) {
        toast.error("Failed to load work orders", { description: e instanceof Error ? e.message : "Unknown error" });
        setWorkOrderList([]);
        setLoading(false);
      }
    };
  }, [token]);

  useEffect(() => {
    void loadDependencies();
    void loadWorkOrdersFromApi();
  }, [loadDependencies, loadWorkOrdersFromApi]);

  const createWorkOrder = async (values: CreateWorkOrderValues) => {
    if (!token) return;
    const id = createWorkOrderId(workOrderList);

    const selectedRoute = routes.find((r) => r.id === values.routeId);
    const routeName = selectedRoute?.name || selectedRoute?.origin?.label || "Unknown Route";
    const destinations = selectedRoute?.destination?.label ? [selectedRoute.destination.label] : ["Unknown Destination"];

    const result = await apiFetchJson<{ success: boolean }>(
      "/api/work-orders",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          action: "create",
          legacyId: id,
          title: values.title.trim(),
          driverId: values.driverId,
          truckId: values.truckId,
          routeName,
          destinations,
          notes: values.notes || "",
          priority: values.priority,
          dueDate: values.dueDate,
        }),
      },
      { label: "POST /api/work-orders (create) (WorkOrders)" },
    );

    if (result.ok === false) {
      if (result.status === 401) {
        await signOut();
      }
      toast.error("Failed to create work order", { description: result.error });
      return;
    }

    toast.success("Work order created", { description: id });
    setCreateOpen(false);
    await loadWorkOrdersFromApi();
  };

  const updateWorkOrder = (values: CreateWorkOrderValues & { _newHistory?: WorkOrder["history"] }) => {
    if (!editingWorkOrder) return;
    void (async () => {
      if (!token) return;

      if (values._newHistory && values._newHistory.length > (editingWorkOrder.history?.length ?? 0)) {
        const entry = values._newHistory[values._newHistory.length - 1];
        const result = await apiFetchJson<{ success: boolean }>(
          "/api/work-orders",
          {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              action: "addHistory",
              id: editingWorkOrder.dbId,
              message: entry.message,
              attachmentName: entry.attachment?.name,
              attachmentUrl: entry.attachment?.url,
            }),
          },
          { label: "POST /api/work-orders (addHistory) (WorkOrders)" },
        );
        if (result.ok === false) {
          if (result.status === 401) {
            await signOut();
          }
          toast.error("Failed to add history", { description: result.error });
          return;
        }

        await loadWorkOrdersFromApi();
        setEditingWorkOrder((prev) => {
          if (!prev) return prev;
          const updated = workOrderList.find((w) => w.dbId === prev.dbId);
          return updated ?? prev;
        });
        return;
      }

      const selectedRoute = routes.find((r) => r.id === values.routeId);
      const routeName = selectedRoute?.name || selectedRoute?.origin?.label || "Unknown Route";
      const destinations = selectedRoute?.destination?.label ? [selectedRoute.destination.label] : ["Unknown Destination"];

      const result = await apiFetchJson<{ success: boolean }>(
        "/api/work-orders",
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            action: "update",
            id: editingWorkOrder.dbId,
            title: values.title.trim(),
            driverId: values.driverId,
            truckId: values.truckId,
            routeName,
            destinations,
            notes: values.notes || "",
            priority: values.priority,
            status: values.status || editingWorkOrder.status,
            dueDate: values.dueDate,
          }),
        },
        { label: "POST /api/work-orders (update) (WorkOrders)" },
      );

      if (result.ok === false) {
        if (result.status === 401) {
          await signOut();
        }
        toast.error("Failed to update work order", { description: result.error });
        return;
      }

      toast.success("Work order updated", { description: editingWorkOrder.id });
      setEditingWorkOrder(null);
      await loadWorkOrdersFromApi();
    })();
  };

  const matchesFilters = (colKey: ColumnKey, order: WorkOrder) => {
    const f = filtersByColumn[colKey];
    const q = f.query.trim().toLowerCase();
    const origin = f.origin.trim().toLowerCase();
    const destination = f.destination.trim().toLowerCase();

    if (q) {
      const haystack = `${order.id} ${order.title}`.toLowerCase();
      if (!haystack.includes(q)) {
        return false;
      }
    }

    if (f.driverId !== "all" && order.driverId !== f.driverId) {
      return false;
    }

    if (origin && !order.pickupLocation.toLowerCase().includes(origin)) {
      return false;
    }

    if (destination) {
      const hasDestination = order.destinations.some((d) => d.toLowerCase().includes(destination));
      if (!hasDestination) {
        return false;
      }
    }

    if (f.dueFrom && order.dueDate < f.dueFrom) {
      return false;
    }

    if (f.dueTo && order.dueDate > f.dueTo) {
      return false;
    }

    return true;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Work Orders</h1>
          <p className="text-sm text-muted-foreground mt-1">{workOrderList.length} total orders</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="icon"
            variant="outline"
            onClick={() => setViewMode((prev) => (prev === "kanban" ? "table" : "kanban"))}
            aria-label={viewMode === "kanban" ? "Switch to table view" : "Switch to kanban view"}
          >
            {viewMode === "kanban" ? <Table2 className="h-4 w-4" /> : <LayoutGrid className="h-4 w-4" />}
          </Button>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> Add
          </Button>
        </div>
      </div>

      <CreateWorkOrderDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreate={createWorkOrder}
        drivers={drivers}
        trucks={trucks}
        routes={routes}
      />
      
      {editingWorkOrder && (
        <CreateWorkOrderDialog 
          open={!!editingWorkOrder} 
          onOpenChange={(open) => {
            if (!open) setEditingWorkOrder(null);
          }} 
          onCreate={updateWorkOrder} 
          initialData={editingWorkOrder}
          drivers={drivers}
          trucks={trucks}
          routes={routes}
        />
      )}

      {viewMode === "table" ? (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Route</TableHead>
                <TableHead>Driver</TableHead>
                <TableHead>Truck</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Due Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedForTable.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-10 text-center text-sm text-muted-foreground">
                    {loading ? "Loading…" : "No work orders yet. Click Add to create your first work order."}
                  </TableCell>
                </TableRow>
              ) : (
                sortedForTable.map((order) => {
                  const driver = drivers.find((d) => d.id === order.driverId);
                  const truck = trucks.find((t) => t.id === order.truckId);
                  return (
                    <TableRow
                      key={order.dbId}
                      className="cursor-pointer"
                      onClick={() => setEditingWorkOrder(order)}
                    >
                      <TableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap">{order.id}</TableCell>
                      <TableCell className="font-medium max-w-[280px] truncate">{order.title}</TableCell>
                      <TableCell className="max-w-[260px] truncate">{order.pickupLocation}</TableCell>
                      <TableCell className="max-w-[220px] truncate">{driver?.name ?? "—"}</TableCell>
                      <TableCell className="whitespace-nowrap">{truck?.plateNumber ?? order.truckId}</TableCell>
                      <TableCell className={cn("font-semibold", priorityColors[order.priority])}>{order.priority}</TableCell>
                      <TableCell>
                        <StatusBadge status={order.status} />
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">{order.dueDate || "—"}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeletingWorkOrder(order);
                            setDeleteOpen(true);
                          }}
                        >
                          Delete
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      ) : (
        workOrderList.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-8 text-center text-sm text-muted-foreground">
            {loading ? "Loading…" : "No work orders yet. Click Add to create your first work order."}
          </div>
        ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {columns.map(col => {
          const orders = workOrderList
            .filter((wo) => wo.status === col.key)
            .filter((wo) => matchesFilters(col.key, wo));

          const f = filtersByColumn[col.key];
          const isOpen = filtersOpenByColumn[col.key];
          const isActive = hasActiveFilters(f);
          return (
            <div key={col.key} className="space-y-3">
              <div className={cn("flex items-center justify-between gap-2 pb-2 border-b-2", col.color)}>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-foreground">{col.label}</h3>
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{orders.length}</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn("h-8 w-8", isActive && "text-primary")}
                  aria-label={`Toggle filters for ${col.label}`}
                  aria-expanded={isOpen}
                  onClick={() => toggleFilters(col.key)}
                >
                  <Filter className="h-4 w-4" />
                </Button>
              </div>
              {isOpen ? (
              <div className="bg-card border border-border rounded-xl p-3 space-y-2">
                <Input
                  value={f.query}
                  onChange={(e) => updateFilters(col.key, { query: e.target.value })}
                  placeholder="Search ID or title"
                  className="h-9 text-xs"
                />
                <div className="grid grid-cols-1 gap-2">
                  <Select value={f.driverId} onValueChange={(v) => updateFilters(col.key, { driverId: v })}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Driver" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All drivers</SelectItem>
                      {driverOptions.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Input
                    value={f.origin}
                    onChange={(e) => updateFilters(col.key, { origin: e.target.value })}
                    placeholder="Origin warehouse"
                    className="h-9 text-xs"
                  />
                  <Input
                    value={f.destination}
                    onChange={(e) => updateFilters(col.key, { destination: e.target.value })}
                    placeholder="Destination warehouse"
                    className="h-9 text-xs"
                  />

                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      type="date"
                      value={f.dueFrom}
                      onChange={(e) => updateFilters(col.key, { dueFrom: e.target.value })}
                      className="h-9 text-xs"
                    />
                    <Input
                      type="date"
                      value={f.dueTo}
                      onChange={(e) => updateFilters(col.key, { dueTo: e.target.value })}
                      className="h-9 text-xs"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-end">
                  <Button variant="outline" size="sm" onClick={() => clearFilters(col.key)}>
                    Clear
                  </Button>
                </div>
              </div>
              ) : null}
              <div className="space-y-3 max-h-[calc(100vh-260px)] overflow-y-auto pr-1">
                {orders.map(order => {
                  const driver = drivers.find(d => d.id === order.driverId);
                  const truck = trucks.find(t => t.id === order.truckId);
                  return (
                    <div 
                      key={order.id} 
                      className="bg-card border border-border rounded-xl p-4 card-hover cursor-pointer"
                      onClick={() => setEditingWorkOrder(order)}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <span className="text-[10px] text-muted-foreground font-mono">{order.id}</span>
                        <span className={cn("text-[10px] font-semibold", priorityColors[order.priority])}>
                          {order.priority}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-foreground mb-2 leading-snug">{order.title}</p>
                      <div className="space-y-1.5 text-xs text-muted-foreground">
                        <p>🛣️ {order.pickupLocation}</p>
                        <p>🚚 {truck?.plateNumber || order.truckId}</p>
                      </div>
                      <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/50">
                        <div className="flex items-center gap-1.5">
                          <div className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[8px] font-bold">
                            {driver?.avatar}
                          </div>
                          <span className="text-[10px] text-muted-foreground">{driver?.name}</span>
                        </div>
                        <span className="text-[10px] text-muted-foreground">Due {order.dueDate}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
          })}
        </div>
        )
      )}

      <AlertDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          setDeleteOpen(open);
          if (!open) {
            setDeletingWorkOrder(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete work order</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {deletingWorkOrder?.id ?? "this work order"}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!deletingWorkOrder || !token) return;
                const result = await apiFetchJson<{ success: boolean }>(
                  "/api/work-orders",
                  {
                    method: "POST",
                    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                    body: JSON.stringify({ action: "delete", id: deletingWorkOrder.dbId }),
                  },
                  { label: "POST /api/work-orders (delete) (WorkOrders)" },
                );
                if (result.ok === false) {
                  if (result.status === 401) {
                    await signOut();
                  }
                  toast.error("Failed to delete work order", { description: result.error });
                  return;
                }
                toast.success("Work order deleted", { description: deletingWorkOrder.id });
                setDeleteOpen(false);
                setDeletingWorkOrder(null);
                await loadWorkOrdersFromApi();
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
