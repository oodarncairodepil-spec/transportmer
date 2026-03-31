import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useState } from "react";
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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { MaintenanceRecord, Truck } from "@/data/mockData";
import { cn } from "@/lib/utils";
import { Check, ChevronsUpDown } from "lucide-react";

const maintenanceTypes: MaintenanceRecord["type"][] = [
  "Oil Change",
  "Tire Rotation",
  "Brake Inspection",
  "Engine Check",
  "Full Service",
];

const maintenanceStatuses: MaintenanceRecord["status"][] = ["Scheduled", "Cancelled", "In Progress", "Completed", "Pending", "Overdue"];

const schema = z.object({
  truckId: z.string().min(1, "Truck is required"),
  type: z.enum(["Oil Change", "Tire Rotation", "Brake Inspection", "Engine Check", "Full Service"]),
  status: z.enum(["Scheduled", "Cancelled", "In Progress", "Completed", "Pending", "Overdue"]),
  date: z.string().min(1, "Date is required"),
  cost: z.preprocess(
    (v) => {
      if (typeof v === "string") {
        const clean = v.replace(/,/g, "");
        if (clean.trim().length === 0) return NaN;
        return Number(clean);
      }
      return Number(v);
    },
    z.number().nonnegative("Cost must be 0 or more"),
  ),
  notes: z.string().trim().min(1, "Notes are required"),
});

export type CreateMaintenanceValues = z.infer<typeof schema>;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trucks: Truck[];
  onSubmit: (values: CreateMaintenanceValues) => void;
  mode?: "create" | "edit";
  initialData?: MaintenanceRecord;
};

export default function CreateMaintenanceDialog({
  open,
  onOpenChange,
  trucks,
  onSubmit,
  mode = "create",
  initialData,
}: Props) {
  const [truckOpen, setTruckOpen] = useState(false);
  const [vehicleSearch, setVehicleSearch] = useState("");

  const truckOptions = useMemo(() => {
    let sorted = trucks
      .slice()
      .sort((a, b) => b.id.localeCompare(a.id)); // Sort descending to get newest

    if (vehicleSearch.length >= 3) {
      const lowerQuery = vehicleSearch.toLowerCase();
      sorted = sorted.filter(
        (t) =>
          t.plateNumber.toLowerCase().includes(lowerQuery) ||
          t.id.toLowerCase().includes(lowerQuery)
      );
    } else {
      sorted = sorted.slice(0, 5); // Only show the first 5 vehicles if not searching deeply
    }

    return sorted.map((t) => ({ id: t.id, label: `${t.plateNumber} (${t.id})` }));
  }, [trucks, vehicleSearch]);

  const form = useForm<CreateMaintenanceValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      truckId: "",
      type: "Oil Change",
      status: "Scheduled",
      date: new Date().toISOString().split("T")[0],
      cost: "" as unknown as number, // Using string internally to manage the empty state and commas
      notes: "",
    },
  });

  const canSubmit = truckOptions.length > 0;

  useEffect(() => {
    if (!open) {
      return;
    }
    if (initialData) {
      return;
    }
    const current = form.getValues("truckId");
    if (!current && truckOptions.length > 0) {
      form.setValue("truckId", truckOptions[0].id, { shouldValidate: true });
    }
  }, [form, initialData, open, truckOptions]);

  useEffect(() => {
    if (!open) {
      return;
    }
    if (!initialData) {
      return;
    }

    form.reset({
      truckId: initialData.truckId,
      type: initialData.type,
      status: initialData.status,
      date: initialData.date,
      cost: String(initialData.cost) as unknown as number,
      notes: initialData.notes,
    });
  }, [form, initialData, open]);

  useEffect(() => {
    if (!open) {
      setTruckOpen(false);
      setVehicleSearch("");
    }
  }, [open]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) {
          form.reset({
            truckId: "",
            type: "Oil Change",
            status: "Scheduled",
            date: new Date().toISOString().split("T")[0],
            cost: "" as unknown as number,
            notes: "",
          });
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === "edit" ? "Edit maintenance record" : "Add maintenance record"}</DialogTitle>
          <DialogDescription>
            {mode === "edit" ? "Update a maintenance schedule or log entry." : "Create a maintenance schedule or log entry for a vehicle."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => onSubmit(v))} className="space-y-4">
            <FormField
              control={form.control}
              name="truckId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Vehicle</FormLabel>
                  <Popover open={truckOpen} onOpenChange={setTruckOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          type="button"
                          variant="outline"
                          role="combobox"
                          aria-expanded={truckOpen}
                          className={cn("w-full justify-between", !field.value && "text-muted-foreground")}
                        >
                          {truckOptions.find((t) => t.id === field.value)?.label ?? "Select vehicle"}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                      <Command>
                        <CommandInput 
                          placeholder="Search vehicle..." 
                          value={vehicleSearch}
                          onValueChange={setVehicleSearch}
                        />
                        <CommandList>
                          <CommandEmpty>No vehicles found.</CommandEmpty>
                          <CommandGroup>
                            {truckOptions.map((t) => (
                              <CommandItem
                                key={t.id}
                                value={t.label}
                                onSelect={() => {
                                  field.onChange(t.id);
                                  setTruckOpen(false);
                                }}
                              >
                                <Check className={cn("mr-2 h-4 w-4", t.id === field.value ? "opacity-100" : "opacity-0")} />
                                {t.label}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {maintenanceTypes.map((t) => (
                          <SelectItem key={t} value={t}>
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {maintenanceStatuses.map((s) => (
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
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
                    <FormControl>
                      <Input 
                        type="date" 
                        className="w-full flex"
                        onClick={(e) => {
                          if ('showPicker' in HTMLInputElement.prototype) {
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

              <FormField
                control={form.control}
                name="cost"
                render={({ field: { value, onChange, ...fieldProps } }) => {
                  // Format the value with commas for display
                  const displayValue = value === "" || value === undefined || value === null || Number.isNaN(value)
                    ? "" 
                    : value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
                  
                  return (
                    <FormItem>
                      <FormLabel>Cost (Rp)</FormLabel>
                      <FormControl>
                        <Input 
                          type="text" 
                          placeholder="e.g. 1,500,000"
                          {...fieldProps} 
                          value={displayValue}
                          onChange={(e) => {
                            // Strip non-numeric characters (except maybe dot if you want decimals later, but usually IDR is whole numbers)
                            const rawValue = e.target.value.replace(/\D/g, "");
                            onChange(rawValue === "" ? "" : rawValue);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Optional details" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!canSubmit}>
                {mode === "edit" ? "Save" : "Add"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
