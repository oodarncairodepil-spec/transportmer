import { z } from "zod";
import { generateTempPassword } from "../../server/lib/tempPassword";
import { getAdminClient, requireAdmin, requireUser } from "../supabase";
import { requireEnvOrThrow, sendJsonError, withErrorHandler } from "../withErrorHandler";

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

    const schema = z.object({ userId: z.string().min(1) });
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

    const tempPassword = generateTempPassword();
    const { data: profileRow } = await supabaseAdmin.from("staff_profiles").select("role").eq("user_id", parsed.userId).maybeSingle();
    const nextRole = String((profileRow as any)?.role ?? "staff");
    const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(parsed.userId, {
      password: tempPassword,
      app_metadata: { role: nextRole },
    } as any);
    if (updateErr) {
      return sendJsonError(res, 400, "Failed to update user", updateErr.message);
    }

    const { error: profileErr } = await supabaseAdmin
      .from("staff_profiles")
      .update({ must_change_password: true })
      .eq("user_id", parsed.userId);
    if (profileErr) {
      return sendJsonError(res, 400, "Failed to update profile", profileErr.message);
    }

    return res.status(200).json({ success: true, userId: parsed.userId, tempPassword });
  },
  { route: "/api/staff/rotate-password" },
);

