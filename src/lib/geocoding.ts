export type GeocodeResult = {
  label: string;
  lat: number;
  lng: number;
};

const INDONESIA_BBOX = {
  minLng: 95.0,
  minLat: -11.5,
  maxLng: 141.5,
  maxLat: 6.5,
};

function isInIndonesia(lat: number, lng: number) {
  return (
    lat >= INDONESIA_BBOX.minLat &&
    lat <= INDONESIA_BBOX.maxLat &&
    lng >= INDONESIA_BBOX.minLng &&
    lng <= INDONESIA_BBOX.maxLng
  );
}

export async function searchPlaces(query: string, signal?: AbortSignal): Promise<GeocodeResult[]> {
  const q = query.trim();
  if (!q) {
    return [];
  }

  try {
    const apiUrl = new URL("/api/places", window.location.origin);
    apiUrl.searchParams.set("q", q);
    const apiRes = await fetch(apiUrl.toString(), {
      method: "GET",
      signal,
      headers: { Accept: "application/json" },
    });
    if (apiRes.ok) {
      const data = (await apiRes.json()) as { results?: Array<{ label: string; lat: number; lng: number }> };
      const results = (data.results ?? []).filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lng));
      if (results.length > 0) {
        return results.slice(0, 6);
      }
    }
  } catch {
    // fall back to Photon
  }

  const url = new URL("https://photon.komoot.io/api/");
  url.searchParams.set("q", q);
  url.searchParams.set("limit", "6");
  url.searchParams.set(
    "bbox",
    `${INDONESIA_BBOX.minLng},${INDONESIA_BBOX.minLat},${INDONESIA_BBOX.maxLng},${INDONESIA_BBOX.maxLat}`,
  );
  url.searchParams.set("lat", "-2.5");
  url.searchParams.set("lon", "118.0");

  const res = await fetch(url.toString(), {
    method: "GET",
    signal,
    headers: {
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(`Geocoding request failed: ${res.status}`);
  }

  const json = (await res.json()) as {
    features: Array<{
      geometry: { coordinates: [number, number] };
      properties: {
        name?: string;
        city?: string;
        state?: string;
        country?: string;
        osm_key?: string;
      };
    }>;
  };

  return (json.features ?? [])
    .map((f) => {
      const [lng, lat] = f.geometry.coordinates;
      const parts = [f.properties.name, f.properties.city, f.properties.state, f.properties.country].filter(Boolean);
      const label = parts.join(", ") || "Unknown location";
      return { label, lat, lng, country: f.properties.country };
    })
    .filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lng))
    .filter((r) => isInIndonesia(r.lat, r.lng))
    .filter((r) => {
      if (!r.country) {
        return true;
      }
      return r.country.toLowerCase() === "indonesia";
    })
    .map(({ label, lat, lng }) => ({ label, lat, lng }));
}
