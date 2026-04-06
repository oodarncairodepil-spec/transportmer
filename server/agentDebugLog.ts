import fs from "node:fs";

const LOG_PATH = "/Users/plugoemployee/Transportmer/transportmer/.cursor/debug-989f64.log";
const INGEST = "http://127.0.0.1:7263/ingest/8242b6f4-7f2f-48be-968d-91813ce1a602";

/** NDJSON debug log for agent session 989f64 — do not log secrets/PII */
export function agentDebugLog(
  location: string,
  message: string,
  data: Record<string, unknown>,
  hypothesisId: string,
  runId?: string,
) {
  const payload = {
    sessionId: "989f64",
    location,
    message,
    data,
    hypothesisId,
    runId: runId ?? "pre-fix",
    timestamp: Date.now(),
  };
  try {
    fs.appendFileSync(LOG_PATH, `${JSON.stringify(payload)}\n`);
  } catch {
    /* ignore (e.g. read-only serverless FS) */
  }
  fetch(INGEST, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "989f64" },
    body: JSON.stringify(payload),
  }).catch(() => {});
}
