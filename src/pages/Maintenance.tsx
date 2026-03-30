import { maintenanceRecords, trucks } from "@/data/mockData";
import StatusBadge from "@/components/StatusBadge";
import { Wrench, AlertTriangle, CheckCircle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Maintenance() {
  const overdue = maintenanceRecords.filter(m => m.status === 'Overdue');
  const scheduled = maintenanceRecords.filter(m => m.status === 'Scheduled');
  const completed = maintenanceRecords.filter(m => m.status === 'Completed');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Fleet Maintenance</h1>
        <p className="text-sm text-muted-foreground mt-1">Track service schedules and inspection logs</p>
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
        <div className="divide-y divide-border/50">
          {maintenanceRecords.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map(record => {
            const truck = trucks.find(t => t.id === record.truckId);
            return (
              <div key={record.id} className="flex items-center gap-4 px-5 py-4 hover:bg-muted/20 transition-colors">
                <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
                  record.status === 'Overdue' ? 'bg-destructive/10' :
                  record.status === 'Scheduled' ? 'bg-warning/10' : 'bg-success/10'
                )}>
                  <Wrench className={cn("w-4 h-4",
                    record.status === 'Overdue' ? 'text-destructive' :
                    record.status === 'Scheduled' ? 'text-warning' : 'text-success'
                  )} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{record.type}</p>
                  <p className="text-xs text-muted-foreground">{truck?.plateNumber} ({truck?.id}) • {record.notes}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm text-foreground">{new Date(record.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                  <p className="text-xs text-muted-foreground">Rp {record.cost.toLocaleString()}</p>
                </div>
                <StatusBadge status={record.status} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
