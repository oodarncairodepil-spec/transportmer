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

    const schema = z.object({ userId: z.string().min(1) });
    const parsed = schema.parse(typeof req.body === "string" ? JSON.parse(req.body) : req.body);

    const supabaseAdmin = getAdminClient();
    if (!supabaseAdmin) {
      return json(res, { status: 500, body: { error: "Supabase env not configured" } });
    }

    const tempPassword = generateTempPassword();
    const { data: profileRow } = await supabaseAdmin.from("staff_profiles").select("role").eq("user_id", parsed.userId).maybeSingle();
    const nextRole = String((profileRow as any)?.role ?? "staff");
    const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(parsed.userId, {
      password: tempPassword,
      app_metadata: { role: nextRole },
    } as any);
    if (updateErr) {
      return json(res, { status: 400, body: { error: updateErr.message } });
    }

    const { error: profileErr } = await supabaseAdmin
      .from("staff_profiles")
      .update({ must_change_password: true })
      .eq("user_id", parsed.userId);
    if (profileErr) {
      return json(res, { status: 400, body: { error: profileErr.message } });
    }

    return json(res, { status: 200, body: { userId: parsed.userId, tempPassword } });
  } catch (e) {
    const err = e instanceof Error ? e : new Error("Unhandled error");
    return json(res, {
      status: 500,
      body: isDebug(req) ? { error: "Unhandled server error", detail: err.message, stack: err.stack } : { error: err.message },
    });
  }
}
