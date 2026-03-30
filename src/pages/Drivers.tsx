import { useState } from "react";
import { drivers, trucks } from "@/data/mockData";
import StatusBadge from "@/components/StatusBadge";
import { Search, Plus, Star, Phone } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Drivers() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const filtered = drivers.filter(d => {
    const matchSearch = d.name.toLowerCase().includes(search.toLowerCase()) || d.id.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "All" || d.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Driver Management</h1>
          <p className="text-sm text-muted-foreground mt-1">{drivers.length} drivers registered</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
          <Plus className="w-4 h-4" /> Add Driver
        </button>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input type="text" placeholder="Search drivers..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-card border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20" />
        </div>
        {['All', 'Available', 'Assigned', 'Off-duty'].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={cn("px-3 py-2 rounded-lg text-xs font-medium transition-colors", statusFilter === s ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground hover:bg-muted")}>
            {s}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map(driver => {
          const truck = trucks.find(t => t.id === driver.assignedTruck);
          return (
            <div key={driver.id} className="bg-card border border-border rounded-xl p-5 card-hover">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold shrink-0">
                  {driver.avatar}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-foreground">{driver.name}</p>
                    <StatusBadge status={driver.status} />
                  </div>
                  <p className="text-xs text-muted-foreground">{driver.id} • {driver.licenseType}</p>
                </div>
              </div>
              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground flex items-center gap-1"><Phone className="w-3 h-3" /> Phone</span>
                  <span className="text-foreground">{driver.phone}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground flex items-center gap-1"><Star className="w-3 h-3" /> Rating</span>
                  <span className="text-foreground font-medium">{driver.rating} / 5.0</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Total Trips</span>
                  <span className="text-foreground font-medium">{driver.totalTrips}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Assigned Truck</span>
                  <span className="text-foreground font-medium">{truck ? truck.plateNumber : '—'}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
