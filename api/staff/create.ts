import { z } from "zod";
import { generateTempPassword } from "../../server/lib/tempPassword";
import { json, isDebug, requireAdmin, requireUser, getAdminClient } from "../_supabase";
import { requireEnvOrThrow, sendJsonError, withErrorHandler } from "../_withErrorHandler";

export const config = {
  runtime: "nodejs",
};

export default withErrorHandler(
  async (req: any, res: any) => {
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
      email: z.string().email(),
      name: z.string().min(1).max(120),
      role: z.enum(["admin", "staff"]).optional().default("staff"),
      phone: z.string().max(60).optional(),
      title: z.string().max(80).optional(),
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

    const tempPassword = generateTempPassword();
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: parsed.email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { name: parsed.name },
      app_metadata: { role: parsed.role },
    } as any);
    if (createErr || !created.user) {
      return sendJsonError(res, 400, "Failed to create user", createErr?.message);
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
      return sendJsonError(res, 400, "Failed to insert profile", insertErr.message);
    }

    return res.status(200).json({ success: true, userId: created.user.id, tempPassword });
  },
  { route: "/api/staff/create" },
);
