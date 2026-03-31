import { json, isDebug, requireAdmin, requireUser, getAdminClient } from "./_supabase";

export default async function handler(req: any, res: any) {
  if (req.method !== "GET") {
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

    const supabaseAdmin = getAdminClient();
    if (!supabaseAdmin) {
      return json(res, { status: 500, body: { error: "Supabase env not configured" } });
    }

    const { data, error } = await supabaseAdmin
      .from("staff_profiles")
      .select("user_id,email,name,phone,title,role,must_change_password,created_at")
      .order("created_at", { ascending: false });
    if (error) {
      return json(res, { status: 500, body: { error: error.message } });
    }

    return json(res, { status: 200, body: { staff: data ?? [] } });
  } catch (e) {
    const err = e instanceof Error ? e : new Error("Unhandled error");
    return json(res, {
      status: 500,
      body: isDebug(req) ? { error: "Unhandled server error", detail: err.message, stack: err.stack } : { error: "Unhandled server error" },
    });
  }
}
