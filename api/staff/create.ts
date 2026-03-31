import { z } from "zod";
import { generateTempPassword } from "../../server/lib/tempPassword";
import { json, isDebug, requireAdmin, requireUser, getAdminClient } from "../_supabase";

export const config = {
  runtime: "nodejs",
};

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return json(res, { status: 405, body: { error: "Method not allowed" } });
  }

  try {
    const auth = await requireUser(req);
    if (!auth.ok) {
      return json(res, { status: auth.status, body: isDebug(req) ? { error: auth.error, debug: auth.debug } : { error: auth.error } });
    }

    const admin = await requireAdmin(auth.user);
    if (!admin.ok) {
      return json(res, { status: admin.status, body: { error: admin.error } });
    }

    const schema = z.object({
      email: z.string().email(),
      name: z.string().min(1).max(120),
      role: z.enum(["admin", "staff"]).optional().default("staff"),
      phone: z.string().max(60).optional(),
      title: z.string().max(80).optional(),
    });

    const parsed = schema.parse(typeof req.body === "string" ? JSON.parse(req.body) : req.body);

    const supabaseAdmin = getAdminClient();
    if (!supabaseAdmin) {
      return json(res, { status: 500, body: { error: "Supabase env not configured" } });
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
      return json(res, { status: 400, body: { error: createErr?.message || "Failed to create user" } });
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
      return json(res, { status: 400, body: { error: insertErr.message } });
    }

    return json(res, { status: 200, body: { userId: created.user.id, tempPassword } });
  } catch (e) {
    const err = e instanceof Error ? e : new Error("Unhandled error");
    return json(res, {
      status: 500,
      body: isDebug(req) ? { error: "Unhandled server error", detail: err.message, stack: err.stack } : { error: err.message },
    });
  }
}
