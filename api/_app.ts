import { agentDebugLog } from "../server/agentDebugLog.js";

let cachedApp: ((req: any, res: any) => any) | null = null;
let cachedError: unknown = null;
let loading: Promise<void> | null = null;

async function loadApp() {
  if (cachedApp || cachedError) return;
  if (!loading) {
    loading = import("../server/index.js")
      .then((m) => {
        cachedApp = (m as any).default;
      })
      .catch((e) => {
        cachedError = e;
      })
      .finally(() => {
        loading = null;
      });
  }
  await loading;
}

function isDebug(req: any) {
  return String(req.query?.debug ?? "") === "1";
}

export async function handleWithExpressApp(req: any, res: any) {
  await loadApp();

  if (cachedError || !cachedApp) {
    const err = cachedError instanceof Error ? cachedError : new Error("Failed to load server");
    // #region agent log
    agentDebugLog(
      "api/_app.ts:handleWithExpressApp",
      "express_app_load_failed",
      {
        hasCachedApp: !!cachedApp,
        errName: err.name,
        errMessage: err.message.slice(0, 500),
        url: typeof req?.url === "string" ? req.url.slice(0, 200) : "",
      },
      "H1",
    );
    // #endregion
    const payload: any = { error: "Server initialization failed" };
    if (isDebug(req)) {
      payload.detail = err.message;
      payload.stack = err.stack;
    }
    return res.status(500).json(payload);
  }

  try {
    return cachedApp(req as any, res as any);
  } catch (e) {
    const err = e instanceof Error ? e : new Error("Unhandled server error");
    // #region agent log
    agentDebugLog(
      "api/_app.ts:handleWithExpressApp",
      "cachedApp_sync_throw",
      {
        errName: err.name,
        errMessage: err.message.slice(0, 500),
        url: typeof req?.url === "string" ? req.url.slice(0, 200) : "",
      },
      "H2",
    );
    // #endregion
    const payload: any = { error: "Unhandled server error" };
    if (isDebug(req)) {
      payload.detail = err.message;
      payload.stack = err.stack;
    }
    return res.status(500).json(payload);
  }
}
