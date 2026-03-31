import { useMemo } from "react";
import { trucks, routes, fuelHistory } from "@/data/mockData";
import { loadDrivers } from "@/lib/driversStorage";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from "recharts";

export default function Reports() {
  const drivers = useMemo(() => loadDrivers(), []);
  const statusData = [
    { name: 'Active', value: trucks.filter(t => t.status === 'Active').length },
    { name: 'Maintenance', value: trucks.filter(t => t.status === 'In Maintenance').length },
    { name: 'Idle', value: trucks.filter(t => t.status === 'Idle').length },
  ];
  const PIE_COLORS = ['hsl(var(--success))', 'hsl(var(--warning))', 'hsl(var(--muted-foreground))'];

  const routeStatusData = [
    { name: 'Completed', value: routes.filter(r => r.status === 'Completed').length },
    { name: 'In Progress', value: routes.filter(r => r.status === 'In Progress').length },
    { name: 'Delayed', value: routes.filter(r => r.status === 'Delayed').length },
    { name: 'Planned', value: routes.filter(r => r.status === 'Planned').length },
  ];

  const topDrivers = [...drivers].sort((a, b) => b.totalTrips - a.totalTrips).slice(0, 5);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Reports & Analytics</h1>
        <p className="text-sm text-muted-foreground mt-1">Fleet performance insights</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Fleet Status */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">Fleet Status Distribution</h2>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={statusData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                {statusData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Route Completion */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">Route Status Breakdown</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={routeStatusData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
              <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
              <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
              <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Fuel Trends */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">Fuel vs Mileage Trend</h2>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={fuelHistory}>
              <defs>
                <linearGradient id="fuelG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="mileG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
              <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
              <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
              <Area type="monotone" dataKey="consumption" stroke="hsl(var(--primary))" fill="url(#fuelG)" strokeWidth={2} name="Fuel (L)" />
              <Area type="monotone" dataKey="mileage" stroke="hsl(var(--success))" fill="url(#mileG)" strokeWidth={2} name="Mileage (km)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Top Drivers */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">Top Drivers by Trips</h2>
          <div className="space-y-3">
            {topDrivers.map((driver, i) => (
              <div key={driver.id} className="flex items-center gap-3">
                <span className="text-xs font-bold text-muted-foreground w-4">{i + 1}</span>
                <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                  {driver.avatar}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">{driver.name}</p>
                  <p className="text-xs text-muted-foreground">{driver.totalTrips} trips • ⭐ {driver.rating}</p>
                </div>
                <div className="w-24">
                  <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${(driver.totalTrips / topDrivers[0].totalTrips) * 100}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
