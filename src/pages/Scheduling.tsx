import { scheduleEvents, drivers } from "@/data/mockData";
import { cn } from "@/lib/utils";

const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const displayDrivers = drivers.slice(0, 10);

export default function Scheduling() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Driver Scheduling</h1>
        <p className="text-sm text-muted-foreground mt-1">Weekly schedule — March 30 - April 3, 2026</p>
      </div>

      <div className="flex items-center gap-4 text-xs">
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-primary/20 border border-primary/40" /> Shift</div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-warning/20 border border-warning/40" /> Leave</div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-muted border border-border" /> Off</div>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden overflow-x-auto">
        <table className="w-full min-w-[700px]">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 w-44">Driver</th>
              {days.map(d => (
                <th key={d} className="text-center text-xs font-medium text-muted-foreground px-4 py-3">{d}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {displayDrivers.map(driver => (
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
                {days.map(day => {
                  const event = scheduleEvents.find(e => e.driverId === driver.id && e.day === day);
                  return (
                    <td key={day} className="px-2 py-2 text-center">
                      {event ? (
                        <div className={cn(
                          "rounded-lg px-2 py-1.5 text-[10px] font-medium",
                          event.type === 'leave' ? 'bg-warning/10 text-warning border border-warning/20' :
                          'bg-primary/10 text-primary border border-primary/20'
                        )}>
                          <p>{event.title}</p>
                          {event.start && <p className="text-[9px] opacity-70">{event.start}-{event.end}</p>}
                        </div>
                      ) : (
                        <div className="rounded-lg px-2 py-1.5 text-[10px] text-muted-foreground bg-muted/30">
                          —
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
