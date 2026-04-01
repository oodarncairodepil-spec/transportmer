import { useMemo, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";

import { useAuth } from "@/components/AuthProvider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { debugLog } from "@/lib/debug";
import { apiFetchJson } from "@/lib/apiFetch";

type LocationState = {
  from?: { pathname?: string };
};

export default function ForceChangePassword() {
  const navigate = useNavigate();
  const location = useLocation();
  const { session, mustChangePassword, refreshProfile, signOut } = useAuth();

  const fromPath = useMemo(() => {
    const state = location.state as LocationState | null;
    return state?.from?.pathname ?? "/";
  }, [location.state]);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (!mustChangePassword) {
    return <Navigate to={fromPath} replace />;
  }

  const matches = newPassword.length > 0 && confirmPassword.length > 0 && newPassword === confirmPassword;
  const canSubmit = matches && newPassword.length >= 8 && !submitting;

  return (
    <div className="min-h-svh flex items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader>
            <CardTitle>Change your password</CardTitle>
            <CardDescription>For security, you must set a new password before continuing.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertTitle>Update failed</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {done && (
              <Alert>
                <AlertTitle>Password updated</AlertTitle>
                <AlertDescription>You can continue to the dashboard.</AlertDescription>
              </Alert>
            )}

            <form
              className="space-y-4"
              onSubmit={async (e) => {
                e.preventDefault();
                setError(null);
                if (!matches) {
                  setError("Passwords do not match.");
                  return;
                }
                if (newPassword.length < 8) {
                  setError("Password must be at least 8 characters.");
                  return;
                }

                setSubmitting(true);
                try {
                  debugLog("ForceChangePassword: submitting update-password; token length", session.access_token?.length ?? 0);
                  const result = await apiFetchJson<{ ok: true }>(
                    "/api/auth/update-password",
                    {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${session.access_token}`,
                      },
                      body: JSON.stringify({ newPassword }),
                    },
                    { label: "POST /api/auth/update-password (ForceChangePassword)" },
                  );

                  if (result.ok === false) {
                    if (result.status === 401) {
                      await signOut();
                      navigate("/login", { replace: true, state: { from: location } });
                      return;
                    }
                    setError(result.error);
                    setSubmitting(false);
                    return;
                  }

                  await refreshProfile();
                  setDone(true);
                  setSubmitting(false);
                  navigate(fromPath, { replace: true });
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Failed to update password");
                  setSubmitting(false);
                }
              }}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="newPassword">New password</Label>
                  <button
                    type="button"
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => setShowNew((v) => !v)}
                  >
                    <span className="inline-flex items-center gap-1">
                      {showNew ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      {showNew ? "Hide" : "Show"}
                    </span>
                  </button>
                </div>
                <Input
                  id="newPassword"
                  type={showNew ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                />
                <p className="text-xs text-muted-foreground">At least 8 characters.</p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="confirmPassword">Confirm password</Label>
                  <button
                    type="button"
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => setShowConfirm((v) => !v)}
                  >
                    <span className="inline-flex items-center gap-1">
                      {showConfirm ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      {showConfirm ? "Hide" : "Show"}
                    </span>
                  </button>
                </div>
                <Input
                  id="confirmPassword"
                  type={showConfirm ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                />
                {!matches && confirmPassword.length > 0 && (
                  <p className="text-xs text-destructive">Passwords must match.</p>
                )}
              </div>

              <Button type="submit" className="w-full" disabled={!canSubmit}>
                {submitting ? "Updating…" : "Update password"}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex items-center justify-center">
            <p className="text-xs text-muted-foreground">You can change it again later in Supabase.</p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
