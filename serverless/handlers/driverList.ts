import { getAdminClient, requireUser } from "../supabase.js";
import { requireEnvOrThrow, sendJsonError, withErrorHandler } from "../withErrorHandler.js";

export default withErrorHandler(
  async (req, res) => {
    if (req.method !== "GET") {
      return sendJsonError(res, 405, "Method not allowed");
    }

    requireEnvOrThrow(["SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"]);

    const auth = await requireUser(req);
    if (!auth.ok) {
      return sendJsonError(res, auth.status, auth.error);
    }

    const supabaseAdmin = await getAdminClient();
    if (!supabaseAdmin) {
      return sendJsonError(res, 500, "Supabase env not configured");
    }

    const { data, error } = await supabaseAdmin
      .from("drivers")
      .select("id,legacy_id,name,license_type,license_valid_month,license_valid_year,status,phone,rating,total_trips,avatar,created_at")
      .eq("user_id", auth.user.id)
      .order("created_at", { ascending: false });
    if (error) {
      return sendJsonError(res, 500, "DB error", error.message);
    }

    return res.status(200).json({ success: true, drivers: data ?? [] });
  },
  { route: "/api/drivers" },
);

