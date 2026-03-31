import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { WorkOrder } from "@/data/mockData";
import { loadDrivers } from "@/lib/driversStorage";
import { loadFleetTrucks } from "@/lib/fleetStorage";
import { loadRoutes } from "@/lib/routesStorage";

import { Paperclip, FileText, ImageIcon } from "lucide-react";

const workOrderStatuses: WorkOrder["status"][] = ["Pending", "In Progress", "Completed", "Cancelled"];
const priorities: WorkOrder["priority"][] = ["High", "Medium", "Low"];

const createWorkOrderSchema = z.object({
  title: z.string().trim().min(2, "Title is required"),
  driverId: z.string().trim().min(1, "Driver is required"),
  truckId: z.string().trim().min(1, "Truck is required"),
  routeId: z.string().trim().min(1, "Route is required"),
  notes: z.string().trim().optional(),
  priority: z.enum(["High", "Medium", "Low"]),
  status: z.enum(["Pending", "In Progress", "Completed", "Cancelled"]).optional(),
  dueDate: z.string().trim().min(1, "Due date is required"),
});

export type CreateWorkOrderValues = z.infer<typeof createWorkOrderSchema>;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (values: CreateWorkOrderValues) => void;
  initialData?: WorkOrder;
};

export default function CreateWorkOrderDialog({ open, onOpenChange, onCreate, initialData }: Props) {
  const drivers = loadDrivers();
  const trucks = loadFleetTrucks();
  const routes = loadRoutes();
  
  const [truckSearch, setTruckSearch] = useState("");
  const [driverSearch, setDriverSearch] = useState("");
  const [routeSearch, setRouteSearch] = useState("");

  const [historyMessage, setHistoryMessage] = useState("");
  const [historyFile, setHistoryFile] = useState<File | null>(null);

  const displayedTrucks = useMemo(() => {
    if (truckSearch.length >= 3) {
      const lowerQuery = truckSearch.toLowerCase();
      return trucks.filter(
        (t) =>
          t.plateNumber.toLowerCase().includes(lowerQuery) ||
          t.type.toLowerCase().includes(lowerQuery)
      );
    }
    return [...trucks]
      .sort((a, b) => b.id.localeCompare(a.id))
      .slice(0, 5);
  }, [trucks, truckSearch]);

  const displayedDrivers = useMemo(() => {
    if (driverSearch.length >= 3) {
      const lowerQuery = driverSearch.toLowerCase();
      return drivers.filter(
        (d) => d.name.toLowerCase().includes(lowerQuery)
      );
    }
    return [...drivers]
      .sort((a, b) => b.id.localeCompare(a.id))
      .slice(0, 5);
  }, [drivers, driverSearch]);

  const displayedRoutes = useMemo(() => {
    if (routeSearch.length >= 3) {
      const lowerQuery = routeSearch.toLowerCase();
      return routes.filter(
        (r) => (r.name || r.id).toLowerCase().includes(lowerQuery)
      );
    }
    return [...routes]
      .sort((a, b) => b.id.localeCompare(a.id))
      .slice(0, 5);
  }, [routes, routeSearch]);

  const form = useForm<CreateWorkOrderValues>({
    resolver: zodResolver(createWorkOrderSchema),
    defaultValues: {
      title: initialData?.title || "",
      driverId: initialData?.driverId || "",
      truckId: initialData?.truckId || "",
      routeId: "", // Since we don't store routeId on WorkOrder currently, we have to leave this blank for edits or resolve it backwards
      notes: initialData?.cargoType || "",
      priority: initialData?.priority || "Medium",
      status: initialData?.status || "Pending",
      dueDate: initialData?.dueDate || new Date().toISOString().split("T")[0],
    },
  });

  const onSubmit = (values: CreateWorkOrderValues) => {
    onCreate(values);
  };

  useEffect(() => {
    if (open) {
      setHistoryMessage("");
      setHistoryFile(null);
      if (initialData) {
        form.reset({
          title: initialData.title,
          driverId: initialData.driverId,
          truckId: initialData.truckId,
          routeId: "", // Needs to be re-selected on edit
          notes: initialData.cargoType,
          priority: initialData.priority,
          status: initialData.status,
          dueDate: initialData.dueDate,
        });
      } else {
        form.reset({
          title: "",
          driverId: "",
          truckId: "",
          routeId: "",
          notes: "",
          priority: "Medium",
          status: "Pending",
          dueDate: new Date().toISOString().split("T")[0],
        });
      }
    } else {
      setTruckSearch("");
      setDriverSearch("");
      setRouteSearch("");
    }
  }, [form, open, initialData]);

  const handleAddHistory = () => {
    if (!historyMessage.trim() && !historyFile) return;

    // We generate a fake URL for the file to simulate uploading
    let attachment;
    if (historyFile) {
      attachment = {
        name: historyFile.name,
        url: URL.createObjectURL(historyFile)
      };
    }

    const newHistoryEntry = {
      id: `hist_${Date.now()}`,
      timestamp: new Date().toISOString(),
      message: historyMessage.trim(),
      attachment
    };

    // We pass this back up through the form data or handle it directly.
    // For simplicity, we can intercept the current submit or mutate initialData directly
    // but the cleanest way is to pass it as part of the values.
    
    // Instead of mutating the form, we can just call onCreate directly 
    // with the current form values and the appended history if we are editing.
    // However, a better approach is to manage history in the parent or pass it in the onSubmit.
    
    // Let's create a custom submission that includes the new history
    const currentValues = form.getValues();
    
    // Call onCreate with a special flag or just pass it up. 
    // To keep types happy without changing CreateWorkOrderValues heavily, 
    // we can attach it to the onCreate call via a wrapper or modify the schema.
    
    // For now, let's just trigger a full save to parent
    const updatedHistory = [...(initialData?.history || []), newHistoryEntry];
    
    const nextValues = {
      ...currentValues,
      _newHistory: updatedHistory
    };

    onCreate(nextValues as CreateWorkOrderValues & { _newHistory: typeof updatedHistory });

    setHistoryMessage("");
    setHistoryFile(null);
  };

  const getFileIcon = (fileName: string) => {
    if (fileName.match(/\.(jpg|jpeg|png|gif|webp)$/i)) return <ImageIcon className="w-4 h-4" />;
    return <FileText className="w-4 h-4" />;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initialData ? "Edit work order" : "Add work order"}</DialogTitle>
          <DialogDescription>
            {initialData ? "Update the details for this work order." : "Create a new work order for a driver and truck."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Pengiriman Bahan Baku" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="driverId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Driver</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select driver" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <div className="p-2 border-b border-border sticky top-0 bg-popover z-10">
                          <Input
                            placeholder="Search drivers..."
                            value={driverSearch}
                            onChange={(e) => setDriverSearch(e.target.value)}
                            className="h-8 text-xs"
                            autoFocus
                            onKeyDown={(e) => {
                              e.stopPropagation();
                            }}
                          />
                        </div>
                        {displayedDrivers.length === 0 ? (
                          <div className="p-2 text-sm text-muted-foreground text-center">No drivers found</div>
                        ) : (
                          displayedDrivers.map((d) => (
                            <SelectItem key={d.id} value={d.id}>
                              {d.name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="truckId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Truck</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select truck" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <div className="p-2 border-b border-border sticky top-0 bg-popover z-10">
                          <Input
                            placeholder="Search trucks..."
                            value={truckSearch}
                            onChange={(e) => setTruckSearch(e.target.value)}
                            className="h-8 text-xs"
                            autoFocus
                            onKeyDown={(e) => {
                              // Prevent closing the select when typing spaces
                              e.stopPropagation();
                            }}
                          />
                        </div>
                        {displayedTrucks.length === 0 ? (
                          <div className="p-2 text-sm text-muted-foreground text-center">No trucks found</div>
                        ) : (
                          displayedTrucks.map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                              {t.plateNumber} ({t.type})
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="routeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Route</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select route" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <div className="p-2 border-b border-border sticky top-0 bg-popover z-10">
                          <Input
                            placeholder="Search routes..."
                            value={routeSearch}
                            onChange={(e) => setRouteSearch(e.target.value)}
                            className="h-8 text-xs"
                            autoFocus
                            onKeyDown={(e) => {
                              e.stopPropagation();
                            }}
                          />
                        </div>
                        {displayedRoutes.length === 0 ? (
                          <div className="p-2 text-sm text-muted-foreground text-center">No routes found</div>
                        ) : (
                          displayedRoutes.map((r) => (
                            <SelectItem key={r.id} value={r.id}>
                              {r.name || r.id}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="dueDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Due Date</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        onClick={(e) => {
                          if ("showPicker" in HTMLInputElement.prototype) {
                            (e.target as HTMLInputElement).showPicker();
                          }
                        }}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Priority</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select priority" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {priorities.map((p) => (
                          <SelectItem key={p} value={p}>
                            {p}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {initialData && (
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {workOrderStatuses.map((s) => (
                            <SelectItem key={s} value={s}>
                              {s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Enter cargo details, instructions, or any other notes..." 
                      className="resize-none h-20"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit">{initialData ? "Save Changes" : "Create"}</Button>
            </DialogFooter>
          </form>
        </Form>

        {initialData && (
          <div className="mt-6 pt-6 border-t border-border">
            <h3 className="text-sm font-semibold text-foreground mb-4">History Log</h3>
            
            <div className="space-y-4 mb-4 max-h-[200px] overflow-y-auto pr-2">
              {!initialData.history || initialData.history.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">No history recorded yet.</p>
              ) : (
                initialData.history.map(log => (
                  <div key={log.id} className="bg-muted/30 p-3 rounded-lg text-sm border border-border/50">
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-medium text-xs text-foreground">Update</span>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(log.timestamp).toLocaleString()}
                      </span>
                    </div>
                    {log.message && <p className="text-muted-foreground text-xs mt-1 whitespace-pre-wrap">{log.message}</p>}
                    {log.attachment && (
                      <div className="mt-2 flex items-center gap-2 p-2 bg-background border border-border rounded-md w-fit max-w-full">
                        <div className="text-primary shrink-0">
                          {getFileIcon(log.attachment.name)}
                        </div>
                        <a 
                          href={log.attachment.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline truncate"
                        >
                          {log.attachment.name}
                        </a>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="bg-muted/20 p-3 rounded-lg border border-border flex flex-col gap-3">
              <Textarea 
                placeholder="Type a new update message..." 
                className="min-h-[60px] text-xs resize-none bg-background"
                value={historyMessage}
                onChange={(e) => setHistoryMessage(e.target.value)}
              />
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Input 
                    type="file" 
                    id="history-file" 
                    className="hidden" 
                    onChange={(e) => {
                      if (e.target.files && e.target.files.length > 0) {
                        setHistoryFile(e.target.files[0]);
                      }
                    }}
                  />
                  <label 
                    htmlFor="history-file" 
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer transition-colors px-2 py-1.5 rounded-md hover:bg-muted"
                  >
                    <Paperclip className="w-3.5 h-3.5" />
                    {historyFile ? historyFile.name : "Attach file"}
                  </label>
                  {historyFile && (
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="sm" 
                      className="h-6 px-2 text-[10px] text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => setHistoryFile(null)}
                    >
                      Remove
                    </Button>
                  )}
                </div>
                <Button 
                  type="button" 
                  size="sm" 
                  className="h-8 text-xs"
                  onClick={handleAddHistory}
                  disabled={!historyMessage.trim() && !historyFile}
                >
                  Add Log
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
