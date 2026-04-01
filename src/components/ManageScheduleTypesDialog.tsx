import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/sonner";
import { useAuth } from "@/components/AuthProvider";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { upsertScheduleTemplate, type ScheduleTemplate } from "@/lib/scheduleTemplatesStorage";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged?: (templates: ScheduleTemplate[]) => void;
};

type TemplateType = ScheduleTemplate["type"];

export default function ManageScheduleTypesDialog({ open, onOpenChange, onChanged }: Props) {
  const { session, signOut } = useAuth();
  const token = session?.access_token ?? "";
  const [templates, setTemplates] = useState<ScheduleTemplate[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [type, setType] = useState<TemplateType>("shift");
  const [title, setTitle] = useState("");
  const [start, setStart] = useState("06:00");
  const [end, setEnd] = useState("18:00");
  const [saving, setSaving] = useState(false);

  const sortedTemplates = useMemo(() => {
    return templates
      .slice()
      .sort((a, b) => {
        if (a.type !== b.type) {
          return a.type.localeCompare(b.type);
        }
        return a.title.localeCompare(b.title);
      });
  }, [templates]);

  const canSave = title.trim().length > 0 && (type === "leave" || (start.trim().length > 0 && end.trim().length > 0));

  const resetForm = () => {
    setEditingId(null);
    setType("shift");
    setTitle("");
    setStart("06:00");
    setEnd("18:00");
  };

  useEffect(() => {
    if (!open) {
      return;
    }
    if (!token) {
      setTemplates([]);
      resetForm();
      return;
    }
    const supabase = getSupabaseClient();
    if (!supabase) {
      setTemplates([]);
      resetForm();
      return;
    }
    supabase
      .from("schedule_templates")
      .select("id,type,title,start_time,end_time,created_at")
      .order("type", { ascending: true })
      .order("title", { ascending: true })
      .then(({ data, error }) => {
        if (error) {
          toast.error("Failed to load schedule types", { description: error.message });
          setTemplates([]);
          resetForm();
          return;
        }
        const mapped: ScheduleTemplate[] = (data ?? []).map((r: any) => ({
          id: String(r.id),
          type: r.type === "leave" ? "leave" : "shift",
          title: String(r.title ?? ""),
          start: String(r.start_time ?? ""),
          end: String(r.end_time ?? ""),
        }));
        setTemplates(mapped);
        onChanged?.(mapped);
        resetForm();
      });
    resetForm();
  }, [open]);

  const save = async () => {
    if (!canSave) {
      return;
    }
    if (!token) {
      toast.error("Please sign in first");
      return;
    }
    const supabase = getSupabaseClient();
    if (!supabase) {
      toast.error("Supabase client not configured");
      return;
    }

    setSaving(true);
    const next = upsertScheduleTemplate(templates, {
      id: editingId ?? undefined,
      type,
      title: title.trim(),
      start: type === "leave" ? "" : start,
      end: type === "leave" ? "" : end,
    });

    const payloadBase: any = {
      type,
      title: title.trim(),
      start_time: type === "leave" ? null : start,
      end_time: type === "leave" ? null : end,
    };

    try {
      if (editingId) {
        const { error } = await supabase.from("schedule_templates").update(payloadBase).eq("id", editingId);
        if (error) {
          toast.error("Failed to save schedule type", { description: error.message });
          return;
        }
      } else {
        const first = await supabase.from("schedule_templates").insert(payloadBase).select("id").single();
        if (first.error) {
          const msg = String(first.error.message ?? "").toLowerCase();
          if (msg.includes("user_id") && msg.includes("null value")) {
            const second = await supabase
              .from("schedule_templates")
              .insert({ ...payloadBase, user_id: session?.user?.id } as any)
              .select("id")
              .single();
            if (second.error) {
              toast.error("Failed to save schedule type", { description: second.error.message });
              return;
            }
          } else if (msg.includes("jwt") || msg.includes("permission")) {
            await signOut();
            return;
          } else {
            toast.error("Failed to save schedule type", { description: first.error.message });
            return;
          }
        }
      }

      setTemplates(next);
      onChanged?.(next);
      resetForm();
      toast.success(editingId ? "Schedule type updated" : "Schedule type created");
    } finally {
      setSaving(false);
    }
  };

  const deleteTemplate = async (id: string) => {
    if (!token) {
      toast.error("Please sign in first");
      return;
    }
    const supabase = getSupabaseClient();
    if (!supabase) {
      toast.error("Supabase client not configured");
      return;
    }
    const { error } = await supabase.from("schedule_templates").delete().eq("id", id);
    if (error) {
      toast.error("Failed to delete schedule type", { description: error.message });
      return;
    }
    const next = templates.filter((t) => t.id !== id);
    setTemplates(next);
    onChanged?.(next);
    if (editingId === id) {
      resetForm();
    }
  };

  const beginEdit = (t: ScheduleTemplate) => {
    setEditingId(t.id);
    setType(t.type);
    setTitle(t.title);
    setStart(t.start || "06:00");
    setEnd(t.end || "18:00");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Manage schedule types</DialogTitle>
          <DialogDescription>Create, edit, or delete schedule templates (shifts and leave types).</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-card p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">Type</p>
                <Select value={type} onValueChange={(v) => setType(v as TemplateType)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="shift">Shift</SelectItem>
                    <SelectItem value="leave">Leave</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">Name</p>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Morning Shift" />
              </div>
            </div>

            {type !== "leave" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">Start</p>
                  <Input
                    type="time"
                    value={start}
                    onChange={(e) => setStart(e.target.value)}
                    onClick={(e) => {
                      if ("showPicker" in HTMLInputElement.prototype) {
                        (e.target as HTMLInputElement).showPicker();
                      }
                    }}
                    onFocus={(e) => {
                      if ("showPicker" in HTMLInputElement.prototype) {
                        (e.target as HTMLInputElement).showPicker();
                      }
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">End</p>
                  <Input
                    type="time"
                    value={end}
                    onChange={(e) => setEnd(e.target.value)}
                    onClick={(e) => {
                      if ("showPicker" in HTMLInputElement.prototype) {
                        (e.target as HTMLInputElement).showPicker();
                      }
                    }}
                    onFocus={(e) => {
                      if ("showPicker" in HTMLInputElement.prototype) {
                        (e.target as HTMLInputElement).showPicker();
                      }
                    }}
                  />
                </div>
              </div>
            ) : null}

            <div className="flex items-center justify-between">
              <Button type="button" variant="outline" onClick={resetForm}>
                Clear
              </Button>
              <Button type="button" onClick={save} disabled={!canSave || saving}>
                {editingId ? "Save changes" : "Create type"}
              </Button>
            </div>
          </div>

          <div className="rounded-lg border border-border overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">Templates</p>
              <span className="text-xs text-muted-foreground">{sortedTemplates.length}</span>
            </div>

            <div className="max-h-[320px] overflow-y-auto">
              {sortedTemplates.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground text-sm">No templates yet</div>
              ) : (
                <div className="divide-y divide-border/50">
                  {sortedTemplates.map((t) => (
                    <div key={t.id} className="p-3 px-4 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {t.title}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {t.type === "leave" ? "Leave" : `Shift • ${t.start}-${t.end}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button type="button" size="sm" variant="outline" onClick={() => beginEdit(t)}>
                          Edit
                        </Button>
                        <Button type="button" size="sm" variant="destructive" onClick={() => deleteTemplate(t.id)}>
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
