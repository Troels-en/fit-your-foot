import { useEffect, useState, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

type GateState =
  | { phase: "loading" }
  | { phase: "anonymous" }
  | { phase: "approved" }
  | { phase: "pending" }
  | { phase: "waitlist" }
  | { phase: "rejected" };

/**
 * Schützt eine Route. Verhalten:
 * - Nicht eingeloggt → Redirect /auth (mit Redirect-Back-Param)
 * - Eingeloggt + approval_status='approved' → render children
 * - Eingeloggt + pending|rejected|waitlist → Redirect /warteliste
 *
 * Den Status holen wir aus profiles.approval_status (RLS lässt User nur
 * eigene Row sehen). Wenn das Profile noch nicht da ist (Race-Condition
 * direkt nach Signup), behandeln wir's als 'pending'.
 */
export default function AuthGate({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [state, setState] = useState<GateState>({ phase: "loading" });

  useEffect(() => {
    let cancelled = false;

    async function check() {
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled) return;

      if (!session?.user) {
        setState({ phase: "anonymous" });
        return;
      }

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("approval_status")
        .eq("id", session.user.id)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        console.error("AuthGate profile fetch failed", error);
        // Fail-closed: behandle als pending
        setState({ phase: "pending" });
        return;
      }

      const status = profile?.approval_status ?? "pending";
      switch (status) {
        case "approved":
          setState({ phase: "approved" });
          break;
        case "waitlist":
          setState({ phase: "waitlist" });
          break;
        case "rejected":
          setState({ phase: "rejected" });
          break;
        case "pending":
        default:
          setState({ phase: "pending" });
          break;
      }
    }

    check();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      // Only re-check on actual login/logout — TOKEN_REFRESHED + USER_UPDATED
      // don't change the gate decision and would just cause UI flicker.
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") check();
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  if (state.phase === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
        Lade…
      </div>
    );
  }

  if (state.phase === "anonymous") {
    const redirectTo = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/auth?redirect=${redirectTo}`} replace />;
  }

  if (state.phase !== "approved") {
    return <Navigate to={`/warteliste?status=${state.phase}`} replace />;
  }

  return <>{children}</>;
}
