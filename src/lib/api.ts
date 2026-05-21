import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type ScanRow = Tables<"scans">;

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL as string | undefined;

async function backend<T>(path: string, init?: RequestInit): Promise<T> {
  if (!BACKEND_URL) throw new Error("VITE_BACKEND_URL not set");
  const res = await fetch(`${BACKEND_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`Backend ${path} → ${res.status}`);
  return res.json();
}

/**
 * Create a new fit-check session. In the hybrid architecture a "session" is a row
 * in the `scans` table with status='pending'. The mobile scan later UPDATEs the
 * same row with measurements and flips status to 'complete'.
 *
 * Prefers Railway backend when VITE_BACKEND_URL is set; falls back to a direct
 * Supabase insert so the UI is unblocked during parallel backend development.
 */
export async function createSession(args: {
  shoe_slug: string;
  brand_id?: string | null;
}): Promise<{ session_id: string; client_token?: string; session_token?: string }> {
  // Bei eingeloggtem User: direkt insert mit user_id, sodass useFitProfile
  // den fertigen Scan später unter `user_id = auth.uid()` findet.
  // Modal-Backend setzt user_id nicht; RPC-Fallback ist fürs Anon-Demo gedacht.
  // session_token (Task 14) kommt nur bei Modal-/session-Pfad zurück. Im
  // Direct-Supabase-Insert-Pfad ist Modal-Auth N/A — Calls landen direkt in
  // Supabase + RLS handelt Auth.
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) {
    const clientToken = crypto.randomUUID();
    const { data, error } = await (supabase as any)
      .from("scans")
      .insert({
        shoe_slug: args.shoe_slug,
        brand_id: args.brand_id ?? null,
        status: "pending",
        user_id: session.user.id,
        client_token: clientToken,
      })
      .select("id")
      .single();
    if (error) throw error;
    // Wenn Modal-URL gesetzt ist, müssen wir trotzdem zusätzlich Modal /session
    // anfordern für session_token (Modal kennt die Supabase-Row sonst nicht).
    // Path-Constraint: hier nehmen wir die Modal-URL-Variante damit token + sid
    // gleich sind. Falls VITE_BACKEND_URL fehlt, return ohne token (legacy).
    if (BACKEND_URL) {
      try {
        const modal = await backend<{ session_id: string; session_token?: string }>(
          "/session",
          { method: "POST", body: JSON.stringify(args) },
        );
        // Verwende Modal-session_id für API-Calls (token bindet auf diese sid).
        return {
          session_id: modal.session_id,
          client_token: clientToken,
          session_token: modal.session_token,
        };
      } catch {
        // Modal nicht erreichbar — return Supabase-id ohne token.
        return { session_id: data.id as string, client_token: clientToken };
      }
    }
    return { session_id: data.id as string, client_token: clientToken };
  }

  // Anon: bestehender Pfad (Modal oder RPC).
  if (BACKEND_URL) {
    return backend<{ session_id: string; client_token?: string; session_token?: string }>(
      "/session",
      {
        method: "POST",
        body: JSON.stringify(args),
      },
    );
  }
  const { data, error } = await (supabase as any).rpc("create_scan_session", {
    p_shoe_slug: args.shoe_slug,
    p_brand_id: args.brand_id ?? null,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return { session_id: row.session_id, client_token: row.client_token };
}

function readClientToken() {
  return typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("t") : null;
}

export async function fetchSession(session_id: string, client_token = readClientToken()): Promise<ScanRow | null> {
  if (BACKEND_URL) {
    return backend<ScanRow>(`/session/${session_id}`);
  }
  if (!client_token) return null;
  const { data, error } = await (supabase as any).rpc("get_scan_session", {
    p_session_id: session_id,
    p_client_token: client_token,
  });
  if (error) throw error;
  return data;
}

export type SubmitScanPayload = {
  session_id: string;
  client_token?: string | null;
  foot_length_mm: number;
  foot_width_mm: number;
  ball_width_mm: number;
  heel_width_mm: number;
  foot_toebox_height_mm?: number;
  preferred_drop_mm?: number;
  arch_type: "low" | "medium" | "high";
  eu_size: number;
};

export async function submitScan(payload: SubmitScanPayload): Promise<void> {
  if (BACKEND_URL) {
    await backend("/scan", { method: "POST", body: JSON.stringify(payload) });
    return;
  }
  const { session_id, client_token = readClientToken(), ...measurements } = payload;
  if (!client_token) throw new Error("Missing scan token");
  const { error } = await (supabase as any).rpc("submit_scan_measurements", {
    p_session_id: session_id,
    p_client_token: client_token,
    p_foot_length_mm: measurements.foot_length_mm,
    p_foot_width_mm: measurements.foot_width_mm,
    p_ball_width_mm: measurements.ball_width_mm,
    p_heel_width_mm: measurements.heel_width_mm,
    p_arch_type: measurements.arch_type,
    p_eu_size: measurements.eu_size,
    p_foot_toebox_height_mm: measurements.foot_toebox_height_mm ?? null,
    p_preferred_drop_mm: measurements.preferred_drop_mm ?? null,
  });
  if (error) throw error;
}
