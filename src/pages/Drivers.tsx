import { useEffect, useMemo, useState } from "react";
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
import { loadFleetTrucks } from "@/lib/fleetStorage";
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

export default function Drivers() {
  const { session, signOut } = useAuth();
  const token = session?.access_token ?? "";

  const [driverList, setDriverList] = useState<Array<Driver & { dbId: string }>>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<(Driver & { dbId: string }) | null>(null);
  const [search, setSearch] = useState("");
  const allStatuses = ["Active", "Inactive"] as const;
  const [selectedStatuses, setSelectedStatuses] = useState<(typeof allStatuses)[number][]>([...allStatuses]);
  const [viewMode, setViewMode] = useState<"grid" | "table">("table");
  const trucks = useMemo(() => loadFleetTrucks(), []);
  const [loading, setLoading] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingDriver, setDeletingDriver] = useState<(Driver & { dbId: string }) | null>(null);

  const filtered = useMemo(() => {
    return driverList.filter((d) => {
      const matchSearch =
        d.name.toLowerCase().includes(search.toLowerCase()) || d.id.toLowerCase().includes(search.toLowerCase());
      const matchStatus = selectedStatuses.length === 0 || selectedStatuses.includes(d.status);
      return matchSearch && matchStatus;
    });
  }, [driverList, search, selectedStatuses]);

  const loadDriversFromApi = useMemo(() => {
    return async () => {
      if (!token) return;
      setLoading(true);
      try {
        const result = await apiFetchJson<{ success: boolean; drivers: Array<any> }>(
          "/api/drivers",
          { headers: { Authorization: `Bearer ${token}` } },
          { label: "GET /api/drivers (Drivers)" },
        );
        if (result.ok === false) {
          if (result.status === 401) {
            await signOut();
          }
          toast.error("Failed to load drivers", { description: result.error });
          setDriverList([]);
          setLoading(false);
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
            dbId: String(r.id),
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
          } satisfies Driver & { dbId: string };
        });

        setDriverList(mapped);
        setLoading(false);
      } catch (e) {
        toast.error("Failed to load drivers", { description: e instanceof Error ? e.message : "Unknown error" });
        setDriverList([]);
        setLoading(false);
      }
    };
  }, [token]);

  useEffect(() => {
    void loadDriversFromApi();
  }, [loadDriversFromApi]);

  const getNextDriverLegacyId = (existing: Array<Driver & { dbId: string }>) => {
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
  };

  const createDriver = async (values: CreateDriverValues) => {
    if (!token) return;
    const legacyId = getNextDriverLegacyId(driverList);
    const avatar = values.name
      .trim()
      .split(/\s+/g)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("")
      .slice(0, 2);
    const name = values.name.trim();

    const result = await apiFetchJson<{ success: boolean; driver: any }>(
      "/api/drivers/create",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          legacyId,
          name,
          licenseType: values.licenseType.trim(),
          licenseValidMonth: values.licenseValidMonth,
          licenseValidYear: values.licenseValidYear,
          status: values.status,
          phone: values.phone.trim(),
          rating: 4.5,
          totalTrips: 0,
          avatar: avatar || "DR",
        }),
      },
      { label: "POST /api/drivers/create (Drivers)" },
    );

    if (result.ok === false) {
      if (result.status === 401) {
        await signOut();
      }
      toast.error("Failed to create driver", { description: result.error });
      return;
    }

    toast.success("Driver created", { description: name });
    setCreateOpen(false);
    await loadDriversFromApi();
  };

  const updateDriver = (values: CreateDriverValues) => {
    if (!editingDriver) return;
    void (async () => {
      if (!token) return;
      const avatar = values.name
        .trim()
        .split(/\s+/g)
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p[0]?.toUpperCase())
        .join("")
        .slice(0, 2);
      const name = values.name.trim();

      const result = await apiFetchJson<{ success: boolean; driver: any }>(
        "/api/drivers/update",
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            id: editingDriver.dbId,
            name,
            licenseType: values.licenseType.trim(),
            licenseValidMonth: values.licenseValidMonth,
            licenseValidYear: values.licenseValidYear,
            status: values.status,
            phone: values.phone.trim(),
            avatar: avatar || editingDriver.avatar,
          }),
        },
        { label: "POST /api/drivers/update (Drivers)" },
      );

      if (result.ok === false) {
        if (result.status === 401) {
          await signOut();
        }
        toast.error("Failed to update driver", { description: result.error });
        return;
      }

      toast.success("Driver updated", { description: name });
      setEditOpen(false);
      setEditingDriver(null);
      await loadDriversFromApi();
    })();
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
        filtered.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-8 text-center text-sm text-muted-foreground">
            {loading ? "Loading…" : "No drivers yet. Click Add to create your first driver."}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((driver) => {
              const truck = trucks.find((t) => t.id === driver.assignedTruck);
              return (
                <div
                  key={driver.dbId}
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
        )
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
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-10 text-center text-sm text-muted-foreground">
                    {loading ? "Loading…" : "No drivers yet. Click Add to create your first driver."}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((driver) => {
                  const truck = trucks.find((t) => t.id === driver.assignedTruck);
                  return (
                    <TableRow
                      key={driver.dbId}
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
                      <TableCell className="text-right">
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeletingDriver(driver);
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
      )}

      <AlertDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          setDeleteOpen(open);
          if (!open) {
            setDeletingDriver(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete driver</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {deletingDriver?.name ?? "this driver"}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!deletingDriver || !token) return;
                const result = await apiFetchJson<{ success: boolean }>(
                  "/api/drivers/delete",
                  {
                    method: "POST",
                    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                    body: JSON.stringify({ id: deletingDriver.dbId }),
                  },
                  { label: "POST /api/drivers/delete (Drivers)" },
                );
                if (result.ok === false) {
                  if (result.status === 401) {
                    await signOut();
                  }
                  toast.error("Failed to delete driver", { description: result.error });
                  return;
                }
                toast.success("Driver deleted", { description: deletingDriver.name });
                setDeleteOpen(false);
                setDeletingDriver(null);
                await loadDriversFromApi();
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
