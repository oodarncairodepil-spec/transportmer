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
import { loadScheduleTemplates, saveScheduleTemplates, upsertScheduleTemplate, type ScheduleTemplate } from "@/lib/scheduleTemplatesStorage";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type TemplateType = ScheduleTemplate["type"];

export default function ManageScheduleTypesDialog({ open, onOpenChange }: Props) {
  const [templates, setTemplates] = useState<ScheduleTemplate[]>(() => loadScheduleTemplates());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [type, setType] = useState<TemplateType>("shift");
  const [title, setTitle] = useState("");
  const [start, setStart] = useState("06:00");
  const [end, setEnd] = useState("18:00");

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
    setTemplates(loadScheduleTemplates());
    resetForm();
  }, [open]);

  const save = () => {
    if (!canSave) {
      return;
    }
    const next = upsertScheduleTemplate(templates, {
      id: editingId ?? undefined,
      type,
      title: title.trim(),
      start: type === "leave" ? "" : start,
      end: type === "leave" ? "" : end,
    });
    setTemplates(next);
    saveScheduleTemplates(next);
    resetForm();
  };

  const deleteTemplate = (id: string) => {
    const next = templates.filter((t) => t.id !== id);
    setTemplates(next);
    saveScheduleTemplates(next);
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
              <Button type="button" onClick={save} disabled={!canSave}>
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
