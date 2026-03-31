export function isDebugEnabled() {
  if (typeof window === "undefined") return false;
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get("debug") === "1") return true;
    if (window.localStorage.getItem("DEBUG") === "1") return true;
  } catch {
    return false;
  }
  return false;
}

export function debugLog(...args: any[]) {
  if (!isDebugEnabled()) return;
  // eslint-disable-next-line no-console
  console.log("[debug]", ...args);
}

