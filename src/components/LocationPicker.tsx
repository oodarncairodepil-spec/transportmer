import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { parseLatLngFromGoogleMapsLink } from "@/lib/googleMapsLatLng";
import { searchPlaces } from "@/lib/geocoding";
import type { SavedLocation } from "@/lib/locationsStorage";
import type { LocationInput } from "@/lib/routesStorage";

type Props = {
  label: string;
  value: LocationInput | null;
  onChange: (next: LocationInput | null) => void;
  locations?: SavedLocation[];
  showExisting?: boolean;
};

export default function LocationPicker({ label, value, onChange, locations = [], showExisting = true }: Props) {
  const canShowExisting = showExisting;
  const [tab, setTab] = useState<"existing" | "google_search" | "google_link">(canShowExisting ? "existing" : "google_search");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<Array<{ label: string; lat: number; lng: number }>>([]);

  const [existingQuery, setExistingQuery] = useState("");
  const [existingOpen, setExistingOpen] = useState(false);

  const [googleLink, setGoogleLink] = useState("");
  const [googleLabel, setGoogleLabel] = useState(value?.label ?? "");
  const [googleLat, setGoogleLat] = useState<number | null>(value?.lat ?? null);
  const [googleLng, setGoogleLng] = useState<number | null>(value?.lng ?? null);
  const [googleError, setGoogleError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const existingBlurTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (!canShowExisting && tab === "existing") {
      setTab("google_search");
    }
  }, [canShowExisting, tab]);

  useEffect(() => {
    if (tab !== "existing") {
      setExistingOpen(false);
    }
  }, [tab]);

  useEffect(() => {
    setGoogleLabel(value?.label ?? "");
    setGoogleLat(value?.lat ?? null);
    setGoogleLng(value?.lng ?? null);
  }, [value?.label, value?.lat, value?.lng]);

  const canUseGoogle = useMemo(() => {
    return googleLat !== null && googleLng !== null && googleLabel.trim().length > 0;
  }, [googleLabel, googleLat, googleLng]);

  useEffect(() => {
    const q = searchQuery.trim();
    if (tab !== "google_search") {
      return;
    }
    if (q.length < 3) {
      setSearchResults([]);
      setSearchError(null);
      setSearchLoading(false);
      abortRef.current?.abort();
      abortRef.current = null;
      return;
    }

    setSearchLoading(true);
    setSearchError(null);
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const t = window.setTimeout(async () => {
      try {
        const results = await searchPlaces(q, controller.signal);
        setSearchResults(results);
      } catch (e) {
        if (controller.signal.aborted) {
          return;
        }
        setSearchResults([]);
        setSearchError(e instanceof Error ? e.message : "Search failed");
      } finally {
        if (!controller.signal.aborted) {
          setSearchLoading(false);
        }
      }
    }, 350);

    return () => {
      window.clearTimeout(t);
      controller.abort();
    };
  }, [searchQuery, tab]);

  const applySearchResult = (r: { label: string; lat: number; lng: number }) => {
    setSearchQuery(r.label);
    setSearchResults([]);
    onChange({ label: r.label, lat: r.lat, lng: r.lng, source: "search" });
  };

  const filteredExisting = useMemo(() => {
    if (!canShowExisting) {
      return [];
    }
    const q = existingQuery.trim().toLowerCase();
    const base = locations
      .slice()
      .sort((a, b) => a.label.localeCompare(b.label));
    if (!q) {
      return base;
    }
    return base.filter((l) => {
      const haystack = `${l.kind} ${l.label}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [existingQuery, canShowExisting, locations]);

  const applyExisting = (l: SavedLocation) => {
    onChange({ label: l.label, lat: l.lat, lng: l.lng, source: "library", locationId: l.id });
  };

  const extractFromGoogle = () => {
    const latLng = parseLatLngFromGoogleMapsLink(googleLink);
    if (!latLng) {
      setGoogleError("Couldn’t find coordinates in the link.");
      setGoogleLat(null);
      setGoogleLng(null);
      return;
    }
    setGoogleError(null);
    setGoogleLat(latLng.lat);
    setGoogleLng(latLng.lng);
  };

  const applyGoogle = () => {
    if (!canUseGoogle || googleLat === null || googleLng === null) {
      return;
    }
    onChange({ label: googleLabel.trim(), lat: googleLat, lng: googleLng, source: "google_link" });
  };

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-foreground">{label}</p>
          <p className="text-xs text-muted-foreground">Search a place or paste a Google Maps link.</p>
        </div>
        {value ? (
          <Button variant="outline" size="sm" onClick={() => onChange(null)}>
            Clear
          </Button>
        ) : null}
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as "existing" | "google_search" | "google_link")}>
        <TabsList className="w-full">
          {canShowExisting ? (
            <TabsTrigger value="existing" className="flex-1">
              Existing
            </TabsTrigger>
          ) : null}
          <TabsTrigger value="google_search" className="flex-1">
            Google search
          </TabsTrigger>
          <TabsTrigger value="google_link" className="flex-1">
            Google link
          </TabsTrigger>
        </TabsList>

        {canShowExisting ? (
          <TabsContent value="existing" className="space-y-2">
            <Input
              value={existingQuery}
              onChange={(e) => setExistingQuery(e.target.value)}
              onFocus={() => {
                if (existingBlurTimeoutRef.current !== null) {
                  window.clearTimeout(existingBlurTimeoutRef.current);
                  existingBlurTimeoutRef.current = null;
                }
                setExistingOpen(true);
              }}
              onBlur={() => {
                if (existingBlurTimeoutRef.current !== null) {
                  window.clearTimeout(existingBlurTimeoutRef.current);
                }
                existingBlurTimeoutRef.current = window.setTimeout(() => {
                  setExistingOpen(false);
                  existingBlurTimeoutRef.current = null;
                }, 150);
              }}
              placeholder="Search saved locations"
            />

            {existingOpen ? (
              filteredExisting.length === 0 ? (
                <p className="text-xs text-muted-foreground">No saved locations.</p>
              ) : (
                <div className="space-y-2">
                  {filteredExisting.map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => applyExisting(l)}
                      className={cn(
                        "w-full text-left bg-background border border-border rounded-lg p-3 hover:bg-muted/30 transition-colors",
                        value?.source === "library" && value.locationId === l.id && "border-primary/50",
                      )}
                    >
                      <p className="text-xs font-medium text-foreground line-clamp-2">{l.label}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {l.kind} • {l.lat.toFixed(6)}, {l.lng.toFixed(6)}
                      </p>
                    </button>
                  ))}
                </div>
              )
            ) : null}
          </TabsContent>
        ) : null}

        <TabsContent value="google_search" className="space-y-2">
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Type a location name (min 3 chars)"
          />

          {value?.source === "search" && searchQuery.trim().toLowerCase() === value.label.trim().toLowerCase() ? null : (
            <div className="space-y-2">
              {searchLoading ? <p className="text-xs text-muted-foreground">Searching…</p> : null}
              {searchError ? <p className="text-xs text-destructive">{searchError}</p> : null}
              {!searchLoading && !searchError && searchQuery.trim().length >= 3 && searchResults.length === 0 ? (
                <p className="text-xs text-muted-foreground">No results.</p>
              ) : null}

              <div className="space-y-2">
                {searchResults.map((r) => (
                  <button
                    key={`${r.lat},${r.lng}`}
                    type="button"
                    onClick={() => applySearchResult(r)}
                    className={cn(
                      "w-full text-left bg-background border border-border rounded-lg p-3 hover:bg-muted/30 transition-colors",
                      value?.source === "search" && value.lat === r.lat && value.lng === r.lng && "border-primary/50",
                    )}
                  >
                    <p className="text-xs font-medium text-foreground line-clamp-2">{r.label}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {r.lat.toFixed(6)}, {r.lng.toFixed(6)}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="google_link" className="space-y-2">
          <Input
            value={googleLink}
            onChange={(e) => setGoogleLink(e.target.value)}
            placeholder="Paste Google Maps link or 'lat,lng'"
          />
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={extractFromGoogle}>
              Extract coordinates
            </Button>
            <p className="text-[10px] text-muted-foreground">Supports @lat,lng, !3d!4d, q=lat,lng.</p>
          </div>
          {googleError ? <p className="text-xs text-destructive">{googleError}</p> : null}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Input value={googleLabel} onChange={(e) => setGoogleLabel(e.target.value)} placeholder="Location label" />
            <div className="grid grid-cols-2 gap-2">
              <Input value={googleLat === null ? "" : String(googleLat)} readOnly placeholder="Lat" />
              <Input value={googleLng === null ? "" : String(googleLng)} readOnly placeholder="Lng" />
            </div>
          </div>

          <div className="flex items-center justify-end">
            <Button type="button" onClick={applyGoogle} disabled={!canUseGoogle}>
              Use this location
            </Button>
          </div>
        </TabsContent>
      </Tabs>

      {value ? (
        <div className="bg-muted/30 border border-border rounded-lg p-3">
          <p className="text-xs font-medium text-foreground">Selected</p>
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{value.label}</p>
          <p className="text-[10px] text-muted-foreground mt-1">
            {value.lat.toFixed(6)}, {value.lng.toFixed(6)} • {value.source}
          </p>
        </div>
      ) : null}
    </div>
  );
}
