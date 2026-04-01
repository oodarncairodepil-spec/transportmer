import { z } from "zod";

import { getAdminClient, requireAdmin, requireUser } from "../supabase.js";
import { requireEnvOrThrow, sendJsonError, withErrorHandler } from "../withErrorHandler.js";

export default withErrorHandler(
  async (req, res) => {
    if (req.method !== "POST") {
      return sendJsonError(res, 405, "Method not allowed");
    }

    requireEnvOrThrow(["SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"]);

    const auth = await requireUser(req);
    if (!auth.ok) {
      return sendJsonError(res, auth.status, auth.error);
    }

    const admin = await requireAdmin(auth.user);
    if (!admin.ok) {
      return sendJsonError(res, admin.status, admin.error);
    }

    const schema = z.object({
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

    let parsed: z.infer<typeof schema>;
    try {
      parsed = schema.parse(typeof req.body === "string" ? JSON.parse(req.body) : req.body);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Invalid request";
      return sendJsonError(res, 400, "Invalid request", message);
    }

    const supabaseAdmin = await getAdminClient();
    if (!supabaseAdmin) {
      return sendJsonError(res, 500, "Supabase env not configured");
    }

    const { data, error } = await supabaseAdmin
      .from("fleet_trucks")
      .insert({
        user_id: auth.user.id,
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
      return sendJsonError(res, 400, "Failed to create truck", error.message);
    }

    return res.status(200).json({ success: true, truck: data });
  },
  { route: "/api/fleet/create" },
);

