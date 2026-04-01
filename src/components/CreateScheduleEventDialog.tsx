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
import type { Driver } from "@/data/mockData";
import type { ScheduleDay, ScheduleType } from "@/lib/schedulingStorage";
import type { ScheduleTemplate } from "@/lib/scheduleTemplatesStorage";
import { cn } from "@/lib/utils";
import { Check, ChevronsUpDown } from "lucide-react";

const days: ScheduleDay[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const schema = z
  .object({
    driverId: z.string().min(1, "Driver is required"),
    day: z.enum(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]),
    type: z.enum(["shift", "leave"]),
    title: z.string().trim().min(1, "Title is required"),
    start: z.string().optional(),
    end: z.string().optional(),
  })
  .refine(
    (v) => {
      if (v.type === "leave") {
        return true;
      }
      return (v.start ?? "").trim().length > 0 && (v.end ?? "").trim().length > 0;
    },
    { message: "Start and end time are required for shifts", path: ["start"] },
  );

export type CreateScheduleEventValues = z.infer<typeof schema>;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  drivers: Driver[];
  templates: ScheduleTemplate[];
  onCreate: (values: CreateScheduleEventValues) => void;
  mode?: "create" | "edit";
  initialValues?: Partial<CreateScheduleEventValues>;
  onDelete?: () => void;
};

export default function CreateScheduleEventDialog({
  open,
  onOpenChange,
  drivers,
  templates,
  onCreate,
  mode = "create",
  initialValues,
  onDelete,
}: Props) {
  const [driverOpen, setDriverOpen] = useState(false);
  const [driverSearch, setDriverSearch] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("__default__");
  const driverOptions = useMemo(() => {
    return drivers
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((d) => ({ id: d.id, label: `${d.name} (${d.id})` }));
  }, [drivers]);
  const displayedDriverOptions = useMemo(() => {
    if (driverSearch.length >= 3) {
      const lower = driverSearch.toLowerCase();
      return driverOptions.filter((d) => d.label.toLowerCase().includes(lower));
    }
    return driverOptions.slice(0, 5);
  }, [driverOptions, driverSearch]);

  const defaults = useMemo(
    () => ({
      driverId: driverOptions[0]?.id ?? "",
      day: "Mon" as const,
      type: "shift" as const,
      title: "",
      start: "06:00",
      end: "18:00",
    }),
    [driverOptions],
  );

  const form = useForm<CreateScheduleEventValues>({
    resolver: zodResolver(schema),
    defaultValues: defaults,
  });

  const type = form.watch("type");
  const title = form.watch("title");
  const canSubmit = driverOptions.length > 0;
  const isDayOff = title.trim().toLowerCase() === "day off";

  const templatesForType = useMemo(() => {
    return templates
      .slice()
      .sort((a, b) => {
        if (a.type !== b.type) {
          return a.type.localeCompare(b.type);
        }
        return a.title.localeCompare(b.title);
      });
  }, [templates]);

  useEffect(() => {
    if (!open) {
      return;
    }
    form.reset({ ...defaults, ...(initialValues ?? {}) });
  }, [defaults, form, initialValues, open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    if (templatesForType.length === 0) {
      setSelectedTemplateId("__dayoff__");
      form.setValue("type", "leave", { shouldValidate: true });
      form.setValue("title", "Day Off", { shouldValidate: true });
      form.setValue("start", "", { shouldValidate: true });
      form.setValue("end", "", { shouldValidate: true });
      return;
    }

    const match =
      templatesForType.find((t) => t.title.trim().toLowerCase() === title.trim().toLowerCase()) ?? templatesForType[0];
    setSelectedTemplateId(match.id);
    form.setValue("type", match.type, { shouldValidate: true });
    form.setValue("title", match.title, { shouldValidate: true });
    form.setValue("start", match.start, { shouldValidate: true });
    form.setValue("end", match.end, { shouldValidate: true });
  }, [form, open, templatesForType, title]);

  useEffect(() => {
    if (!open) {
      setDriverOpen(false);
      setDriverSearch("");
      setSelectedTemplateId("__default__");
    }
  }, [open]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) {
          form.reset(defaults);
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === "edit" ? "Edit schedule" : "Add schedule"}</DialogTitle>
          <DialogDescription>
            {mode === "edit" ? "Update the schedule entry for a driver/date." : "Add or replace a schedule entry for a driver/date."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => onCreate(v))} className="space-y-4">
            <FormField
              control={form.control}
              name="driverId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Driver</FormLabel>
                  <Popover open={driverOpen} onOpenChange={setDriverOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          type="button"
                          variant="outline"
                          role="combobox"
                          aria-expanded={driverOpen}
                          className={cn("w-full justify-between", !field.value && "text-muted-foreground")}
                        >
                          {driverOptions.find((d) => d.id === field.value)?.label ?? "Select driver"}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Search driver..." value={driverSearch} onValueChange={setDriverSearch} />
                        <CommandList>
                          <CommandEmpty>No drivers found.</CommandEmpty>
                          <CommandGroup>
                            {displayedDriverOptions.map((d) => (
                              <CommandItem
                                key={d.id}
                                value={d.label}
                                onSelect={() => {
                                  field.onChange(d.id);
                                  setDriverOpen(false);
                                }}
                              >
                                <Check className={cn("mr-2 h-4 w-4", d.id === field.value ? "opacity-100" : "opacity-0")} />
                                {d.label}
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
                name="day"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Day</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select day" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {days.map((d) => (
                          <SelectItem key={d} value={d}>
                            {d}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormItem>
              <FormLabel>Schedule</FormLabel>
              <Select
                value={selectedTemplateId}
                onValueChange={(next) => {
                  setSelectedTemplateId(next);
                  if (next === "__dayoff__") {
                    form.setValue("type", "leave", { shouldValidate: true });
                    form.setValue("title", "Day Off", { shouldValidate: true });
                    form.setValue("start", "", { shouldValidate: true });
                    form.setValue("end", "", { shouldValidate: true });
                    return;
                  }

                  const selected = templatesForType.find((t) => t.id === next);
                  if (!selected) {
                    return;
                  }
                  form.setValue("type", selected.type, { shouldValidate: true });
                  form.setValue("title", selected.title, { shouldValidate: true });
                  form.setValue("start", selected.start, { shouldValidate: true });
                  form.setValue("end", selected.end, { shouldValidate: true });
                }}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select schedule" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="__dayoff__">Day Off</SelectItem>
                  {templatesForType.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.type === "leave" ? `Leave • ${t.title}` : `Shift • ${t.title} • ${t.start}-${t.end}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormItem>



            <DialogFooter>
              {mode === "edit" && onDelete ? (
                <Button type="button" variant="destructive" onClick={onDelete}>
                  Delete
                </Button>
              ) : null}
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
