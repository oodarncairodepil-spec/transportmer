import { z } from "zod";

import { getAdminClient, requireAdmin, requireUser } from "../supabase.js";
import { requireEnvOrThrow, sendJsonError, withErrorHandler } from "../withErrorHandler.js";

export default withErrorHandler(
  async (req, res) => {
    requireEnvOrThrow(["SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"]);

    const auth = await requireUser(req);
    if (!auth.ok) {
      return sendJsonError(res, auth.status, auth.error);
    }

    const supabaseAdmin = await getAdminClient();
    if (!supabaseAdmin) {
      return sendJsonError(res, 500, "Supabase env not configured");
    }

    if (req.method === "GET") {
      const { data, error } = await supabaseAdmin
        .from("fleet_trucks")
        .select(
          "id,legacy_id,plate_number,plate_month,plate_year,type,status,location,mileage,fuel_level,last_service,next_service,lat,lng,created_at",
        )
        .order("created_at", { ascending: false });
      if (error) {
        return sendJsonError(res, 500, "DB error", error.message);
      }
      return res.status(200).json({ success: true, trucks: data ?? [] });
    }

    if (req.method !== "POST") {
      return sendJsonError(res, 405, "Method not allowed");
    }

    const admin = await requireAdmin(auth.user);
    if (!admin.ok) {
      return sendJsonError(res, 403, admin.error);
    }

    const actionSchema = z.discriminatedUnion("action", [
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

    let parsed: z.infer<typeof actionSchema>;
    try {
      parsed = actionSchema.parse(typeof req.body === "string" ? JSON.parse(req.body) : req.body);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Invalid request";
      return sendJsonError(res, 400, "Invalid request", message);
    }

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
        .select(
          "id,legacy_id,plate_number,plate_month,plate_year,type,status,location,mileage,fuel_level,last_service,next_service,lat,lng,created_at",
        )
        .single();
      if (error) {
        return sendJsonError(res, 400, "Failed to create truck", error.message);
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
      .select(
        "id,legacy_id,plate_number,plate_month,plate_year,type,status,location,mileage,fuel_level,last_service,next_service,lat,lng,created_at",
      )
      .single();
    if (error) {
      return sendJsonError(res, 400, "Failed to update truck", error.message);
    }

    return res.status(200).json({ success: true, truck: data });
  },
  { route: "/api/fleet" },
);
