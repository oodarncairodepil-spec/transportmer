import { useState } from "react";
import { trucks, drivers } from "@/data/mockData";
import StatusBadge from "@/components/StatusBadge";
import { Search, Filter, Plus, Fuel, Gauge } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Fleet() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("All");

  const filtered = trucks.filter(t => {
    const matchSearch = t.plateNumber.toLowerCase().includes(search.toLowerCase()) ||
      t.id.toLowerCase().includes(search.toLowerCase()) ||
      t.type.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "All" || t.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Fleet Management</h1>
          <p className="text-sm text-muted-foreground mt-1">{trucks.length} vehicles registered</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
          <Plus className="w-4 h-4" /> Add Vehicle
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by plate, ID, type..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-card border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        {['All', 'Active', 'In Maintenance', 'Idle'].map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={cn(
              "px-3 py-2 rounded-lg text-xs font-medium transition-colors",
              statusFilter === s ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground hover:bg-muted"
            )}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Truck Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map(truck => {
          const assignedDrivers = drivers.filter(d => truck.assignedDrivers.includes(d.id));
          return (
            <div key={truck.id} className="bg-card border border-border rounded-xl p-5 card-hover">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-sm font-bold text-foreground">{truck.plateNumber}</p>
                  <p className="text-xs text-muted-foreground">{truck.id} • {truck.type}</p>
                </div>
                <StatusBadge status={truck.status} />
              </div>
              <div className="space-y-2.5 mt-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Capacity</span>
                  <span className="text-foreground font-medium">{truck.capacity}</span>
                </div>
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
                    {assignedDrivers.length > 0 ? assignedDrivers.map(d => d.name).join(', ') : '—'}
                  </span>
                </div>
                {/* Fuel bar */}
                <div className="pt-2">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-muted-foreground flex items-center gap-1"><Fuel className="w-3 h-3" /> Fuel</span>
                    <span className={cn("font-medium", truck.fuelLevel < 30 ? 'text-destructive' : truck.fuelLevel < 50 ? 'text-warning' : 'text-success')}>
                      {truck.fuelLevel}%
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={cn("h-full rounded-full transition-all", truck.fuelLevel < 30 ? 'bg-destructive' : truck.fuelLevel < 50 ? 'bg-warning' : 'bg-success')}
                      style={{ width: `${truck.fuelLevel}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
