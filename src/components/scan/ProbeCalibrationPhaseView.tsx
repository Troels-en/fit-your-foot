import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, RotateCw, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDeviceOrientation } from "@/hooks/scan/useDeviceOrientation";
import { captureFrame } from "@/lib/scan/captureFrame";
import {
  probePro,
  type ProbeProResult,
  type SessionAuth,
} from "@/lib/scan/extendedApi";
import {
  hasViewAngleDiversity,
  CALIBRATION_FRAME_COUNT_TARGET,
  type CapturedPose,
} from "@/lib/scan/calibrationDiversity";
import { speak } from "@/lib/scan/feedback";

type Props = {
  videoRef: React.RefObject<HTMLVideoElement>;
  matFormat: "A4" | "A3";
  /** Session-Auth (Task 14). Optional bei legacy/dev-Backends. */
  auth?: SessionAuth | null;
  /** Auto-Capture-Polling-Intervall — checkt jede Tick ob Diversity-Gate offen. */
  pollIntervalMs?: number;
  onComplete: (result: ProbeProResult) => void;
  onTerminalFail: (reason: string) => void;
  onCancel: () => void;
};

const DEFAULT_POLL_MS = 250;

/**
 * Premium-Scan-Pro Probe-Calibration-Phase (Task 12). Erfasst 5 Frames mit
 * View-Angle-Diversity-Gate (≥15° Rotation ODER ≥150px Marker-Center-Shift
 * vs. allen bisherigen). Bewegt-Phone-Hint dynamisch.
 *
 * Pipeline:
 *   1. User dreht Phone in Bogen über Mat
 *   2. Pro Frame: gyro-pose + capture-frame; wenn Diversity-Gate offen,
 *      Frame als captured markieren
 *   3. Bei TARGET (default 5) Frames: POST /probe-pro
 *   4. Backend führt Zhang's Method + gated UA-Prior-Fallback durch
 *   5. ok=true → onComplete mit camera_intrinsics
 *   6. ok=false → onTerminalFail mit reject_reason (User → "Premium später
 *      neu versuchen")
 *
 * Camera-Stream wird vom Parent gehalten (videoRef-prop) — Phase-View ist
 * pure-View ohne Stream-Lifecycle.
 */
export default function ProbeCalibrationPhaseView({
  videoRef,
  matFormat,
  auth,
  pollIntervalMs = DEFAULT_POLL_MS,
  onComplete,
  onTerminalFail,
  onCancel,
}: Props) {
  const orient = useDeviceOrientation();
  const [capturedFrames, setCapturedFrames] = useState<Blob[]>([]);
  const [capturedPoses, setCapturedPoses] = useState<CapturedPose[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [needsMoveHint, setNeedsMoveHint] = useState(false);
  const captureBusyRef = useRef(false);
  const submittedRef = useRef(false);

  const targetCount = CALIBRATION_FRAME_COUNT_TARGET;
  const captured = capturedFrames.length;

  // ===== Capture-Loop: poll for diversity-gate-open =====
  useEffect(() => {
    if (submittedRef.current || submitting) return;
    if (captured >= targetCount) return;

    const interval = window.setInterval(async () => {
      if (captureBusyRef.current) return;
      const video = videoRef.current;
      if (!video || video.readyState < 2 || video.videoWidth === 0) return;
      const o = orient.currentRef.current;
      if (!o || o.beta == null || o.gamma == null) return;

      const pose: CapturedPose = {
        alpha: o.alpha,
        beta: o.beta,
        gamma: o.gamma,
        // Marker-Center-Pixel würde server-side detection brauchen; in
        // Probe-Phase haben wir noch keine intrinsics → marker-shift skip.
        // Diversity-Gate fällt dann reduziert auf rotation-only zurück.
        markerCenterPx: null,
      };

      if (!hasViewAngleDiversity(pose, capturedPoses)) {
        setNeedsMoveHint(true);
        return;
      }
      setNeedsMoveHint(false);

      captureBusyRef.current = true;
      try {
        const blob = await captureFrame(video, { quality: 0.85, maxBytes: 600_000 });
        setCapturedFrames((prev) => [...prev, blob]);
        setCapturedPoses((prev) => [...prev, pose]);
      } catch (err) {
        console.error("calibration capture failed", err);
      } finally {
        captureBusyRef.current = false;
      }
    }, pollIntervalMs);

    return () => window.clearInterval(interval);
  }, [captured, capturedPoses, orient, pollIntervalMs, submitting, targetCount, videoRef]);

  // ===== Submit when 5 collected =====
  useEffect(() => {
    if (submittedRef.current) return;
    if (captured < targetCount) return;
    submittedRef.current = true;
    setSubmitting(true);
    speak("Kalibrierung wird berechnet", { force: true });
    probePro(capturedFrames, matFormat, auth)
      .then((result) => {
        if (!result.ok || !result.camera_intrinsics) {
          onTerminalFail(result.reject_reason ?? "Calibration fehlgeschlagen");
          return;
        }
        onComplete(result);
      })
      .catch((err) => {
        onTerminalFail(err instanceof Error ? err.message : String(err));
      });
  }, [auth, captured, capturedFrames, matFormat, onComplete, onTerminalFail, targetCount]);

  // ===== Voice-Hints =====
  useEffect(() => {
    if (captured === 0) {
      speak("Halte das Phone überm Blatt und dreh es langsam in einem Bogen.", {
        force: true,
      });
    } else if (captured < targetCount && needsMoveHint) {
      speak("Etwas weiter bewegen — neue Perspektive.");
    }
  }, [captured, needsMoveHint, targetCount]);

  const restart = useCallback(() => {
    submittedRef.current = false;
    setSubmitting(false);
    setCapturedFrames([]);
    setCapturedPoses([]);
    setNeedsMoveHint(false);
  }, []);

  const progressPct = Math.min(100, (captured / targetCount) * 100);

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-background/95 text-foreground">
      <div className="w-full max-w-md mx-auto">
        {submitting ? (
          <>
            <Loader2 className="h-12 w-12 animate-spin mb-4 text-accent mx-auto" />
            <h1 className="text-xl font-bold mb-2">Kalibrierung läuft…</h1>
            <p className="text-sm text-muted-foreground mb-6">
              Wir berechnen die Camera-Parameter aus deinen {targetCount} Frames.
            </p>
          </>
        ) : (
          <>
            <RotateCw className="h-12 w-12 mb-4 text-accent mx-auto animate-pulse" />
            <h1 className="text-xl font-bold mb-2">Kamera kalibrieren</h1>
            <p className="text-sm text-muted-foreground mb-4 max-w-sm mx-auto">
              Halte das Phone überm Blatt und dreh es langsam in einem Bogen
              — wir nehmen {targetCount} Aufnahmen aus verschiedenen Winkeln.
            </p>

            <div className="bg-muted/50 rounded-lg p-3 mb-4">
              <div className="flex items-center justify-between mb-2 text-xs">
                <span className="font-semibold">{captured} / {targetCount} Frames</span>
                {needsMoveHint && (
                  <span className="text-amber-600">Phone weiter bewegen</span>
                )}
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent transition-all duration-200"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-5 gap-1 mb-6">
              {Array.from({ length: targetCount }).map((_, i) => (
                <div
                  key={i}
                  className={`h-2 rounded-full transition-colors ${
                    i < captured ? "bg-emerald-500" : "bg-muted"
                  }`}
                />
              ))}
            </div>
          </>
        )}

        <div className="flex flex-col gap-2 max-w-xs mx-auto">
          {!submitting && captured > 0 && captured < targetCount && (
            <Button variant="outline" size="sm" onClick={restart}>
              Neu starten
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={onCancel} className="text-xs">
            <Camera className="h-3.5 w-3.5 mr-1" /> Abbrechen
          </Button>
        </div>
      </div>
    </div>
  );
}
