import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: string;
  className?: string;
}

const statusStyles: Record<string, string> = {
  'Active': 'status-active',
  'Available': 'status-active',
  'Completed': 'status-active',
  'In Progress': 'bg-primary/10 text-primary',
  'Assigned': 'bg-primary/10 text-primary',
  'In Maintenance': 'status-warning',
  'Scheduled': 'status-warning',
  'Pending': 'status-warning',
  'Planned': 'status-warning',
  'Delayed': 'status-danger',
  'Overdue': 'status-danger',
  'Cancelled': 'status-danger',
  'Off-duty': 'status-idle',
  'Idle': 'status-idle',
};

export default function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span className={cn(
      "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
      statusStyles[status] || 'status-idle',
      className
    )}>
      {status}
    </span>
  );
}
