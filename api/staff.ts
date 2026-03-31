export const config = {
  runtime: "nodejs",
};

function isDebug(req: any) {
  return String(req?.query?.debug ?? "") === "1";
}

function sendJson(res: any, status: number, body: any) {
  try {
    if (typeof res.status === "function" && typeof res.json === "function") {
      return res.status(status).json(body);
    }
  } catch {}
  try {
    res.statusCode = status;
    res.setHeader?.("content-type", "application/json; charset=utf-8");
    res.end(JSON.stringify(body));
  } catch {
    try {
      res.end();
    } catch {}
  }
}

function getBearerToken(req: any) {
  const header = String(req?.headers?.authorization ?? req?.headers?.Authorization ?? "").trim();
  if (!header.toLowerCase().startsWith("bearer ")) return null;
  const token = header.slice("bearer ".length).trim();
  return token.length > 0 ? token : null;
}

function envSnapshot() {
  const url = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").trim();
  const anonKey = String(process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "").trim();
  const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  return {
    url: url || null,
    anonKey: anonKey || null,
    serviceRoleKey: serviceRoleKey || null,
  };
}

export default async function handler(req: any, res: any) {
  const debug = isDebug(req);
  const rid = String(req?.headers?.["x-vercel-id"] ?? req?.headers?.["x-vercel-deployment-url"] ?? "");

  try {
    if (req.method !== "GET") {
      return sendJson(res, 405, { error: "Method not allowed" });
    }

    const token = getBearerToken(req);
    if (!token) {
      return sendJson(res, 401, { error: "Missing bearer token" });
    }

    const env = envSnapshot();
    const missing = {
      SUPABASE_URL: !env.url,
      SUPABASE_ANON_KEY: !env.anonKey,
      SUPABASE_SERVICE_ROLE_KEY: !env.serviceRoleKey,
    };
    if (missing.SUPABASE_URL || missing.SUPABASE_ANON_KEY || missing.SUPABASE_SERVICE_ROLE_KEY) {
      console.error("/api/staff missing env", { rid, missing });
      return sendJson(res, 500, debug ? { error: "Missing required env", missing } : { error: "Server misconfigured" });
    }

    const { createClient } = await import("@supabase/supabase-js");
    const supabaseAuth = createClient(env.url!, env.anonKey!, { auth: { persistSession: false, autoRefreshToken: false } });
    const supabaseAdmin = createClient(env.url!, env.serviceRoleKey!, { auth: { persistSession: false, autoRefreshToken: false } });

    console.log("/api/staff start", { rid, hasToken: true });

    const { data: userData, error: userErr } = await supabaseAuth.auth.getUser(token);
    if (userErr || !userData.user) {
      console.error("/api/staff invalid token", { rid, message: userErr?.message });
      return sendJson(res, 401, debug ? { error: "Invalid auth token", message: userErr?.message } : { error: "Invalid auth token" });
    }
    const user = userData.user;

    const metaRole = String((user.app_metadata as any)?.role ?? "").trim().toLowerCase();
    let isAdmin = metaRole === "admin";

    if (!isAdmin) {
      const { data: profileRow, error: profileErr } = await supabaseAdmin
        .from("staff_profiles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!profileErr) {
        const profileRole = String((profileRow as any)?.role ?? "").trim().toLowerCase();
        isAdmin = profileRole === "admin";
      }
    }

    if (!isAdmin) {
      const { count, error: countErr } = await supabaseAdmin
        .from("staff_profiles")
        .select("user_id", { count: "exact", head: true })
        .eq("role", "admin");

      if (!countErr && (count ?? 0) === 0) {
        const email = String(user.email ?? `${user.id}@local`);
        const name = String(((user.user_metadata as any)?.name ?? email ?? "Admin")).trim();
        const upsertErr = await supabaseAdmin
          .from("staff_profiles")
          .upsert(
            {
              user_id: user.id,
              email,
              name,
              role: "admin",
              must_change_password: false,
              created_by_user_id: user.id,
            },
            { onConflict: "user_id" },
          )
          .then((r: any) => r.error);
        if (!upsertErr) {
          isAdmin = true;
          console.log("/api/staff bootstrapped first admin", { rid, userId: user.id });
        }
      }
    }

    if (!isAdmin) {
      return sendJson(res, 403, { error: "Forbidden" });
    }

    const { data, error } = await supabaseAdmin
      .from("staff_profiles")
      .select("user_id,email,name,phone,title,role,must_change_password,created_at")
      .order("created_at", { ascending: false });
    if (error) {
      console.error("/api/staff db error", { rid, message: error.message });
      return sendJson(res, 500, debug ? { error: "DB error", message: error.message } : { error: "Server error" });
    }

    return sendJson(res, 200, { staff: data ?? [] });
  } catch (e) {
    const err = e instanceof Error ? e : new Error("Unhandled error");
    console.error("/api/staff crash", { rid, message: err.message, stack: err.stack });
    return sendJson(res, 500, debug ? { error: "Unhandled server error", message: err.message, stack: err.stack } : { error: "Server error" });
  }
}
