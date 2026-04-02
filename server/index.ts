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
import { TruckRoutingService } from "./routing/TruckRoutingService";

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

const vehicleSchema = z.object({
  height: z.number().positive().optional(),
  width: z.number().positive().optional(),
  length: z.number().positive().optional(),
  weight: z.number().positive().optional(),
  axleCount: z.number().int().positive().optional(),
  trailerCount: z.number().int().nonnegative().optional(),
  engineType: z.string().optional(),
  category: z.string().optional(),
});

const avoidSchema = z.object({
  features: z.array(z.string()).optional(),
  truckRoadTypes: z.array(z.string()).optional(),
  areas: z.array(z.string()).optional(),
});

const requestSchema = z.object({
  origin: z.object({ lat: z.number(), lng: z.number() }),
  destination: z.object({ lat: z.number(), lng: z.number() }),
  alternatives: z.boolean().optional().default(true),
  minScore: z.number().optional().default(-1),
  truckConfig: truckConfigSchema.optional().default({ maxWeight: 15000, maxHeight: 4.0 }),
  vehicle: vehicleSchema.optional(),
  routingSource: z.enum(["gmaps_osm", "here_osm", "here"]).optional().default("gmaps_osm"),
  routingMode: z.enum(["fast", "short"]).optional(),
  departureTime: z.string().optional(),
  traffic: z.boolean().optional(),
  units: z.enum(["metric", "imperial"]).optional(),
  lang: z.string().optional(),
  avoid: avoidSchema.optional(),
  networkRestrictedTruck: z.boolean().optional(),
  permittedNetworks: z.array(z.string()).optional(),
  fallback: z.enum(["none", "gmaps_osm", "osm"]).optional(),
  save: z.boolean().optional().default(false),
  title: z.string().optional(),
  stops: z.array(z.object({ lat: z.number(), lng: z.number(), label: z.string().optional() })).optional().default([]),
});

app.post("/api/truck-route", async (req, res) => {
  try {
    const parsed = requestSchema.parse(req.body);
    const googleKey = process.env.GOOGLE_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
    const overpassUrl = process.env.OVERPASS_URL || "https://overpass-api.de/api/interpreter";

    const source = parsed.routingSource;
    const vehicle = {
      height: parsed.vehicle?.height ?? parsed.truckConfig.maxHeight,
      width: parsed.vehicle?.width,
      length: parsed.vehicle?.length,
      weight: parsed.vehicle?.weight ?? parsed.truckConfig.maxWeight,
      axleCount: parsed.vehicle?.axleCount,
      trailerCount: parsed.vehicle?.trailerCount,
      engineType: parsed.vehicle?.engineType,
      category: parsed.vehicle?.category,
    };

    let response: { bestRouteId: string; routes: any[] };

    if (source === "gmaps_osm") {
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
        provider: "gmaps_osm",
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
        sections: [
          {
            summary: {
              travelTime: Number(r.durationSeconds ?? 0),
              length: Number(r.distanceMeters ?? 0),
            },
          },
        ],
      }));

      response = {
        bestRouteId: best.routeId,
        routes,
      };
    } else {
      const service = new TruckRoutingService();
      const result = await service.calculate_route(
        parsed.origin,
        parsed.destination,
        vehicle,
        {
          source,
          alternatives: parsed.alternatives,
          minScore: parsed.minScore,
          via: parsed.stops.map((s) => ({ lat: s.lat, lng: s.lng })),
          routingMode: parsed.routingMode,
          departureTime: parsed.departureTime,
          traffic: parsed.traffic,
          units: parsed.units,
          lang: parsed.lang,
          avoid: parsed.avoid,
          networkRestrictedTruck: parsed.networkRestrictedTruck,
          permittedNetworks: parsed.permittedNetworks,
          fallback: parsed.fallback,
        },
      );

      response = {
        bestRouteId: result.bestRouteId,
        routes: result.routes,
      };
    }

    if (parsed.save) {
      const auth = await requireUser(req);
      if (!auth.ok) {
        return res.status(200).json({ ...response, saved: false, saveError: auth.error });
      }

      const url = getSupabaseUrl();
      const serviceRole = getSupabaseServiceRoleKey();
      if (!url || !serviceRole) {
        return res.status(200).json({ ...response, saved: false, saveError: "Supabase env not configured" });
      }

      const supabase = createClient(url, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } });

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

      const best = response.routes.find((r) => r.routeId === response.bestRouteId) ?? response.routes[0];
      const recoInsert = {
        map_route_id: routeRow.id,
        provider: source,
        route_id: best.routeId,
        score: best.score ?? 0,
        is_truck_safe: best.isTruckSafe ?? false,
        violations: best.violations ?? [],
        polyline: best.polyline,
        geometry: best.geometry ?? [],
        segments: best.segments ?? [],
      };

      const { data: recoRow, error: recoErr } = await supabase
        .from("map_route_recommendations")
        .insert(recoInsert)
        .select("id")
        .single();
      if (recoErr) {
        return res.status(200).json({ ...response, saved: false, saveError: recoErr.message, mapRouteId: routeRow.id });
      }

      if (best.segments && best.segments.length > 0) {
        const segmentsInsert = best.segments.map((seg: any) => ({
          map_route_recommendation_id: recoRow.id,
          highway: seg.highway ?? null,
          maxspeed: seg.maxspeed ?? null,
          lanes: seg.lanes ?? null,
          maxweight: seg.maxweight ?? null,
          maxheight: seg.maxheight ?? null,
          way: seg.osmWayId ? String(seg.osmWayId) : null,
          score: seg.score ?? 0,
          matched: seg.matched ?? false,
        }));

        await supabase.from("map_route_segments").insert(segmentsInsert);
      }

      return res.status(200).json({ ...response, saved: true, mapRouteId: routeRow.id, recommendationId: recoRow.id });
    }

    return res.status(200).json(response);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return res.status(400).json({ error: message });
  }
});

const saveRouteSchema = z.object({
  routeDbId: z.string(),
  title: z.string().optional(),
  origin: z.object({
    label: z.string().optional(),
    lat: z.number(),
    lng: z.number(),
    source: z.string().optional(),
    locationId: z.string().optional(),
  }),
  destination: z.object({
    label: z.string().optional(),
    lat: z.number(),
    lng: z.number(),
    source: z.string().optional(),
    locationId: z.string().optional(),
  }),
  stops: z
    .array(
      z.object({
        position: z.number().int(),
        label: z.string(),
        lat: z.number(),
        lng: z.number(),
        source: z.string().optional(),
        locationId: z.string().optional(),
      }),
    )
    .optional()
    .default([]),
  truckConfig: truckConfigSchema.optional().default({ maxWeight: 15000, maxHeight: 4.0 }),
  provider: z.string(),
  routeId: z.string(),
  score: z.number(),
  isTruckSafe: z.boolean(),
  violations: z.array(z.any()).optional().default([]),
  polyline: z.string().optional(),
  geometry: z.array(z.any()),
  segments: z.array(z.any()).optional().default([]),
});

app.post("/api/routes/save", async (req, res) => {
  try {
    const auth = await requireUser(req);
    if (!auth.ok) {
      return res.status(auth.status).json({ error: auth.error });
    }

    const parsed = saveRouteSchema.parse(req.body);
    const url = getSupabaseUrl();
    const serviceRole = getSupabaseServiceRoleKey();
    if (!url || !serviceRole) {
      return res.status(500).json({ error: "Supabase env not configured" });
    }

    const supabase = createClient(url, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } });

    const routeKey = String(parsed.routeDbId).trim();
    if (!routeKey) {
      return res.status(400).json({ error: "Missing routeDbId" });
    }
    const originLabel = String(parsed.origin.label ?? "").trim() || "Origin";
    const destLabel = String(parsed.destination.label ?? "").trim() || "Destination";

    const { data: routeRow, error: routeErr } = await supabase
      .from("routes")
      .upsert(
        {
          name: parsed.title ?? null,
          origin_label: originLabel,
          origin_lat: parsed.origin.lat,
          origin_lng: parsed.origin.lng,
          destination_label: destLabel,
          destination_lat: parsed.destination.lat,
          destination_lng: parsed.destination.lng,
          legacy_id: routeKey,
        } as any,
        { onConflict: "legacy_id" } as any,
      )
      .select("id")
      .single();
    if (routeErr) {
      return res.status(400).json({ error: routeErr.message });
    }

    await supabase.from("route_stops").delete().eq("route_id", routeRow.id);
    if (parsed.stops.length > 0) {
      const { error: stopsErr } = await supabase.from("route_stops").insert(
        parsed.stops.map((s) => ({
          route_id: routeRow.id,
          position: s.position,
          label: s.label,
          lat: s.lat,
          lng: s.lng,
          source: String(s.source ?? "search"),
        })),
      );
      if (stopsErr) {
        return res.status(400).json({ error: stopsErr.message, routeId: routeRow.id });
      }
    }

    const { error: locErr } = await supabase.from("locations").upsert(
      [
        {
          kind: "Other",
          label: originLabel,
          lat: parsed.origin.lat,
          lng: parsed.origin.lng,
          source: String(parsed.origin.source ?? "search"),
        },
        {
          kind: "Other",
          label: destLabel,
          lat: parsed.destination.lat,
          lng: parsed.destination.lng,
          source: String(parsed.destination.source ?? "search"),
        },
        ...parsed.stops.map((s) => ({
          kind: "Other",
          label: s.label,
          lat: s.lat,
          lng: s.lng,
          source: String(s.source ?? "search"),
        })),
      ] as any,
      { onConflict: "label,lat,lng" } as any,
    );
    if (locErr) {
      return res.status(400).json({ error: locErr.message, routeId: routeRow.id });
    }

    const { data: mapRouteRow, error: mapRouteErr } = await supabase
      .from("map_routes")
      .insert({
        title: parsed.title ?? null,
        origin: parsed.origin,
        destination: parsed.destination,
        stops: parsed.stops,
        truck_config: parsed.truckConfig,
      })
      .select("id")
      .single();
    if (mapRouteErr) {
      return res.status(400).json({ error: mapRouteErr.message, routeId: routeRow.id });
    }

    const { data: recoRow, error: recoErr } = await supabase
      .from("map_route_recommendations")
      .insert({
        map_route_id: mapRouteRow.id,
        provider: parsed.provider,
        route_id: parsed.routeId,
        score: parsed.score,
        is_truck_safe: parsed.isTruckSafe,
        violations: parsed.violations,
        polyline: parsed.polyline ?? null,
        geometry: parsed.geometry,
        segments: parsed.segments,
      })
      .select("id")
      .single();
    if (recoErr) {
      return res.status(400).json({ error: recoErr.message, routeId: routeRow.id, mapRouteId: mapRouteRow.id });
    }

    if (parsed.segments.length > 0) {
      const { error: segErr } = await supabase.from("map_route_segments").insert(
        parsed.segments.map((seg) => ({
          map_route_recommendation_id: recoRow.id,
          highway: seg.highway ?? null,
          maxspeed: seg.maxspeed ?? null,
          lanes: seg.lanes ?? null,
          maxweight: seg.maxweight ?? null,
          maxheight: seg.maxheight ?? null,
          way: seg.osmWayId ? String(seg.osmWayId) : null,
          score: seg.score ?? 0,
          matched: seg.matched ?? false,
        })),
      );
      if (segErr) {
        return res.status(400).json({ error: segErr.message, routeId: routeRow.id, mapRouteId: mapRouteRow.id, recommendationId: recoRow.id });
      }
    }

    return res.status(200).json({ success: true, routeId: routeRow.id, mapRouteId: mapRouteRow.id, recommendationId: recoRow.id });
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

  const { data: existingProfile } = await supabaseAdmin
    .from("staff_profiles")
    .select("role")
    .eq("user_id", auth.user.id)
    .maybeSingle();
  const metaRole = String((auth.user?.app_metadata as any)?.role ?? "").trim().toLowerCase();
  const role =
    String((existingProfile as any)?.role ?? "")?.trim().toLowerCase() ||
    (metaRole === "admin" || metaRole === "staff" ? metaRole : "staff");

  const email = String((auth.user as any)?.email ?? `${auth.user.id}@local`);
  const name = String((((auth.user as any)?.user_metadata as any)?.name ?? email ?? "User")).trim();

  const { error: profileErr } = await supabaseAdmin
    .from("staff_profiles")
    .upsert(
      {
        user_id: auth.user.id,
        email,
        name,
        role,
        must_change_password: false,
        created_by_user_id: auth.user.id,
      },
      { onConflict: "user_id" },
    );
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

app.get("/api/fleet", async (req, res) => {
  const auth = await requireUser(req);
  if (!auth.ok) {
    return res.status(auth.status).json({ error: auth.error });
  }

  const url = getSupabaseUrl();
  const serviceRole = getSupabaseServiceRoleKey();
  if (!url || !serviceRole) {
    return res.status(500).json({ error: "Supabase env not configured" });
  }

  const supabaseAdmin = createClient(url, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await supabaseAdmin
    .from("fleet_trucks")
    .select("id,legacy_id,plate_number,plate_month,plate_year,type,status,location,mileage,fuel_level,last_service,next_service,lat,lng,created_at")
    .order("created_at", { ascending: false });
  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({ success: true, trucks: data ?? [] });
});

app.post("/api/fleet", async (req, res) => {
  const auth = await requireUser(req);
  if (!auth.ok) {
    return res.status(auth.status).json({ error: auth.error });
  }

  const admin = await requireAdmin(auth.user);
  if (!admin.ok) {
    return res.status(403).json({ error: admin.error });
  }

  const bodySchema = z.discriminatedUnion("action", [
    z.object({
      action: z.literal("create"),
      legacyId: z.string().min(1),
      plateNumber: z.string().min(3),
      plateMonth: z.string().optional(),
      plateYear: z.string().optional(),
      type: z.string().min(1),
      status: z.string().min(1),
      location: z.string().optional(),
      mileage: z.number().optional(),
      fuelLevel: z.number().optional(),
      lastService: z.string().optional(),
      nextService: z.string().optional(),
      lat: z.number().optional(),
      lng: z.number().optional(),
    }),
    z.object({
      action: z.literal("update"),
      id: z.string().min(1),
      plateNumber: z.string().min(3),
      plateMonth: z.string().optional(),
      plateYear: z.string().optional(),
      type: z.string().min(1),
      status: z.string().min(1),
      location: z.string().optional(),
    }),
  ]);

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

  if (parsed.action === "create") {
    const { data, error } = await supabaseAdmin
      .from("fleet_trucks")
      .insert({
        legacy_id: parsed.legacyId,
        plate_number: parsed.plateNumber,
        plate_month: parsed.plateMonth ?? null,
        plate_year: parsed.plateYear ?? null,
        type: parsed.type,
        status: parsed.status,
        location: parsed.location ?? null,
        mileage: parsed.mileage ?? 0,
        fuel_level: parsed.fuelLevel ?? 0,
        last_service: parsed.lastService ?? null,
        next_service: parsed.nextService ?? null,
        lat: parsed.lat ?? null,
        lng: parsed.lng ?? null,
      })
      .select("id,legacy_id,plate_number,plate_month,plate_year,type,status,location,mileage,fuel_level,last_service,next_service,lat,lng,created_at")
      .single();
    if (error) {
      return res.status(400).json({ error: error.message });
    }
    return res.status(200).json({ success: true, truck: data });
  }

  const { data, error } = await supabaseAdmin
    .from("fleet_trucks")
    .update({
      plate_number: parsed.plateNumber,
      plate_month: parsed.plateMonth ?? null,
      plate_year: parsed.plateYear ?? null,
      type: parsed.type,
      status: parsed.status,
      location: parsed.location ?? null,
    })
    .eq("id", parsed.id)
    .select("id,legacy_id,plate_number,plate_month,plate_year,type,status,location,mileage,fuel_level,last_service,next_service,lat,lng,created_at")
    .single();
  if (error) {
    return res.status(400).json({ error: error.message });
  }
  return res.status(200).json({ success: true, truck: data });
});

app.post("/api/fleet/create", async (req, res) => {
  const auth = await requireUser(req);
  if (!auth.ok) {
    return res.status(auth.status).json({ error: auth.error });
  }

  const bodySchema = z.object({
    legacyId: z.string().min(1),
    plateNumber: z.string().min(3),
    plateMonth: z.string().optional(),
    plateYear: z.string().optional(),
    type: z.string().min(1),
    status: z.string().min(1),
    location: z.string().optional(),
    mileage: z.number().optional(),
    fuelLevel: z.number().optional(),
    lastService: z.string().optional(),
    nextService: z.string().optional(),
    lat: z.number().optional(),
    lng: z.number().optional(),
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

  const supabaseAdmin = createClient(url, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await supabaseAdmin
    .from("fleet_trucks")
    .insert({
      legacy_id: parsed.legacyId,
      plate_number: parsed.plateNumber,
      plate_month: parsed.plateMonth ?? null,
      plate_year: parsed.plateYear ?? null,
      type: parsed.type,
      status: parsed.status,
      location: parsed.location ?? null,
      mileage: parsed.mileage ?? 0,
      fuel_level: parsed.fuelLevel ?? 0,
      last_service: parsed.lastService ?? null,
      next_service: parsed.nextService ?? null,
      lat: parsed.lat ?? null,
      lng: parsed.lng ?? null,
    })
    .select("id,legacy_id,plate_number,plate_month,plate_year,type,status,location,mileage,fuel_level,last_service,next_service,lat,lng,created_at")
    .single();
  if (error) {
    return res.status(400).json({ error: error.message });
  }

  return res.status(200).json({ success: true, truck: data });
});

app.post("/api/fleet/update", async (req, res) => {
  const auth = await requireUser(req);
  if (!auth.ok) {
    return res.status(auth.status).json({ error: auth.error });
  }

  const bodySchema = z.object({
    id: z.string().min(1),
    plateNumber: z.string().min(3),
    plateMonth: z.string().optional(),
    plateYear: z.string().optional(),
    type: z.string().min(1),
    status: z.string().min(1),
    location: z.string().optional(),
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

  const supabaseAdmin = createClient(url, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await supabaseAdmin
    .from("fleet_trucks")
    .update({
      plate_number: parsed.plateNumber,
      plate_month: parsed.plateMonth ?? null,
      plate_year: parsed.plateYear ?? null,
      type: parsed.type,
      status: parsed.status,
      location: parsed.location ?? null,
    })
    .eq("id", parsed.id)
    .select("id,legacy_id,plate_number,plate_month,plate_year,type,status,location,mileage,fuel_level,last_service,next_service,lat,lng,created_at")
    .single();
  if (error) {
    return res.status(400).json({ error: error.message });
  }

  return res.status(200).json({ success: true, truck: data });
});

app.get("/api/drivers", async (req, res) => {
  const auth = await requireUser(req);
  if (!auth.ok) {
    return res.status(auth.status).json({ error: auth.error });
  }

  const url = getSupabaseUrl();
  const serviceRole = getSupabaseServiceRoleKey();
  if (!url || !serviceRole) {
    return res.status(500).json({ error: "Supabase env not configured" });
  }

  const supabaseAdmin = createClient(url, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await supabaseAdmin
    .from("drivers")
    .select("id,legacy_id,name,license_type,license_valid_month,license_valid_year,status,phone,rating,total_trips,avatar,created_at")
    .order("created_at", { ascending: false });
  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({ success: true, drivers: data ?? [] });
});

app.post("/api/drivers", async (req, res) => {
  const auth = await requireUser(req);
  if (!auth.ok) {
    return res.status(auth.status).json({ error: auth.error });
  }

  const admin = await requireAdmin(auth.user);
  if (!admin.ok) {
    return res.status(403).json({ error: admin.error });
  }

  const bodySchema = z.discriminatedUnion("action", [
    z.object({
      action: z.literal("create"),
      legacyId: z.string().min(1),
      name: z.string().min(1),
      licenseType: z.string().min(1),
      licenseValidMonth: z.string().optional(),
      licenseValidYear: z.string().optional(),
      status: z.enum(["Active", "Inactive"]),
      phone: z.string().optional(),
      rating: z.number().optional(),
      totalTrips: z.number().optional(),
      avatar: z.string().optional(),
    }),
    z.object({
      action: z.literal("update"),
      id: z.string().min(1),
      name: z.string().min(1),
      licenseType: z.string().min(1),
      licenseValidMonth: z.string().optional(),
      licenseValidYear: z.string().optional(),
      status: z.enum(["Active", "Inactive"]),
      phone: z.string().optional(),
      avatar: z.string().optional(),
    }),
    z.object({
      action: z.literal("delete"),
      id: z.string().min(1),
    }),
  ]);

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

  if (parsed.action === "delete") {
    const { error } = await supabaseAdmin.from("drivers").delete().eq("id", parsed.id);
    if (error) {
      return res.status(400).json({ error: error.message });
    }
    return res.status(200).json({ success: true });
  }

  if (parsed.action === "create") {
    const { data, error } = await supabaseAdmin
      .from("drivers")
      .insert({
        legacy_id: parsed.legacyId,
        name: parsed.name,
        license_type: parsed.licenseType,
        license_valid_month: parsed.licenseValidMonth ?? null,
        license_valid_year: parsed.licenseValidYear ?? null,
        status: parsed.status,
        phone: parsed.phone ?? null,
        rating: parsed.rating ?? 0,
        total_trips: parsed.totalTrips ?? 0,
        avatar: parsed.avatar ?? null,
      })
      .select("id,legacy_id,name,license_type,license_valid_month,license_valid_year,status,phone,rating,total_trips,avatar,created_at")
      .single();
    if (error) {
      return res.status(400).json({ error: error.message });
    }
    return res.status(200).json({ success: true, driver: data });
  }

  const { data, error } = await supabaseAdmin
    .from("drivers")
    .update({
      name: parsed.name,
      license_type: parsed.licenseType,
      license_valid_month: parsed.licenseValidMonth ?? null,
      license_valid_year: parsed.licenseValidYear ?? null,
      status: parsed.status,
      phone: parsed.phone ?? null,
      avatar: parsed.avatar ?? null,
    })
    .eq("id", parsed.id)
    .select("id,legacy_id,name,license_type,license_valid_month,license_valid_year,status,phone,rating,total_trips,avatar,created_at")
    .single();
  if (error) {
    return res.status(400).json({ error: error.message });
  }
  return res.status(200).json({ success: true, driver: data });
});

app.post("/api/drivers/create", async (req, res) => {
  const auth = await requireUser(req);
  if (!auth.ok) {
    return res.status(auth.status).json({ error: auth.error });
  }

  const admin = await requireAdmin(auth.user);
  if (!admin.ok) {
    return res.status(403).json({ error: admin.error });
  }

  const bodySchema = z.object({
    legacyId: z.string().min(1),
    name: z.string().min(1),
    licenseType: z.string().min(1),
    licenseValidMonth: z.string().optional(),
    licenseValidYear: z.string().optional(),
    status: z.enum(["Active", "Inactive"]),
    phone: z.string().optional(),
    rating: z.number().optional(),
    totalTrips: z.number().optional(),
    avatar: z.string().optional(),
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

  const supabaseAdmin = createClient(url, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await supabaseAdmin
    .from("drivers")
    .insert({
      user_id: auth.user.id,
      legacy_id: parsed.legacyId,
      name: parsed.name,
      license_type: parsed.licenseType,
      license_valid_month: parsed.licenseValidMonth ?? null,
      license_valid_year: parsed.licenseValidYear ?? null,
      status: parsed.status,
      phone: parsed.phone ?? null,
      rating: parsed.rating ?? 0,
      total_trips: parsed.totalTrips ?? 0,
      avatar: parsed.avatar ?? null,
    })
    .select("id,legacy_id,name,license_type,license_valid_month,license_valid_year,status,phone,rating,total_trips,avatar,created_at")
    .single();
  if (error) {
    return res.status(400).json({ error: error.message });
  }

  return res.status(200).json({ success: true, driver: data });
});

app.post("/api/drivers/update", async (req, res) => {
  const auth = await requireUser(req);
  if (!auth.ok) {
    return res.status(auth.status).json({ error: auth.error });
  }

  const admin = await requireAdmin(auth.user);
  if (!admin.ok) {
    return res.status(403).json({ error: admin.error });
  }

  const bodySchema = z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    licenseType: z.string().min(1),
    licenseValidMonth: z.string().optional(),
    licenseValidYear: z.string().optional(),
    status: z.enum(["Active", "Inactive"]),
    phone: z.string().optional(),
    avatar: z.string().optional(),
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

  const supabaseAdmin = createClient(url, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await supabaseAdmin
    .from("drivers")
    .update({
      name: parsed.name,
      license_type: parsed.licenseType,
      license_valid_month: parsed.licenseValidMonth ?? null,
      license_valid_year: parsed.licenseValidYear ?? null,
      status: parsed.status,
      phone: parsed.phone ?? null,
      avatar: parsed.avatar ?? null,
    })
    .eq("id", parsed.id)
    .eq("user_id", auth.user.id)
    .select("id,legacy_id,name,license_type,license_valid_month,license_valid_year,status,phone,rating,total_trips,avatar,created_at")
    .single();
  if (error) {
    return res.status(400).json({ error: error.message });
  }

  return res.status(200).json({ success: true, driver: data });
});

app.post("/api/drivers/delete", async (req, res) => {
  const auth = await requireUser(req);
  if (!auth.ok) {
    return res.status(auth.status).json({ error: auth.error });
  }

  const admin = await requireAdmin(auth.user);
  if (!admin.ok) {
    return res.status(403).json({ error: admin.error });
  }

  const bodySchema = z.object({ id: z.string().min(1) });
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
  const { error } = await supabaseAdmin.from("drivers").delete().eq("id", parsed.id);
  if (error) {
    return res.status(400).json({ error: error.message });
  }

  return res.status(200).json({ success: true });
});

app.get("/api/maintenance", async (req, res) => {
  const auth = await requireUser(req);
  if (!auth.ok) {
    return res.status(auth.status).json({ error: auth.error });
  }

  const url = getSupabaseUrl();
  const serviceRole = getSupabaseServiceRoleKey();
  if (!url || !serviceRole) {
    return res.status(500).json({ error: "Supabase env not configured" });
  }

  const supabaseAdmin = createClient(url, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await supabaseAdmin
    .from("maintenance_records")
    .select("id,truck_id,type,status,date,notes,cost,created_at,updated_at")
    .order("date", { ascending: false });
  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({ success: true, records: data ?? [] });
});

app.post("/api/maintenance", async (req, res) => {
  const auth = await requireUser(req);
  if (!auth.ok) {
    return res.status(auth.status).json({ error: auth.error });
  }

  const bodySchema = z.discriminatedUnion("action", [
    z.object({
      action: z.literal("create"),
      truckId: z.string().min(1),
      type: z.string().min(1),
      status: z.string().min(1),
      date: z.string().min(1),
      notes: z.string().min(1),
      cost: z.number().nonnegative(),
    }),
    z.object({
      action: z.literal("update"),
      id: z.string().min(1),
      truckId: z.string().min(1),
      type: z.string().min(1),
      status: z.string().min(1),
      date: z.string().min(1),
      notes: z.string().min(1),
      cost: z.number().nonnegative(),
    }),
    z.object({
      action: z.literal("delete"),
      id: z.string().min(1),
    }),
  ]);

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

  if (parsed.action === "delete") {
    const { error } = await supabaseAdmin.from("maintenance_records").delete().eq("id", parsed.id);
    if (error) {
      return res.status(400).json({ error: error.message });
    }
    return res.status(200).json({ success: true });
  }

  const payload = {
    truck_id: parsed.truckId,
    type: parsed.type,
    status: parsed.status,
    date: parsed.date,
    notes: parsed.notes,
    cost: parsed.cost,
  };

  if (parsed.action === "create") {
    const first = await supabaseAdmin
      .from("maintenance_records")
      .insert(payload as any)
      .select("id,truck_id,type,status,date,notes,cost,created_at,updated_at")
      .single();
    if (!first.error) {
      return res.status(200).json({ success: true, record: first.data });
    }

    const msg = String(first.error.message ?? "");
    if (msg.toLowerCase().includes("user_id") && msg.toLowerCase().includes("null value")) {
      const second = await supabaseAdmin
        .from("maintenance_records")
        .insert({ ...(payload as any), user_id: auth.user.id } as any)
        .select("id,truck_id,type,status,date,notes,cost,created_at,updated_at")
        .single();
      if (second.error) {
        return res.status(400).json({ error: second.error.message });
      }
      return res.status(200).json({ success: true, record: second.data });
    }

    return res.status(400).json({ error: first.error.message });
  }

  const { data, error } = await supabaseAdmin
    .from("maintenance_records")
    .update(payload as any)
    .eq("id", parsed.id)
    .select("id,truck_id,type,status,date,notes,cost,created_at,updated_at")
    .single();
  if (error) {
    return res.status(400).json({ error: error.message });
  }
  return res.status(200).json({ success: true, record: data });
});

app.get("/api/work-orders", async (req, res) => {
  const auth = await requireUser(req);
  if (!auth.ok) {
    return res.status(auth.status).json({ error: auth.error });
  }

  const url = getSupabaseUrl();
  const serviceRole = getSupabaseServiceRoleKey();
  if (!url || !serviceRole) {
    return res.status(500).json({ error: "Supabase env not configured" });
  }

  const supabaseAdmin = createClient(url, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } });

  const workOrderSelect =
    "id,legacy_id,title,driver_id,truck_id,route_name,destinations,notes,priority,status,due_date,created_at,updated_at";
  const { data: orders, error } = await supabaseAdmin
    .from("work_orders")
    .select(workOrderSelect)
    .order("created_at", { ascending: false });
  if (error) {
    return res.status(500).json({ error: error.message });
  }

  const orderIds = (orders ?? []).map((o: any) => String(o.id));
  const historyByOrderId = new Map<string, any[]>();
  if (orderIds.length > 0) {
    const { data: historyRows } = await supabaseAdmin
      .from("work_order_history")
      .select("id,work_order_id,message,attachment_name,attachment_url,created_at")
      .in("work_order_id", orderIds)
      .order("created_at", { ascending: true });
    for (const h of historyRows ?? []) {
      const key = String((h as any).work_order_id);
      const list = historyByOrderId.get(key) ?? [];
      list.push(h);
      historyByOrderId.set(key, list);
    }
  }

  const driverIds = Array.from(new Set((orders ?? []).map((o: any) => String(o.driver_id)).filter(Boolean)));
  const truckIds = Array.from(new Set((orders ?? []).map((o: any) => String(o.truck_id)).filter(Boolean)));
  const driverLegacyById = new Map<string, string>();
  const truckLegacyById = new Map<string, string>();

  if (driverIds.length > 0) {
    const { data: driverRows } = await supabaseAdmin.from("drivers").select("id,legacy_id").in("id", driverIds);
    for (const d of driverRows ?? []) {
      driverLegacyById.set(String((d as any).id), String((d as any).legacy_id ?? ""));
    }
  }
  if (truckIds.length > 0) {
    const { data: truckRows } = await supabaseAdmin.from("fleet_trucks").select("id,legacy_id").in("id", truckIds);
    for (const t of truckRows ?? []) {
      truckLegacyById.set(String((t as any).id), String((t as any).legacy_id ?? ""));
    }
  }

  const mapped = (orders ?? []).map((o: any) => {
    const id = String(o.id);
    const history = (historyByOrderId.get(id) ?? []).map((h: any) => ({
      id: String(h.id),
      timestamp: String(h.created_at),
      message: String(h.message ?? ""),
      attachment:
        h.attachment_name && h.attachment_url
          ? { name: String(h.attachment_name), url: String(h.attachment_url) }
          : h.attachment_name
            ? { name: String(h.attachment_name), url: "" }
            : undefined,
    }));

    const destinations = Array.isArray(o.destinations) ? o.destinations : (o.destinations?.destinations ?? o.destinations ?? []);
    return {
      dbId: id,
      id: String(o.legacy_id ?? ""),
      title: String(o.title ?? ""),
      driverId: driverLegacyById.get(String(o.driver_id)) ?? "",
      truckId: truckLegacyById.get(String(o.truck_id)) ?? "",
      pickupLocation: String(o.route_name ?? ""),
      destinations: Array.isArray(destinations) ? destinations.map(String) : [],
      cargoType: String(o.notes ?? ""),
      priority: String(o.priority ?? "Medium"),
      status: String(o.status ?? "Pending"),
      createdAt: String(o.created_at ?? "").slice(0, 10),
      dueDate: String(o.due_date ?? ""),
      history,
    };
  });

  return res.status(200).json({ success: true, workOrders: mapped });
});

app.post("/api/work-orders", async (req, res) => {
  const auth = await requireUser(req);
  if (!auth.ok) {
    return res.status(auth.status).json({ error: auth.error });
  }

  const admin = await requireAdmin(auth.user);
  if (!admin.ok) {
    return res.status(403).json({ error: admin.error });
  }

  const bodySchema = z.discriminatedUnion("action", [
    z.object({
      action: z.literal("create"),
      legacyId: z.string().min(1),
      title: z.string().min(1),
      driverId: z.string().min(1),
      truckId: z.string().min(1),
      routeName: z.string().min(1),
      destinations: z.array(z.string()).default([]),
      notes: z.string().optional(),
      priority: z.enum(["High", "Medium", "Low"]),
      dueDate: z.string().min(1),
    }),
    z.object({
      action: z.literal("update"),
      id: z.string().min(1),
      title: z.string().min(1),
      driverId: z.string().min(1),
      truckId: z.string().min(1),
      routeName: z.string().min(1),
      destinations: z.array(z.string()).default([]),
      notes: z.string().optional(),
      priority: z.enum(["High", "Medium", "Low"]),
      status: z.enum(["Pending", "In Progress", "Completed", "Cancelled"]),
      dueDate: z.string().min(1),
    }),
    z.object({
      action: z.literal("delete"),
      id: z.string().min(1),
    }),
    z.object({
      action: z.literal("addHistory"),
      id: z.string().min(1),
      message: z.string().optional(),
      attachmentName: z.string().optional(),
      attachmentUrl: z.string().optional(),
    }),
  ]);

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

  if (parsed.action === "delete") {
    const { error } = await supabaseAdmin.from("work_orders").delete().eq("id", parsed.id);
    if (error) return res.status(400).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  if (parsed.action === "addHistory") {
    const { error } = await supabaseAdmin.from("work_order_history").insert({
      work_order_id: parsed.id,
      message: parsed.message ?? "",
      attachment_name: parsed.attachmentName ?? null,
      attachment_url: parsed.attachmentUrl ?? null,
    });
    if (error) return res.status(400).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  const { data: driverRow } = await supabaseAdmin
    .from("drivers")
    .select("id")
    .eq("legacy_id", parsed.driverId)
    .maybeSingle();
  if (!driverRow) return res.status(400).json({ error: "Invalid driver" });

  const { data: truckRow } = await supabaseAdmin
    .from("fleet_trucks")
    .select("id")
    .eq("legacy_id", parsed.truckId)
    .maybeSingle();
  if (!truckRow) return res.status(400).json({ error: "Invalid truck" });

  if (parsed.action === "create") {
    const { data, error } = await supabaseAdmin
      .from("work_orders")
      .insert({
        legacy_id: parsed.legacyId,
        title: parsed.title,
        driver_id: (driverRow as any).id,
        truck_id: (truckRow as any).id,
        route_name: parsed.routeName,
        destinations: parsed.destinations,
        notes: parsed.notes ?? null,
        priority: parsed.priority,
        status: "Pending",
        due_date: parsed.dueDate,
      })
      .single();
    if (error) return res.status(400).json({ error: error.message });
    return res.status(200).json({ success: true, workOrder: data });
  }

  const { data, error } = await supabaseAdmin
    .from("work_orders")
    .update({
      title: parsed.title,
      driver_id: (driverRow as any).id,
      truck_id: (truckRow as any).id,
      route_name: parsed.routeName,
      destinations: parsed.destinations,
      notes: parsed.notes ?? null,
      priority: parsed.priority,
      status: parsed.status,
      due_date: parsed.dueDate,
    })
    .eq("id", parsed.id)
    .single();
  if (error) return res.status(400).json({ error: error.message });
  return res.status(200).json({ success: true, workOrder: data });
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
