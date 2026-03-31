import { useCallback, useEffect, useMemo, useState } from "react";
import { Copy, KeyRound, Plus, RefreshCcw } from "lucide-react";

import { useAuth } from "@/components/AuthProvider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { debugLog } from "@/lib/debug";
import { apiFetchJson } from "@/lib/apiFetch";

type StaffRow = {
  user_id: string;
  email: string;
  name: string;
  phone: string | null;
  title: string | null;
  role: string;
  must_change_password: boolean;
  created_at: string;
};

export default function AdminStaff() {
  const { session, signOut } = useAuth();
  const token = session?.access_token ?? "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [staff, setStaff] = useState<StaffRow[]>([]);

  const [createOpen, setCreateOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [title, setTitle] = useState("");
  const [staffRole, setStaffRole] = useState<"admin" | "staff">("staff");
  const [creating, setCreating] = useState(false);

  const [oneTimePassword, setOneTimePassword] = useState<string | null>(null);
  const [oneTimeEmail, setOneTimeEmail] = useState<string | null>(null);
  const [rotateOpen, setRotateOpen] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [rotateError, setRotateError] = useState<string | null>(null);
  const [rotateUserId, setRotateUserId] = useState<string | null>(null);
  const [rotateRole, setRotateRole] = useState<"admin" | "staff">("staff");

  const loginInstructions = useMemo(() => {
    if (!oneTimeEmail || !oneTimePassword) return null;
    return `Login URL: ${window.location.origin}/login\nEmail: ${oneTimeEmail}\nTemporary password: ${oneTimePassword}\n\nYou will be asked to change your password on first login.`;
  }, [oneTimeEmail, oneTimePassword]);

  const loadStaff = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      debugLog("AdminStaff: loading staff");
      const result = await apiFetchJson<{ staff: StaffRow[] }>("/api/staff", {
        headers: { Authorization: `Bearer ${token}` },
      }, { label: "GET /api/staff (AdminStaff)" });

      if (!result.ok) {
        if (result.status === 401) {
          await signOut();
        }
        setError(result.raw ? `${result.error}\n\n${result.raw.slice(0, 300)}` : result.error);
        setStaff([]);
        setLoading(false);
        return;
      }
      debugLog("AdminStaff: /api/staff ok", (result.data.staff ?? []).length);
      setStaff((result.data.staff ?? []) as StaffRow[]);
      setLoading(false);
    } catch (e) {
      debugLog("AdminStaff: load error", e instanceof Error ? e.message : e);
      setError(e instanceof Error ? e.message : "Failed to load staff");
      setStaff([]);
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadStaff();
  }, [loadStaff]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Staff management</h1>
          <p className="text-sm text-muted-foreground">Create staff users and rotate temporary passwords.</p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => void loadStaff()} disabled={loading}>
            <RefreshCcw className="h-4 w-4 mr-2" />
            Refresh
          </Button>

          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create staff
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create staff</DialogTitle>
                <DialogDescription>Generates a one-time temporary password for first login.</DialogDescription>
              </DialogHeader>

              {error && (
                <Alert variant="destructive">
                  <AlertTitle>Action failed</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <form
                className="space-y-4"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!token) return;
                  setCreating(true);
                  setError(null);
                  setOneTimeEmail(null);
                  setOneTimePassword(null);

                  try {
                    const r = await fetch("/api/staff/create", {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                      },
                      body: JSON.stringify({
                        email: email.trim(),
                        name: name.trim(),
                        role: staffRole,
                        phone: phone.trim() ? phone.trim() : undefined,
                        title: title.trim() ? title.trim() : undefined,
                      }),
                    });
                    const data = (await r.json()) as any;
                    if (!r.ok) {
                      setError(String(data?.error || "Failed to create staff"));
                      setCreating(false);
                      return;
                    }

                    setOneTimeEmail(email.trim());
                    setOneTimePassword(String(data.tempPassword || ""));
                    setEmail("");
                    setName("");
                    setPhone("");
                    setTitle("");
                    setStaffRole("staff");
                    setCreating(false);
                    await loadStaff();
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Failed to create staff");
                    setCreating(false);
                  }
                }}
              >
                <div className="space-y-2">
                  <Label htmlFor="staffEmail">Email</Label>
                  <Input id="staffEmail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="staffName">Full name</Label>
                  <Input id="staffName" value={name} onChange={(e) => setName(e.target.value)} required />
                </div>

                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select value={staffRole} onValueChange={(v) => setStaffRole(v as "admin" | "staff")}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="staff">Staff</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="staffPhone">Phone (optional)</Label>
                    <Input id="staffPhone" value={phone} onChange={(e) => setPhone(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="staffTitle">Title (optional)</Label>
                    <Input id="staffTitle" value={title} onChange={(e) => setTitle(e.target.value)} />
                  </div>
                </div>

                <Button type="submit" className="w-full" disabled={creating || !email.trim() || !name.trim()}>
                  {creating ? "Creating…" : "Create"}
                </Button>

                {oneTimePassword && oneTimeEmail && (
                  <Card className="sticky bottom-0 bg-card">
                    <CardHeader>
                      <CardTitle className="text-base">One-time temporary password</CardTitle>
                      <CardDescription>Copy now. You won’t be able to view this again.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="space-y-1">
                        <div className="text-xs text-muted-foreground">Email</div>
                        <div className="text-sm font-mono break-all">{oneTimeEmail}</div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-xs text-muted-foreground">Temporary password</div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 text-sm font-mono break-all">{oneTimePassword}</div>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={async () => {
                              await navigator.clipboard.writeText(oneTimePassword);
                            }}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {loginInstructions && (
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full"
                          onClick={async () => {
                            await navigator.clipboard.writeText(loginInstructions);
                          }}
                        >
                          <Copy className="h-4 w-4 mr-2" />
                          Copy login instructions
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                )}
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {error && !createOpen && (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Staff</CardTitle>
          <CardDescription>All staff profiles in your workspace.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : staff.length === 0 ? (
            <div className="text-sm text-muted-foreground">No staff yet.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {staff.map((s) => (
                  <TableRow key={s.user_id}>
                    <TableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap">
                      {s.user_id}
                    </TableCell>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell className="font-mono text-xs">{s.email}</TableCell>
                    <TableCell className="whitespace-nowrap">{s.role}</TableCell>
                    <TableCell>
                      <span className="text-xs">
                        {s.must_change_password ? "First login required" : "Active"}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(s.created_at).toLocaleString()}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          if (!token) return;
                          setRotateError(null);
                          setOneTimeEmail(s.email);
                          setOneTimePassword(null);
                          setRotateUserId(s.user_id);
                          setRotateRole((s.role === "admin" ? "admin" : "staff") as "admin" | "staff");
                          setRotateOpen(true);
                          setRotating(true);
                          try {
                            const r = await fetch("/api/staff/rotate-password", {
                              method: "POST",
                              headers: {
                                "Content-Type": "application/json",
                                Authorization: `Bearer ${token}`,
                              },
                              body: JSON.stringify({ userId: s.user_id }),
                            });
                            const data = (await r.json()) as any;
                            if (!r.ok) {
                              setRotateError(String(data?.error || "Failed to rotate password"));
                              setRotating(false);
                              return;
                            }
                            setOneTimePassword(String(data.tempPassword || ""));
                            setRotating(false);
                            await loadStaff();
                          } catch (err) {
                            setRotateError(err instanceof Error ? err.message : "Failed to rotate password");
                            setRotating(false);
                          }
                        }}
                      >
                        <KeyRound className="h-4 w-4 mr-2" />
                        Rotate
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={rotateOpen}
        onOpenChange={(open) => {
          setRotateOpen(open);
          if (!open) {
            setRotating(false);
            setRotateError(null);
            setRotateUserId(null);
            setRotateRole("staff");
            setOneTimeEmail(null);
            setOneTimePassword(null);
          }
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Rotate temporary password</DialogTitle>
            <DialogDescription>
              Generates a new one-time temporary password. The staff member will be required to change it on first login.
            </DialogDescription>
          </DialogHeader>

          {rotateError ? (
            <Alert variant="destructive">
              <AlertTitle>Action failed</AlertTitle>
              <AlertDescription>{rotateError}</AlertDescription>
            </Alert>
          ) : null}

          <div className="space-y-3">
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">User</div>
              <div className="text-sm font-mono break-all">{rotateUserId ?? "—"}</div>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Email</div>
              <div className="text-sm font-mono break-all">{oneTimeEmail ?? "—"}</div>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Role</div>
              <div className="text-sm">{rotateRole === "admin" ? "Admin" : "Staff"}</div>
            </div>
          </div>

          {rotating ? <div className="text-sm text-muted-foreground">Generating…</div> : null}

          {oneTimePassword ? (
            <Card className="bg-card">
              <CardHeader>
                <CardTitle className="text-base">One-time temporary password</CardTitle>
                <CardDescription>Copy now. You won’t be able to view this again.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Temporary password</div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 text-sm font-mono break-all">{oneTimePassword}</div>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={async () => {
                        await navigator.clipboard.writeText(oneTimePassword);
                      }}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {loginInstructions ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={async () => {
                      await navigator.clipboard.writeText(loginInstructions);
                    }}
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copy login instructions
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
