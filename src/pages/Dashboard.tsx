import { Truck, Users, MapPin, Wrench, Package, Fuel, AlertTriangle, Activity } from "lucide-react";
import { trucks, drivers, routes, workOrders, alerts, fuelHistory } from "@/data/mockData";
import StatCard from "@/components/StatCard";
import StatusBadge from "@/components/StatusBadge";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";

export default function Dashboard() {
  const activeTrucks = trucks.filter(t => t.status === 'Active').length;
  const inMaintenance = trucks.filter(t => t.status === 'In Maintenance').length;
  const activeDeliveries = routes.filter(r => r.status === 'In Progress').length;
  const delayedRoutes = routes.filter(r => r.status === 'Delayed').length;
  const todayFuel = fuelHistory[fuelHistory.length - 1].consumption;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Fleet operations overview — {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Trucks" value={trucks.length} subtitle={`${activeTrucks} active`} icon={Truck} variant="primary" trend={{ value: "2 added this month", positive: true }} />
        <StatCard title="Active Deliveries" value={activeDeliveries} subtitle="In transit now" icon={Package} variant="default" />
        <StatCard title="Delayed Routes" value={delayedRoutes} subtitle="Needs attention" icon={AlertTriangle} variant={delayedRoutes > 0 ? "danger" : "default"} />
        <StatCard title="Fuel Today" value={`${todayFuel}L`} subtitle="Fleet consumption" icon={Fuel} variant="warning" trend={{ value: "9% vs yesterday", positive: false }} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Map placeholder */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl overflow-hidden">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Fleet Map Overview</h2>
            <span className="text-xs text-muted-foreground">{activeTrucks} trucks active</span>
          </div>
          <div className="relative h-80 bg-muted/30">
            {/* Simulated map with dots */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="relative w-full h-full">
                {/* Indonesia map outline approximation */}
                <svg viewBox="0 0 800 400" className="w-full h-full opacity-20">
                  <path d="M100,200 Q200,150 300,180 Q400,160 500,190 Q600,170 700,200 Q650,250 550,240 Q450,260 350,240 Q250,260 150,240 Z" 
                    fill="none" stroke="hsl(var(--primary))" strokeWidth="2" />
                </svg>
                {/* Truck positions */}
                {trucks.filter(t => t.status === 'Active').map((truck, i) => {
                  const positions = [
                    { x: 25, y: 45 }, { x: 30, y: 50 }, { x: 55, y: 40 },
                    { x: 62, y: 55 }, { x: 48, y: 48 }, { x: 72, y: 45 },
                  ];
                  const pos = positions[i % positions.length];
                  return (
                    <div key={truck.id} className="absolute group" style={{ left: `${pos.x}%`, top: `${pos.y}%` }}>
                      <div className="w-3 h-3 rounded-full bg-primary animate-pulse-dot" />
                      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 bg-card border border-border rounded-lg px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 shadow-lg">
                        <p className="text-[10px] font-semibold text-foreground">{truck.plateNumber}</p>
                        <p className="text-[9px] text-muted-foreground">{truck.location}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Alerts Panel */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="p-4 border-b border-border">
            <h2 className="text-sm font-semibold text-foreground">Recent Alerts</h2>
          </div>
          <div className="divide-y divide-border/50 max-h-[340px] overflow-y-auto">
            {alerts.map(alert => (
              <div key={alert.id} className="p-3 hover:bg-muted/20 transition-colors">
                <div className="flex items-start gap-2.5">
                  <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                    alert.severity === 'high' ? 'bg-destructive' :
                    alert.severity === 'medium' ? 'bg-warning' : 'bg-success'
                  }`} />
                  <div className="min-w-0">
                    <p className="text-xs text-foreground leading-relaxed">{alert.message}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className="text-[10px] text-muted-foreground capitalize px-1.5 py-0.5 rounded bg-muted/50">
                        {alert.type}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">Fuel Consumption (Last 7 Days)</h2>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={fuelHistory}>
              <defs>
                <linearGradient id="fuelGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
              <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
              <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
              <Area type="monotone" dataKey="consumption" stroke="hsl(var(--primary))" fill="url(#fuelGradient)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">Daily Mileage (km)</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={fuelHistory}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
              <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
              <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
              <Bar dataKey="mileage" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Active Routes */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">Active Routes</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Route</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Truck</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Driver</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Origin → Dest</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Status</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Deviation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {routes.filter(r => r.status === 'In Progress' || r.status === 'Delayed').map(route => {
                const driver = drivers.find(d => d.id === route.driverId);
                const truck = trucks.find(t => t.id === route.truckId);
                return (
                  <tr key={route.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-foreground">{route.id}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{truck?.plateNumber}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{driver?.name}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{route.origin} → {route.destination}</td>
                    <td className="px-4 py-3"><StatusBadge status={route.status} /></td>
                    <td className="px-4 py-3">
                      {route.deviation && <span className="text-xs text-destructive font-medium">⚠ Deviation</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
