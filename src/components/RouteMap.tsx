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
  const polyline: [number, number][] = line.map((p) => [p.lat, p.lng]);

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
        <FitBounds origin={origin} destination={destination} stops={stops} line={line} />
      </MapContainer>
    </div>
  );
}
