import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Truck } from "@/data/mockData";

const truckTypes: Truck["type"][] = ["Trailer", "Box Truck", "Tanker", "Flatbed", "Refrigerated"];
const truckStatuses: Truck["status"][] = ["Active", "In Maintenance", "Idle"];

const months = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"));
const buildYears = () => {
  const year = new Date().getFullYear();
  return Array.from({ length: 12 }, (_, i) => String(year + i));
};

const createTruckSchema = z.object({
  plateNumber: z.string().trim().min(3, "Plate number is required"),
  plateMonth: z.string().regex(/^(0[1-9]|1[0-2])$/, "Plate month is required"),
  plateYear: z.string().regex(/^\d{4}$/, "Plate year is required"),
  type: z.enum(["Trailer", "Box Truck", "Tanker", "Flatbed", "Refrigerated"]),
  location: z.string().trim().min(2, "Location is required"),
  status: z.enum(["Active", "In Maintenance", "Idle"]),
});

export type CreateTruckValues = z.infer<typeof createTruckSchema>;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: CreateTruckValues) => void | Promise<void>;
  mode?: "create" | "edit";
  initialData?: Truck;
};

export default function CreateTruckDialog({ open, onOpenChange, onSubmit, mode = "create", initialData }: Props) {
  const years = buildYears();
  const today = new Date();
  const defaultMonth = String(today.getMonth() + 1).padStart(2, "0");
  const defaultYear = String(today.getFullYear());

  const form = useForm<CreateTruckValues>({
    resolver: zodResolver(createTruckSchema),
    defaultValues: {
      plateNumber: "",
      plateMonth: defaultMonth,
      plateYear: defaultYear,
      type: "Trailer",
      location: "",
      status: "Active",
    },
  });

  useEffect(() => {
    if (!open) {
      form.reset({
        plateNumber: "",
        plateMonth: defaultMonth,
        plateYear: defaultYear,
        type: "Trailer",
        location: "",
        status: "Active",
      });
      return;
    }

    if (initialData) {
      form.reset({
        plateNumber: initialData.plateNumber,
        plateMonth: initialData.plateMonth ?? defaultMonth,
        plateYear: initialData.plateYear ?? defaultYear,
        type: initialData.type,
        location: initialData.location,
        status: initialData.status,
      });
    }
  }, [defaultMonth, defaultYear, form, initialData, open]);

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === "edit" ? "Edit Vehicle" : "Add Vehicle"}</DialogTitle>
          <DialogDescription>
            {mode === "edit" ? "Update a fleet asset." : "Create a new fleet asset and add it to your list."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(async (values) => {
              await onSubmit(values);
            })}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="plateNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Plate Number</FormLabel>
                  <FormControl>
                    <Input placeholder="B 1234 ABC" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="plateMonth"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Plate Month</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="MM" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {months.map((m) => (
                          <SelectItem key={m} value={m}>
                            {m}
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
                name="plateYear"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Plate Year</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="YYYY" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {years.map((y) => (
                          <SelectItem key={y} value={y}>
                            {y}
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
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {truckTypes.map((t) => (
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
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {truckStatuses.map((s) => (
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

            <FormField
              control={form.control}
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Location</FormLabel>
                  <FormControl>
                    <Input placeholder="Jakarta" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={form.formState.isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Saving…" : mode === "edit" ? "Save" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
