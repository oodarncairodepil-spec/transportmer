import { describe, expect, it } from "vitest";

import { parseLatLngFromGoogleMapsLink } from "@/lib/googleMapsLatLng";

describe("parseLatLngFromGoogleMapsLink", () => {
  it("parses @lat,lng form", () => {
    const v = parseLatLngFromGoogleMapsLink("https://www.google.com/maps/@-6.2088,106.8456,12z");
    expect(v).toEqual({ lat: -6.2088, lng: 106.8456 });
  });

  it("parses !3d!4d form", () => {
    const v = parseLatLngFromGoogleMapsLink("https://www.google.com/maps/place/X/!3d-7.2575!4d112.7521");
    expect(v).toEqual({ lat: -7.2575, lng: 112.7521 });
  });

  it("parses q=lat,lng form", () => {
    const v = parseLatLngFromGoogleMapsLink("https://www.google.com/maps?q=-8.65,115.2167");
    expect(v).toEqual({ lat: -8.65, lng: 115.2167 });
  });

  it("parses plain lat,lng", () => {
    const v = parseLatLngFromGoogleMapsLink("-6.9175, 107.6191");
    expect(v).toEqual({ lat: -6.9175, lng: 107.6191 });
  });

  it("returns null for invalid or missing", () => {
    expect(parseLatLngFromGoogleMapsLink("")).toBeNull();
    expect(parseLatLngFromGoogleMapsLink("hello world")).toBeNull();
    expect(parseLatLngFromGoogleMapsLink("@-999,999")).toBeNull();
  });
});

