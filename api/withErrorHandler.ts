type Handler = (req: any, res: any) => any | Promise<any>;

type WrappedOptions = {
  route: string;
};

function isDebug(req: any) {
  return String(req?.query?.debug ?? "") === "1";
}

function maskEnvValue(v: string | null) {
  if (!v) return null;
  if (v.length <= 8) return "***";
  return `${v.slice(0, 4)}…${v.slice(-4)}`;
}

export function envReport() {
  const url = String(process.env.SUPABASE_URL || "").trim() || null;
  const anonKey = String(process.env.SUPABASE_ANON_KEY || "").trim() || null;
  const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim() || null;

  const missing = {
    SUPABASE_URL: !url,
    SUPABASE_ANON_KEY: !anonKey,
    SUPABASE_SERVICE_ROLE_KEY: !serviceRoleKey,
  };

  return {
    missing,
    present: {
      SUPABASE_URL: Boolean(url),
      SUPABASE_ANON_KEY: Boolean(anonKey),
      SUPABASE_SERVICE_ROLE_KEY: Boolean(serviceRoleKey),
    },
    masked: {
      SUPABASE_URL: url,
      SUPABASE_ANON_KEY: maskEnvValue(anonKey),
      SUPABASE_SERVICE_ROLE_KEY: maskEnvValue(serviceRoleKey),
    },
  };
}

export function getBearerToken(req: any) {
  const header = String(req?.headers?.authorization ?? req?.headers?.Authorization ?? "").trim();
  if (!header.toLowerCase().startsWith("bearer ")) return null;
  const token = header.slice("bearer ".length).trim();
  return token.length > 0 ? token : null;
}

function sendJson(res: any, status: number, body: any) {
  try {
    if (typeof res.status === "function" && typeof res.json === "function") {
      return res.status(status).json(body);
    }
  } catch {}

  res.statusCode = status;
  res.setHeader?.("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

export function withErrorHandler(handler: Handler, opts: WrappedOptions) {
  return async function wrapped(req: any, res: any) {
    const debug = isDebug(req);
    const tokenPresent = Boolean(getBearerToken(req));
    const env = envReport();

    try {
      console.log(`${opts.route} start`, { method: req?.method, tokenPresent, envPresent: env.present });
      await handler(req, res);
    } catch (e) {
      const err = e instanceof Error ? e : new Error("Unhandled error");
      console.error(`${opts.route} crash`, { message: err.message, stack: err.stack });

      const payload = {
        success: false,
        error: "Internal Server Error",
        message: debug ? err.message : undefined,
        debug: debug
          ? {
              env: env.masked,
              tokenPresent,
              route: opts.route,
              method: req?.method,
            }
          : undefined,
      };
      sendJson(res, 500, payload);
    }
  };
}

export function requireEnvOrThrow(required: Array<keyof ReturnType<typeof envReport>["missing"]>) {
  const env = envReport();
  const missing: string[] = [];
  for (const k of required) {
    if ((env.missing as any)[k]) missing.push(k);
  }
  if (missing.length > 0) {
    const err = new Error(`Missing required env: ${missing.join(", ")}`);
    (err as any).code = "MISSING_ENV";
    throw err;
  }
}

export function sendJsonError(res: any, status: number, error: string, message?: string) {
  return sendJson(res, status, { success: false, error, message });
}

