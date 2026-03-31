import { useMemo, useState } from "react";
import { loadWorkOrders, saveWorkOrders, createWorkOrderId } from "@/lib/workOrdersStorage";
import { loadRoutes } from "@/lib/routesStorage";
import { loadFleetTrucks } from "@/lib/fleetStorage";
import type { WorkOrder } from "@/data/mockData";
import { loadDrivers } from "@/lib/driversStorage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import StatusBadge from "@/components/StatusBadge";
import { cn } from "@/lib/utils";
import { Filter, LayoutGrid, Plus, Table2 } from "lucide-react";
import CreateWorkOrderDialog, { type CreateWorkOrderValues } from "@/components/CreateWorkOrderDialog";

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
  const [workOrderList, setWorkOrderList] = useState<WorkOrder[]>(() => loadWorkOrders());
  const [createOpen, setCreateOpen] = useState(false);
  const [editingWorkOrder, setEditingWorkOrder] = useState<WorkOrder | null>(null);
  const [viewMode, setViewMode] = useState<"kanban" | "table">("kanban");

  const drivers = useMemo(() => loadDrivers(), []);
  const trucks = useMemo(() => loadFleetTrucks(), []);
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

  const createWorkOrder = (values: CreateWorkOrderValues) => {
    const id = createWorkOrderId(workOrderList);
    
    // We need to resolve the selected route to get pickup and destinations
    const routes = loadRoutes();
    const selectedRoute = routes.find(r => r.id === values.routeId);
    
    // Use the route name if available, otherwise fallback to the origin label
    const routeName = selectedRoute?.name || selectedRoute?.origin?.label || "Unknown Route";
    const destinations = selectedRoute?.destination?.label 
      ? [selectedRoute.destination.label] 
      : ["Unknown Destination"];

    const next: WorkOrder = {
      id,
      title: values.title.trim(),
      driverId: values.driverId,
      truckId: values.truckId,
      pickupLocation: routeName, // We store the route name here now to display it
      destinations,
      cargoType: values.notes || "No notes", // Use notes as cargoType for backward compatibility
      priority: values.priority,
      status: "Pending", // Default to Pending since we removed the selection
      dueDate: values.dueDate,
      createdAt: new Date().toISOString().split("T")[0],
    };

    setWorkOrderList((prev) => {
      const updated = [next, ...prev];
      saveWorkOrders(updated);
      return updated;
    });
    setCreateOpen(false);
  };

  const updateWorkOrder = (values: CreateWorkOrderValues & { _newHistory?: WorkOrder["history"] }) => {
    if (!editingWorkOrder) return;

    const routes = loadRoutes();
    const selectedRoute = routes.find(r => r.id === values.routeId);
    
    const routeName = selectedRoute?.name || selectedRoute?.origin?.label || "Unknown Route";
    const destinations = selectedRoute?.destination?.label 
      ? [selectedRoute.destination.label] 
      : ["Unknown Destination"];

    setWorkOrderList((prev) => {
      const updated = prev.map(wo => {
        if (wo.id === editingWorkOrder.id) {
          return {
            ...wo,
            title: values.title.trim(),
            driverId: values.driverId,
            truckId: values.truckId,
            pickupLocation: routeName,
            destinations,
            cargoType: values.notes || "No notes",
            priority: values.priority,
            status: values.status || wo.status,
            dueDate: values.dueDate,
            history: values._newHistory || wo.history,
          };
        }
        return wo;
      });
      saveWorkOrders(updated);
      
      // Update local state so it reflects immediately without closing the dialog
      if (values._newHistory) {
        setEditingWorkOrder(updated.find(w => w.id === editingWorkOrder.id) || null);
      } else {
        setEditingWorkOrder(null);
      }
      return updated;
    });
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

      <CreateWorkOrderDialog open={createOpen} onOpenChange={setCreateOpen} onCreate={createWorkOrder} />
      
      {editingWorkOrder && (
        <CreateWorkOrderDialog 
          open={!!editingWorkOrder} 
          onOpenChange={(open) => {
            if (!open) setEditingWorkOrder(null);
          }} 
          onCreate={updateWorkOrder} 
          initialData={editingWorkOrder}
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedForTable.map((order) => {
                const driver = drivers.find((d) => d.id === order.driverId);
                const truck = trucks.find((t) => t.id === order.truckId);
                return (
                  <TableRow
                    key={order.id}
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
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
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
      )}
    </div>
  );
}
