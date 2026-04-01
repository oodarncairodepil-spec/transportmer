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

    const schema = z.object({ id: z.string().min(1) });
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

    const { error } = await supabaseAdmin.from("drivers").delete().eq("id", parsed.id).eq("user_id", auth.user.id);
    if (error) {
      return sendJsonError(res, 400, "Failed to delete driver", error.message);
    }

    return res.status(200).json({ success: true });
  },
  { route: "/api/drivers/delete" },
);

