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
      id: z.string().min(1),
      name: z.string().min(1),
      licenseType: z.string().min(1),
      licenseValidMonth: z.string().optional(),
      licenseValidYear: z.string().optional(),
      status: z.enum(["Active", "Inactive"]),
      phone: z.string().optional(),
      avatar: z.string().optional(),
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
      return sendJsonError(res, 400, "Failed to update driver", error.message);
    }

    return res.status(200).json({ success: true, driver: data });
  },
  { route: "/api/drivers/update" },
);
