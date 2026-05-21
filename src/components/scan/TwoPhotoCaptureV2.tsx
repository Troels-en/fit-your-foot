import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCameraStream } from "@/hooks/scan/useCameraStream";
import { useDeviceOrientation } from "@/hooks/scan/useDeviceOrientation";
import { useFrameQuality } from "@/hooks/scan/useFrameQuality";
import { useScreenOrientation } from "@/hooks/scan/useScreenOrientation";
import { useExtendedDetection, isExtendedResultFresh } from "@/hooks/scan/useExtendedDetection";
import { captureFrame } from "@/lib/scan/captureFrame";
import {
  hapticCalibrated,
  hapticSubmitReady,
  isSpeechSupported,
  setSpeechEnabled,
  speak,
} from "@/lib/scan/feedback";
import {
  composeClientGates,
  HOLD_TIME_TOP_MS,
  HOLD_TIME_SIDE_MS,
  TAP_FALLBACK_AFTER_MS,
  type GateResult,
} from "@/lib/scan/gates";
import { evaluateServerGates, type TopPoseRef } from "@/lib/scan/serverGates";
import { getVoiceString, type SelectedFoot } from "@/lib/scan/voiceStrings";
import {
  type CameraIntrinsics,
  type DetectExtendedResult,
  type ProbeLiteResult,
  type SessionAuth,
} from "@/lib/scan/extendedApi";
import {
  submitTwoPhotoMeasurement,
  type MeasurementResult,
} from "@/lib/scan/twoPhotoApi";
import { createSession } from "@/lib/api";
import SetupScreenView from "@/components/scan/SetupScreenView";
import ProbeLitePhaseView from "@/components/scan/ProbeLitePhaseView";
import CapturePhaseView from "@/components/scan/CapturePhaseView";
import SeatedPromptView from "@/components/scan/SeatedPromptView";
import OrientationSwitchView from "@/components/scan/OrientationSwitchView";
import ValidationErrorView, {
  type ValidationErrorContext,
} from "@/components/scan/ValidationErrorView";
import DonePhaseView from "@/components/scan/DonePhaseView";

/**
 * Phase 4 Task 11: TwoPhotoCaptureV2 — refactored Quick-Scan-Lite-Component
 * (v11 design). Replaces 724-LOC monolith mit phase-machine + 8 phase-views +
 * pure-function gates + decomposed runCaptureTick.
 *
 * Phase-Machine:
 *   setup-check → permission-pending → probe-lite → top-photo → top-validating
 *   → seated-prompt → orientation-switch → side-photo → side-validating
 *   → submitting → done
 *
 * Error-States parametrisiert: validation-error mit errorContext aus
 * {probe-ua, probe-other, top, side, orientation, submit}.
 *
 * Hard-vs-Soft-Gate: Tap-Fallback nach 8s ohne Auto-Trigger. Tap NIE bypass-bar
 * für Hard-Gates (Phone-Orientation, Marker-Coverage, PnP-Z, Side-Yaw, Heel-
 * Wand-Gap, Foot-Confidence, Homography-Residuals, Foot-Pivot). Tap bypass-bar
 * für Soft-Gates (Brightness, Light-Delta).
 */

type Phase =
  | "setup-check"
  | "permission-pending"
  | "permission-error"
  | "probe-lite"
  | "top-photo"
  | "top-validating"
  | "seated-prompt"
  | "orientation-switch"
  | "side-photo"
  | "side-validating"
  | "submitting"
  | "done"
  | "validation-error";

type Props = {
  selectedFoot?: SelectedFoot;
  matFormat?: "A4" | "A3";
  onSubmit?: (result: MeasurementResult) => void;
  onCancel: () => void;
};

const TICK_INTERVAL_MS = 250;

export default function TwoPhotoCaptureV2({
  selectedFoot = "right",
  matFormat = "A4",
  onSubmit,
  onCancel,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);

  // ===== Phase + UI-State =====
  const [phase, setPhase] = useState<Phase>("setup-check");
  const [errorContext, setErrorContext] = useState<ValidationErrorContext | null>(null);
  const [errorReason, setErrorReason] = useState<string | null>(null);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [topPhoto, setTopPhoto] = useState<Blob | null>(null);
  const [sidePhoto, setSidePhoto] = useState<Blob | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [measurements, setMeasurements] = useState<MeasurementResult | null>(null);
  const [holdProgress, setHoldProgress] = useState(0);
  const [tapFallbackVisible, setTapFallbackVisible] = useState(false);
  const [failedHard, setFailedHard] = useState<GateResult[]>([]);
  const [failedSoft, setFailedSoft] = useState<GateResult[]>([]);
  const [speechOn, setSpeechOn] = useState(() => isSpeechSupported());

  // ===== Refs =====
  const phaseRef = useRef<Phase>("setup-check");
  const captureBusyRef = useRef(false);
  const allGreenSinceRef = useRef<number | null>(null);
  const phaseEnteredAtRef = useRef<number>(0);
  const intrinsicsRef = useRef<CameraIntrinsics | null>(null);
  const probeBaselineRef = useRef<ProbeLiteResult | null>(null);
  const topPoseRef = useRef<TopPoseRef | null>(null);
  // Forward-declared für tick-loop useEffect — wird unten nach
  // runCaptureTick-Definition aktualisiert. Loop ruft via .current.
  const runCaptureTickRef = useRef<(() => Promise<void>) | null>(null);

  // ===== Hooks =====
  const cam = useCameraStream(videoRef);
  const orient = useDeviceOrientation();
  const quality = useFrameQuality();
  const orientationType = useScreenOrientation();
  const extendedDetection = useExtendedDetection();

  useEffect(() => {
    phaseRef.current = phase;
    phaseEnteredAtRef.current = Date.now();
    setHoldProgress(0);
    setTapFallbackVisible(false);
    setFailedHard([]);
    setFailedSoft([]);
    allGreenSinceRef.current = null;
  }, [phase]);

  useEffect(() => {
    setSpeechEnabled(speechOn);
  }, [speechOn]);

  // ===== onStart: setup-check → permission-pending → probe-lite =====
  const onStart = useCallback(async () => {
    setPermissionError(null);
    setPhase("permission-pending");
    if (speechOn && isSpeechSupported()) {
      speak("Bereit für Quick-Scan", { force: true });
    }
    try {
      const session = await createSession({ shoe_slug: "fitly-profile" });
      setSessionId(session.session_id);
      setSessionToken(session.session_token ?? null);
    } catch (err) {
      console.error("createSession failed", err);
      setPermissionError("Session konnte nicht angelegt werden");
      setPhase("permission-error");
      return;
    }
    const motion = await orient.requestPermission();
    if (motion === "denied" || motion === "unavailable") {
      setPermissionError(
        motion === "denied"
          ? "Bewegungssensor erforderlich — bitte Settings prüfen"
          : "Browser unterstützt DeviceOrientation nicht",
      );
      setPhase("permission-error");
      return;
    }
    await cam.start();
  }, [cam, orient, speechOn]);

  // permission-pending → probe-lite (cam ready + orient probe ok)
  useEffect(() => {
    if (phase !== "permission-pending") return;
    if (cam.state.phase === "ready") {
      let cancelled = false;
      orient.probe(2000).then((ok) => {
        if (cancelled) return;
        if (!ok) {
          setPermissionError("DeviceOrientation liefert keine Events");
          setPhase("permission-error");
          cam.stop();
          return;
        }
        setPhase("probe-lite");
      });
      return () => {
        cancelled = true;
      };
    } else if (cam.state.phase === "error") {
      setPermissionError(cam.state.reason);
      setPhase("permission-error");
    }
  }, [cam, orient, phase]);

  // ===== Capture-Tick-Loop für top-photo + side-photo =====
  useEffect(() => {
    if (phase !== "top-photo" && phase !== "side-photo") return;

    if (phase === "top-photo") {
      speak(getVoiceString("phase-top-enter", selectedFoot), { force: true });
    } else {
      speak(getVoiceString("phase-side-enter", selectedFoot), { force: true });
    }

    const interval = window.setInterval(async () => {
      if (phaseRef.current !== "top-photo" && phaseRef.current !== "side-photo") return;
      if (captureBusyRef.current) return;
      const tick = runCaptureTickRef.current;
      if (!tick) return;
      captureBusyRef.current = true;
      try {
        await tick();
      } finally {
        captureBusyRef.current = false;
      }
    }, TICK_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [phase, selectedFoot]);

  // ===== Capture frame + advance =====
  // Definiert vor runCaptureTick (TDZ-Fix): runCaptureTick ist useCallback +
  // hat capturePhoto in deps array — `const` declarations sind TDZ-protected,
  // also muss capturePhoto VORHER deklariert werden.
  const capturePhoto = useCallback(
    async (lastDetect: DetectExtendedResult | null) => {
      const video = videoRef.current;
      if (!video) return;
      try {
        const blob = await captureFrame(video, { quality: 0.92 });
        hapticCalibrated();
        if (phaseRef.current === "top-photo") {
          setTopPhoto(blob);
          if (
            lastDetect?.heel_position_marker_coords_mm &&
            lastDetect?.toe_tip_position_marker_coords_mm &&
            lastDetect?.foot_yaw_angle_deg !== null &&
            lastDetect?.foot_yaw_angle_deg !== undefined
          ) {
            topPoseRef.current = {
              heel: lastDetect.heel_position_marker_coords_mm,
              toe: lastDetect.toe_tip_position_marker_coords_mm,
              yawDeg: lastDetect.foot_yaw_angle_deg,
            };
          }
          setPhase("top-validating");
        } else if (phaseRef.current === "side-photo") {
          setSidePhoto(blob);
          setPhase("side-validating");
        }
      } catch (err) {
        console.error("captureFrame failed", err);
        setErrorContext("submit");
        setErrorReason("Foto-Aufnahme fehlgeschlagen");
        setPhase("validation-error");
      }
    },
    [],
  );

  // ===== runCaptureTick: composed gate-eval + auto-trigger =====
  const runCaptureTick = useCallback(async () => {
    const video = videoRef.current;
    if (!video || video.readyState < 2 || video.videoWidth === 0) return;
    const intrinsics = intrinsicsRef.current;
    if (!intrinsics) return;

    const tickPhase: "top" | "side" = phaseRef.current === "top-photo" ? "top" : "side";
    const blob = await captureFrame(video, { quality: 0.55, maxBytes: 250_000 });

    let brightness = 128;
    try {
      const score = await quality.score(blob);
      if (score) brightness = score.brightness;
    } catch {
      // ignore — leave brightness default mid-range
    }

    const auth: SessionAuth | null = sessionId
      ? { sessionId, sessionToken }
      : null;
    const detected = await extendedDetection.invoke(
      blob,
      intrinsics,
      matFormat,
      tickPhase,
      selectedFoot,
      auth,
    );
    const cache = extendedDetection.lastResult.current;
    const fresh = isExtendedResultFresh(cache) ? cache.result : detected;

    const clientGates = composeClientGates({
      orientationType,
      orient: orient.currentRef.current ?? { alpha: null, beta: null, gamma: null },
      phase: tickPhase,
      brightnessMean: brightness,
      brightnessBaseline: probeBaselineRef.current?.brightness_mean ?? null,
      footBboxPx: null, // detect-extended liefert mm-coords; central-frame
      // wird via foot_bbox_to_paper_edge_min_mm (server-side) konservativer
      // gecheckt.
      imageWidth: video.videoWidth,
      imageHeight: video.videoHeight,
      isLitePath: true,
      markerCount: fresh?.marker_count ?? 0,
      markerHullAreaFraction: fresh?.marker_convex_hull_area_fraction ?? null,
    });
    const serverGates = evaluateServerGates({
      result: fresh,
      phase: tickPhase,
      selectedFoot,
      topPose: topPoseRef.current,
    });

    const allFailedHard = [...clientGates.failedHard, ...serverGates.failedHard];
    const allFailedSoft = [...clientGates.failedSoft, ...serverGates.failedSoft];
    setFailedHard(allFailedHard);
    setFailedSoft(allFailedSoft);

    const allOk = allFailedHard.length === 0 && allFailedSoft.length === 0;
    const now = Date.now();
    if (allOk) {
      if (allGreenSinceRef.current === null) allGreenSinceRef.current = now;
      const hold = tickPhase === "top" ? HOLD_TIME_TOP_MS : HOLD_TIME_SIDE_MS;
      const elapsed = now - allGreenSinceRef.current;
      setHoldProgress(Math.min(1, elapsed / hold));
      if (elapsed >= hold) {
        allGreenSinceRef.current = null;
        setHoldProgress(0);
        await capturePhoto(fresh);
      }
    } else {
      allGreenSinceRef.current = null;
      setHoldProgress(0);
    }

    if (now - phaseEnteredAtRef.current > TAP_FALLBACK_AFTER_MS) {
      setTapFallbackVisible(true);
    }
  }, [
    capturePhoto,
    extendedDetection,
    matFormat,
    orient,
    orientationType,
    quality,
    selectedFoot,
    sessionId,
    sessionToken,
  ]);

  // Wire freshest runCaptureTick into ref (forward-declared above) damit
  // tick-loop interval immer die aktuelle Version aufruft ohne re-create.
  useEffect(() => {
    runCaptureTickRef.current = runCaptureTick;
  }, [runCaptureTick]);

  // top-validating → seated-prompt
  useEffect(() => {
    if (phase !== "top-validating") return;
    const t = setTimeout(() => {
      extendedDetection.reset();
      setPhase("seated-prompt");
      speak(getVoiceString("phase-seated-prompt", selectedFoot), { force: true });
    }, 600);
    return () => clearTimeout(t);
  }, [extendedDetection, phase, selectedFoot]);

  // side-validating → submitting
  useEffect(() => {
    if (phase !== "side-validating") return;
    if (!sessionId || !topPhoto || !sidePhoto) return;
    setPhase("submitting");
    hapticSubmitReady();
    submitTwoPhotoMeasurement(sessionId, topPhoto, sidePhoto, sessionToken)
      .then((result) => {
        setMeasurements(result);
        if (result.ok) {
          cam.stop();
          setPhase("done");
          if (onSubmit) onSubmit(result);
          speak(getVoiceString("phase-done", selectedFoot));
        } else {
          cam.stop();
          setErrorContext("submit");
          setErrorReason(result.error ?? "Submit fehlgeschlagen");
          setPhase("validation-error");
        }
      })
      .catch((err) => {
        cam.stop();
        setErrorContext("submit");
        setErrorReason(err instanceof Error ? err.message : String(err));
        setPhase("validation-error");
      });
  }, [cam, onSubmit, phase, selectedFoot, sessionId, sessionToken, sidePhoto, topPhoto]);

  // ===== Cancel-Wrapper: stop camera before unmount =====
  const handleCancel = useCallback(() => {
    cam.stop();
    onCancel();
  }, [cam, onCancel]);

  // ===== Tap-Fallback (Soft-Gates only — Hard-Gates blocked at button level) =====
  const onTapCapture = useCallback(async () => {
    if (failedHard.length > 0) return; // belt-and-braces — view also disables button
    await capturePhoto(extendedDetection.lastResult.current.result);
  }, [capturePhoto, extendedDetection, failedHard.length]);

  // ===== Render =====
  const showCamera =
    phase === "probe-lite" ||
    phase === "top-photo" ||
    phase === "side-photo" ||
    phase === "top-validating" ||
    phase === "side-validating";

  return (
    <div className="relative min-h-screen bg-black text-white">
      <video
        ref={videoRef}
        playsInline
        muted
        className={`absolute inset-0 w-full h-full object-cover ${showCamera ? "" : "invisible"}`}
      />

      {phase === "setup-check" && (
        <SetupScreenView selectedFoot={selectedFoot} onStart={onStart} onCancel={handleCancel} />
      )}

      {phase === "permission-pending" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-background text-foreground">
          <Loader2 className="h-10 w-10 animate-spin mb-4" />
          <p className="text-sm text-muted-foreground">Zugriffe werden angefragt…</p>
        </div>
      )}

      {phase === "permission-error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-background text-foreground">
          <h2 className="text-xl font-bold mb-2">Setup fehlgeschlagen</h2>
          <p className="text-sm text-muted-foreground mb-6 max-w-sm">{permissionError}</p>
          <Button onClick={handleCancel} variant="outline" className="gap-2">
            <RotateCw className="h-4 w-4" /> Zurück
          </Button>
        </div>
      )}

      {phase === "probe-lite" && (
        <ProbeLitePhaseView
          videoRef={videoRef}
          matFormat={matFormat}
          auth={sessionId ? { sessionId, sessionToken } : null}
          onComplete={(result) => {
            probeBaselineRef.current = result;
            if (result.ua_prior_intrinsics) {
              intrinsicsRef.current = result.ua_prior_intrinsics;
            }
            setPhase("top-photo");
          }}
          onUaUnknown={() => {
            setErrorContext("probe-ua");
            setErrorReason(getVoiceString("validation-error-ua-unknown", selectedFoot));
            setPhase("validation-error");
          }}
          onError={(reason) => {
            setErrorContext("probe-other");
            setErrorReason(reason);
            setPhase("validation-error");
          }}
          onCancel={handleCancel}
        />
      )}

      {(phase === "top-photo" || phase === "side-photo") && (
        <CapturePhaseView
          phase={phase === "top-photo" ? "top" : "side"}
          selectedFoot={selectedFoot}
          holdProgress={holdProgress}
          failedHard={failedHard}
          failedSoft={failedSoft}
          tapFallbackVisible={tapFallbackVisible}
          speechOn={speechOn}
          speechSupported={isSpeechSupported()}
          onTap={onTapCapture}
          onToggleSpeech={() => setSpeechOn((v) => !v)}
          onCancel={handleCancel}
        />
      )}

      {(phase === "top-validating" || phase === "side-validating" || phase === "submitting") && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-background/80 text-foreground">
          <Loader2 className="h-10 w-10 animate-spin mb-4 text-accent" />
          <p className="text-sm">
            {phase === "submitting" ? "Maße werden berechnet…" : "Foto wird verarbeitet…"}
          </p>
        </div>
      )}

      {phase === "seated-prompt" && (
        <SeatedPromptView
          selectedFoot={selectedFoot}
          onConfirm={() => setPhase("orientation-switch")}
          onCancel={handleCancel}
        />
      )}

      {phase === "orientation-switch" && (
        <OrientationSwitchView
          onLandscapeDetected={() => setPhase("side-photo")}
          onTimeout={() => {
            setErrorContext("orientation");
            setErrorReason("Phone-Drehung nicht erkannt nach 30 Sekunden.");
            setPhase("validation-error");
          }}
          onCancel={handleCancel}
        />
      )}

      {phase === "validation-error" && errorContext && (
        <ValidationErrorView
          context={errorContext}
          reason={errorReason}
          onRetake={() => {
            const ctx = errorContext;
            setErrorContext(null);
            setErrorReason(null);
            if (ctx === "top") {
              setTopPhoto(null);
              extendedDetection.reset();
              setPhase("top-photo");
            } else if (ctx === "side") {
              setSidePhoto(null);
              extendedDetection.reset();
              setPhase("orientation-switch");
            } else if (ctx === "orientation") {
              setPhase("orientation-switch");
            } else if (ctx === "probe-other") {
              setPhase("probe-lite");
            } else if (ctx === "submit") {
              setPhase("side-validating");
            }
          }}
          onRetakeFromTop={
            errorContext === "side"
              ? () => {
                  setErrorContext(null);
                  setErrorReason(null);
                  setTopPhoto(null);
                  setSidePhoto(null);
                  topPoseRef.current = null;
                  extendedDetection.reset();
                  setPhase("top-photo");
                }
              : undefined
          }
          onSwitchPremium={
            errorContext === "probe-ua"
              ? () => {
                  // Premium-Switch ist Parent-Verantwortung — wir cancellen
                  // hier und Parent kann ScanModeSelector wieder zeigen.
                  handleCancel();
                }
              : undefined
          }
          onCancel={handleCancel}
        />
      )}

      {phase === "done" && (
        <DonePhaseView measurements={measurements} onReset={handleCancel} />
      )}
    </div>
  );
}

