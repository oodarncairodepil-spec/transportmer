import { useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";

import { useAuth } from "@/components/AuthProvider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { debugLog } from "@/lib/debug";

export default function ResetPassword() {
  const navigate = useNavigate();
  const { session, refreshProfile, signOut } = useAuth();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const matches = newPassword.length > 0 && confirmPassword.length > 0 && newPassword === confirmPassword;
  const canSubmit = matches && newPassword.length >= 8 && !submitting;

  return (
    <div className="min-h-svh flex items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader>
            <CardTitle>Reset password</CardTitle>
            <CardDescription>Set a new password for your account.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!session && (
              <Alert variant="destructive">
                <AlertTitle>Reset link required</AlertTitle>
                <AlertDescription>Open this page from the password reset email link.</AlertDescription>
              </Alert>
            )}

            {error && (
              <Alert variant="destructive">
                <AlertTitle>Update failed</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {done && (
              <Alert>
                <AlertTitle>Password updated</AlertTitle>
                <AlertDescription>You can now sign in with your new password.</AlertDescription>
              </Alert>
            )}

            <form
              className="space-y-4"
              onSubmit={async (e) => {
                e.preventDefault();
                setError(null);

                if (!session) {
                  setError("No active reset session. Please open the reset link again.");
                  return;
                }
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
                  const r = await fetch("/api/auth/update-password", {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      Authorization: `Bearer ${session.access_token}`,
                    },
                    body: JSON.stringify({ newPassword }),
                  });
                  const data = (await r.json()) as any;
                  if (!r.ok) {
                    debugLog("ResetPassword.update-password error", r.status, data);
                    setError(String(data?.error || "Failed to update password"));
                    setSubmitting(false);
                    return;
                  }

                  await refreshProfile();
                  await signOut();
                  setDone(true);
                  setSubmitting(false);
                  navigate("/login", { replace: true });
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Failed to update password");
                  setSubmitting(false);
                }
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="newPassword">New password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                />
                {!matches && confirmPassword.length > 0 ? (
                  <p className="text-xs text-destructive">Passwords must match.</p>
                ) : null}
              </div>

              <Button type="submit" className="w-full" disabled={!canSubmit || !session}>
                {submitting ? "Updating…" : "Update password"}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex items-center justify-center">
            <p className="text-xs text-muted-foreground">Minimum 8 characters.</p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
