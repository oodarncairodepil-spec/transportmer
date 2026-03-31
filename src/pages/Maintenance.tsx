import { useMemo, useState } from "react";
import type { MaintenanceRecord } from "@/data/mockData";
import CreateMaintenanceDialog, { type CreateMaintenanceValues } from "@/components/CreateMaintenanceDialog";
import StatusBadge from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/components/ui/sonner";
import { createMaintenanceRecord, loadMaintenanceRecords, saveMaintenanceRecords } from "@/lib/maintenanceStorage";
import { loadFleetTrucks } from "@/lib/fleetStorage";
import { AlertTriangle, CheckCircle, Clock, Plus } from "lucide-react";

export default function Maintenance() {
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<MaintenanceRecord | null>(null);
  const [records, setRecords] = useState<MaintenanceRecord[]>(() => loadMaintenanceRecords());
  const trucks = useMemo(() => loadFleetTrucks(), []);

  const overdue = useMemo(() => records.filter((m) => m.status === "Overdue"), [records]);
  const scheduled = useMemo(() => records.filter((m) => m.status === "Scheduled"), [records]);
  const completed = useMemo(() => records.filter((m) => m.status === "Completed"), [records]);

  const sorted = useMemo(() => {
    return records
      .slice()
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [records]);

  const handleCreate = (values: CreateMaintenanceValues) => {
    const next = createMaintenanceRecord({
      truckId: values.truckId,
      type: values.type,
      status: values.status,
      date: values.date,
      notes: values.notes.trim(),
      cost: values.cost,
    });

    setRecords((prev) => {
      const updated = [next, ...prev];
      saveMaintenanceRecords(updated);
      return updated;
    });

    toast.success("Maintenance record added");
    setCreateOpen(false);
  };

  const handleUpdate = (values: CreateMaintenanceValues) => {
    if (!editingRecord) {
      return;
    }

    setRecords((prev) => {
      const updated = prev.map((r) => {
        if (r.id !== editingRecord.id) {
          return r;
        }
        return {
          ...r,
          truckId: values.truckId,
          type: values.type,
          status: values.status,
          date: values.date,
          notes: values.notes.trim(),
          cost: values.cost,
        };
      });
      saveMaintenanceRecords(updated);
      return updated;
    });

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
                    {truck ? `${truck.plateNumber} (${truck.id})` : record.truckId}
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
