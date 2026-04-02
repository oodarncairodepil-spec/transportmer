import { MapContainer, Marker, Polyline, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import { useEffect, useMemo } from "react";

type LatLng = { lat: number; lng: number };

type Props = {
  origin: LatLng;
  destination: LatLng;
  stops?: LatLng[];
  line: LatLng[];
};

const markerIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

function haversineMeters(a: LatLng, b: LatLng) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const s =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

function sanitizeLine(origin: LatLng, destination: LatLng, line: LatLng[]) {
  const maxDistance = 5_000_000;
  return (line ?? [])
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
    .filter((p) => Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180)
    .filter((p) => {
      const d1 = haversineMeters(origin, p);
      const d2 = haversineMeters(destination, p);
      return Math.min(d1, d2) <= maxDistance;
    });
}

function FitBounds({ origin, destination, line, stops }: Props) {
  const map = useMap();

  const bounds = useMemo(() => {
    const points = [origin, destination, ...(stops ?? []), ...line].map((p) => [p.lat, p.lng] as [number, number]);
    return L.latLngBounds(points);
  }, [destination, line, origin, stops]);

  useEffect(() => {
    if (!bounds.isValid()) {
      return;
    }
    map.fitBounds(bounds, { padding: [16, 16] });
  }, [bounds, map]);

  return null;
}

export default function RouteMap({ origin, destination, stops, line }: Props) {
  const center: [number, number] = [origin.lat, origin.lng];
  const safeLine = useMemo(() => sanitizeLine(origin, destination, line), [destination, line, origin]);
  const polyline: [number, number][] = safeLine.map((p) => [p.lat, p.lng]);

  return (
    <div className="h-[520px] w-full rounded-xl overflow-hidden border border-border">
      <MapContainer center={center} zoom={10} scrollWheelZoom className="h-full w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={[origin.lat, origin.lng]} icon={markerIcon} />
        {(stops ?? []).map((s, idx) => (
          <Marker key={`${s.lat}_${s.lng}_${idx}`} position={[s.lat, s.lng]} icon={markerIcon} />
        ))}
        <Marker position={[destination.lat, destination.lng]} icon={markerIcon} />
        {polyline.length > 1 ? <Polyline positions={polyline} pathOptions={{ color: "#0ea5e9", weight: 5 }} /> : null}
        <FitBounds origin={origin} destination={destination} stops={stops} line={safeLine} />
      </MapContainer>
    </div>
  );
}
