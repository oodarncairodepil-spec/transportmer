import "dotenv/config";

import cors from "cors";
import express from "express";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { generateTempPassword } from "./lib/tempPassword";

import { fetchGoogleDirections } from "./routeFetcher/googleDirections";
import { fetchOsrmFallback } from "./routeFetcher/osrmFallback";
import { scoreRoutes, selectBestRoute } from "./routeSelector";
import type { LatLng } from "./lib/polyline";
import { encodeGooglePolyline } from "./lib/polyline";
import { getSupabaseClient } from "./supabase/client";

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

function getSupabaseUrl() {
  return String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").trim();
}

function getSupabaseAnonKey() {
  return String(process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "").trim();
}

function getSupabaseServiceRoleKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || "";
}

function getBearerToken(req: express.Request) {
  const header = String(req.header("authorization") || "").trim();
  if (!header.toLowerCase().startsWith("bearer ")) {
    return null;
  }
  const token = header.slice("bearer ".length).trim();
  return token.length > 0 ? token : null;
}

async function requireUser(req: express.Request) {
  const url = getSupabaseUrl();
  const anonKey = getSupabaseAnonKey();
  const token = getBearerToken(req);
  if (!token) {
    return { ok: false as const, status: 401 as const, error: "Missing bearer token" };
  }
  if (!url || !anonKey) {
    return { ok: false as const, status: 500 as const, error: "Supabase env not configured" };
  }

  const supabase = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return {
      ok: false as const,
      status: 401 as const,
      error: error?.message ? `Invalid auth token: ${error.message}` : "Invalid auth token",
    };
  }
  return { ok: true as const, user: data.user, token };
}

async function requireAdmin(user: { id: string; app_metadata?: Record<string, unknown> }) {
  const role = String((user.app_metadata as any)?.role || "").trim().toLowerCase();
  if (role === "admin") {
    return { ok: true as const };
  }

  const url = getSupabaseUrl();
  const serviceRole = getSupabaseServiceRoleKey();
  if (!url || !serviceRole) {
    return { ok: false as const, error: "Forbidden" };
  }

  const supabaseAdmin = createClient(url, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await supabaseAdmin.from("staff_profiles").select("role,email,name").eq("user_id", user.id).maybeSingle();
  if (!error) {
    const profileRole = String((data as any)?.role ?? "").trim().toLowerCase();
    if (profileRole === "admin") {
      return { ok: true as const };
    }
  }

  const { count, error: countErr } = await supabaseAdmin
    .from("staff_profiles")
    .select("user_id", { count: "exact", head: true })
    .eq("role", "admin");
  if (!countErr && (count ?? 0) === 0) {
    const email = (user as any).email as string | undefined;
    const name = String(((user as any).user_metadata as any)?.name ?? email ?? "Admin");
    const upsertErr = await supabaseAdmin
      .from("staff_profiles")
      .upsert(
        {
          user_id: user.id,
          email: email ?? `${user.id}@local`,
          name,
          role: "admin",
          must_change_password: false,
          created_by_user_id: user.id,
        },
        { onConflict: "user_id" },
      )
      .then((r) => r.error);
    if (!upsertErr) {
      return { ok: true as const };
    }
  }

  return { ok: false as const, error: "Forbidden" };
}


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

function normalizeTokens(q: string) {
  return q
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3);
}

function rankResultsByQuery(q: string, results: Array<{ label: string; lat: number; lng: number }>) {
  const tokens = normalizeTokens(q);
  if (tokens.length === 0) {
    return results;
  }
  const scored = results
    .map((r) => {
      const label = r.label.toLowerCase();
      const matchCount = tokens.reduce((acc, t) => acc + (label.includes(t) ? 1 : 0), 0);
      const hasStrongToken = tokens.some((t) => (t === "cikarang" || t === "bekasi" || t === "karawang" || t === "cibitung") && label.includes(t));
      return { r, matchCount, hasStrongToken };
    })
    .sort((a, b) =>
      Number(b.hasStrongToken) - Number(a.hasStrongToken) ||
      b.matchCount - a.matchCount ||
      a.r.label.length - b.r.label.length,
    );

  const strong = scored.filter((x) => x.matchCount > 0);
  return (strong.length > 0 ? strong : scored).map((x) => x.r);
}

function uniq(arr: string[]) {
  const out: string[] = [];
  for (const v of arr) {
    if (!v) continue;
    if (!out.includes(v)) out.push(v);
  }
  return out;
}

const truckConfigSchema = z.object({
  maxWeight: z.number().positive().default(15000),
  maxHeight: z.number().positive().default(4.0),
});

const requestSchema = z.object({
  origin: z.object({ lat: z.number(), lng: z.number() }),
  destination: z.object({ lat: z.number(), lng: z.number() }),
  alternatives: z.boolean().optional().default(true),
  minScore: z.number().optional().default(-1),
  truckConfig: truckConfigSchema.optional().default({ maxWeight: 15000, maxHeight: 4.0 }),
  save: z.boolean().optional().default(false),
  title: z.string().optional(),
  stops: z.array(z.object({ lat: z.number(), lng: z.number(), label: z.string().optional() })).optional().default([]),
});

app.post("/api/truck-route", async (req, res) => {
  try {
    const parsed = requestSchema.parse(req.body);
    const googleKey = process.env.GOOGLE_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
    const overpassUrl = process.env.OVERPASS_URL || "https://overpass-api.de/api/interpreter";

    let candidates: Array<{
      routeId: string;
      polyline: string;
      distanceMeters?: number;
      durationSeconds?: number;
      steps?: Array<{ instruction: string; name: string; distanceMeters: number; durationSeconds: number }>;
    }> = [];

    if (googleKey) {
      const googleRoutes = await fetchGoogleDirections({
        origin: parsed.origin as LatLng,
        destination: parsed.destination as LatLng,
        alternatives: parsed.alternatives,
        apiKey: googleKey,
        waypoints: parsed.stops.map((s) => ({ lat: s.lat, lng: s.lng, label: s.label })),
      });
      candidates = googleRoutes.map((r) => ({
        routeId: r.routeId,
        polyline: r.polyline,
        distanceMeters: r.distanceMeters,
        durationSeconds: r.durationSeconds,
        steps: r.steps,
      }));
    } else {
      try {
        const osrmRoutes = await fetchOsrmFallback({
          origin: parsed.origin as LatLng,
          destination: parsed.destination as LatLng,
          waypoints: parsed.stops.map((s) => ({ lat: s.lat, lng: s.lng, label: s.label })),
          alternatives: parsed.alternatives,
        });
        candidates = osrmRoutes.map((r) => ({
          routeId: r.routeId,
          polyline: r.polyline,
          distanceMeters: r.distanceMeters,
          durationSeconds: r.durationSeconds,
          steps: r.steps,
        }));
      } catch {
        const fallbackLine = [parsed.origin, ...parsed.stops.map((s) => ({ lat: s.lat, lng: s.lng })), parsed.destination];
        candidates = [{ routeId: "fallback_direct", polyline: encodeGooglePolyline(fallbackLine) }];
      }
    }

    const scored = await scoreRoutes({
      routes: candidates,
      truck: parsed.truckConfig,
      overpassUrl,
    });

    const sorted = scored.slice().sort((a, b) => b.score - a.score);
    const { best } = selectBestRoute(sorted, parsed.minScore);
    if (!best) {
      return res.status(404).json({ error: "No route options" });
    }

    const routes = sorted.map((r) => ({
      routeId: r.routeId,
      score: r.score,
      isTruckSafe: r.isTruckSafe,
      violations: r.violations,
      polyline: r.polyline,
      distanceMeters: r.distanceMeters,
      durationSeconds: r.durationSeconds,
      steps: r.steps ?? [],
      geometry: r.points,
      segments: r.segments,
    }));

    const response = {
      bestRouteId: best.routeId,
      routes,
    };

    if (parsed.save) {
      const supabase = getSupabaseClient();
      if (!supabase) {
        return res.status(200).json({ ...response, saved: false, saveError: "Supabase env not configured" });
      }

      const routeInsert = {
        title: parsed.title ?? null,
        origin: parsed.origin,
        destination: parsed.destination,
        stops: parsed.stops,
        truck_config: parsed.truckConfig,
      };

      const { data: routeRow, error: routeErr } = await supabase
        .from("map_routes")
        .insert(routeInsert)
        .select("id")
        .single();
      if (routeErr) {
        return res.status(200).json({ ...response, saved: false, saveError: routeErr.message });
      }

      const recoInsert = {
        map_route_id: routeRow.id,
        provider: googleKey ? "google" : "fallback",
        route_id: best.routeId,
        score: best.score,
        is_truck_safe: best.isTruckSafe,
        violations: best.violations,
        polyline: best.polyline,
        geometry: best.points,
        segments: best.segments,
      };

      const { data: recoRow, error: recoErr } = await supabase
        .from("map_route_recommendations")
        .insert(recoInsert)
        .select("id")
        .single();
      if (recoErr) {
        return res.status(200).json({ ...response, saved: false, saveError: recoErr.message, mapRouteId: routeRow.id });
      }

      return res.status(200).json({ ...response, saved: true, mapRouteId: routeRow.id, recommendationId: recoRow.id });
    }

    return res.status(200).json(response);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return res.status(400).json({ error: message });
  }
});

app.get("/api/me", async (req, res) => {
  const auth = await requireUser(req);
  if (!auth.ok) {
    return res.status(auth.status).json({ error: auth.error });
  }

  const url = getSupabaseUrl();
  const anonKey = getSupabaseAnonKey();
  if (!url || !anonKey) {
    return res.status(500).json({ error: "Supabase env not configured" });
  }

  const supabase = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${auth.token}` } },
  });

  const { data, error } = await supabase
    .from("staff_profiles")
    .select("user_id,email,name,phone,title,role,must_change_password,created_at")
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (error) {
    return res.status(200).json({
      user: { id: auth.user.id, email: auth.user.email },
      profile: null,
      profileError: error.message,
    });
  }

  return res.status(200).json({
    user: { id: auth.user.id, email: auth.user.email },
    profile: data,
  });
});

app.post("/api/auth/update-password", async (req, res) => {
  const auth = await requireUser(req);
  if (!auth.ok) {
    return res.status(auth.status).json({ error: auth.error });
  }

  const bodySchema = z.object({ newPassword: z.string().min(8).max(128) });
  let parsed: z.infer<typeof bodySchema>;
  try {
    parsed = bodySchema.parse(req.body);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Invalid request";
    return res.status(400).json({ error: message });
  }

  const url = getSupabaseUrl();
  const serviceRole = getSupabaseServiceRoleKey();
  if (!url || !serviceRole) {
    return res.status(500).json({ error: "Supabase env not configured" });
  }

  const supabaseAdmin = createClient(url, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error: pwErr } = await supabaseAdmin.auth.admin.updateUserById(auth.user.id, { password: parsed.newPassword } as any);
  if (pwErr) {
    return res.status(400).json({ error: pwErr.message });
  }

  const { error: profileErr } = await supabaseAdmin
    .from("staff_profiles")
    .update({ must_change_password: false })
    .eq("user_id", auth.user.id);
  if (profileErr) {
    return res.status(200).json({ ok: true, profileUpdated: false, profileError: profileErr.message });
  }

  return res.status(200).json({ ok: true });
});

app.get("/api/staff", async (req, res) => {
  const auth = await requireUser(req);
  if (!auth.ok) {
    return res.status(auth.status).json({ error: auth.error });
  }

  const admin = await requireAdmin(auth.user);
  if (!admin.ok) {
    return res.status(admin.error === "Forbidden" ? 403 : 500).json({ error: admin.error });
  }

  const url = getSupabaseUrl();
  const serviceRole = getSupabaseServiceRoleKey();
  if (!url || !serviceRole) {
    return res.status(500).json({ error: "Supabase env not configured" });
  }
  const supabaseAdmin = createClient(url, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data, error } = await supabaseAdmin
    .from("staff_profiles")
    .select("user_id,email,name,phone,title,role,must_change_password,created_at")
    .order("created_at", { ascending: false });
  if (error) {
    return res.status(500).json({ error: error.message });
  }
  return res.status(200).json({ staff: data ?? [] });
});

app.post("/api/staff/create", async (req, res) => {
  const auth = await requireUser(req);
  if (!auth.ok) {
    return res.status(auth.status).json({ error: auth.error });
  }

  const admin = await requireAdmin(auth.user);
  if (!admin.ok) {
    return res.status(admin.error === "Forbidden" ? 403 : 500).json({ error: admin.error });
  }

  const bodySchema = z.object({
    email: z.string().email(),
    name: z.string().min(1).max(120),
    role: z.enum(["admin", "staff"]).optional().default("staff"),
    phone: z.string().max(60).optional(),
    title: z.string().max(80).optional(),
  });
  let parsed: z.infer<typeof bodySchema>;
  try {
    parsed = bodySchema.parse(req.body);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Invalid request";
    return res.status(400).json({ error: message });
  }

  const url = getSupabaseUrl();
  const serviceRole = getSupabaseServiceRoleKey();
  if (!url || !serviceRole) {
    return res.status(500).json({ error: "Supabase env not configured" });
  }

  const tempPassword = generateTempPassword();
  const supabaseAdmin = createClient(url, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
    email: parsed.email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { name: parsed.name },
    app_metadata: { role: parsed.role },
  } as any);
  if (createErr || !created.user) {
    return res.status(400).json({ error: createErr?.message || "Failed to create user" });
  }

  const { error: insertErr } = await supabaseAdmin.from("staff_profiles").insert({
    user_id: created.user.id,
    email: parsed.email,
    name: parsed.name,
    phone: parsed.phone ?? null,
    title: parsed.title ?? null,
    role: parsed.role,
    must_change_password: true,
    created_by_user_id: auth.user.id,
  });
  if (insertErr) {
    return res.status(400).json({ error: insertErr.message });
  }

  return res.status(200).json({ userId: created.user.id, tempPassword });
});

app.post("/api/staff/rotate-password", async (req, res) => {
  const auth = await requireUser(req);
  if (!auth.ok) {
    return res.status(auth.status).json({ error: auth.error });
  }

  const admin = await requireAdmin(auth.user);
  if (!admin.ok) {
    return res.status(admin.error === "Forbidden" ? 403 : 500).json({ error: admin.error });
  }

  const bodySchema = z.object({ userId: z.string().min(1) });
  let parsed: z.infer<typeof bodySchema>;
  try {
    parsed = bodySchema.parse(req.body);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Invalid request";
    return res.status(400).json({ error: message });
  }

  const url = getSupabaseUrl();
  const serviceRole = getSupabaseServiceRoleKey();
  if (!url || !serviceRole) {
    return res.status(500).json({ error: "Supabase env not configured" });
  }

  const tempPassword = generateTempPassword();
  const supabaseAdmin = createClient(url, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: profileRow } = await supabaseAdmin.from("staff_profiles").select("role").eq("user_id", parsed.userId).maybeSingle();
  const nextRole = String((profileRow as any)?.role ?? "staff");
  const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(parsed.userId, {
    password: tempPassword,
    app_metadata: { role: nextRole },
  } as any);
  if (updateErr) {
    return res.status(400).json({ error: updateErr.message });
  }

  const { error: profileErr } = await supabaseAdmin
    .from("staff_profiles")
    .update({ must_change_password: true })
    .eq("user_id", parsed.userId);
  if (profileErr) {
    return res.status(400).json({ error: profileErr.message });
  }

  return res.status(200).json({ userId: parsed.userId, tempPassword });
});

app.get("/api/places", async (req, res) => {
  try {
    const q = String(req.query.q ?? "").trim();
    const debug = String(req.query.debug ?? "") === "1";
    if (q.length < 3) {
      return res.status(200).json({ results: [] });
    }

    const googleKey = process.env.GOOGLE_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
    if (!googleKey) {
      const photon = new URL("https://photon.komoot.io/api/");
      photon.searchParams.set("q", q);
      photon.searchParams.set("limit", "6");
      photon.searchParams.set(
        "bbox",
        `${INDONESIA_BBOX.minLng},${INDONESIA_BBOX.minLat},${INDONESIA_BBOX.maxLng},${INDONESIA_BBOX.maxLat}`,
      );
      photon.searchParams.set("lat", "-2.5");
      photon.searchParams.set("lon", "118.0");

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const r = await fetch(photon.toString(), { signal: controller.signal, headers: { Accept: "application/json" } });
      clearTimeout(timeout);
      if (!r.ok) {
        return res.status(200).json({ results: [] });
      }
      const data = (await r.json()) as any;
      const results = (data.features || [])
        .map((f: any) => {
          const [lng, lat] = f.geometry?.coordinates ?? [];
          const props = f.properties ?? {};
          const label = [props.name, props.city, props.state, props.country].filter(Boolean).join(", ") || "Unknown location";
          return { label, lat: Number(lat), lng: Number(lng), country: String(props.country || "") };
        })
        .filter((it: any) => Number.isFinite(it.lat) && Number.isFinite(it.lng))
        .filter((it: any) => isInIndonesia(it.lat, it.lng))
        .filter((it: any) => !it.country || it.country.toLowerCase() === "indonesia")
        .map(({ label, lat, lng }: any) => ({ label, lat, lng }))
        .slice(0, 6);

      if (debug) {
        return res.status(200).json({ results, debug: { provider: "photon", googleKeyPresent: false } });
      }
      return res.status(200).json({ results });
    }

    const baseQuery = /\bindonesia\b/i.test(q) ? q : `${q} Indonesia`;
    const tokens = normalizeTokens(q);
    const wantsWarehouse = tokens.includes("warehouse") || tokens.includes("gudang") || tokens.includes("depot");
    const variants = uniq([
      baseQuery,
      !wantsWarehouse ? `${baseQuery} warehouse` : "",
      !wantsWarehouse ? `${baseQuery} gudang` : "",
    ]);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    const collected: Array<{ label: string; lat: number; lng: number }> = [];
    const add = (items: Array<{ label: string; lat: number; lng: number }>) => {
      for (const it of items) {
        const key = `${it.lat.toFixed(6)},${it.lng.toFixed(6)}`;
        if (!collected.some((x) => `${x.lat.toFixed(6)},${x.lng.toFixed(6)}` === key)) {
          collected.push(it);
        }
      }
    };

    const tryPlaces = async (query: string) => {
      const url = new URL("https://maps.googleapis.com/maps/api/place/textsearch/json");
      url.searchParams.set("query", query);
      url.searchParams.set("key", googleKey);
      url.searchParams.set("region", "id");
      url.searchParams.set("language", "id");
      let r: Response;
      try {
        r = await fetch(url.toString(), { signal: controller.signal });
      } catch (e) {
        return { ok: false, denied: false, status: "FETCH_ERROR", error: e instanceof Error ? e.message : "fetch failed", results: [] as any[] };
      }
      if (!r.ok) return { ok: false, denied: false, status: `HTTP_${r.status}`, error: null as string | null, results: [] as any[] };
      const data = (await r.json()) as any;
      const status = String(data.status || "UNKNOWN");
      const error = data.error_message ? String(data.error_message) : null;
      if (status === "REQUEST_DENIED") return { ok: false, denied: true, status, error, results: [] as any[] };
      if (status !== "OK") return { ok: false, denied: false, status, error, results: [] as any[] };
      const results = (data.results || [])
        .map((it: any) => {
          const loc = it.geometry?.location;
          const lat = Number(loc?.lat);
          const lng = Number(loc?.lng);
          const name = String(it.name || "").trim();
          const address = String(it.formatted_address || "").trim();
          const label = [name, address].filter(Boolean).join(", ") || String(it.place_id || "Unknown");
          return { label, lat, lng };
        })
        .filter((it: any) => Number.isFinite(it.lat) && Number.isFinite(it.lng))
        .filter((it: any) => isInIndonesia(it.lat, it.lng));
      return { ok: true, denied: false, status, error, results };
    };

    const tryGeocode = async (query: string) => {
      const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
      url.searchParams.set("address", query);
      url.searchParams.set("key", googleKey);
      url.searchParams.set("region", "id");
      url.searchParams.set("components", "country:ID");
      url.searchParams.set("language", "id");
      url.searchParams.set(
        "bounds",
        `${INDONESIA_BBOX.minLat},${INDONESIA_BBOX.minLng}|${INDONESIA_BBOX.maxLat},${INDONESIA_BBOX.maxLng}`,
      );
      let r: Response;
      try {
        r = await fetch(url.toString(), { signal: controller.signal });
      } catch {
        return [];
      }
      if (!r.ok) return [];
      const data = (await r.json()) as any;
      return (data.results || [])
        .map((it: any) => {
          const loc = it.geometry?.location;
          const lat = Number(loc?.lat);
          const lng = Number(loc?.lng);
          const label = String(it.formatted_address || it.place_id || "Unknown");
          return { label, lat, lng };
        })
        .filter((it: any) => Number.isFinite(it.lat) && Number.isFinite(it.lng))
        .filter((it: any) => isInIndonesia(it.lat, it.lng));
    };

    let placesDenied = false;
    let lastPlacesStatus: string | null = null;
    let lastPlacesError: string | null = null;
    for (const v of variants) {
      const out = await tryPlaces(v);
      if (out.denied) {
        placesDenied = true;
        lastPlacesStatus = out.status;
        lastPlacesError = out.error;
        break;
      }
      if (out.ok) {
        add(out.results);
        lastPlacesStatus = out.status;
        lastPlacesError = out.error;
        if (collected.length >= 6) break;
      } else {
        lastPlacesStatus = out.status;
        lastPlacesError = out.error;
      }
    }

    if (collected.length < 6) {
      for (const v of variants) {
        add(await tryGeocode(v));
        if (collected.length >= 6) break;
        if (placesDenied) break;
      }
    }

    clearTimeout(timeout);
    const results = rankResultsByQuery(q, collected).slice(0, 6);
    if (debug) {
      return res.status(200).json({
        results,
        debug: {
          provider: googleKey ? "google" : "photon",
          usedPlaces: !placesDenied,
          placesDenied,
          lastPlacesStatus,
          lastPlacesError,
          variants,
        },
      });
    }
    return res.status(200).json({ results });
  } catch (e) {
    const debug = String(req.query.debug ?? "") === "1";
    if (debug) {
      return res.status(200).json({ results: [], debug: { error: e instanceof Error ? e.message : "Unknown error" } });
    }
    return res.status(200).json({ results: [] });
  }
});

if (!process.env.VERCEL) {
  const port = Number(process.env.PORT || 8787);
  app.listen(port, () => {
    process.stdout.write(`API listening on http://localhost:${port}\n`);
    if (!process.env.GOOGLE_MAPS_API_KEY && !process.env.GOOGLE_API_KEY) {
      process.stdout.write("Warning: Google API keys are not set; /api/places and Google routing will be limited.\n");
    }
  });
}

export default app;
