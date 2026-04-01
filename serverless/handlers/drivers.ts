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
        .from("drivers")
        .select("id,legacy_id,name,license_type,license_valid_month,license_valid_year,status,phone,rating,total_trips,avatar,created_at")
        .eq("user_id", auth.user.id)
        .order("created_at", { ascending: false });
      if (error) {
        return sendJsonError(res, 500, "DB error", error.message);
      }
      return res.status(200).json({ success: true, drivers: data ?? [] });
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

    let parsed: z.infer<typeof actionSchema>;
    try {
      parsed = actionSchema.parse(typeof req.body === "string" ? JSON.parse(req.body) : req.body);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Invalid request";
      return sendJsonError(res, 400, "Invalid request", message);
    }

    if (parsed.action === "create") {
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
        return sendJsonError(res, 400, "Failed to create driver", error.message);
      }
      return res.status(200).json({ success: true, driver: data });
    }

    if (parsed.action === "update") {
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
        return sendJsonError(res, 400, "Failed to update driver", error.message);
      }
      return res.status(200).json({ success: true, driver: data });
    }

    const { error } = await supabaseAdmin.from("drivers").delete().eq("id", parsed.id).eq("user_id", auth.user.id);
    if (error) {
      return sendJsonError(res, 400, "Failed to delete driver", error.message);
    }

    return res.status(200).json({ success: true });
  },
  { route: "/api/drivers" },
);

