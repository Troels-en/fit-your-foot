import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  Loader2,
  RotateCw,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCameraStream } from "@/hooks/scan/useCameraStream";
import { useDeviceOrientation } from "@/hooks/scan/useDeviceOrientation";
import { useFrameQuality } from "@/hooks/scan/useFrameQuality";
import { captureFrame } from "@/lib/scan/captureFrame";
import {
  hapticBucketFilled,
  hapticCalibrated,
  hapticSubmitReady,
  isSpeechSupported,
  setSpeechEnabled,
  speak,
} from "@/lib/scan/feedback";
import {
  detectAruco,
  detectFoot,
  submitTwoPhotoMeasurement,
  type MeasurementResult,
} from "@/lib/scan/twoPhotoApi";
import { createSession } from "@/lib/api";
import {
  SetupIllustration,
  TopPhotoIllustration,
  SidePhotoIllustration,
} from "@/components/scan/PhotoIllustrations";

/**
 * Phase 2: Quick-Scan-2-Foto-Capture-Flow.
 *
 * State-Machine:
 *  setup-check → permission-pending → top-photo → top-validating
 *  → side-photo → side-validating → submitting → done
 *
 * Hard-Constraints (alle vor Auto-Trigger nötig):
 *  - Setup-Check Pflicht (4 Checkboxes)
 *  - Gyro-Gate per Photo-Orientation (Top: Pitch, Side: Roll)
 *  - Local Quality (Brightness via Worker)
 *  - Server-Validation: ArUco detected + Foot detected (via Modal Endpoints)
 *  - Auto-Trigger wenn alle Gates 1.5s grün
 *  - Voice + Haptic-Coaching während gesamtem Flow
 */

type Phase =
  | "setup-check"
  | "permission-pending"
  | "permission-error"
  | "top-photo"
  | "top-validating"
  | "seated-prompt"
  | "side-photo"
  | "side-validating"
  | "submitting"
  | "done"
  | "error";

// Lockere Gates — nur als Hilfsindikator, nicht als Blocker. User entscheidet
// via manuellem Foto-Button wann ausgelöst wird. Werte vorher 5°/0.6 waren
// zu strikt — User kam nicht durch.
// Top-Photo: Phone flat überm Fuß. |beta|<=15 (oder 180±15). Strict 15° statt 20°
//   schließt Side-Range mutex aus (Side beginnt bei 20°).
// Side-Photo: Phone schräg auf Knie. Forward-Tilt fällt entweder auf BETA
//   (portrait) oder GAMMA (landscape), die jeweils ANDERE Achse muss klein
//   bleiben. SIDE_TILT_MIN=30°: realer Side-Pose hat 40-60° Tilt; 30° Floor
//   schließt Phone-flat-mit-Wrist-Roll aus (Codex-Iter3-Finding: bei Min=20°
//   passt gamma=20 + beta=0 als landscapeTilt durch, obwohl Phone faktisch
//   flach liegt). Mutex zur Top-Range [0,15] mit 15° Dead-Band [15,30].
const TOP_GYRO_TOLERANCE_DEG = 15;
const SIDE_TILT_MIN = 30;
const SIDE_TILT_MAX = 80;
const SIDE_CROSS_MAX = 25;
const VALIDATION_INTERVAL_MS = 1500; // Server-Validation seltener (war 800ms)
const BRIGHTNESS_MIN = 50; // 70 → 50: dunklere Räume erlaubt
const BRIGHTNESS_MAX = 230; // 210 → 230: hellere auch
const FOOT_CONFIDENCE_MIN = 0.4; // war 0.6
const ARUCO_MIN_MARKERS = 2; // war 4 — auch mit 2 Markern haben wir Scale
// Hold-Time bevor Auto-Trigger feuert. KRITISCH: ohne diese Konstante wäre
// `elapsed / HOLD_TIME_MS = NaN` → Auto-Trigger fired NIE obwohl alle gates grün
// (Codex-Review-Finding: Smoking-Gun für „nichts passiert" Bug).
const HOLD_TIME_MS = 1200;

type Props = {
  /**
   * Welcher Fuß wird gescannt — bestimmt Side-Direction-Mirror (Lateral-Side
   * = User-Outside vom gewählten Fuß) und alle UI-String-Spiegelungen. Aus
   * PreFlowScreen erfasst. Default "right" für Backwards-Compat. Voll-genutzt
   * in Task #11 (selectedFoot-Mirror durch alle Components + Illustrationen).
   */
  selectedFoot?: "left" | "right";
  /**
   * Welches Mat-Format gedruckt wurde — bestimmt Backend-Marker-Pitch (A4=30mm,
   * A3=45mm). Default "A4". Wird an detectAruco/detectFoot weitergereicht für
   * korrekte Pixel-zu-mm-Skala.
   */
  matFormat?: "A4" | "A3";
  onSubmit?: (result: MeasurementResult) => void;
  onCancel: () => void;
};

export default function TwoPhotoCapture({
  selectedFoot = "right",
  matFormat = "A4",
  onSubmit,
  onCancel,
}: Props) {
  // selectedFoot wird in Setup-Screen für UI-Mirror-Strings genutzt
  // ("rechten/linken Fuß"). Voll-aktive Side-Direction-Mirror-Logic in
  // capture-phases ist Task #11 (selectedFoot through illustrations + voice
  // hints + side-direction lateral plane validation).
  const videoRef = useRef<HTMLVideoElement>(null);

  // ===== Phase + UI-State =====
  const [phase, setPhase] = useState<Phase>("setup-check");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [topPhoto, setTopPhoto] = useState<Blob | null>(null);
  const [sidePhoto, setSidePhoto] = useState<Blob | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [measurements, setMeasurements] = useState<MeasurementResult | null>(null);

  // ===== Live-Gates State =====
  const [gates, setGates] = useState<{
    gyro: "ok" | "fail" | "pending";
    brightness: "ok" | "fail" | "pending";
    aruco: "ok" | "fail" | "pending";
    foot: "ok" | "fail" | "pending";
  }>({ gyro: "pending", brightness: "pending", aruco: "pending", foot: "pending" });
  const [holdProgress, setHoldProgress] = useState(0); // 0-1 progress to auto-trigger
  const [speechOn, setSpeechOn] = useState(() => isSpeechSupported());

  // Refs
  const phaseRef = useRef<Phase>("setup-check");
  const captureBusyRef = useRef(false);
  const allGatesGreenSinceRef = useRef<number | null>(null);
  const lastValidationRef = useRef<number>(0);
  // Letzte Server-Validation-Ergebnisse persistiert über Tick-Grenzen hinweg.
  // Vorher: lokale Variablen → in 80% der Ticks null → allGreen niemals true →
  // Auto-Trigger feuerte nicht obwohl gates state grün anzeigte.
  const serverResultRef = useRef<{ aruco: boolean | null; foot: boolean | null; ts: number }>(
    { aruco: null, foot: null, ts: 0 }
  );
  // TTS-Lockout: nach Phase-Entry sollen Voice-Tick-Hints für 4s schweigen,
  // damit die längere Phase-Transition-Utterance nicht abgeschnitten wird
  // (Codex-Review: tick-hint feuert sonst innerhalb 250-1500ms und
  // unterbricht die kritische „Setz dich"-/„Stell dich aufs Blatt"-Anweisung).
  const phaseEnteredAtRef = useRef<number>(0);

  // ===== Hooks =====
  const cam = useCameraStream(videoRef);
  const orient = useDeviceOrientation();
  const quality = useFrameQuality();

  useEffect(() => {
    phaseRef.current = phase;
    phaseEnteredAtRef.current = Date.now();
  }, [phase]);

  useEffect(() => {
    setSpeechEnabled(speechOn);
  }, [speechOn]);

  // ===== Phase: setup-check → permission =====
  const onStart = useCallback(async () => {
    setErrorMsg(null);
    setPhase("permission-pending");

    // Speech-prime im Click-Handler (iOS gesture-chain)
    if (speechOn && isSpeechSupported()) {
      speak("Bereit für Quick-Scan", { force: true });
    }

    // Session anlegen
    try {
      const { session_id } = await createSession({ shoe_slug: "fitly-profile" });
      setSessionId(session_id);
    } catch (err) {
      console.error("createSession failed", err);
      setErrorMsg("Session konnte nicht angelegt werden");
      setPhase("error");
      return;
    }

    // iOS Motion-Permission
    const motion = await orient.requestPermission();
    if (motion === "denied") {
      setErrorMsg("Bewegungssensor erforderlich — bitte Settings prüfen");
      setPhase("permission-error");
      return;
    }
    if (motion === "unavailable") {
      setErrorMsg("Browser unterstützt DeviceOrientation nicht");
      setPhase("permission-error");
      return;
    }

    await cam.start();
  }, [cam, orient, speechOn]);

  // Camera-State Effect → advance auf top-photo
  useEffect(() => {
    if (phase !== "permission-pending") return;
    if (cam.state.phase === "ready") {
      let cancelled = false;
      orient.probe(2000).then((ok) => {
        if (cancelled) return;
        if (!ok) {
          setErrorMsg("DeviceOrientation liefert keine Events");
          setPhase("permission-error");
          cam.stop();
          return;
        }
        setPhase("top-photo");
        speak("Foto 1: Stell dich auf das Blatt, Ferse an die Wand. Phone flach über deinem Fuß.", { force: true });
      });
      return () => {
        cancelled = true;
      };
    } else if (cam.state.phase === "error") {
      setErrorMsg(cam.state.reason);
      setPhase("permission-error");
    }
  }, [cam, orient, phase]);

  // ===== Live-Gates-Loop (top-photo + side-photo) =====
  useEffect(() => {
    if (phase !== "top-photo" && phase !== "side-photo") return;

    const interval = window.setInterval(async () => {
      if (phaseRef.current !== "top-photo" && phaseRef.current !== "side-photo") return;
      // Race-Fix: lock SOFORT setzen vor jedem await damit overlapping Ticks
      // nicht parallel die Brightness/Server-Checks anfeuern. Vorher war Lock
      // erst INSIDE des Server-Validation-Blocks gesetzt, also nach mehreren
      // Awaits — overlapping Ticks konnten allGatesGreenSinceRef korrumpieren.
      if (captureBusyRef.current) return;
      captureBusyRef.current = true;
      try {
        await runTickBody();
      } finally {
        captureBusyRef.current = false;
      }
    }, 250);

    // TODO Task #11: runTickBody is a monolith mit gyro+brightness+server-
    // validation in einem Block. Brittle (brightness-fail blockt server-call,
    // stalls capture ohne user-feedback). Deferred to selectedFoot-Mirror-
    // Refactor wo Phase-Logic + Gates in kleinere testbare Units gesplittet
    // werden (siehe WORKPLAN-20260504-quick-scan-design-v2.md Phase 4).
    async function runTickBody() {
      const curr = orient.currentRef.current;
      const video = videoRef.current;
      if (!curr || !video || video.readyState < 2 || video.videoWidth === 0) return;
      // Beta/Gamma können null sein auf Devices ohne entsprechende Achse.
      // Math.abs(null)=0 würde silently als gültige 0°-Pose durchgehen.
      // → frame skip bis valide Werte da sind. (Gemini-Iter3-Finding)
      if (curr.beta == null || curr.gamma == null) return;

      // Gyro-Gate (Phase-spezifisch):
      //   top-photo: Phone flat über Fuß. |beta|<=15° (oder 180±15° wenn Phone
      //              upside-down). Mutex zur Side-Range (>=20°).
      //   side-photo (seated): exakt EINE Achse gekippt 20-80°, ANDERE Achse
      //              <25° — schließt Phone-flat-on-thigh aus (z.B. beta=0,
      //              gamma=12: keine Pose erfüllt → fail). Portrait kippt
      //              beta, Landscape kippt gamma.
      const absBeta = Math.abs(curr.beta);
      const absGamma = Math.abs(curr.gamma);
      const portraitTilt =
        absBeta >= SIDE_TILT_MIN && absBeta <= SIDE_TILT_MAX && absGamma < SIDE_CROSS_MAX;
      const landscapeTilt =
        absGamma >= SIDE_TILT_MIN && absGamma <= SIDE_TILT_MAX && absBeta < SIDE_CROSS_MAX;
      const gyroOk =
        phaseRef.current === "top-photo"
          ? absBeta <= TOP_GYRO_TOLERANCE_DEG ||
            Math.abs(absBeta - 180) <= TOP_GYRO_TOLERANCE_DEG
          : portraitTilt || landscapeTilt;

      // Local-Brightness-Gate via Worker (lazy capture-quality-frame)
      let brightnessOk = false;
      try {
        const blob = await captureFrame(video, { quality: 0.5, maxBytes: 200_000 });
        const score = await quality.score(blob);
        if (score) {
          brightnessOk = score.brightness >= BRIGHTNESS_MIN && score.brightness <= BRIGHTNESS_MAX;
        }
      } catch {
        // skip, leave brightness pending
      }

      // Server-Validation (ArUco + Foot) throttled — alle VALIDATION_INTERVAL_MS.
      // Result wird in serverResultRef persistiert damit zwischen Validations
      // der State über tick-Grenzen hinweg verfügbar ist (sonst Auto-Trigger
      // feuert nie weil arucoOk/footOk in 80% der Ticks null sind).
      const now = Date.now();
      if (now - lastValidationRef.current > VALIDATION_INTERVAL_MS && gyroOk && brightnessOk) {
        try {
          lastValidationRef.current = now;
          const blob = await captureFrame(video, { quality: 0.7, maxBytes: 500_000 });
          const [arucoR, footR] = await Promise.all([
            detectAruco(blob, matFormat),
            detectFoot(blob),
          ]);
          serverResultRef.current = {
            aruco: arucoR.ok && arucoR.marker_count >= ARUCO_MIN_MARKERS,
            foot: footR.best_confidence >= FOOT_CONFIDENCE_MIN,
            ts: Date.now(), // ts MIT post-await timestamp damit serverFresh korrekt
          };
        } catch (err) {
          console.error("server-validation failed", err);
        }
      }

      // Server-Results gelten für 5s als gültig — danach als stale verworfen
      // (User hat Phone vielleicht weggelegt, neue Validation muss erst laufen).
      const serverFresh = now - serverResultRef.current.ts < 5000;
      const arucoOk = serverFresh ? serverResultRef.current.aruco : null;
      const footOk = serverFresh ? serverResultRef.current.foot : null;

      // Update gates state für UI-Indikatoren
      setGates({
        gyro: gyroOk ? "ok" : "fail",
        brightness: brightnessOk ? "ok" : "fail",
        aruco: arucoOk === null ? "pending" : arucoOk ? "ok" : "fail",
        foot: footOk === null ? "pending" : footOk ? "ok" : "fail",
      });

      // Voice-Coach in Klartext — einer Sache zur Zeit, throttled durch speak().
      // Lockout: erste 4s nach Phase-Entry KEIN Tick-Hint, damit die längere
      // Transition-Utterance („Foto eins im Kasten…", „Stell dich aufs Blatt…")
      // nicht abgeschnitten wird (Codex-Review-Finding).
      const sincePhaseEntry = now - phaseEnteredAtRef.current;
      if (sincePhaseEntry > 4000) {
        if (!gyroOk) {
          if (phaseRef.current === "top-photo") {
            speak("Phone flach halten — wie ein Tablett über deinem Fuß");
          } else {
            speak("Phone schräg über Knie — Camera Richtung Fuß");
          }
        } else if (!brightnessOk) {
          speak("Mehr Licht bitte");
        } else if (arucoOk === false) {
          speak("Blatt muss im Bild sein");
        } else if (footOk === false) {
          speak("Fuß ins Bild rücken");
        }
      }

      // All-green-Tracking → Auto-Trigger
      const allGreen = gyroOk && brightnessOk && arucoOk === true && footOk === true;
      if (allGreen) {
        if (allGatesGreenSinceRef.current === null) allGatesGreenSinceRef.current = now;
        const elapsed = now - allGatesGreenSinceRef.current;
        setHoldProgress(Math.min(1, elapsed / HOLD_TIME_MS));
        if (elapsed >= HOLD_TIME_MS) {
          // Auto-Capture!
          allGatesGreenSinceRef.current = null;
          setHoldProgress(0);
          await capturePhoto();
        }
      } else {
        allGatesGreenSinceRef.current = null;
        setHoldProgress(0);
      }
    }

    return () => window.clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refs are stable
  }, [phase]);

  // ===== Capture-Photo + Phase-Advance =====
  const capturePhoto = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;
    captureBusyRef.current = true;
    try {
      const blob = await captureFrame(video, { quality: 0.92 });
      hapticCalibrated();
      if (phaseRef.current === "top-photo") {
        setTopPhoto(blob);
        setPhase("top-validating");
        speak("Top-Foto erfasst");
      } else if (phaseRef.current === "side-photo") {
        setSidePhoto(blob);
        setPhase("side-validating");
        speak("Zweites Foto erfasst");
      }
    } catch (err) {
      console.error("captureFrame failed", err);
      setErrorMsg("Foto-Aufnahme fehlgeschlagen");
    } finally {
      captureBusyRef.current = false;
    }
  }, []);

  // ===== Top-Validating → Seated-Prompt (User-Confirm) → Side-Photo =====
  useEffect(() => {
    if (phase !== "top-validating") return;
    // Kurze Pause für haptic-feedback, dann „setz dich"-Prompt anzeigen.
    const t = setTimeout(() => {
      setGates({ gyro: "pending", brightness: "pending", aruco: "pending", foot: "pending" });
      // Server-Validation-Cache leeren — Top-Foto-Validation gilt nicht für Side-Foto
      serverResultRef.current = { aruco: null, foot: null, ts: 0 };
      lastValidationRef.current = 0;
      allGatesGreenSinceRef.current = null;
      setPhase("seated-prompt");
      speak("Foto eins ist im Kasten. Setz dich jetzt hin.", { force: true });
    }, 800);
    return () => clearTimeout(t);
  }, [phase]);

  // Confirm-Klick auf Seated-Prompt → Side-Photo
  const onSeatedConfirm = useCallback(() => {
    setPhase("side-photo");
    speak("Halt das Phone auf Knie-Höhe. Camera schräg nach unten zu deinem Fuß.", { force: true });
  }, []);

  // Cancel-Wrapper: cam.stop() vor onCancel-Callback. cam.stop() ist idempotent
  // (no-op wenn streamRef leer), darum sicher in allen Phasen aufrufbar. Vorher
  // rief der Seated-Prompt-Cancel nur onCancel() → Stream lief weiter falls
  // Parent nicht sofort unmountete → Hardware-Lock + Akku-Drain.
  const handleCancel = useCallback(() => {
    cam.stop();
    onCancel();
  }, [cam, onCancel]);

  // ===== Side-Validating → Submit =====
  useEffect(() => {
    if (phase !== "side-validating") return;
    if (!sessionId || !topPhoto || !sidePhoto) return;
    setPhase("submitting");
    hapticSubmitReady();
    speak("Beide Fotos erfasst — Maße werden berechnet");

    submitTwoPhotoMeasurement(sessionId, topPhoto, sidePhoto)
      .then((result) => {
        setMeasurements(result);
        if (result.ok) {
          cam.stop();
          setPhase("done");
          if (onSubmit) onSubmit(result);
          speak("Scan erfolgreich");
        } else {
          // Stream stoppen auch im Fail-Pfad (Codex-Iter3-Finding: Camera-Leak
          // wenn submit ok=false oder catch — Hardware bleibt locked, Akku-
          // Drain bis Component unmountet).
          cam.stop();
          setErrorMsg(result.error ?? "Submit fehlgeschlagen");
          setPhase("error");
        }
      })
      .catch((err) => {
        cam.stop();
        setErrorMsg(err instanceof Error ? err.message : String(err));
        setPhase("error");
      });
  }, [phase, sessionId, topPhoto, sidePhoto, onSubmit, cam]);

  // ===== Render =====
  const showCamera =
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
        <div className="absolute inset-0 flex flex-col items-center justify-start p-6 overflow-y-auto bg-background text-foreground">
          <div className="w-full max-w-md mx-auto pt-6 pb-6">
            <Camera className="h-10 w-10 mb-2 text-accent mx-auto" />
            <h1 className="text-2xl font-bold mb-1 text-center">Setup</h1>
            <p className="text-sm text-muted-foreground text-center mb-4">
              So bereitest du dich vor — das macht den Scan genauer.
            </p>

            {/* Pflicht-Icon-Leiste: Barfuß / Hosenbein / Knöchel / Zehen */}
            <div className="grid grid-cols-4 gap-2 mb-4">
              {[
                { emoji: "🦶", label: "Barfuß" },
                { emoji: "👖", label: "Hosenbein hoch" },
                { emoji: "📍", label: "Knöchel frei" },
                { emoji: "✋", label: "Zehen locker" },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex flex-col items-center text-center p-2 rounded-lg bg-muted/30 border border-border"
                >
                  <span className="text-xl mb-1" aria-hidden="true">{item.emoji}</span>
                  <span className="text-[10px] font-medium leading-tight">{item.label}</span>
                </div>
              ))}
            </div>

            {/* Top-Down-Illustration: Wand + Blatt + Fuß */}
            <div className="bg-muted/30 rounded-lg p-3 mb-4 flex justify-center">
              <SetupIllustration />
            </div>

            {/* 3-Sätze-Anweisung (v11 design) */}
            <ol className="space-y-2 text-sm mb-5 list-decimal list-inside text-foreground">
              <li>
                Leg das Blatt mit der kurzen Kante <strong>(↑ WAND-SEITE-Label)</strong> an die Wand.
              </li>
              <li>
                Setz dich auf einen normalen Stuhl. Beide Füße flach am Boden, Knie über dem Fuß. Stell deinen{" "}
                <strong>{selectedFoot === "right" ? "rechten" : "linken"} Fuß</strong> mittig aufs Blatt — Ferse berührt die Wand. Belaste den Fuß normal, Zehen locker.
              </li>
              <li>
                Mach erst <strong>Foto 1 von oben</strong> (Phone hochkant), dann <strong>Foto 2 seitlich von außen</strong> (Phone querformat). Bewege Fuß und Blatt zwischen den Fotos NICHT.
              </li>
            </ol>

            <Button size="lg" onClick={onStart} className="w-full gap-2">
              <Camera className="h-5 w-5" /> Start Quick-Scan
            </Button>
            <Button variant="ghost" size="sm" onClick={handleCancel} className="w-full mt-2 text-xs gap-1">
              <ArrowLeft className="h-3.5 w-3.5" /> Zurück
            </Button>
          </div>
        </div>
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
          <p className="text-sm text-muted-foreground mb-6 max-w-sm">{errorMsg}</p>
          <Button onClick={handleCancel} variant="outline" className="gap-2">
            <RotateCw className="h-4 w-4" /> Zurück
          </Button>
        </div>
      )}

      {(phase === "top-photo" || phase === "side-photo") && (
        <div className="absolute inset-0 flex flex-col">
          <div className="bg-gradient-to-b from-black/85 to-transparent p-3 text-center">
            <p className="text-base font-semibold mb-1">
              {phase === "top-photo" ? "Foto 1 von 2 — von oben" : "Foto 2 von 2 — von der Seite"}
            </p>
            {/* Illustration zeigt wie das Phone zu halten ist */}
            <div className="bg-white/95 rounded-lg p-2 mx-auto max-w-[260px] mb-2">
              {phase === "top-photo" ? <TopPhotoIllustration /> : <SidePhotoIllustration />}
            </div>
            <div className="flex items-center justify-center gap-3 text-[11px]">
              <Dot label="Phone-Haltung" state={gates.gyro} />
              <Dot label="Licht" state={gates.brightness} />
              <Dot label="Blatt" state={gates.aruco} />
              <Dot label="Fuß" state={gates.foot} />
              {isSpeechSupported() && (
                <button
                  type="button"
                  onClick={() => setSpeechOn((v) => !v)}
                  className={`ml-1 px-1.5 py-0.5 rounded ${
                    speechOn ? "bg-white/20" : "bg-white/5 text-white/50"
                  }`}
                  aria-label={speechOn ? "Voice aus" : "Voice an"}
                >
                  {speechOn ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
                </button>
              )}
            </div>
          </div>

          <div className="flex-1" />

          <div className="bg-gradient-to-t from-black/80 to-transparent p-4 text-center">
            {/* Hold-Progress-Ring */}
            <div className="relative w-20 h-20 mx-auto mb-3">
              <svg viewBox="0 0 80 80" className="w-full h-full">
                <circle cx="40" cy="40" r="35" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="6" />
                <circle
                  cx="40"
                  cy="40"
                  r="35"
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="6"
                  strokeDasharray={`${holdProgress * 219.9} 219.9`}
                  transform="rotate(-90 40 40)"
                  style={{ transition: "stroke-dasharray 100ms linear" }}
                />
              </svg>
              <Camera className="h-8 w-8 absolute inset-0 m-auto text-white" />
            </div>
            <p className="text-xs text-white/85 max-w-xs mx-auto">
              {holdProgress >= 1
                ? "Aufnahme!"
                : holdProgress > 0
                ? "Stillhalten… Foto wird gleich ausgelöst"
                : (() => {
                    // Konkrete Anweisung: was muss der User als Nächstes tun?
                    const failed: string[] = [];
                    if (gates.gyro !== "ok") failed.push(
                      phase === "top-photo"
                        ? "Phone wie ein Tablett halten — flach über dem Fuß"
                        : "Setz dich hin · Phone schräg über Knie Richtung Fuß"
                    );
                    if (gates.aruco !== "ok") failed.push("Blatt muss im Bild sein");
                    if (gates.foot !== "ok") failed.push("Fuß ins Bild rücken");
                    if (gates.brightness !== "ok") failed.push("Mehr Licht");
                    if (failed.length === 0) return "Sieht gut aus — gleich kommt der Auslöser";
                    return failed[0];
                  })()}
            </p>
            <Button variant="ghost" size="sm" onClick={handleCancel} className="mt-3 text-xs text-white/60">
              Abbrechen
            </Button>
          </div>
        </div>
      )}

      {(phase === "top-validating" || phase === "side-validating" || phase === "submitting") && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-background/80 text-foreground">
          <Loader2 className="h-10 w-10 animate-spin mb-4 text-accent" />
          <p className="text-sm">
            {phase === "submitting"
              ? "Maße werden berechnet…"
              : "Foto wird verarbeitet…"}
          </p>
        </div>
      )}

      {phase === "seated-prompt" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-background text-foreground overflow-y-auto">
          <div className="w-full max-w-md mx-auto py-6">
            <CheckCircle2 className="h-12 w-12 mb-3 text-emerald-600 mx-auto" />
            <h1 className="text-xl font-bold mb-2">Foto 1 im Kasten</h1>
            <p className="text-sm text-muted-foreground mb-4">
              Jetzt das zweite Foto — von der Seite. Bequemer im Sitzen.
            </p>

            {/* Illustration zeigt die seated-Pose */}
            <div className="bg-white/95 rounded-lg p-3 mb-4">
              <SidePhotoIllustration />
            </div>

            <div className="text-left bg-card border border-border rounded-lg p-3 mb-4 text-sm">
              <p className="font-semibold mb-1">So geht's weiter:</p>
              <ol className="space-y-1 text-xs text-muted-foreground list-decimal list-inside">
                <li>Setz dich auf einen Stuhl neben dem Blatt.</li>
                <li>Dein Fuß bleibt auf dem Blatt — Ferse weiter an der Wand.</li>
                <li>Halte das Phone auf Knie-Höhe, leicht gekippt Richtung Fuß.</li>
              </ol>
            </div>

            <Button size="lg" onClick={onSeatedConfirm} className="w-full gap-2">
              <Camera className="h-5 w-5" /> Bin sitzbereit — Foto 2 starten
            </Button>
            <Button variant="ghost" size="sm" onClick={handleCancel} className="w-full mt-2 text-xs">
              Scan abbrechen
            </Button>
          </div>
        </div>
      )}

      {phase === "done" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-background text-foreground">
          <CheckCircle2 className="h-16 w-16 mb-4 text-emerald-600" />
          <h1 className="text-2xl font-bold mb-2">Scan abgeschlossen</h1>
          {measurements?.measurements && (
            <div className="text-sm space-y-1 mb-4 mt-2">
              <p>Länge: <strong>{measurements.measurements.foot_length_mm.toFixed(0)} mm</strong></p>
              <p>Ballenbreite: <strong>{measurements.measurements.ball_width_mm.toFixed(0)} mm</strong></p>
              <p>Fersenbreite: <strong>{measurements.measurements.heel_width_mm.toFixed(0)} mm</strong></p>
              <p className="text-xs text-muted-foreground mt-2">
                EU-Größe: {measurements.measurements.eu_size}
              </p>
            </div>
          )}
          <Button onClick={handleCancel} variant="outline" className="gap-2">
            <RotateCw className="h-4 w-4" /> Neuer Scan
          </Button>
        </div>
      )}

      {phase === "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-background text-foreground">
          <h2 className="text-xl font-bold mb-2 text-red-500">Fehler</h2>
          <p className="text-sm text-muted-foreground mb-6 max-w-sm">{errorMsg}</p>
          <Button onClick={handleCancel} variant="outline" className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Zurück
          </Button>
        </div>
      )}
    </div>
  );
}

function Dot({ label, state }: { label: string; state: "ok" | "fail" | "pending" }) {
  const color =
    state === "ok"
      ? "bg-emerald-400"
      : state === "fail"
      ? "bg-red-400"
      : "bg-white/30";
  return (
    <div className="flex items-center gap-1">
      <span className={`inline-block w-2 h-2 rounded-full ${color}`} aria-hidden />
      <span className="text-white/80">{label}</span>
    </div>
  );
}
