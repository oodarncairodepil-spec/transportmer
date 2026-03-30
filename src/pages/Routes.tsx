import { useState } from "react";
import { routes, drivers, trucks } from "@/data/mockData";
import StatusBadge from "@/components/StatusBadge";
import { Search, MapPin, ArrowRight, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Routes() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [selectedRoute, setSelectedRoute] = useState<string | null>(null);

  const filtered = routes.filter(r => {
    const matchSearch = r.id.toLowerCase().includes(search.toLowerCase()) ||
      r.origin.toLowerCase().includes(search.toLowerCase()) ||
      r.destination.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "All" || r.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const selected = routes.find(r => r.id === selectedRoute);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Route Tracking</h1>
        <p className="text-sm text-muted-foreground mt-1">{routes.length} routes logged</p>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input type="text" placeholder="Search routes..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-card border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20" />
        </div>
        {['All', 'In Progress', 'Completed', 'Delayed', 'Planned'].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={cn("px-3 py-2 rounded-lg text-xs font-medium transition-colors", statusFilter === s ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground hover:bg-muted")}>
            {s}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Route List */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Route</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Journey</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Truck</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Distance</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filtered.map(route => {
                  const truck = trucks.find(t => t.id === route.truckId);
                  return (
                    <tr key={route.id} onClick={() => setSelectedRoute(route.id)}
                      className={cn("hover:bg-muted/20 transition-colors cursor-pointer", selectedRoute === route.id && "bg-primary/5")}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground">{route.id}</span>
                          {route.deviation && <AlertTriangle className="w-3.5 h-3.5 text-destructive" />}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          {route.origin} <ArrowRight className="w-3 h-3" /> {route.destination}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{truck?.plateNumber}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {route.actualDistance > 0 ? `${route.actualDistance}/${route.plannedDistance} km` : `${route.plannedDistance} km`}
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={route.status} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Route Detail / Timeline */}
        <div className="bg-card border border-border rounded-xl p-5">
          {selected ? (
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-1">{selected.id} — Route Timeline</h3>
              <p className="text-xs text-muted-foreground mb-4">{selected.origin} → {selected.destination}</p>
              {selected.deviation && (
                <div className="mb-4 p-2.5 rounded-lg bg-destructive/10 border border-destructive/20">
                  <p className="text-xs text-destructive font-medium flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" /> Route deviation detected
                  </p>
                </div>
              )}
              <div className="space-y-0">
                {selected.stops.map((stop, i) => (
                  <div key={i} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className={cn("w-3 h-3 rounded-full border-2 shrink-0",
                        stop.status === 'Completed' ? 'bg-success border-success' :
                        stop.status === 'Current' ? 'bg-primary border-primary animate-pulse-dot' :
                        'bg-muted border-border'
                      )} />
                      {i < selected.stops.length - 1 && (
                        <div className={cn("w-0.5 h-12", stop.status === 'Completed' ? 'bg-success/30' : 'bg-border')} />
                      )}
                    </div>
                    <div className="pb-6">
                      <p className="text-xs font-medium text-foreground">{stop.location}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {stop.arrivedAt ? `Arrived: ${new Date(stop.arrivedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Pending'}
                        {stop.departedAt && ` • Departed: ${new Date(stop.departedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
              <MapPin className="w-8 h-8 mb-2 opacity-30" />
              <p className="text-sm">Select a route to view timeline</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
