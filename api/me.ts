import { json, isDebug, requireUser, getAdminClient } from "./_supabase";

export default async function handler(req: any, res: any) {
  if (req.method !== "GET") {
    return json(res, { status: 405, body: { error: "Method not allowed" } });
  }

  try {
    const auth = await requireUser(req);
    if (!auth.ok) {
      return json(res, { status: auth.status, body: isDebug(req) ? { error: auth.error, debug: auth.debug } : { error: auth.error } });
    }

    const supabaseAdmin = getAdminClient();
    if (!supabaseAdmin) {
      return json(res, { status: 200, body: { user: auth.user, profile: null } });
    }
    const { data: profile } = await supabaseAdmin
      .from("staff_profiles")
      .select("user_id,email,name,phone,title,role,must_change_password,created_at")
      .eq("user_id", auth.user.id)
      .maybeSingle();
    return json(res, { status: 200, body: { user: auth.user, profile: profile ?? null } });
  } catch (e) {
    const err = e instanceof Error ? e : new Error("Unhandled error");
    return json(res, {
      status: 500,
      body: isDebug(req) ? { error: "Unhandled server error", detail: err.message, stack: err.stack } : { error: err.message },
    });
  }
}
