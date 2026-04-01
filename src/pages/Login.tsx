import { useMemo, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/components/AuthProvider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff } from "lucide-react";
import { debugLog, isDebugEnabled } from "@/lib/debug";
import { getSupabaseClient } from "@/lib/supabaseClient";

type LocationState = {
  from?: { pathname?: string };
};

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { loading, session, configured, signInWithPassword, signOut } = useAuth();

  const fromPath = useMemo(() => {
    const state = location.state as LocationState | null;
    return state?.from?.pathname ?? "/";
  }, [location.state]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetEmail, setResetEmail] = useState("");
  const [resetOpen, setResetOpen] = useState(false);
  const [resetSubmitting, setResetSubmitting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetDone, setResetDone] = useState(false);

  if (!loading && session) {
    return <Navigate to={fromPath} replace />;
  }

  const canSubmit = email.trim().length > 3 && password.length > 0 && !submitting;

  return (
    <div className="min-h-svh flex items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader>
            <CardTitle>Sign in</CardTitle>
            <CardDescription>Sign in to access your dashboard.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!configured && (
              <Alert variant="destructive">
                <AlertTitle>Supabase not configured</AlertTitle>
                <AlertDescription>
                  Set <span className="font-mono text-xs">VITE_SUPABASE_URL</span> and{" "}
                  <span className="font-mono text-xs">VITE_SUPABASE_ANON_KEY</span> in your environment.
                </AlertDescription>
              </Alert>
            )}

            {error && (
              <Alert variant="destructive">
                <AlertTitle>Sign-in failed</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <form
              className="space-y-4"
              onSubmit={async (e) => {
                e.preventDefault();
                setError(null);
                setSubmitting(true);
                const result = await signInWithPassword(email.trim(), password);
                setSubmitting(false);

                if (!result.ok) {
                  setError(result.message);
                  return;
                }

                navigate(fromPath, { replace: true });
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <button
                    type="button"
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => setShowPassword((v) => !v)}
                  >
                    <span className="inline-flex items-center gap-1">
                      {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      {showPassword ? "Hide" : "Show"}
                    </span>
                  </button>
                </div>
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
                <div className="flex items-center justify-between">
                  <Dialog open={resetOpen} onOpenChange={setResetOpen}>
                    <DialogTrigger asChild>
                      <button type="button" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                        Forgot password?
                      </button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Reset password</DialogTitle>
                        <DialogDescription>Send a reset link to your email.</DialogDescription>
                      </DialogHeader>
                      {resetError ? (
                        <Alert variant="destructive">
                          <AlertTitle>Request failed</AlertTitle>
                          <AlertDescription>{resetError}</AlertDescription>
                        </Alert>
                      ) : null}
                      {resetDone ? (
                        <Alert>
                          <AlertTitle>Email sent</AlertTitle>
                          <AlertDescription>Check your inbox for a reset link.</AlertDescription>
                        </Alert>
                      ) : null}
                      <form
                        className="space-y-3"
                        onSubmit={async (e) => {
                          e.preventDefault();
                          setResetError(null);
                          setResetDone(false);
                          setResetSubmitting(true);
                          try {
                            const supabase = getSupabaseClient();
                            if (!supabase) {
                              setResetError("Supabase is not configured.");
                              setResetSubmitting(false);
                              return;
                            }
                            const { error: resetErr } = await supabase.auth.resetPasswordForEmail(resetEmail.trim(), {
                              redirectTo: `${window.location.origin}/reset-password`,
                            });
                            if (resetErr) {
                              debugLog("Login.resetPasswordForEmail error", resetErr.message);
                              setResetError(resetErr.message);
                              setResetSubmitting(false);
                              return;
                            }
                            setResetDone(true);
                            setResetSubmitting(false);
                          } catch (err) {
                            setResetError(err instanceof Error ? err.message : "Failed to send reset email");
                            setResetSubmitting(false);
                          }
                        }}
                      >
                        <div className="space-y-2">
                          <Label htmlFor="resetEmail">Email</Label>
                          <Input
                            id="resetEmail"
                            type="email"
                            value={resetEmail}
                            onChange={(e) => setResetEmail(e.target.value)}
                            placeholder="you@example.com"
                            required
                          />
                        </div>
                        <Button type="submit" className="w-full" disabled={resetSubmitting || resetEmail.trim().length < 4}>
                          {resetSubmitting ? "Sending…" : "Send reset link"}
                        </Button>
                      </form>
                    </DialogContent>
                  </Dialog>

                  {isDebugEnabled() ? (
                    <button
                      type="button"
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                      onClick={async () => {
                        await signOut();
                        setError(null);
                      }}
                    >
                      Clear session
                    </button>
                  ) : null}
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={!canSubmit}>
                {submitting ? "Signing in…" : "Sign in"}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex items-center justify-center">
            <p className="text-xs text-muted-foreground">No registration yet.</p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
