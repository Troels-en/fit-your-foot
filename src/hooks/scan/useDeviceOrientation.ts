import { useCallback, useEffect, useRef, useState } from "react";
import { isOrientationValid, type Orientation } from "@/lib/scan/orientation";

type IOSPermissionFn = () => Promise<"granted" | "denied">;

type DeviceOrientationConstructor = {
  requestPermission?: IOSPermissionFn;
};

export type OrientationPermission = "unknown" | "granted" | "denied" | "unavailable";

/**
 * Cross-browser DeviceOrientation Hook.
 *
 * iOS Safari ≥ 13: requestPermission() muss aus Click-Handler aufgerufen werden.
 * Android Chrome / Firefox: events fließen ohne Permission.
 *
 * Live-Werte über `currentRef.current` statt React-State — sonst triggert
 * jeder Gyro-Tick einen Re-Render und useEffects mit dep auf state würden
 * gerendert/abgerissen werden bei 60Hz.
 */
export function useDeviceOrientation() {
  const [permission, setPermission] = useState<OrientationPermission>("unknown");

  // Live-Refs (kein Re-Render pro Update)
  const currentRef = useRef<Orientation | null>(null);
  const timestampRef = useRef<number | null>(null);
  const hasEverReceivedRef = useRef(false);

  const handlerRef = useRef<((e: DeviceOrientationEvent) => void) | null>(null);
  const startedRef = useRef(false);

  const handleEvent = useCallback((e: DeviceOrientationEvent) => {
    const o = { alpha: e.alpha, beta: e.beta, gamma: e.gamma };
    if (!isOrientationValid(o)) {
      // Sporadisch null mid-stream → frame skip. KEIN hasEverReceivedRef
      // set — probe muss auf VALID Events warten, sonst wird Calibration
      // mit currentRef.current=null gestartet und kann nur timeouten.
      return;
    }
    currentRef.current = o;
    timestampRef.current = Date.now();
    hasEverReceivedRef.current = true;
  }, []);

  // Listener wird IMMER gleich attached. Wenn DeviceOrientationEvent nicht
  // existiert oder Permission gefordert ist (iOS), kommen einfach keine
  // Events — currentRef bleibt null. Plant für probe()/sensor-check.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (typeof DeviceOrientationEvent === "undefined") {
      setPermission("unavailable");
      return;
    }
    // Auf Android & nicht-iOS gibt es keine requestPermission — direkt attachen.
    const ctor = DeviceOrientationEvent as unknown as DeviceOrientationConstructor;
    if (typeof ctor.requestPermission !== "function") {
      handlerRef.current = handleEvent;
      window.addEventListener("deviceorientation", handleEvent, true);
      startedRef.current = true;
      setPermission("granted");
    }
    return () => {
      if (handlerRef.current) {
        window.removeEventListener("deviceorientation", handlerRef.current, true);
        handlerRef.current = null;
        startedRef.current = false;
      }
    };
  }, [handleEvent]);

  /**
   * MUSS aus User-Click-Handler aufgerufen werden für iOS gesture-chain.
   * Auf iOS: requestPermission() async → wenn granted, sofort listener attachen.
   * Auf nicht-iOS: schon attached via useEffect oben → returnt direkt "granted".
   */
  const requestPermission = useCallback(async (): Promise<OrientationPermission> => {
    if (typeof DeviceOrientationEvent === "undefined") {
      setPermission("unavailable");
      return "unavailable";
    }
    const ctor = DeviceOrientationEvent as unknown as DeviceOrientationConstructor;
    if (typeof ctor.requestPermission !== "function") {
      // Android — schon im useEffect attached
      setPermission("granted");
      return "granted";
    }
    try {
      const result = await ctor.requestPermission();
      if (result !== "granted") {
        setPermission("denied");
        return "denied";
      }
      // iOS: jetzt attachen (synchron-ish nach Permission)
      if (!startedRef.current) {
        handlerRef.current = handleEvent;
        window.addEventListener("deviceorientation", handleEvent, true);
        startedRef.current = true;
      }
      setPermission("granted");
      return "granted";
    } catch {
      setPermission("denied");
      return "denied";
    }
  }, [handleEvent]);

  /**
   * Probe via Refs — KEIN Closure-Capture-Bug.
   * Resolves true sobald irgendein valid event kam, oder false nach timeout.
   */
  const probe = useCallback((timeoutMs: number): Promise<boolean> => {
    return new Promise((resolve) => {
      const start = Date.now();
      const tick = () => {
        if (hasEverReceivedRef.current) return resolve(true);
        if (Date.now() - start >= timeoutMs) return resolve(false);
        requestAnimationFrame(tick);
      };
      tick();
    });
  }, []);

  return {
    permission,
    /** Live-Ref auf current orientation. Lese als `currentRef.current`. */
    currentRef,
    /** Live-Ref auf timestamp der letzten valid Orientation. */
    timestampRef,
    requestPermission,
    probe,
  };
}
