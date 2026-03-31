import { z } from "zod";
import { json, isDebug, requireUser, getAdminClient } from "../_supabase";

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

    const schema = z.object({ newPassword: z.string().min(8).max(200) });
    const parsed = schema.parse(typeof req.body === "string" ? JSON.parse(req.body) : req.body);

    const supabaseAdmin = await getAdminClient();
    if (!supabaseAdmin) {
      return json(res, { status: 500, body: { error: "Supabase env not configured" } });
    }

    const { error: pwErr } = await supabaseAdmin.auth.admin.updateUserById(auth.user.id, { password: parsed.newPassword } as any);
    if (pwErr) {
      return json(res, { status: 400, body: { error: pwErr.message } });
    }

    const { error: profileErr } = await supabaseAdmin
      .from("staff_profiles")
      .update({ must_change_password: false })
      .eq("user_id", auth.user.id);
    if (profileErr) {
      return json(res, { status: 200, body: { ok: true, profileUpdated: false, profileError: profileErr.message } });
    }

    return json(res, { status: 200, body: { ok: true } });
  } catch (e) {
    const err = e instanceof Error ? e : new Error("Unhandled error");
    return json(res, {
      status: 500,
      body: isDebug(req) ? { error: "Unhandled server error", detail: err.message, stack: err.stack } : { error: err.message },
    });
  }
}
