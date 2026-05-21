import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { ScanRow } from "@/lib/api";
import { fetchSession } from "@/lib/api";

type SessionStatus = "pending" | "scanning" | "complete" | "error";

/**
 * Subscribe to a scan row and receive live updates as the mobile flow writes
 * measurements. Uses Supabase Realtime as the primary signal AND a 2s polling
 * fallback so demos never hang if a Realtime channel silently drops the UPDATE
 * event (RLS edge cases, publication misconfig, transient socket drops).
 *
 * Polling stops automatically once status === 'complete'.
 */
export function useSessionRealtime(sessionId: string | null, clientToken?: string | null) {
  const [session, setSession] = useState<ScanRow | null>(null);
  const [status, setStatus] = useState<SessionStatus>("pending");
  const [error, setError] = useState<Error | null>(null);
  const statusRef = useRef<SessionStatus>("pending");
  statusRef.current = status;

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;

    const applyRow = (row: ScanRow | null, source: string) => {
      if (cancelled || !row) return;
      setSession(row);
      if (row.status) {
        setStatus(row.status as SessionStatus);
        console.info("[realtime] session update", {
          source,
          sessionId,
          status: row.status,
        });
      }
    };

    fetchSession(sessionId, clientToken)
      .then((row) => applyRow(row, "initial-fetch"))
      .catch((e) => !cancelled && setError(e));

    const channel = supabase
      .channel(`scan:${sessionId}:${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "scans",
          filter: `id=eq.${sessionId}`,
        },
        (payload) => applyRow(payload.new as ScanRow, "realtime")
      )
      .subscribe((channelStatus) => {
        console.info("[realtime] channel status", { sessionId, channelStatus });
      });

    // Polling fallback — guarantees the laptop catches the scan even if
    // Realtime silently fails. Stops once we observe status='complete'.
    const pollHandle = window.setInterval(() => {
      if (statusRef.current === "complete") return;
      fetchSession(sessionId, clientToken)
        .then((row) => applyRow(row, "poll"))
        .catch(() => {
          /* swallow — next tick retries */
        });
    }, 2000);

    return () => {
      cancelled = true;
      window.clearInterval(pollHandle);
      supabase.removeChannel(channel);
    };
  }, [sessionId, clientToken]);

  return { session, status, error };
}
