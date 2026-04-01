import { useEffect, useMemo, useState } from "react";

import LocationPicker from "@/components/LocationPicker";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import type { LocationInput } from "@/lib/routesStorage";
import type { LocationKind, SavedLocation } from "@/lib/locationsStorage";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: SavedLocation | null;
  locations?: SavedLocation[];
  onSave: (location: SavedLocation) => Promise<void>;
  onDelete: (location: SavedLocation) => Promise<void>;
};

export default function EditLocationDialog({ open, onOpenChange, initial, locations = [], onSave, onDelete }: Props) {
  const [kind, setKind] = useState<LocationKind>(initial?.kind ?? "Other");
  const [labelOverride, setLabelOverride] = useState(initial?.label ?? "");
  const [picked, setPicked] = useState<LocationInput | null>(() => {
    if (!initial) return null;
    return {
      label: initial.label,
      lat: initial.lat,
      lng: initial.lng,
      source: initial.source,
      locationId: initial.id,
    };
  });
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }
    if (!initial) {
      setKind("Other");
      setLabelOverride("");
      setPicked(null);
      return;
    }
    setKind(initial.kind);
    setLabelOverride(initial.label);
    setPicked({
      label: initial.label,
      lat: initial.lat,
      lng: initial.lng,
      source: initial.source,
      locationId: initial.id,
    });
  }, [initial, open]);

  const finalLabel = useMemo(() => {
    const base = (labelOverride || picked?.label || "").trim();
    return base;
  }, [labelOverride, picked?.label]);

  const canSave = !!initial && !!picked && finalLabel.length > 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit location</DialogTitle>
          <DialogDescription>Update this saved location.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <p className="text-xs font-medium text-foreground">Type</p>
              <Select value={kind} onValueChange={(v) => setKind(v as LocationKind)}>
                <SelectTrigger>
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Warehouse">Warehouse</SelectItem>
                  <SelectItem value="Rest Area">Rest Area</SelectItem>
                  <SelectItem value="Gas Station">Gas Station</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-medium text-foreground">Label</p>
              <Input value={labelOverride} onChange={(e) => setLabelOverride(e.target.value)} />
            </div>
          </div>

          <LocationPicker label="Location" value={picked} onChange={setPicked} locations={locations} showExisting />
        </div>

        <DialogFooter>
          {initial ? (
            <Button
              type="button"
              variant="destructive"
              disabled={saving || deleting}
              onClick={() => {
                setDeleteOpen(true);
              }}
            >
              Delete
            </Button>
          ) : null}
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button
            disabled={!canSave || saving}
            onClick={async () => {
              if (!initial || !picked) {
                return;
              }
              setSaving(true);
              try {
                const next: SavedLocation = {
                  ...initial,
                  kind,
                  label: finalLabel,
                  lat: picked.lat,
                  lng: picked.lng,
                  source: picked.source as any,
                  updatedAt: new Date().toISOString(),
                };
                await onSave(next);
                onOpenChange(false);
              } catch (e) {
                const msg = e instanceof Error ? e.message : "Failed to save location";
                toast.error("Failed to save location", { description: msg });
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete location?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={!initial || deleting}
              onClick={async () => {
                if (!initial) {
                  return;
                }
                setDeleting(true);
                try {
                  await onDelete(initial);
                  setDeleteOpen(false);
                  onOpenChange(false);
                } catch (e) {
                  const msg = e instanceof Error ? e.message : "Failed to delete location";
                  toast.error("Failed to delete location", { description: msg });
                } finally {
                  setDeleting(false);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
