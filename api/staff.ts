export const config = {
  runtime: "nodejs",
};

import { getAdminClient, requireAdmin, requireUser } from "./supabase";
import { requireEnvOrThrow, sendJsonError, withErrorHandler } from "./withErrorHandler";

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

    const admin = await requireAdmin(auth.user);
    if (!admin.ok) {
      return sendJsonError(res, admin.status, admin.error);
    }

    const supabaseAdmin = await getAdminClient();
    if (!supabaseAdmin) {
      return sendJsonError(res, 500, "Supabase env not configured");
    }

    const { data, error } = await supabaseAdmin
      .from("staff_profiles")
      .select("user_id,email,name,phone,title,role,must_change_password,created_at")
      .order("created_at", { ascending: false });

    if (error) {
      return sendJsonError(res, 500, "DB error", error.message);
    }

    return res.status(200).json({ success: true, staff: data ?? [] });
  },
  { route: "/api/staff" },
);
