import { useState } from "react";
import { workOrders, drivers, trucks } from "@/data/mockData";
import StatusBadge from "@/components/StatusBadge";
import { cn } from "@/lib/utils";

const columns = [
  { key: 'Pending', label: 'Pending', color: 'border-warning' },
  { key: 'In Progress', label: 'In Progress', color: 'border-primary' },
  { key: 'Completed', label: 'Completed', color: 'border-success' },
  { key: 'Cancelled', label: 'Cancelled', color: 'border-destructive' },
];

const priorityColors: Record<string, string> = {
  High: 'text-destructive',
  Medium: 'text-warning',
  Low: 'text-muted-foreground',
};

export default function WorkOrders() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Work Orders</h1>
          <p className="text-sm text-muted-foreground mt-1">{workOrders.length} total orders</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
          + New Work Order
        </button>
      </div>

      {/* Kanban Board */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {columns.map(col => {
          const orders = workOrders.filter(wo => wo.status === col.key);
          return (
            <div key={col.key} className="space-y-3">
              <div className={cn("flex items-center gap-2 pb-2 border-b-2", col.color)}>
                <h3 className="text-sm font-semibold text-foreground">{col.label}</h3>
                <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{orders.length}</span>
              </div>
              <div className="space-y-3 max-h-[calc(100vh-260px)] overflow-y-auto pr-1">
                {orders.map(order => {
                  const driver = drivers.find(d => d.id === order.driverId);
                  return (
                    <div key={order.id} className="bg-card border border-border rounded-xl p-4 card-hover">
                      <div className="flex items-start justify-between mb-2">
                        <span className="text-[10px] text-muted-foreground font-mono">{order.id}</span>
                        <span className={cn("text-[10px] font-semibold", priorityColors[order.priority])}>
                          {order.priority}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-foreground mb-2 leading-snug">{order.title}</p>
                      <div className="space-y-1.5 text-xs text-muted-foreground">
                        <p>📍 {order.pickupLocation}</p>
                        <p>🎯 {order.destinations[0]}</p>
                        <p>📦 {order.cargoType}</p>
                      </div>
                      <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/50">
                        <div className="flex items-center gap-1.5">
                          <div className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[8px] font-bold">
                            {driver?.avatar}
                          </div>
                          <span className="text-[10px] text-muted-foreground">{driver?.name}</span>
                        </div>
                        <span className="text-[10px] text-muted-foreground">Due {order.dueDate}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
