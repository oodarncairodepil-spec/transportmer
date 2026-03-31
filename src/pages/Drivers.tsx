import { useMemo, useState } from "react";
import type { Driver } from "@/data/mockData";
import StatusBadge from "@/components/StatusBadge";
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
import { ChevronDown, LayoutGrid, Phone, Plus, Search, Table2 } from "lucide-react";
import { cn } from "@/lib/utils";
import CreateDriverDialog, { type CreateDriverValues } from "@/components/CreateDriverDialog";
import { createDriverId, loadDrivers, saveDrivers } from "@/lib/driversStorage";
import { loadFleetTrucks } from "@/lib/fleetStorage";

export default function Drivers() {
  const [driverList, setDriverList] = useState<Driver[]>(() => loadDrivers());
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [search, setSearch] = useState("");
  const allStatuses = ["Active", "Inactive"] as const;
  const [selectedStatuses, setSelectedStatuses] = useState<(typeof allStatuses)[number][]>([...allStatuses]);
  const [viewMode, setViewMode] = useState<"grid" | "table">("table");
  const trucks = useMemo(() => loadFleetTrucks(), []);

  const filtered = useMemo(() => {
    return driverList.filter((d) => {
      const matchSearch =
        d.name.toLowerCase().includes(search.toLowerCase()) || d.id.toLowerCase().includes(search.toLowerCase());
      const matchStatus = selectedStatuses.length === 0 || selectedStatuses.includes(d.status);
      return matchSearch && matchStatus;
    });
  }, [driverList, search, selectedStatuses]);

  const createDriver = (values: CreateDriverValues) => {
    const id = createDriverId(driverList);
    const avatar = values.name
      .trim()
      .split(/\s+/g)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("")
      .slice(0, 2);

    const next: Driver = {
      id,
      name: values.name.trim(),
      licenseType: values.licenseType.trim(),
      licenseValidMonth: values.licenseValidMonth,
      licenseValidYear: values.licenseValidYear,
      status: values.status,
      phone: values.phone.trim(),
      rating: 4.5,
      totalTrips: 0,
      assignedTruck: null,
      avatar: avatar || "DR",
    };

    setDriverList((prev) => {
      const updated = [next, ...prev];
      saveDrivers(updated);
      return updated;
    });
    setCreateOpen(false);
  };

  const updateDriver = (values: CreateDriverValues) => {
    if (!editingDriver) {
      return;
    }
    let nextState: Driver[] | null = null;
    let isDuplicate = false;

    setDriverList((prev) => {
      isDuplicate = prev.some(
        (d) => d.id !== editingDriver.id && d.phone.trim() === values.phone.trim() && values.phone.trim().length > 0,
      );
      if (isDuplicate) {
        return prev;
      }

      nextState = prev.map((d) => {
        if (d.id !== editingDriver.id) {
          return d;
        }
        const avatar = values.name
          .trim()
          .split(/\s+/g)
          .filter(Boolean)
          .slice(0, 2)
          .map((p) => p[0]?.toUpperCase())
          .join("")
          .slice(0, 2);

        return {
          ...d,
          name: values.name.trim(),
          licenseType: values.licenseType.trim(),
          licenseValidMonth: values.licenseValidMonth,
          licenseValidYear: values.licenseValidYear,
          status: values.status,
          phone: values.phone.trim(),
          avatar: avatar || d.avatar,
        };
      });

      return nextState;
    });

    if (isDuplicate) {
      return;
    }

    if (nextState) {
      saveDrivers(nextState);
      setEditOpen(false);
      setEditingDriver(null);
    }
  };

  const toggleStatus = (status: (typeof allStatuses)[number], checked: boolean) => {
    setSelectedStatuses((prev) => {
      const next = checked ? Array.from(new Set([...prev, status])) : prev.filter((s) => s !== status);
      return next.length === 0 ? [...allStatuses] : next;
    });
  };

  const isAllSelected = selectedStatuses.length === allStatuses.length;
  const statusLabel = isAllSelected ? "All" : `${selectedStatuses.length} selected`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Driver Management</h1>
          <p className="text-sm text-muted-foreground mt-1">{driverList.length} drivers registered</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="w-4 h-4" /> Add
        </Button>
      </div>

      <CreateDriverDialog open={createOpen} onOpenChange={setCreateOpen} onSubmit={createDriver} mode="create" />
      <CreateDriverDialog
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open);
          if (!open) {
            setEditingDriver(null);
          }
        }}
        onSubmit={updateDriver}
        mode="edit"
        initialData={editingDriver ?? undefined}
      />

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search drivers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
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
            <DropdownMenuCheckboxItem checked={isAllSelected} onCheckedChange={() => setSelectedStatuses([...allStatuses])}>
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
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((driver) => {
            const truck = trucks.find((t) => t.id === driver.assignedTruck);
            return (
              <div
                key={driver.id}
                className="bg-card border border-border rounded-xl p-5 card-hover cursor-pointer"
                onClick={() => {
                  setEditingDriver(driver);
                  setEditOpen(true);
                }}
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold shrink-0">
                    {driver.avatar}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-bold text-foreground">{driver.name}</p>
                      <StatusBadge status={driver.status} />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {driver.id} • {driver.licenseType}
                      {driver.licenseValidMonth && driver.licenseValidYear
                        ? ` • ${driver.licenseValidMonth}/${driver.licenseValidYear}`
                        : ""}
                    </p>
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Phone className="w-3 h-3" /> Phone
                    </span>
                    <span className="text-foreground">{driver.phone}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Total Trips</span>
                    <span className="text-foreground font-medium">{driver.totalTrips}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Assigned Truck</span>
                    <span className="text-foreground font-medium">{truck ? truck.plateNumber : "—"}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Driver</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>License</TableHead>
                <TableHead>License Valid</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead className="text-right">Trips</TableHead>
                <TableHead>Assigned Truck</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((driver) => {
                const truck = trucks.find((t) => t.id === driver.assignedTruck);
                return (
                  <TableRow
                    key={driver.id}
                    className="cursor-pointer"
                    onClick={() => {
                      setEditingDriver(driver);
                      setEditOpen(true);
                    }}
                  >
                    <TableCell className="font-mono text-xs text-muted-foreground">{driver.id}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                          {driver.avatar}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-foreground truncate">{driver.name}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{driver.status}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={driver.status} />
                    </TableCell>
                    <TableCell>{driver.licenseType}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {driver.licenseValidMonth && driver.licenseValidYear
                        ? `${driver.licenseValidMonth}/${driver.licenseValidYear}`
                        : "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{driver.phone}</TableCell>
                    <TableCell className="text-right">{driver.totalTrips}</TableCell>
                    <TableCell className="max-w-[240px] truncate">{truck ? truck.plateNumber : "—"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
