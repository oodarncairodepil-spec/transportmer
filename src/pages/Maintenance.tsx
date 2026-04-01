import { useEffect, useMemo, useState } from "react";
import type { MaintenanceRecord } from "@/data/mockData";
import CreateMaintenanceDialog, { type CreateMaintenanceValues } from "@/components/CreateMaintenanceDialog";
import StatusBadge from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/components/ui/sonner";
import { useAuth } from "@/components/AuthProvider";
import { apiFetchJson } from "@/lib/apiFetch";
import { AlertTriangle, CheckCircle, Clock, Plus } from "lucide-react";

type MaintenanceRow = {
  id: string;
  truck_id: string | null;
  type: MaintenanceRecord["type"];
  status: MaintenanceRecord["status"];
  date: string;
  notes: string;
  cost: number;
  created_at?: string;
  updated_at?: string;
};

type TruckOption = {
  id: string;
  plateNumber: string;
  code?: string;
};

export default function Maintenance() {
  const { session, signOut } = useAuth();
  const token = session?.access_token ?? "";
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<MaintenanceRecord | null>(null);
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [trucks, setTrucks] = useState<TruckOption[]>([]);

  useEffect(() => {
    if (!token) {
      setRecords([]);
      setTrucks([]);
      return;
    }
    setLoading(true);
    Promise.all([
      apiFetchJson<{ success: boolean; trucks: Array<any> }>(
        "/api/fleet",
        { headers: { Authorization: `Bearer ${token}` } },
        { label: "GET /api/fleet (Maintenance)" },
      ),
      apiFetchJson<{ success: boolean; records: Array<MaintenanceRow> }>(
        "/api/maintenance",
        { headers: { Authorization: `Bearer ${token}` } },
        { label: "GET /api/maintenance" },
      ),
    ])
      .then(async ([fleetRes, maintRes]) => {
        if (fleetRes.ok === false) {
          if (fleetRes.status === 401) {
            await signOut();
          }
          toast.error("Failed to load fleet", { description: fleetRes.error });
          setTrucks([]);
        } else {
          const mappedTrucks: TruckOption[] = (fleetRes.data.trucks ?? []).map((r: any) => ({
            id: String(r.id),
            plateNumber: String(r.plate_number ?? r.plateNumber ?? ""),
            code: String(r.legacy_id ?? r.legacyId ?? ""),
          }));
          setTrucks(mappedTrucks);
        }

        if (maintRes.ok === false) {
          if (maintRes.status === 401) {
            await signOut();
          }
          toast.error("Failed to load maintenance records", { description: maintRes.error });
          setRecords([]);
        } else {
          const mappedRecords: MaintenanceRecord[] = (maintRes.data.records ?? []).map((r: any) => ({
            id: String(r.id),
            truckId: String(r.truck_id ?? ""),
            type: r.type,
            status: r.status,
            date: String(r.date),
            notes: String(r.notes ?? ""),
            cost: Number(r.cost ?? 0),
          }));
          setRecords(mappedRecords);
        }
        setLoading(false);
      })
      .catch((e) => {
        toast.error("Failed to load maintenance records", { description: e instanceof Error ? e.message : "Unknown error" });
        setRecords([]);
        setTrucks([]);
        setLoading(false);
      });
  }, [token]);

  const overdue = useMemo(() => records.filter((m) => m.status === "Overdue"), [records]);
  const scheduled = useMemo(() => records.filter((m) => m.status === "Scheduled"), [records]);
  const completed = useMemo(() => records.filter((m) => m.status === "Completed"), [records]);

  const sorted = useMemo(() => {
    return records
      .slice()
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [records]);

  const handleCreate = async (values: CreateMaintenanceValues) => {
    if (!token) return;
    const result = await apiFetchJson<{ success: boolean; record: MaintenanceRow }>(
      "/api/maintenance",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          action: "create",
          truckId: values.truckId,
          type: values.type,
          status: values.status,
          date: values.date,
          notes: values.notes.trim(),
          cost: values.cost,
        }),
      },
      { label: "POST /api/maintenance create" },
    );
    if (result.ok === false) {
      if (result.status === 401) {
        await signOut();
      }
      toast.error("Failed to add maintenance record", { description: result.error });
      return;
    }

    const r = result.data.record as any;
    const next: MaintenanceRecord = {
      id: String(r.id),
      truckId: String(r.truck_id ?? ""),
      type: r.type,
      status: r.status,
      date: String(r.date),
      notes: String(r.notes ?? ""),
      cost: Number(r.cost ?? 0),
    };
    setRecords((prev) => [next, ...prev]);
    toast.success("Maintenance record added");
    setCreateOpen(false);
  };

  const handleUpdate = async (values: CreateMaintenanceValues) => {
    if (!editingRecord) {
      return;
    }
    if (!token) return;

    const result = await apiFetchJson<{ success: boolean; record: MaintenanceRow }>(
      "/api/maintenance",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          action: "update",
          id: editingRecord.id,
          truckId: values.truckId,
          type: values.type,
          status: values.status,
          date: values.date,
          notes: values.notes.trim(),
          cost: values.cost,
        }),
      },
      { label: "POST /api/maintenance update" },
    );
    if (result.ok === false) {
      if (result.status === 401) {
        await signOut();
      }
      toast.error("Failed to update maintenance record", { description: result.error });
      return;
    }

    const r = result.data.record as any;
    const next: MaintenanceRecord = {
      id: String(r.id),
      truckId: String(r.truck_id ?? ""),
      type: r.type,
      status: r.status,
      date: String(r.date),
      notes: String(r.notes ?? ""),
      cost: Number(r.cost ?? 0),
    };
    setRecords((prev) => prev.map((x) => (x.id === next.id ? next : x)));
    toast.success("Maintenance record updated");
    setEditOpen(false);
    setEditingRecord(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Fleet Maintenance</h1>
          <p className="text-sm text-muted-foreground mt-1">Track service schedules and inspection logs</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="w-4 h-4" /> Add
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-destructive/10"><AlertTriangle className="w-5 h-5 text-destructive" /></div>
          <div>
            <p className="text-2xl font-bold text-foreground">{overdue.length}</p>
            <p className="text-xs text-muted-foreground">Overdue</p>
          </div>
        </div>
        <div className="bg-warning/5 border border-warning/20 rounded-xl p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-warning/10"><Clock className="w-5 h-5 text-warning" /></div>
          <div>
            <p className="text-2xl font-bold text-foreground">{scheduled.length}</p>
            <p className="text-xs text-muted-foreground">Scheduled</p>
          </div>
        </div>
        <div className="bg-success/5 border border-success/20 rounded-xl p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-success/10"><CheckCircle className="w-5 h-5 text-success" /></div>
          <div>
            <p className="text-2xl font-bold text-foreground">{completed.length}</p>
            <p className="text-xs text-muted-foreground">Completed</p>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">Maintenance Timeline</h2>
        </div>
        {sorted.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            {loading ? "Loading…" : "No maintenance records yet. Click Add to create your first record."}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Vehicle</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Cost</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((record) => {
                const truck = trucks.find((t) => t.id === record.truckId);
                return (
                  <TableRow
                    key={record.id}
                    className="cursor-pointer"
                    onClick={() => {
                      setEditingRecord(record);
                      setEditOpen(true);
                    }}
                  >
                    <TableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap">{record.id}</TableCell>
                    <TableCell className="whitespace-nowrap">{record.date}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {truck ? `${truck.plateNumber} (${truck.code ?? truck.id})` : record.truckId}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{record.type}</TableCell>
                    <TableCell>
                      <StatusBadge status={record.status} />
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">Rp {record.cost.toLocaleString()}</TableCell>
                    <TableCell className="max-w-[520px] truncate">{record.notes}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <CreateMaintenanceDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        trucks={trucks}
        onSubmit={handleCreate}
        mode="create"
      />

      <CreateMaintenanceDialog
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open);
          if (!open) {
            setEditingRecord(null);
          }
        }}
        trucks={trucks}
        onSubmit={handleUpdate}
        mode="edit"
        initialData={editingRecord ?? undefined}
      />
    </div>
  );
}
