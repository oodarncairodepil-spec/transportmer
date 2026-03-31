import type { LatLng } from "@/lib/routesStorage";

const LAT_LNG_PATTERN = "(-?\\d+(?:\\.\\d+)?)\\s*,\\s*(-?\\d+(?:\\.\\d+)?)";

export function isValidLatLng(lat: number, lng: number) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return false;
  }
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

export function parseLatLngFromGoogleMapsLink(input: string): LatLng | null {
  const text = input.trim();
  if (!text) {
    return null;
  }

  const plain = new RegExp(`^${LAT_LNG_PATTERN}$`).exec(text);
  if (plain) {
    const lat = Number(plain[1]);
    const lng = Number(plain[2]);
    if (isValidLatLng(lat, lng)) {
      return { lat, lng };
    }
  }

  const patterns: RegExp[] = [
    new RegExp(`@${LAT_LNG_PATTERN}`),
    new RegExp(`!3d(-?\\d+(?:\\.\\d+)?)!4d(-?\\d+(?:\\.\\d+)?)`),
    new RegExp(`[?&](?:q|query|ll)=${LAT_LNG_PATTERN}`),
    new RegExp(`/${LAT_LNG_PATTERN}(?:/|\b)`),
  ];

  for (const re of patterns) {
    const m = re.exec(text);
    if (!m) {
      continue;
    }

    const lat = Number(m[1]);
    const lng = Number(m[2]);
    if (isValidLatLng(lat, lng)) {
      return { lat, lng };
    }
  }

  return null;
}
