import { useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { captureFrame } from "@/lib/scan/captureFrame";
import {
  probeLite,
  type ProbeLiteResult,
  type SessionAuth,
} from "@/lib/scan/extendedApi";

type Props = {
  videoRef: React.RefObject<HTMLVideoElement>;
  matFormat: "A4" | "A3";
  /** Session-Auth (Task 14). Optional bei legacy/dev-Backends. */
  auth?: SessionAuth | null;
  onComplete: (probe: ProbeLiteResult) => void;
  onUaUnknown: () => void;
  onError: (reason: string) => void;
  onCancel: () => void;
};

/**
 * Probe-Lite-Phase: Single-Frame-Call zu /probe-lite vor Foto-1 (v11). Liefert
 * UA-Prior-Intrinsics + Brightness-Baseline + Print-Scale-Check. UA-unknown
 * → onUaUnknown (Frontend redirected zu Premium-Pro). Network-error → onError.
 *
 * Concurrency-Lock: doneRef verhindert dass StrictMode-Double-Mount oder
 * Re-renders zweimal probeLite aufrufen — sonst landet bei UA-unknown der
 * onComplete- nach onUaUnknown-Callback und überschreibt State.
 */
export default function ProbeLitePhaseView({
  videoRef,
  matFormat,
  auth,
  onComplete,
  onUaUnknown,
  onError,
  onCancel,
}: Props) {
  const doneRef = useRef(false);

  useEffect(() => {
    if (doneRef.current) return;
    let cancelled = false;
    const run = async () => {
      const video = videoRef.current;
      if (!video || video.readyState < 2 || video.videoWidth === 0) {
        // Wait one frame, retry — Camera-stream sometimes lags.
        await new Promise((r) => requestAnimationFrame(r));
      }
      const v = videoRef.current;
      if (!v || v.readyState < 2 || v.videoWidth === 0) {
        if (!cancelled && !doneRef.current) {
          doneRef.current = true;
          onError("Camera-Stream nicht ready");
        }
        return;
      }
      try {
        const blob = await captureFrame(v, { quality: 0.7, maxBytes: 500_000 });
        const result = await probeLite(blob, matFormat, auth);
        if (cancelled || doneRef.current) return;
        doneRef.current = true;
        if (result.ua_unknown) {
          onUaUnknown();
          return;
        }
        if (!result.ok) {
          onError(result.error ?? "Probe-Lite fehlgeschlagen");
          return;
        }
        onComplete(result);
      } catch (err) {
        if (cancelled || doneRef.current) return;
        doneRef.current = true;
        onError(err instanceof Error ? err.message : String(err));
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [auth, matFormat, onComplete, onError, onUaUnknown, videoRef]);

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-background/90 text-foreground">
      <Loader2 className="h-10 w-10 animate-spin mb-4 text-accent" />
      <p className="text-base font-semibold mb-1">Kamera wird geprüft…</p>
      <p className="text-sm text-muted-foreground max-w-sm">
        Wir gucken kurz, ob dein Phone-Modell und das Licht passen.
      </p>
      <Button variant="ghost" size="sm" onClick={onCancel} className="mt-6 text-xs">
        Abbrechen
      </Button>
    </div>
  );
}
