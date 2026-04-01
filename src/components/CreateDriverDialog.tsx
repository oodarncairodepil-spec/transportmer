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
import type { Driver } from "@/data/mockData";

const driverStatuses: Driver["status"][] = ["Active", "Inactive"];
const licenseTypes = ["SIM B1", "SIM B2"];
const months = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"));
const buildYears = () => {
  const year = new Date().getFullYear();
  return Array.from({ length: 12 }, (_, i) => String(year + i));
};

const createDriverSchema = z.object({
  name: z.string().trim().min(2, "Name is required"),
  licenseType: z.string().trim().min(2, "License type is required"),
  licenseValidMonth: z.string().regex(/^(0[1-9]|1[0-2])$/, "License valid month is required"),
  licenseValidYear: z.string().regex(/^\d{4}$/, "License valid year is required"),
  status: z.enum(["Active", "Inactive"]),
  phone: z.string().trim().min(6, "Phone number is required"),
});

export type CreateDriverValues = z.infer<typeof createDriverSchema>;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: CreateDriverValues) => void | Promise<void>;
  mode?: "create" | "edit";
  initialData?: Driver;
};

export default function CreateDriverDialog({ open, onOpenChange, onSubmit, mode = "create", initialData }: Props) {
  const years = buildYears();
  const defaultMonth = "";
  const defaultYear = "";

  const form = useForm<CreateDriverValues>({
    resolver: zodResolver(createDriverSchema),
    defaultValues: {
      name: "",
      licenseType: "",
      licenseValidMonth: defaultMonth,
      licenseValidYear: defaultYear,
      status: "Active",
      phone: "",
    },
  });

  useEffect(() => {
    if (!open) {
      form.reset({
        name: "",
        licenseType: "",
        licenseValidMonth: defaultMonth,
        licenseValidYear: defaultYear,
        status: "Active",
        phone: "",
      });
      return;
    }

    if (initialData) {
      form.reset({
        name: initialData.name,
        licenseType: initialData.licenseType ?? "",
        licenseValidMonth: initialData.licenseValidMonth ?? defaultMonth,
        licenseValidYear: initialData.licenseValidYear ?? defaultYear,
        status: initialData.status,
        phone: initialData.phone,
      });
    }
  }, [defaultMonth, defaultYear, form, initialData, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === "edit" ? "Edit driver" : "Add driver"}</DialogTitle>
          <DialogDescription>
            {mode === "edit" ? "Update an existing driver profile." : "Create a new driver profile."}
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
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Budi Santoso" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="licenseType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>License type</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select license" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {licenseTypes.map((t) => (
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
                        {driverStatuses.map((s) => (
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
                name="licenseValidMonth"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>License valid month</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
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
                name="licenseValidYear"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>License valid year</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
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

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone</FormLabel>
                  <FormControl>
                    <Input placeholder="+62 812-1234-5678" {...field} />
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
