import { useEffect, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/components/AuthProvider";
import { debugLog } from "@/lib/debug";
import { apiFetchJson } from "@/lib/apiFetch";

export default function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { role, loading, profileLoading, session, refreshProfile, signOut } = useAuth();
  const [denied, setDenied] = useState(false);
  const checkedTokenRef = useRef<string | null>(null);

  useEffect(() => {
    const token = session?.access_token;

    if (loading || profileLoading || role === "admin") {
      return;
    }

    if (!token) {
      debugLog("RequireAdmin: missing token");
      setDenied(true);
      return;
    }

    if (checkedTokenRef.current === token) {
      debugLog("RequireAdmin: token already checked");
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    checkedTokenRef.current = token;
    setDenied(false);
    debugLog("RequireAdmin: checking admin via /api/staff");

    apiFetchJson<{ staff: unknown[] }>(
      "/api/staff",
      { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal },
      { label: "GET /api/staff (RequireAdmin)" },
    )
      .then(async (result) => {
        if ("error" in result) {
          if (result.status === 401) {
            debugLog("RequireAdmin: 401, signing out");
            await signOut();
          }
          throw new Error(result.error);
        }

        await refreshProfile();
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        if (!cancelled) {
          debugLog("RequireAdmin: denied");
          setDenied(true);
        }
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [loading, profileLoading, refreshProfile, role, session?.access_token]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-sm text-muted-foreground">Loading…</div>
      </div>
    );
  }

  if (role === "admin") {
    return <>{children}</>;
  }

  if (profileLoading || !denied) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-sm text-muted-foreground">Loading…</div>
      </div>
    );
  }

  return <Navigate to="/" replace />;
}
