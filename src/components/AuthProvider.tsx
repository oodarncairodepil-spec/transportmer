import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { debugLog } from "@/lib/debug";

type StaffProfile = {
  user_id: string;
  email: string;
  name: string;
  phone: string | null;
  title: string | null;
  role: string;
  must_change_password: boolean;
  created_at: string;
};

type AuthContextValue = {
  loading: boolean;
  configured: boolean;
  session: Session | null;
  user: User | null;
  profileLoading: boolean;
  profile: StaffProfile | null;
  role: "admin" | "staff" | null;
  mustChangePassword: boolean;
  refreshProfile: () => Promise<void>;
  signInWithPassword: (email: string, password: string) => Promise<{ ok: true } | { ok: false; message: string }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profile, setProfile] = useState<StaffProfile | null>(null);
  const configured = Boolean(getSupabaseClient());

  const signOut = useCallback(async () => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      setSession(null);
      setUser(null);
      setProfile(null);
      setProfileLoading(false);
      return;
    }

    try {
      await supabase.auth.signOut({ scope: "local" });
    } catch {}

    setSession(null);
    setUser(null);
    setProfile(null);
    setProfileLoading(false);
  }, []);

  const refreshProfile = useCallback(async () => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      debugLog("AuthProvider.refreshProfile: supabase not configured");
      setProfile(null);
      setProfileLoading(false);
      return;
    }
    const { data } = await supabase.auth.getSession();
    if (!data.session?.user) {
      debugLog("AuthProvider.refreshProfile: no session user");
      setProfile(null);
      setProfileLoading(false);
      return;
    }

    debugLog("AuthProvider.refreshProfile: start");
    setProfileLoading(true);
    const { data: row, error } = await supabase
      .from("staff_profiles")
      .select("user_id,email,name,phone,title,role,must_change_password,created_at")
      .eq("user_id", data.session.user.id)
      .maybeSingle();
    if (error) {
      debugLog("AuthProvider.refreshProfile: error", error.message);
      setProfile(null);
      setProfileLoading(false);
      return;
    }
    setProfile(row as StaffProfile | null);
    debugLog("AuthProvider.refreshProfile: ok", Boolean(row), row?.role);
    setProfileLoading(false);
  }, []);


  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      setLoading(false);
      return;
    }

    let mounted = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!mounted) return;
        setSession(data.session);
        setUser(data.session?.user ?? null);
        setLoading(false);
        void refreshProfile();
      })
      .catch(() => {
        if (!mounted) return;
        setSession(null);
        setUser(null);
        setLoading(false);
        setProfile(null);
        setProfileLoading(false);
      });

    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
      debugLog("AuthProvider.authStateChange:", event);

      if (event === "TOKEN_REFRESH_FAILED") {
        void signOut();
        setLoading(false);
        return;
      }

      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setLoading(false);
      void refreshProfile();
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, [refreshProfile]);

  const value = useMemo<AuthContextValue>(
    () => ({
      loading,
      configured,
      session,
      user,
      profileLoading,
      profile,
      role: (() => {
        const metaRole = String((user?.app_metadata as any)?.role ?? "")
          .trim()
          .toLowerCase();
        const profileRole = String(profile?.role ?? "")
          .trim()
          .toLowerCase();
        if (profileRole === "admin" || metaRole === "admin") return "admin";
        if (profileRole === "staff" || metaRole === "staff") return "staff";
        return null;
      })(),
      mustChangePassword: Boolean(profile?.must_change_password),
      refreshProfile,
      signInWithPassword: async (email, password) => {
        const supabase = getSupabaseClient();
        if (!supabase) {
          return { ok: false, message: "Supabase is not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY." };
        }

        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          debugLog("AuthProvider.signInWithPassword: error", {
            message: error.message,
            status: (error as any).status,
            code: (error as any).code,
            name: (error as any).name,
          });
          return { ok: false, message: error.message };
        }
        return { ok: true };
      },
      signOut,
    }),
    [configured, loading, profile, profileLoading, refreshProfile, session, signOut, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
