import { useEffect, useState } from "react";

/**
 * Subscribed-Hook auf `screen.orientation.change`-Event. Returns current
 * orientation-type ("portrait-primary" | "portrait-secondary" |
 * "landscape-primary" | "landscape-secondary") oder undefined wenn API
 * nicht verfügbar.
 *
 * Used für Side-Photo-Phase: detect orientation-switch von Portrait zu
 * Landscape vor Capture-Stream-Start. Plus für Hard-Gate-Eval in
 * gates.ts:evaluatePhoneOrientation().
 *
 * Browser-Support: iOS Safari 16.4+, Android Chrome — beide implementiert.
 * Legacy-Fallback: undefined returnt → Caller treated als legacy-accept (kein
 * upside-down-detection möglich).
 */

export type OrientationType =
  | "portrait-primary"
  | "portrait-secondary"
  | "landscape-primary"
  | "landscape-secondary"
  | undefined;

export function useScreenOrientation(): OrientationType {
  const [type, setType] = useState<OrientationType>(() => {
    if (typeof window === "undefined") return undefined;
    return (window.screen?.orientation?.type as OrientationType) ?? undefined;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const orientation = window.screen?.orientation;
    if (!orientation) return;

    const handler = () => {
      setType((orientation.type as OrientationType) ?? undefined);
    };
    orientation.addEventListener?.("change", handler);
    // Initial-sync falls hook mountet nach orientation-already-changed
    handler();
    return () => {
      orientation.removeEventListener?.("change", handler);
    };
  }, []);

  return type;
}
