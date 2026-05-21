import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { loadProfile, saveProfile, type StoredProfile } from "@/lib/fitProfile";
import type { FootMm } from "@/lib/matchDb";

/**
 * Returns the visitor's current fit profile, preferring (in order):
 * 1. The latest 'complete' scan owned by the logged-in user
 * 2. The localStorage profile (set right after a scan, also for anon visitors)
 *
 * Refreshes when auth state changes.
 */
export function useFitProfile() {
  const [profile, setProfile] = useState<StoredProfile | null>(() => loadProfile());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled) return;

      if (session?.user) {
        const { data } = await supabase
          .from("scans")
          .select("id, client_token, foot_length_mm, ball_width_mm, heel_width_mm, arch_type, eu_size, foot_toebox_height_mm, preferred_drop_mm")
          .eq("user_id", session.user.id)
          .eq("status", "complete")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (cancelled) return;
        if (data?.foot_length_mm && data.ball_width_mm && data.heel_width_mm) {
          const dbProfile: StoredProfile = {
            foot_length_mm: Number(data.foot_length_mm),
            ball_width_mm: Number(data.ball_width_mm),
            heel_width_mm: Number(data.heel_width_mm),
            arch_type: (data.arch_type as FootMm["arch_type"]) ?? "medium",
            eu_size: Number(data.eu_size ?? 42),
            foot_toebox_height_mm: data.foot_toebox_height_mm ? Number(data.foot_toebox_height_mm) : undefined,
            preferred_drop_mm: data.preferred_drop_mm ? Number(data.preferred_drop_mm) : undefined,
            scan_id: data.id,
            client_token: data.client_token ?? undefined,
            updated_at: new Date().toISOString(),
          };
          setProfile(dbProfile);
          saveProfile(dbProfile);
          setLoading(false);
          return;
        }
      }

      setProfile(loadProfile());
      setLoading(false);
    }

    refresh();
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      refresh();
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { profile, loading };
}
