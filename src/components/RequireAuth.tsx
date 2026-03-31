import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/components/AuthProvider";

export default function RequireAuth({
  children,
  allowPasswordChange,
}: {
  children: React.ReactNode;
  allowPasswordChange?: boolean;
}) {
  const location = useLocation();
  const { loading, profileLoading, session, mustChangePassword } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-sm text-muted-foreground">Loading…</div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (mustChangePassword && !allowPasswordChange && location.pathname !== "/force-change-password") {
    return <Navigate to="/force-change-password" replace state={{ from: location }} />;
  }

  return (
    <>
      {profileLoading ? (
        <div className="px-4 py-2 text-xs text-muted-foreground border-b border-border bg-muted/30">Refreshing profile…</div>
      ) : null}
      {children}
    </>
  );
}
