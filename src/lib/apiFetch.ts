import { debugLog } from "@/lib/debug";

export async function apiFetchJson<T>(
  input: RequestInfo | URL,
  init?: RequestInit,
  meta?: { label?: string },
): Promise<{ ok: true; status: number; data: T } | { ok: false; status: number; error: string; raw?: string }> {
  const label = meta?.label ?? (typeof input === "string" ? input : "request");
  let res: Response;
  try {
    res = await fetch(input, init);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Network error";
    debugLog("apiFetchJson network error", label, msg);
    return { ok: false as const, status: 0, error: msg };
  }

  const contentType = res.headers.get("content-type") ?? "";
  const status = res.status;

  const readText = async () => {
    try {
      return await res.text();
    } catch {
      return "";
    }
  };

  if (!contentType.toLowerCase().includes("application/json")) {
    const raw = await readText();
    debugLog("apiFetchJson non-json", label, status, contentType, raw.slice(0, 200));
    return {
      ok: false as const,
      status,
      error: `Non-JSON response (${status}). content-type=${contentType || "unknown"}`,
      raw,
    };
  }

  try {
    const data = (await res.json()) as T;
    if (!res.ok) {
      debugLog("apiFetchJson error json", label, status, data);
      const err = (data as any)?.error ? String((data as any).error) : `Request failed (${status})`;
      return { ok: false as const, status, error: err };
    }
    return { ok: true as const, status, data };
  } catch {
    const raw = await readText();
    debugLog("apiFetchJson json-parse-failed", label, status, raw.slice(0, 200));
    return { ok: false as const, status, error: `Invalid JSON response (${status})`, raw };
  }
}
