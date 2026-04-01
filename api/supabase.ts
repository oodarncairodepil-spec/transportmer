type JsonRes = { status: number; body: any };

async function createSupabaseClient(url: string, key: string) {
  const mod = (await import("@supabase/supabase-js")) as any;
  const createClient = mod.createClient as (url: string, key: string, opts: any) => any;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function getHeader(req: any, name: string) {
  const headers = req?.headers ?? {};
  const lower = name.toLowerCase();
  return (headers[lower] ?? headers[name] ?? headers[name.toLowerCase()]) as string | undefined;
}

export function getEnv() {
  const url = String(process.env.SUPABASE_URL || "").trim();
  const anonKey = String(process.env.SUPABASE_ANON_KEY || "").trim();
  const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  return {
    url: url || null,
    anonKey: anonKey || null,
    serviceRoleKey: serviceRoleKey || null,
  };
}

export function getBearerToken(req: any) {
  const header = String(getHeader(req, "authorization") || "").trim();
  if (!header.toLowerCase().startsWith("bearer ")) return null;
  const token = header.slice("bearer ".length).trim();
  return token.length > 0 ? token : null;
}

export function isDebug(req: any) {
  return String(req?.query?.debug ?? "") === "1";
}

export function json(res: any, payload: JsonRes) {
  return res.status(payload.status).json(payload.body);
}

export async function requireUser(req: any): Promise<
  | { ok: true; user: any; token: string }
  | { ok: false; status: number; error: string; debug?: Record<string, unknown> }
> {
  const { url, anonKey } = getEnv();
  const token = getBearerToken(req);

  if (!token) {
    return { ok: false, status: 401, error: "Missing bearer token" };
  }
  if (!url || !anonKey) {
    return {
      ok: false,
      status: 500,
      error: "Supabase env not configured",
      debug: { hasUrl: Boolean(url), hasAnonKey: Boolean(anonKey) },
    };
  }

  const supabase = await createSupabaseClient(url, anonKey);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return { ok: false, status: 401, error: error?.message ? `Invalid auth token: ${error.message}` : "Invalid auth token" };
  }

  return { ok: true, user: data.user, token };
}

export async function requireAdmin(user: any): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const role = String(user?.app_metadata?.role ?? "").trim().toLowerCase();
  if (role === "admin") return { ok: true };

  const { url, serviceRoleKey } = getEnv();
  if (!url || !serviceRoleKey) {
    return { ok: false, status: 403, error: "Forbidden" };
  }

  const supabaseAdmin = await createSupabaseClient(url, serviceRoleKey);

  const { data: profileRow, error } = await supabaseAdmin
    .from("staff_profiles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!error) {
    const profileRole = String((profileRow as any)?.role ?? "").trim().toLowerCase();
    if (profileRole === "admin") return { ok: true };
  }

  const { count, error: countErr } = await supabaseAdmin
    .from("staff_profiles")
    .select("user_id", { count: "exact", head: true })
    .eq("role", "admin");
  if (!countErr && (count ?? 0) === 0) {
    const email = String(user?.email ?? `${user.id}@local`);
    const name = String(user?.user_metadata?.name ?? email ?? "Admin");
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
    if (!upsertErr) return { ok: true };
  }

  return { ok: false, status: 403, error: "Forbidden" };
}

export async function getAdminClient() {
  const { url, serviceRoleKey } = getEnv();
  if (!url || !serviceRoleKey) return null;
  return createSupabaseClient(url, serviceRoleKey);
}

