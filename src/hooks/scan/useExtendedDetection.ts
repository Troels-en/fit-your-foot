import { useCallback, useRef } from "react";

import {
  detectExtended,
  type CameraIntrinsics,
  type DetectExtendedResult,
  type SessionAuth,
} from "@/lib/scan/extendedApi";

/**
 * Throttled wrapper für /detect-extended-API-calls. Nicht jeden 250ms-Tick
 * triggern — sondern höchstens 1 Call per VALIDATION_INTERVAL_MS (default
 * 1.5s — matched Iter-3-Pivot value für Modal-Cost + Network-Bandwidth).
 *
 * Concurrent-Call-Lock: wenn ein Call in-flight ist, neue Calls werden
 * ignored bis der vorige resolved. Verhindert Modal-Backend-Pile-Up bei
 * slow Network.
 *
 * Caller-Pattern (im runTickBody):
 *   const { invoke, lastResult } = useExtendedDetection();
 *   const result = await invoke(blob, intrinsics, "A4", "top", "right");
 *   if (result === null) {
 *     // throttled — use lastResult.current für gates
 *   } else {
 *     // fresh result, lastResult auch updated
 *   }
 */

export type ExtendedDetectionAPI = {
  /**
   * Invoke detect-extended call. Returns null wenn throttled OR concurrent-
   * lock active. Returns DetectExtendedResult on success/failure.
   */
  invoke: (
    photo: Blob,
    intrinsics: CameraIntrinsics,
    matFormat: "A4" | "A3",
    phase: "top" | "side",
    selectedFoot: "left" | "right",
    auth?: SessionAuth | null,
  ) => Promise<DetectExtendedResult | null>;
  /**
   * Last successful result + timestamp. Used als Cache zwischen throttled-
   * Ticks damit Gates konsistent evaluiert werden können.
   */
  lastResult: React.MutableRefObject<{
    result: DetectExtendedResult | null;
    timestamp: number;
  }>;
  /**
   * Reset cached state (z.B. bei Phase-Transition top → side).
   */
  reset: () => void;
};

const DEFAULT_THROTTLE_MS = 1500;
const STALE_AFTER_MS = 5000;

export function useExtendedDetection(
  throttleMs = DEFAULT_THROTTLE_MS,
): ExtendedDetectionAPI {
  const lastCallAtRef = useRef<number>(0);
  const inflightRef = useRef<boolean>(false);
  const lastResultRef = useRef<{
    result: DetectExtendedResult | null;
    timestamp: number;
  }>({ result: null, timestamp: 0 });

  const invoke = useCallback(
    async (
      photo: Blob,
      intrinsics: CameraIntrinsics,
      matFormat: "A4" | "A3",
      phase: "top" | "side",
      selectedFoot: "left" | "right",
      auth?: SessionAuth | null,
    ) => {
      const now = Date.now();
      if (inflightRef.current) return null;
      if (now - lastCallAtRef.current < throttleMs) return null;

      inflightRef.current = true;
      lastCallAtRef.current = now;
      try {
        const result = await detectExtended(
          photo,
          intrinsics,
          matFormat,
          phase,
          selectedFoot,
          auth,
        );
        lastResultRef.current = { result, timestamp: Date.now() };
        return result;
      } catch (err) {
        // Network / Server-Error — keep stale lastResult, return null-ish.
        return null;
      } finally {
        inflightRef.current = false;
      }
    },
    [throttleMs],
  );

  const reset = useCallback(() => {
    lastCallAtRef.current = 0;
    lastResultRef.current = { result: null, timestamp: 0 };
  }, []);

  return { invoke, lastResult: lastResultRef, reset };
}

/**
 * Helper: prüft ob lastResult stale ist (älter als 5s). Stale → ignore für
 * Gate-Eval (alte Pose-Info matcht nicht mehr aktuelle Camera-Position).
 */
export function isExtendedResultFresh(
  cache: { result: DetectExtendedResult | null; timestamp: number },
  staleAfterMs = STALE_AFTER_MS,
): boolean {
  if (!cache.result || cache.timestamp === 0) return false;
  return Date.now() - cache.timestamp < staleAfterMs;
}
