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
import type { LocationKind, SavedLocation } from "@/lib/locationsStorage";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (location: { kind: LocationKind; label: string; lat: number; lng: number; source: SavedLocation["source"] }) => void;
  locations?: SavedLocation[];
};

export default function CreateLocationDialog({ open, onOpenChange, onCreate, locations = [] }: Props) {
  const [kind, setKind] = useState<LocationKind>("Warehouse");
  const [labelOverride, setLabelOverride] = useState("");
  const [picked, setPicked] = useState<LocationInput | null>(null);

  const finalLabel = useMemo(() => {
    const base = (labelOverride || picked?.label || "").trim();
    return base;
  }, [labelOverride, picked?.label]);

  const canCreate = !!picked && finalLabel.length > 0;

  const reset = () => {
    setKind("Warehouse");
    setLabelOverride("");
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
          <DialogTitle>New location</DialogTitle>
          <DialogDescription>Create a reusable location and then use it in routes.</DialogDescription>
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
              <p className="text-xs font-medium text-foreground">Label override</p>
              <Input value={labelOverride} onChange={(e) => setLabelOverride(e.target.value)} placeholder="Optional" />
            </div>
          </div>

          <LocationPicker label="Location" value={picked} onChange={setPicked} locations={locations} showExisting />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (!picked || !canCreate) {
                return;
              }
              onCreate({ kind, label: finalLabel, lat: picked.lat, lng: picked.lng, source: picked.source });
              onOpenChange(false);
            }}
            disabled={!canCreate}
          >
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
