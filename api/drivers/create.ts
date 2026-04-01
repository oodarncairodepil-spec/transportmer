export const config = { runtime: "nodejs" };

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

export default async function handler(req: any, res: any) {
  try {
    const mod = (await import("../../serverless/handlers/driverCreate.js")) as any;
    const inner = mod.default as (req: any, res: any) => any;
    return await inner(req, res);
  } catch (e) {
    const err = e instanceof Error ? e : new Error("Server error");
    return sendJson(res, 500, {
      success: false,
      error: "Function initialization failed",
      message: String(req?.query?.debug ?? "") === "1" ? err.message : undefined,
    });
  }
}

