import { useMemo, useState } from "react";

import LocationPicker from "@/components/LocationPicker";
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
import type { LocationInput } from "@/lib/routesStorage";
import type { SavedLocation } from "@/lib/locationsStorage";

type StopKind = "Stop" | "Rest Area" | "Gas Station" | "Warehouse" | "Other";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (stop: { label: string; lat: number; lng: number; source: LocationInput["source"] }) => void;
  locations?: SavedLocation[];
};

export default function AddStopDialog({ open, onOpenChange, onAdd, locations = [] }: Props) {
  const [kind, setKind] = useState<StopKind>("Stop");
  const [customLabel, setCustomLabel] = useState("");
  const [picked, setPicked] = useState<LocationInput | null>(null);

  const finalLabel = useMemo(() => {
    const base = (customLabel || picked?.label || "").trim();
    if (!base) {
      return "";
    }
    if (kind === "Stop") {
      return base;
    }
    return `${kind}: ${base}`;
  }, [customLabel, kind, picked?.label]);

  const canAdd = picked !== null && finalLabel.length > 0;

  const reset = () => {
    setKind("Stop");
    setCustomLabel("");
    setPicked(null);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) {
          reset();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add supporting location</DialogTitle>
          <DialogDescription>Add a stop like a rest area, gas station, or warehouse.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <p className="text-xs font-medium text-foreground">Type</p>
              <Select value={kind} onValueChange={(v) => setKind(v as StopKind)}>
                <SelectTrigger>
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Stop">Stop</SelectItem>
                  <SelectItem value="Rest Area">Rest Area</SelectItem>
                  <SelectItem value="Gas Station">Gas Station</SelectItem>
                  <SelectItem value="Warehouse">Warehouse</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-medium text-foreground">Label override</p>
              <Input value={customLabel} onChange={(e) => setCustomLabel(e.target.value)} placeholder="Optional" />
            </div>
          </div>

          <LocationPicker label="Location" value={picked} onChange={setPicked} locations={locations} />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (!picked) {
                return;
              }
              onAdd({ label: finalLabel, lat: picked.lat, lng: picked.lng, source: picked.source });
              onOpenChange(false);
            }}
            disabled={!canAdd}
          >
            Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
