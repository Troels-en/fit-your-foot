import { useCallback, useEffect, useRef, useState } from "react";
import {
  Camera,
  CheckCircle2,
  Loader2,
  RotateCw,
  Smartphone,
  Sparkles,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCameraStream } from "@/hooks/scan/useCameraStream";
import { useDeviceOrientation } from "@/hooks/scan/useDeviceOrientation";
import { useFrameQuality } from "@/hooks/scan/useFrameQuality";
import { captureFrame } from "@/lib/scan/captureFrame";
import {
  CALIBRATION_STILLNESS_MS,
  CALIBRATION_TIMEOUT_MS,
  CALIBRATION_THRESHOLD_DEG_PER_S,
} from "@/lib/scan/calibration";
import {
  BUCKET_COUNT,
  BUCKET_DEG,
  MIN_FRAMES_PER_BUCKET,
  emptyBucketState,
  filledBucketCount,
  isSubmitReady,
  longestConsecutiveFilled,
  recordFrame,
  totalFrames,
  type BucketState,
} from "@/lib/scan/poseBuckets";
import { angularVelocity, relativeYaw, yawDelta, type Orientation } from "@/lib/scan/orientation";
import { validateFramesForKiri, type FrameMeta } from "@/lib/scan/kiriContract";
import {
  hapticBucketFilled,
  hapticCalibrated,
  hapticSubmitReady,
  isSpeechSupported,
  setSpeechEnabled,
  speak,
} from "@/lib/scan/feedback";
import { detectScanCapabilities, type ScanCapabilities } from "@/lib/scan/capabilities";
import {
  emptyHeatmapState,
  recordFrameInHeatmap,
  type HeatmapState,
} from "@/components/scan/CoverageHeatmap";
import CoverageHeatmap from "@/components/scan/CoverageHeatmap";
import {
  emptyPoseState,
  updatePoseStepper,
  type PoseState,
} from "@/lib/scan/poseStepper";
import PoseStepperBar from "@/components/scan/PoseStepperBar";

type Phase =
  | "intro"
  | "pre-scan-check"
  | "permission-pending"
  | "permission-error"
  | "calibrating"
  | "capturing"
  | "review"
  | "submitting"
  | "done";

export type SockThickness = "none" | "thin" | "medium" | "thick";
// Sprint 7: Capture-Modes. Beide nutzen die selbe Yaw-Orbit-Mechanik, nur
// das Setup unterscheidet sich:
//  - "stand"    Default. User hat Phone in Stativ/Gimbal/Selfie-Stick-Halterung
//               und hält das Setup mit beiden Händen → keine Hand-Tremor →
//               schärfere Frames, ±2-3mm-Goal näher.
//  - "handheld" Fallback wenn kein Stativ verfügbar. User hält Phone mit einer
//               Hand. Mehr Tremor, etwas schwächere Reconstruction-Qualität.
//
// Optical-Flow-Tracker (Phone-fixed, Fuß-rotiert) wäre architektonisch ein
// Switch zur KIRI Featureless-Object-Scan-API — out of Scope für Sprint 7.
export type CaptureMode = "stand" | "handheld";

type Props = {
  onSubmit: (
    frames: FrameMeta[],
    meta: { sockThickness: SockThickness; captureMode: CaptureMode }
  ) => Promise<void> | void;
};

// Sprint-1-Tuning: langsamere Capture-Cadence + striktere Quality-Gates.
// Begründung im WORKPLAN-20260502-photogrammetry-quality-jump.md §Phase 3.
const SAMPLE_INTERVAL_MS = 400; // 250 → 400: stabilere Frames, weniger Motion-Blur
const MIN_YAW_DELTA_DEG = 5;
const MOTION_VELOCITY_MAX = 20; // 30 → 20: nur sharp frames durchlassen
const BLUR_THRESHOLD = 200; // 100 → 200: stricter; fuzzy frames raus
const BRIGHTNESS_MIN = 80; // 40 → 80: tighter range
const BRIGHTNESS_MAX = 200; // 230 → 200
// Hard-Cap: 90 Frames × ~500KB avg ≈ 45MB total — passt unter den 50MB
// Edge-Function-Body-Cap (kiri-submit MAX_TOTAL_BYTES) mit ~10% Reserve.
// Hochsetzen würde 413-Errors bei real submits riskieren.
const MAX_FRAMES = 90;
// Per-Frame-Stillness-Gate: wartet bis PER_FRAME_STILLNESS_MS unter dieser
// Velocity vor Akzeptanz. Vorher 15°/s — bei natürlichem Walk-Pace
// (16-19°/s) entstand Dead-Zone zwischen diesem Gate und MOTION_VELOCITY_MAX,
// alle Frames wurden gedroppt. 18°/s closes diese Lücke.
const PER_FRAME_STILLNESS_MS = 100;
const PER_FRAME_STILLNESS_VEL_MAX = 18;
// Coaching-Hint: nach so vielen consecutive Fails einer Quality-Dimension wird
// ein spezifischer Voice-Hint ausgelöst (5 frames × 400ms ≈ 2 Sekunden problem
// erleben bevor system Vorschlag macht).
const COACHING_FAIL_STREAK = 5;

// Sprint 3: Elevation-Diversity-Tracking. KIRI's SfM braucht Frames aus
// verschiedenen Phone-Tilt-Winkeln (beta) damit Tiefen-Triangulation gut
// funktioniert. Ein Single-Ring-Equator-Orbit produziert zu wenig vertikale
// Baseline → Chimera-Mesh.
//
// Wir tracken beta-Range über alle akzeptierten Frames. Wenn Range < 15°
// nach 20+ Frames, Voice-Coaching-Hint "halte mal steiler oder flacher".
const ELEVATION_MIN_RANGE_DEG = 15;
const ELEVATION_COACH_AFTER_FRAMES = 20;
// Pass-2-Empfehlung: nach Pass-1-Ready bekommt User Optional die Wahl, einen
// 2. Pass mit verändertem Phone-Tilt zu machen. Pass-2-Target: beta um >15°
// vom Pass-1-Median entfernt. Dramatisch bessere Mesh-Quality für ~30s mehr.
const PASS_TWO_TARGET_DELTA_DEG = 15;

type Direction = "unknown" | "cw" | "ccw";

// Pre-Scan-Checkliste: 4 Items die User aktiv abhaken muss bevor Start.
type PreCheckKey = "scanMat" | "darkBackground" | "lighting" | "footPosition";
const PRE_CHECK_LABELS: Record<PreCheckKey, { title: string; sub: string }> = {
  scanMat: {
    title: "Gedrucktes Blatt neben dem Fuß auf dem Boden",
    sub: "PDF im Browser öffnen + auf Papier drucken",
  },
  darkBackground: {
    title: "Dunkler matter Untergrund",
    sub: "Schwarzes Tuch / dunkles Holz / Karton — KEIN weißes Bett",
  },
  lighting: {
    title: "Zwei Lichtquellen",
    sub: "Tageslicht von 2 Fenstern oder 2 Lampen seitlich — keine direkte Decken-Spot",
  },
  footPosition: {
    title: "Fuß auf Hocker / Stapel Bücher (~30 cm Höhe)",
    sub: "So dass du das Phone in einem Bogen über den Fuß führen kannst",
  },
};

export default function PhotogrammetryCapture({ onSubmit }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);

  // ===== Phase + UI-State =====
  const [phase, setPhase] = useState<Phase>("intro");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [buckets, setBuckets] = useState<BucketState>(emptyBucketState);
  const [frames, setFrames] = useState<FrameMeta[]>([]);
  const [direction, setDirection] = useState<Direction>("unknown");
  const [framesUrls, setFramesUrls] = useState<string[]>([]);
  // Live-Feedback fürs Calibrating-UI: Velocity (geglättet) + Stillness-Progress.
  const [calibInfo, setCalibInfo] = useState<{ velocity: number; stillFor: number }>({
    velocity: 0,
    stillFor: 0,
  });
  // Live-Yaw (relativ zu yawZero) fürs Capture-UI — zeigt wo User aktuell
  // im 360°-Orbit steht, damit er weiß welcher der 12 Bereiche grade dran ist.
  const [liveYaw, setLiveYaw] = useState<number | null>(null);
  // Live-Quality-Indicators für Capture-UI (Sprint 2). Drei Dots oben:
  // Belichtung / Schärfe / Bewegung. Werden bei JEDEM Frame-Tick gesetzt,
  // auch wenn Frame rejected wurde — damit User sieht WARUM kein Frame
  // angenommen wird.
  const [qualityInd, setQualityInd] = useState<{
    brightness: "ok" | "fail" | "pending";
    blur: "ok" | "fail" | "pending";
    motion: "ok" | "fail" | "pending";
  }>({ brightness: "pending", blur: "pending", motion: "pending" });
  // Voice-Toggle: User kann Speech ausschalten (default: an, wenn supported).
  const [speechOn, setSpeechOn] = useState(() => isSpeechSupported());
  // Counter-Refs: zählen consecutive-fail-streaks pro Quality-Dimension. Wenn
  // ≥ COACHING_FAIL_STREAK in Folge → spezifischer Voice-Hint.
  const failStreaksRef = useRef({ brightness: 0, blur: 0, motion: 0 });
  const lastFilledRef = useRef(0);
  const announcedReadyRef = useRef(false);
  // Sprint 3: Elevation-Diversity. betaHistory = abs-Werte aller akzeptierten
  // Frames; passOneMedianBeta = beta-Median nach Pass-1-Ready (Target für
  // Pass-2-Coaching).
  const elevationCoachedRef = useRef(false);
  const passOneMedianBetaRef = useRef<number | null>(null);
  const [betaHistory, setBetaHistory] = useState<number[]>([]);
  const [passTwoOffered, setPassTwoOffered] = useState(false);
  const [pass, setPass] = useState<1 | 2>(1);
  // Sprint 6: Device-Capabilities-Detection (WebXR / LiDAR). Async beim Mount,
  // lazy null bis Detection durch ist.
  const [capabilities, setCapabilities] = useState<ScanCapabilities | null>(null);
  // Sprint 7: Capture-Mode. Default 'stand' (Stativ/Gimbal) — schärfere Frames.
  const [captureMode, setCaptureMode] = useState<CaptureMode>("stand");
  // Phase 3: Coverage-Heatmap (12 Yaw × 3 Beta) + Pose-Stepper-UI-State.
  // Beide werden in capture-loop UPDATED aber beeinflussen frame-acceptance NICHT.
  const [heatmap, setHeatmap] = useState<HeatmapState>(emptyHeatmapState);
  const [poseStepper, setPoseStepper] = useState<PoseState>(emptyPoseState);
  const liveBetaRef = useRef<number | null>(null);
  // Pre-Scan-Checkliste-State + Sock-Thickness + Practice-Mode.
  const [preChecks, setPreChecks] = useState<Record<PreCheckKey, boolean>>({
    scanMat: false,
    darkBackground: false,
    lighting: false,
    footPosition: false,
  });
  const [sockThickness, setSockThickness] = useState<SockThickness>("none");
  const [practiceMode, setPracticeMode] = useState(false);
  // Per-frame-stillness-Gate: timestamp seit wann velocity unter Schwelle.
  const stillSinceRef = useRef<number | null>(null);

  // ===== Hooks =====
  const cam = useCameraStream(videoRef);
  const orient = useDeviceOrientation();
  const quality = useFrameQuality();

  // ===== Live-Refs (kein State, kein Re-Render-Trigger) =====
  const yawZeroRef = useRef<number | null>(null);
  const lastSampleRef = useRef<{ orientation: Orientation; ts: number } | null>(null);
  const lastAcceptedYawRef = useRef<number | null>(null);
  const directionVotesRef = useRef<(1 | -1)[]>([]);
  const directionRef = useRef<Direction>("unknown");
  const bucketsRef = useRef<BucketState>(emptyBucketState());
  const framesRef = useRef<FrameMeta[]>([]);
  const phaseRef = useRef<Phase>("intro");
  const captureBusyRef = useRef(false); // Re-entrancy-Guard für setInterval-Tick

  // Sync phase to ref so loops can read latest without dep
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  // Sync direction state to ref
  useEffect(() => {
    directionRef.current = direction;
  }, [direction]);

  // Reset all refs/state when restarting
  const resetState = useCallback(() => {
    yawZeroRef.current = null;
    lastSampleRef.current = null;
    lastAcceptedYawRef.current = null;
    directionVotesRef.current = [];
    directionRef.current = "unknown";
    bucketsRef.current = emptyBucketState();
    framesRef.current = [];
    stillSinceRef.current = null;
    // Sprint-2-Refs: Coaching-Streaks + Bucket-Watch + Ready-Watch.
    failStreaksRef.current = { brightness: 0, blur: 0, motion: 0 };
    lastFilledRef.current = 0;
    announcedReadyRef.current = false;
    // Sprint-3: Elevation-Coach + Pass-State.
    elevationCoachedRef.current = false;
    passOneMedianBetaRef.current = null;
    setBetaHistory([]);
    setPassTwoOffered(false);
    setPass(1);
    setBuckets(emptyBucketState());
    setFrames([]);
    setFramesUrls([]);
    setDirection("unknown");
    setErrorMsg(null);
    setCalibInfo({ velocity: 0, stillFor: 0 });
    setLiveYaw(null);
    setQualityInd({ brightness: "pending", blur: "pending", motion: "pending" });
    setPreChecks({
      scanMat: false,
      darkBackground: false,
      lighting: false,
      footPosition: false,
    });
    setSockThickness("none");
    setPracticeMode(false);
    setCaptureMode("stand"); // Default zurücksetzen
    // Phase 3 state reset
    setHeatmap(emptyHeatmapState());
    setPoseStepper(emptyPoseState());
    liveBetaRef.current = null;
  }, []);

  // ===== Object-URLs lifecycle (capture-then-revoke per useEffect) =====
  useEffect(() => {
    const newUrls = frames.map((f) => URL.createObjectURL(f.blob));
    setFramesUrls(newUrls);
    return () => {
      newUrls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [frames]);

  // ===== Phase: pre-scan-check / intro-practice → permission =====
  // Permission-Request MUSS aus einem Click-Handler heraus laufen (iOS-Gesture-
  // Chain), deshalb beide Pfade (Real + Practice) am Ende durch onStart durch.
  const onStart = useCallback(async () => {
    setErrorMsg(null);
    setPhase("permission-pending");

    // iOS Web-Speech-Prime: erste speak()-Call MUSS aus user-gesture stack
    // erfolgen sonst silent-fail auf iOS. Wir feuern eine quasi-leere Utterance
    // im Click-Handler ab — entsperrt subsequent calls aus RAF / setInterval.
    if (speechOn && isSpeechSupported()) {
      speak("Bereit.", { force: true });
    }

    // 1. iOS Motion-Permission FIRST (gesture chain)
    const motion = await orient.requestPermission();
    if (motion === "denied") {
      setErrorMsg("Bewegungssensor erforderlich. Bitte in Settings → Safari → Bewegung & Lage erlauben.");
      setPhase("permission-error");
      return;
    }
    if (motion === "unavailable") {
      setErrorMsg("Dein Browser unterstützt DeviceOrientation nicht. Bitte aktuellen Safari/Chrome nutzen.");
      setPhase("permission-error");
      return;
    }

    // 2. Camera mit Multi-Tier
    await cam.start();
  }, [cam, orient, speechOn]);

  // Practice-Mode: skip die Checkliste, direkt zum Permission-Step.
  // Real-Mode: zur Checkliste; von dort wird onStart aus dem nächsten Click ausgelöst.
  const onIntroNext = useCallback(
    (isPractice: boolean) => {
      setErrorMsg(null);
      setPracticeMode(isPractice);
      if (isPractice) {
        void onStart();
      } else {
        setPhase("pre-scan-check");
      }
    },
    [onStart]
  );

  const allPreChecksDone = (Object.keys(preChecks) as PreCheckKey[]).every((k) => preChecks[k]);

  // ===== Quality-Reporting + Coaching-Hints =====
  // Functional setState pro Dimension — kein stale-closure-Issue auf qualityInd
  // (vorher hatten wir `{...qualityInd}` aus dem Capture-Effect-Closure, der
  // bei phase-Wechsel einmal einrastet und nie aktualisiert).
  // Streak-Counter laufen via Ref ohne Re-Render-Trigger.
  const reportQuality = useCallback(
    (dim: "motion" | "brightness" | "blur", ok: boolean) => {
      setQualityInd((prev) => ({ ...prev, [dim]: ok ? "ok" : "fail" }));
      if (ok) {
        failStreaksRef.current[dim] = 0;
      } else {
        failStreaksRef.current[dim] += 1;
        if (failStreaksRef.current[dim] === COACHING_FAIL_STREAK) {
          const hint = {
            motion: "Langsamer drehen — Phone wackelt zu sehr",
            brightness:
              "Belichtung passt nicht — mehr Licht oder direkte Sonne vermeiden",
            blur: "Phone ruhig halten und etwas langsamer bewegen",
          }[dim];
          speak(hint);
        }
      }
    },
    []
  );

  // Watch: bei jedem neu gefüllten Bucket Haptic-Tap. Animations-Feedback ohne
  // dass User auf Screen schauen muss.
  useEffect(() => {
    const filledNow = filledBucketCount(buckets);
    if (filledNow > lastFilledRef.current) {
      hapticBucketFilled();
    }
    lastFilledRef.current = filledNow;
  }, [buckets]);

  // Watch: ready=true → "fertig"-Pattern + Voice-Announce (1× pro Capture-Run).
  useEffect(() => {
    if (phase !== "capturing") return;
    const isReady = isSubmitReady(buckets);
    if (isReady && !announcedReadyRef.current) {
      announcedReadyRef.current = true;
      hapticSubmitReady();
      speak("Genug Bereiche gedeckt — du kannst Fertig drücken");
    } else if (!isReady) {
      announcedReadyRef.current = false;
    }
  }, [buckets, phase]);

  // Speech-Toggle synchronisieren mit Modul-Setting.
  useEffect(() => {
    setSpeechEnabled(speechOn);
  }, [speechOn]);

  // Sprint 6: Capabilities einmal beim Mount detecten.
  useEffect(() => {
    let cancelled = false;
    detectScanCapabilities().then((c) => {
      if (!cancelled) setCapabilities(c);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // ===== Sprint 3: Elevation-Diversity-Coach =====
  // Wenn beta-Range über alle akzeptierten Frames < 15° nach 20+ Frames →
  // Voice-Hint "halte mal flacher / steiler". Fires einmal pro Capture-Run.
  useEffect(() => {
    if (phase !== "capturing") return;
    if (elevationCoachedRef.current) return;
    if (betaHistory.length < ELEVATION_COACH_AFTER_FRAMES) return;
    const min = Math.min(...betaHistory);
    const max = Math.max(...betaHistory);
    if (max - min < ELEVATION_MIN_RANGE_DEG) {
      elevationCoachedRef.current = true;
      const median = betaHistory.slice().sort((a, b) => a - b)[
        Math.floor(betaHistory.length / 2)
      ];
      // Coach in Richtung weg vom Median: wenn Median < 50° → "steiler",
      // sonst "flacher". So bekommt KIRI Multi-Elevation-Baseline.
      const hint =
        median < 50
          ? "Variier den Phone-Tilt — halte das Phone mal steiler"
          : "Variier den Phone-Tilt — halte das Phone mal flacher";
      speak(hint);
    }
  }, [betaHistory, phase]);

  // Pass-2-Offer: nach Pass-1-Ready zeigen wir einmalig den Pass-2-Bonus-CTA.
  useEffect(() => {
    if (phase !== "capturing") return;
    if (pass !== 1) return;
    if (passTwoOffered) return;
    if (!isSubmitReady(buckets)) return;
    setPassTwoOffered(true);
    // Pass-1-Median-Beta als Reference für Pass-2-Target speichern.
    if (betaHistory.length > 0) {
      const sorted = betaHistory.slice().sort((a, b) => a - b);
      passOneMedianBetaRef.current = sorted[Math.floor(sorted.length / 2)];
    }
  }, [buckets, phase, pass, passTwoOffered, betaHistory]);

  // Pass-2-Start: User clicked CTA. Reset bucket-state damit user den 2.
  // Pass tracken kann (gleiches yaw-orbit, neue elevation). framesRef bleibt
  // explizit erhalten — Submit aggregiert beide Pässe in einem KIRI-Request.
  // betaHistory wird auch resettet damit Elevation-Coach in Pass 2 erneut
  // anschlagen kann falls User den Tilt nicht ändert.
  const startPassTwo = useCallback(() => {
    bucketsRef.current = emptyBucketState();
    setBuckets(emptyBucketState());
    lastAcceptedYawRef.current = null;
    directionVotesRef.current = [];
    directionRef.current = "unknown";
    setDirection("unknown");
    announcedReadyRef.current = false;
    lastFilledRef.current = 0;
    elevationCoachedRef.current = false; // Pass-2-Coach kann neu anschlagen
    setBetaHistory([]); // Pass 2 hat eigene Beta-Range
    setPass(2);
    const target = passOneMedianBetaRef.current;
    const tiltHint =
      target !== null
        ? target < 50
          ? "Pass 2: halte das Phone jetzt deutlich steiler und lauf nochmal rum"
          : "Pass 2: halte das Phone jetzt deutlich flacher und lauf nochmal rum"
        : "Pass 2: ändere den Phone-Tilt und lauf nochmal rum";
    speak(tiltHint);
    hapticCalibrated();
  }, []);

  // ===== Camera-State Effect → advance auf calibrating =====
  useEffect(() => {
    if (phase !== "permission-pending") return;
    if (cam.state.phase === "ready") {
      let cancelled = false;
      // 3. Sensor-Probe 2s
      orient.probe(2000).then((ok) => {
        if (cancelled) return;
        if (!ok) {
          setErrorMsg("DeviceOrientation liefert keine Events. Bitte aktuellen Browser nutzen.");
          setPhase("permission-error");
          cam.stop();
          return;
        }
        // Reset sample-ref damit Calibration sauber startet
        lastSampleRef.current = null;
        setPhase("calibrating");
      });
      return () => {
        cancelled = true;
      };
    } else if (cam.state.phase === "error") {
      setErrorMsg(cam.state.reason);
      setPhase("permission-error");
    }
  }, [cam, orient, phase]);

  // ===== Phase: calibrating (single RAF reading via refs) =====
  useEffect(() => {
    if (phase !== "calibrating") return;
    let cancelled = false;
    let raf: number | null = null;
    const startedAt = Date.now();
    let stillSince: number | null = null;
    // Velocity-Smoothing: rolling avg über letzte 5 Samples → dämpft 60Hz-
    // Sensor-Spikes von einzelnen Hand-Tremor-Mikrobewegungen.
    const velHistory: number[] = [];
    let lastUiUpdate = 0;

    const tick = () => {
      if (cancelled) return;
      const now = Date.now();
      const curr = orient.currentRef.current;

      if (now - startedAt > CALIBRATION_TIMEOUT_MS) {
        setErrorMsg(
          "Telefon ruhig halten — Calibration nicht erfolgreich. Probier nochmal."
        );
        cam.stop();
        setPhase("permission-error");
        return;
      }

      if (!curr) {
        raf = requestAnimationFrame(tick);
        return;
      }

      const prev = lastSampleRef.current;
      lastSampleRef.current = { orientation: curr, ts: now };

      if (!prev) {
        raf = requestAnimationFrame(tick);
        return;
      }

      const rawVel = angularVelocity(curr, prev.orientation, now - prev.ts);
      velHistory.push(rawVel);
      if (velHistory.length > 5) velHistory.shift();
      const smoothedVel =
        velHistory.reduce((sum, v) => sum + v, 0) / velHistory.length;
      const isStill = smoothedVel < CALIBRATION_THRESHOLD_DEG_PER_S;

      if (!isStill) {
        stillSince = null;
      } else if (stillSince === null) {
        stillSince = now;
      }

      // UI-Update throttled auf ~10Hz statt 60Hz (kein React-Re-Render-Storm).
      if (now - lastUiUpdate > 100) {
        lastUiUpdate = now;
        const stillFor = stillSince === null ? 0 : now - stillSince;
        setCalibInfo({ velocity: smoothedVel, stillFor });
      }

      if (
        isStill &&
        stillSince !== null &&
        now - stillSince >= CALIBRATION_STILLNESS_MS
      ) {
        yawZeroRef.current = curr.alpha;
        lastSampleRef.current = null;
        resetCaptureSpecific();
        // Voice + Haptic Feedback: User weiß ohne Screen-Watching dass er
        // jetzt anfangen kann zu laufen.
        hapticCalibrated();
        speak("Kalibriert — lauf jetzt langsam um den Fuß rum");
        setPhase("capturing");
        return;
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      if (raf !== null) cancelAnimationFrame(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: refs are stable
  }, [phase]);

  const resetCaptureSpecific = useCallback(() => {
    lastAcceptedYawRef.current = null;
    directionVotesRef.current = [];
    directionRef.current = "unknown";
    failStreaksRef.current = { brightness: 0, blur: 0, motion: 0 };
    lastFilledRef.current = 0;
    announcedReadyRef.current = false;
    // Sprint-3-State reset: bei Calibration-Retry darf kein leak von Pass-2-
    // Banner / pass-State aus vorheriger Session bleiben.
    elevationCoachedRef.current = false;
    passOneMedianBetaRef.current = null;
    bucketsRef.current = emptyBucketState();
    framesRef.current = [];
    setBuckets(emptyBucketState());
    setFrames([]);
    setDirection("unknown");
  }, []);

  // ===== Phase: capturing (single setInterval reading via refs) =====
  useEffect(() => {
    if (phase !== "capturing") return;
    if (yawZeroRef.current === null) return;

    const interval = window.setInterval(async () => {
      if (phaseRef.current !== "capturing") return;
      const curr = orient.currentRef.current;
      const video = videoRef.current;
      // Live-Yaw setzen wenn Orientation da ist — auch wenn Frame-Capture
      // noch nicht möglich (Re-Entrancy oder Video noch nicht ready).
      // Sonst keine UI-Updates → User weiß nicht wo er steht.
      if (curr && yawZeroRef.current !== null) {
        const relYaw = relativeYaw(curr.alpha, yawZeroRef.current);
        setLiveYaw(relYaw);
        liveBetaRef.current = curr.beta;
        // Phase 3: Pose-Stepper updaten (UI-only, kein gate auf frame-acceptance)
        setPoseStepper((prev) => {
          const r = updatePoseStepper(
            prev,
            relYaw,
            Date.now(),
            directionRef.current === "cw" ? "cw" : "ccw"
          );
          if (r.reachedThisTick.length > 0) {
            hapticBucketFilled();
            speak(`Position ${r.reachedThisTick[0] + 1} erreicht`);
          }
          return r.state;
        });
      }
      // Re-entrancy-Guard: wenn vorheriger Tick noch läuft (Worker langsam,
      // captureFrame-Encoding lange auf low-end), dropt der nächste Tick
      // statt zu queuen → verhindert Backlog.
      if (captureBusyRef.current) return;
      if (!curr || !video || video.readyState < 2 || video.videoWidth === 0) return;
      captureBusyRef.current = true;
      try {
        await captureLoopBody(curr, video);
      } finally {
        captureBusyRef.current = false;
      }
    }, SAMPLE_INTERVAL_MS);

    async function captureLoopBody(curr: Orientation, video: HTMLVideoElement) {
      // Hard-Cap MAX_FRAMES: stoppt das Akzeptieren neuer Frames.
      // User kann via Submit-Button (ab Bucket-Coverage) abschließen.
      if (framesRef.current.length >= MAX_FRAMES) return;

      const yawZero = yawZeroRef.current!;
      const lastYaw = lastAcceptedYawRef.current;

      // Direction-Lock + Reverse-Detection
      if (lastYaw !== null) {
        const delta = yawDelta(curr.alpha, lastYaw);
        if (Math.abs(delta) > 2) {
          const sign: 1 | -1 = delta > 0 ? 1 : -1;
          directionVotesRef.current.push(sign);
          if (directionVotesRef.current.length > 5) directionVotesRef.current.shift();
        }
        // Lock direction nach 3 votes mit gleichem Vorzeichen
        if (directionRef.current === "unknown" && directionVotesRef.current.length >= 3) {
          const recent3 = directionVotesRef.current.slice(-3);
          const allPos = recent3.every((s) => s === 1);
          const allNeg = recent3.every((s) => s === -1);
          if (allPos) {
            directionRef.current = "ccw";
            setDirection("ccw");
          } else if (allNeg) {
            directionRef.current = "cw";
            setDirection("cw");
          }
        }
        // Reverse: direction locked, aber recent3 ist alles entgegen
        if (directionRef.current !== "unknown") {
          const recent3 = directionVotesRef.current.slice(-3);
          if (recent3.length >= 3) {
            const expected = directionRef.current === "ccw" ? 1 : -1;
            const allReverse = recent3.every((s) => s === -expected);
            if (allReverse) {
              // Reset Stillness-Streak: User hat Richtung gewechselt, das nächste
              // forward-frame muss frische 100ms-Stillness sammeln.
              stillSinceRef.current = null;
              return;
            }
          }
        }
      }

      // Pose-Range-Gate: zu wenig Yaw-Bewegung seit letzter Akzeptanz.
      // Stillness-Streak wird hier NICHT resettet — User wartet bewusst, das
      // ist OK; nächste forward-bewegung mit ausreichend Yaw kann sofort
      // accepted werden (Stillness ist über die Wartezeit weiter gewachsen).
      if (lastYaw !== null) {
        if (Math.abs(yawDelta(curr.alpha, lastYaw)) < MIN_YAW_DELTA_DEG) return;
      }

      // Stillness-Gate (Outer-Cap): velocity über MOTION_VELOCITY_MAX → drop.
      const prevSample = lastSampleRef.current;
      const now = Date.now();
      lastSampleRef.current = { orientation: curr, ts: now };
      if (prevSample && now - prevSample.ts > 0) {
        const vel = angularVelocity(curr, prevSample.orientation, now - prevSample.ts);
        if (vel > MOTION_VELOCITY_MAX) {
          stillSinceRef.current = null;
          reportQuality("motion", false);
          return;
        }
        if (vel > PER_FRAME_STILLNESS_VEL_MAX) {
          stillSinceRef.current = null;
          reportQuality("motion", false);
          return;
        }
        if (stillSinceRef.current === null) stillSinceRef.current = now;
        if (now - stillSinceRef.current < PER_FRAME_STILLNESS_MS) {
          // Velocity OK, aber Stillness-Window noch nicht voll — frame skip
          // OHNE motion-fail (User bewegt sich korrekt langsam).
          return;
        }
        reportQuality("motion", true);
      }

      // Frame-Capture
      let blob: Blob;
      try {
        blob = await captureFrame(video);
      } catch (err) {
        console.error("captureFrame failed", err);
        return;
      }

      if (phaseRef.current !== "capturing") return; // could have changed

      // Quality-Score via Worker (mit Fallback)
      const score = await quality.score(blob);
      if (!score) return;
      const brightnessOk =
        score.brightness >= BRIGHTNESS_MIN && score.brightness <= BRIGHTNESS_MAX;
      const blurOk = score.blur >= BLUR_THRESHOLD;
      reportQuality("brightness", brightnessOk);
      reportQuality("blur", blurOk);
      if (!brightnessOk || !blurOk) return;

      // Akzeptieren
      lastAcceptedYawRef.current = curr.alpha;
      const relYaw = relativeYaw(curr.alpha, yawZero);
      const meta: FrameMeta = {
        blob,
        yawAtCapture: relYaw,
        betaAtCapture: curr.beta,
        capturedAt: now,
      };
      bucketsRef.current = recordFrame(bucketsRef.current, relYaw);
      framesRef.current = [...framesRef.current, meta];
      setBuckets(bucketsRef.current);
      setFrames(framesRef.current);
      // Sprint 3: Beta-History für Elevation-Diversity-Tracking
      setBetaHistory((prev) => [...prev, curr.beta]);
      // Phase 3: Coverage-Heatmap mit echten Daten (12 Yaw × 3 Beta-Bands)
      setHeatmap((prev) => recordFrameInHeatmap(prev, relYaw, curr.beta));
    }

    return () => window.clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refs are stable
  }, [phase]);

  // ===== Submit / Restart / Done-Cleanup =====
  const handleSubmit = useCallback(async () => {
    // Practice-Mode: kein KIRI-Submit, einfach reset auf intro.
    if (practiceMode) {
      cam.stop();
      resetState();
      setPhase("intro");
      return;
    }
    const validation = validateFramesForKiri(frames);
    if (!validation.ok) {
      setErrorMsg(validation.reason);
      return;
    }
    setPhase("submitting");
    try {
      await onSubmit(frames, { sockThickness, captureMode });
      cam.stop();
      setPhase("done");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Submit fehlgeschlagen");
      setPhase("review");
    }
  }, [frames, onSubmit, cam, practiceMode, resetState, sockThickness, captureMode]);

  const handleRestart = useCallback(() => {
    cam.stop();
    resetState();
    setPhase("intro");
  }, [cam, resetState]);

  // Auto-stop camera on done if not already
  useEffect(() => {
    if (phase === "done") {
      cam.stop();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on enter done
  }, [phase]);

  // ===== Render =====
  // WICHTIG: Video-Element MUSS immer im DOM sein, damit videoRef.current
  // bereits non-null ist wenn cam.start() in onStart() läuft. Phase-Screens
  // werden als Overlays gerendert.
  const filled = filledBucketCount(buckets);
  const consecutive = longestConsecutiveFilled(buckets);
  const total = totalFrames(buckets);
  const ready = isSubmitReady(buckets);
  const videoVisible =
    phase === "calibrating" || phase === "capturing" || phase === "review" || phase === "submitting";

  return (
    <div className="relative min-h-screen bg-black text-white">
      <video
        ref={videoRef}
        playsInline
        muted
        className={`absolute inset-0 w-full h-full object-cover ${videoVisible ? "" : "invisible"}`}
      />

      {phase === "intro" && (
        <div className="absolute inset-0 flex flex-col items-center justify-start p-6 overflow-y-auto bg-background text-foreground">
          <div className="w-full max-w-md mx-auto pt-6 pb-6">
            <Smartphone className="h-10 w-10 mb-2 text-accent mx-auto" />
            <h1 className="text-2xl font-bold mb-2 text-center">3D-Fußscan</h1>
            {/* AR-fähige Devices (iPhone Pro+, Android mit ARCore) bekommen
                einen Hint dass künftig ein Premium-Pfad kommen wird. Ohne
                Session-Probe (würde Permission-Prompt triggern) können wir
                LiDAR nicht definitiv bestätigen — wir zeigen den Badge nur
                wenn beide AR-fähig UND Apple-Hint stimmen. */}
            {capabilities?.immersiveArSupported &&
              capabilities?.appleLidarLikely && (
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded p-2 mb-3 text-center">
                  <p className="text-xs text-emerald-700 dark:text-emerald-300 font-semibold flex items-center justify-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5" />
                    AR-fähiges Phone erkannt
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Photogrammetry läuft jetzt — Premium-LiDAR-Pfad kommt im
                    nächsten Update.
                  </p>
                </div>
              )}
            <p className="text-sm text-muted-foreground text-center mb-4">
              Wir nehmen ~70 scharfe Frames auf während du um deinen Fuß rum
              gehst. Funktioniert auch barfuß, mit Socke wird's noch genauer.
            </p>

            {/* Capture-Mode-Toggle: Stand (Default) vs Hand-Held */}
            <div className="bg-muted/30 rounded-lg p-3 mb-4">
              <p className="text-xs font-semibold mb-2">Wie hältst du das Phone?</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setCaptureMode("stand")}
                  className={`p-2 rounded-lg border-2 text-left ${
                    captureMode === "stand"
                      ? "border-accent bg-accent/10"
                      : "border-border bg-card hover:border-muted-foreground"
                  }`}
                >
                  <p className="text-sm font-semibold">Mit Stativ</p>
                  <p className="text-[11px] text-muted-foreground">
                    Selfie-Stick / Gimbal / Tripod — schärfere Frames
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => setCaptureMode("handheld")}
                  className={`p-2 rounded-lg border-2 text-left ${
                    captureMode === "handheld"
                      ? "border-accent bg-accent/10"
                      : "border-border bg-card hover:border-muted-foreground"
                  }`}
                >
                  <p className="text-sm font-semibold">Hand-Held</p>
                  <p className="text-[11px] text-muted-foreground">
                    Eine Hand — Notlösung wenn kein Stativ da
                  </p>
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground mt-2">
                {captureMode === "stand"
                  ? "Empfohlen — Stativ eliminiert Hand-Tremor und liefert deutlich bessere Mesh-Qualität."
                  : "Geht auch, aber halte das Phone bewusst RUHIG mit beiden Händen wenn möglich."}
              </p>
            </div>

            {/* Animierte Skizze: Top-Down, Fuß + Mat in Mitte, Phone-Punkt
                rotiert kontinuierlich um den Fuß-Kreis. */}
            <SetupAnimation />

            <ol className="space-y-3 my-5 text-sm">
              <li className="flex gap-3">
                <span className="flex-none w-6 h-6 rounded-full bg-accent text-white text-xs font-bold flex items-center justify-center">1</span>
                <div>
                  <strong>Blatt ausdrucken</strong> + neben den Fuß auf den Boden legen.
                  <a href="/scan-mat.html" target="_blank" rel="noreferrer" className="block mt-1 text-accent underline text-xs">
                    Druckvorlage öffnen →
                  </a>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="flex-none w-6 h-6 rounded-full bg-accent text-white text-xs font-bold flex items-center justify-center">2</span>
                <div>
                  <strong>Dunkler matter Untergrund</strong> drunter (schwarzes
                  Tuch oder dunkles Holz — KEIN weißes Bett oder heller Teppich).
                </div>
              </li>
              <li className="flex gap-3">
                <span className="flex-none w-6 h-6 rounded-full bg-accent text-white text-xs font-bold flex items-center justify-center">3</span>
                <div>
                  <strong>Lauf langsam einmal um den Fuß rum</strong> (~30 sek
                  für einen Kreis). Phone schräg von oben auf den Fuß gerichtet.
                </div>
              </li>
              <li className="flex gap-3">
                <span className="flex-none w-6 h-6 rounded-full bg-accent text-white text-xs font-bold flex items-center justify-center">4</span>
                <div>
                  Der Kreis-Indicator zeigt welche Bereiche schon gedeckt sind.
                  Alle grün = fertig.
                </div>
              </li>
            </ol>

            <div className="space-y-2">
              <Button size="lg" onClick={() => onIntroNext(false)} className="w-full gap-2">
                <Camera className="h-5 w-5" /> Scan starten
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => onIntroNext(true)}
                className="w-full gap-2"
              >
                Erst üben (kein Submit)
              </Button>
              <p className="text-[11px] text-muted-foreground text-center mt-2">
                „Erst üben" macht den ganzen Flow durch ohne an KIRI zu senden — gut für ersten Try.
              </p>
            </div>
          </div>
        </div>
      )}

      {phase === "pre-scan-check" && (
        <div className="absolute inset-0 flex flex-col items-center justify-start p-6 overflow-y-auto bg-background text-foreground">
          <div className="w-full max-w-md mx-auto pt-6 pb-6">
            <h1 className="text-xl font-bold mb-1 text-center">Setup-Check</h1>
            <p className="text-xs text-muted-foreground text-center mb-5">
              Hak alles ab was bei dir bereit ist. Genauer Setup → präziseres Mesh.
            </p>

            <div className="space-y-3 mb-5">
              {(Object.keys(PRE_CHECK_LABELS) as PreCheckKey[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() =>
                    setPreChecks((prev) => ({ ...prev, [key]: !prev[key] }))
                  }
                  className={`w-full flex items-start gap-3 p-3 rounded-lg border-2 text-left transition-colors ${
                    preChecks[key]
                      ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30"
                      : "border-border bg-card hover:border-muted-foreground"
                  }`}
                >
                  <span
                    className={`flex-none w-6 h-6 mt-0.5 rounded-full border-2 flex items-center justify-center ${
                      preChecks[key]
                        ? "border-emerald-500 bg-emerald-500 text-white"
                        : "border-muted-foreground"
                    }`}
                  >
                    {preChecks[key] && <CheckCircle2 className="h-4 w-4" />}
                  </span>
                  <div>
                    <p className="font-semibold text-sm">{PRE_CHECK_LABELS[key].title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {PRE_CHECK_LABELS[key].sub}
                      {key === "scanMat" && (
                        <>
                          {" · "}
                          <a
                            href="/scan-mat.html"
                            target="_blank"
                            rel="noreferrer"
                            className="text-accent underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            PDF öffnen
                          </a>
                        </>
                      )}
                    </p>
                  </div>
                </button>
              ))}
            </div>

            {/* Sock-Thickness-Picker */}
            <div className="mb-5">
              <p className="text-sm font-semibold mb-2">Trägst du eine Socke beim Scan?</p>
              <p className="text-xs text-muted-foreground mb-3">
                Mit gemusterter Socke wird der Scan oft genauer. Wir rechnen die
                Sock-Dicke aus den Maßen raus.
              </p>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { key: "none", label: "Barfuß", sub: "0 mm" },
                  { key: "thin", label: "Dünn", sub: "~1 mm (Sport)" },
                  { key: "medium", label: "Mittel", sub: "~3 mm (Alltag)" },
                  { key: "thick", label: "Dick", sub: "~6 mm (Wolle)" },
                ] as { key: SockThickness; label: string; sub: string }[]).map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setSockThickness(opt.key)}
                    className={`p-3 rounded-lg border-2 text-left ${
                      sockThickness === opt.key
                        ? "border-accent bg-accent/10"
                        : "border-border bg-card hover:border-muted-foreground"
                    }`}
                  >
                    <p className="text-sm font-semibold">{opt.label}</p>
                    <p className="text-[11px] text-muted-foreground">{opt.sub}</p>
                  </button>
                ))}
              </div>
            </div>

            <Button
              size="lg"
              disabled={!allPreChecksDone}
              onClick={onStart}
              className="w-full gap-2"
            >
              <Camera className="h-5 w-5" /> Scan starten
            </Button>
            {!allPreChecksDone && (
              <p className="text-[11px] text-muted-foreground text-center mt-2">
                Alle 4 Punkte abhaken um fortzufahren
              </p>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPhase("intro")}
              className="w-full mt-2 text-xs"
            >
              ← Zurück zur Anleitung
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
          <Button onClick={handleRestart} variant="outline" className="gap-2">
            <RotateCw className="h-4 w-4" /> Erneut versuchen
          </Button>
        </div>
      )}

      {phase === "done" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-background text-foreground">
          <CheckCircle2 className="h-16 w-16 mb-4 text-emerald-600" />
          <h1 className="text-2xl font-bold mb-2">Scan abgeschlossen</h1>
          <p className="text-sm text-muted-foreground">Wir verarbeiten jetzt deinen Scan.</p>
        </div>
      )}

      {videoVisible && (
        <div className="absolute inset-0 flex flex-col">
          {practiceMode && (
            <div className="bg-amber-500 text-black text-xs font-semibold py-1 px-3 text-center">
              🎯 PRACTICE-MODE — Frames werden nicht gesendet
            </div>
          )}
          {/* Header */}
          <div className="bg-gradient-to-b from-black/80 to-transparent p-4 text-center">
            {phase === "calibrating" ? (
              <>
                <p className="text-base font-semibold">Kalibrierung</p>
                <p className="text-xs text-white/70 mb-2">
                  Halte das Telefon ~30 cm über deinem Fuß und ruhig
                </p>
                <div className="flex items-center gap-2 max-w-xs mx-auto">
                  <span className="text-xs text-white/60 font-mono w-16 text-right">
                    {calibInfo.velocity.toFixed(1)}°/s
                  </span>
                  <div className="flex-1 h-2 bg-white/20 rounded overflow-hidden">
                    <div
                      className="h-full bg-emerald-400 transition-all duration-100"
                      style={{
                        width: `${Math.min(
                          100,
                          (calibInfo.stillFor / CALIBRATION_STILLNESS_MS) * 100
                        )}%`,
                      }}
                    />
                  </div>
                  <span className="text-xs text-white/60 font-mono w-12">
                    {(calibInfo.stillFor / 1000).toFixed(1)}s
                  </span>
                </div>
                <p className="text-[10px] text-white/50 mt-1">
                  Bar füllt wenn ruhig &lt; {CALIBRATION_THRESHOLD_DEG_PER_S}°/s
                </p>
              </>
            ) : phase === "capturing" ? (
              <>
                <p className="text-base font-semibold">
                  Lauf langsam um den Fuß rum
                  {direction === "cw" && " ↻"}
                  {direction === "ccw" && " ↺"}
                </p>
                <p className="text-xs text-white/70 mb-2">
                  {filled}/12 Bereiche gedeckt · {total} Frames
                </p>
                {/* Live-Quality-Indicators: 3 Dots zeigen aktuellen Frame-Status. */}
                <div className="flex items-center justify-center gap-3 text-[11px]">
                  <QualityDot label="Belichtung" state={qualityInd.brightness} />
                  <QualityDot label="Schärfe" state={qualityInd.blur} />
                  <QualityDot label="Bewegung" state={qualityInd.motion} />
                  {isSpeechSupported() && (
                    <button
                      type="button"
                      onClick={() => setSpeechOn((v) => !v)}
                      className={`ml-1 px-1.5 py-0.5 rounded ${
                        speechOn ? "bg-white/20 text-white" : "bg-white/5 text-white/50"
                      }`}
                      aria-label={speechOn ? "Voice ausschalten" : "Voice einschalten"}
                    >
                      {speechOn ? (
                        <Volume2 className="h-3.5 w-3.5" />
                      ) : (
                        <VolumeX className="h-3.5 w-3.5" />
                      )}
                    </button>
                  )}
                </div>
              </>
            ) : null}
          </div>

          <div className="flex-1" />

          {/* Bottom Action */}
          <div className="bg-gradient-to-t from-black/80 to-transparent p-4">
            {phase === "capturing" && (
              <div className="space-y-3">
                {/* Phase 3: Pose-Stepper-Bullets (UI-Layer, kein frame-gate) */}
                <PoseStepperBar state={poseStepper} />
                {/* Phase 3: Coverage-Heatmap (echte Daten, kein vapor) */}
                <CoverageHeatmap
                  state={heatmap}
                  liveYaw={liveYaw}
                  liveBeta={liveBetaRef.current}
                />
                {pass === 2 && (
                  <div className="bg-purple-500/20 border border-purple-400/50 rounded p-1.5 text-center text-[11px] text-purple-100">
                    Pass 2 — anderer Phone-Tilt für Mesh-Quality-Boost
                  </div>
                )}
                <p className="text-center text-sm text-white/80">
                  {ready
                    ? "Genug Bereiche gedeckt — du kannst Fertig drücken"
                    : liveYaw === null
                    ? "Warte auf Bewegungssensor…"
                    : (() => {
                        const next = nextEmptyBucketHint(buckets, liveYaw);
                        if (!next) return "Weiter laufen — fast geschafft!";
                        const dirText =
                          next.dir === "cw" ? "↻ rechts rum" : "↺ links rum";
                        return `${dirText} weiter — noch ${
                          BUCKET_COUNT - filled
                        } Bereiche offen`;
                      })()}
                </p>
                {/* Pass-2-Offer-CTA: nach Pass-1-Ready einmalig Bonus-Run anbieten */}
                {ready && pass === 1 && passTwoOffered && (
                  <div className="bg-emerald-500/15 border border-emerald-400/40 rounded p-3 space-y-2">
                    <p className="text-xs text-emerald-100 text-center">
                      <strong>Quality-Boost:</strong> ein 2. Durchgang mit
                      anderem Phone-Tilt verbessert die Mesh-Qualität deutlich
                      (~30 Sekunden mehr). Optional aber empfohlen.
                    </p>
                    <Button
                      size="sm"
                      onClick={startPassTwo}
                      className="w-full"
                      variant="secondary"
                    >
                      2. Pass starten (anderer Tilt)
                    </Button>
                  </div>
                )}
                <Button
                  size="lg"
                  disabled={!ready}
                  onClick={() => setPhase("review")}
                  className="w-full"
                >
                  {ready
                    ? `Fertig${pass === 2 ? " mit 2 Pässen" : ""} (${total} Frames)`
                    : `Brauchen noch ${MIN_FRAMES_PER_BUCKET * BUCKET_COUNT - total > 0 ? MIN_FRAMES_PER_BUCKET * BUCKET_COUNT - total : 0}+ Frames`}
                </Button>
              </div>
            )}

            {phase === "review" && (
              <div className="space-y-3">
                {practiceMode && (
                  <div className="bg-amber-500/20 border border-amber-500/50 rounded p-2 text-xs text-center text-amber-100">
                    🎯 Practice-Mode — Frames werden NICHT gesendet
                  </div>
                )}
                <p className="text-sm text-center">
                  {frames.length} Frames {practiceMode ? "im Practice-Run" : "bereit zum Senden"}
                </p>
                <div className="grid grid-cols-6 gap-1 max-h-32 overflow-y-auto">
                  {framesUrls.map((url, i) => (
                    <img key={i} src={url} alt="" className="aspect-square object-cover rounded" />
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleRestart} className="flex-1">
                    Neu starten
                  </Button>
                  <Button onClick={handleSubmit} className="flex-1">
                    {practiceMode ? "Practice abschließen" : "Senden"}
                  </Button>
                </div>
                {errorMsg && <p className="text-xs text-red-400">{errorMsg}</p>}
              </div>
            )}

            {phase === "submitting" && (
              <div className="text-center">
                <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                <p className="text-sm">Wird verarbeitet…</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Top-Down Kreis mit 12 Bucket-Segmenten. Grün = ≥3 Frames, Amber = 1-2 Frames,
 * Grau = leer. Weißer Pfeil-Marker zeigt aktuelle Yaw-Position des Users
 * relativ zur Calibration. Damit weiß der User auf einen Blick: "Ich bin hier,
 * dort sind noch Lücken."
 */
function OrbitIndicator({
  buckets,
  liveYaw,
}: {
  buckets: BucketState;
  liveYaw: number | null;
}) {
  const cx = 90;
  const cy = 90;
  const r = 60;
  const segGap = 4; // °
  return (
    <svg viewBox="0 0 180 180" className="w-40 h-40 mx-auto block">
      {/* Bucket-Segmente */}
      {buckets.counts.map((count, i) => {
        const startDeg = i * BUCKET_DEG + segGap / 2;
        const endDeg = (i + 1) * BUCKET_DEG - segGap / 2;
        const color =
          count >= MIN_FRAMES_PER_BUCKET
            ? "#10b981" // emerald
            : count >= 1
            ? "#f59e0b" // amber
            : "rgba(255,255,255,0.2)";
        return (
          <path
            key={i}
            d={arcPath(cx, cy, r, startDeg, endDeg)}
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeLinecap="butt"
          />
        );
      })}
      {/* Mittel-Punkt = Fuß-Symbol */}
      <ellipse cx={cx} cy={cy} rx="6" ry="14" className="fill-white/60" />
      {/* Aktuelle Position des Users */}
      {liveYaw !== null && (() => {
        const pos = polarToCartesian(cx, cy, r, liveYaw);
        return (
          <>
            <circle cx={pos.x} cy={pos.y} r="8" className="fill-white" />
            <circle cx={pos.x} cy={pos.y} r="3" className="fill-black" />
          </>
        );
      })()}
    </svg>
  );
}

/**
 * SVG-Arc-Pfad-Helper: liefert ein Path-Segment auf einem Kreis. 0° = oben,
 * Uhrzeigersinn positiv (passt zu unserem Yaw-Konzept wo "vor uns" = oben).
 */
function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  const start = polarToCartesian(cx, cy, r, startDeg);
  const end = polarToCartesian(cx, cy, r, endDeg);
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

function polarToCartesian(cx: number, cy: number, r: number, deg: number) {
  // 0° = oben (12-Uhr), CW positiv. SVG-Standard ist 0°=3-Uhr CCW also -90 offset.
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

/**
 * Nächster leerer Bucket relativ zur aktuellen Yaw-Position. Wählt die
 * kürzere Richtung (CW oder CCW) damit User nicht zurücklaufen muss.
 */
function nextEmptyBucketHint(
  buckets: BucketState,
  liveYaw: number
): { idx: number; dir: "cw" | "ccw"; offset: number } | null {
  const currIdx = Math.floor((((liveYaw % 360) + 360) % 360) / BUCKET_DEG);
  for (let offset = 1; offset < BUCKET_COUNT; offset++) {
    const cwIdx = (currIdx + offset) % BUCKET_COUNT;
    if (buckets.counts[cwIdx] < MIN_FRAMES_PER_BUCKET) {
      return { idx: cwIdx, dir: "cw", offset };
    }
    const ccwIdx = (currIdx - offset + BUCKET_COUNT) % BUCKET_COUNT;
    if (buckets.counts[ccwIdx] < MIN_FRAMES_PER_BUCKET) {
      return { idx: ccwIdx, dir: "ccw", offset };
    }
  }
  return null;
}

/**
 * Quality-Indicator-Dot: zeigt OK/Fail/Pending für eine Quality-Dimension.
 * Klein + zentriert oben damit User auf einen Blick sieht ob die letzte
 * Frame-Akzeptanz wegen Belichtung / Schärfe / Bewegung gefailt ist.
 */
function QualityDot({
  label,
  state,
}: {
  label: string;
  state: "ok" | "fail" | "pending";
}) {
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

/**
 * Animierte Setup-Skizze für den Intro-Screen. Top-Down-Sicht: Fuß + Mat in
 * der Mitte, Phone-Marker rotiert kontinuierlich um den Fuß-Kreis um die
 * 360°-Orbit-Bewegung zu illustrieren. Verwendet SVG `animateMotion` für
 * native Pfad-Animation (gut supportiert in iOS Safari + Android Chrome).
 */
function SetupAnimation() {
  return (
    <div className="bg-muted/40 rounded-lg p-3 mb-2">
      <p className="text-xs text-muted-foreground text-center mb-2">
        So läuft's ab (Top-Down-Ansicht):
      </p>
      <svg viewBox="0 0 200 140" className="w-full h-32" aria-hidden="true">
        {/* Orbit-Pfad — gestrichelt, dient als animateMotion-Pfad */}
        <defs>
          <path
            id="orbit-path"
            d="M 100 25 A 55 45 0 1 1 99.99 25"
          />
          <marker
            id="arrow-anim"
            viewBox="0 0 10 10"
            refX="5"
            refY="5"
            markerWidth="5"
            markerHeight="5"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" className="fill-accent" />
          </marker>
        </defs>
        {/* Sichtbare Bahn (gestrichelter Kreis) */}
        <ellipse
          cx="100"
          cy="70"
          rx="55"
          ry="45"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeDasharray="4 4"
          className="text-muted-foreground"
        />
        {/* Scan-Mat (Rechteck neben dem Fuß) */}
        <rect
          x="115"
          y="56"
          width="20"
          height="28"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          className="text-muted-foreground"
        />
        <text x="125" y="74" textAnchor="middle" fontSize="6" className="fill-muted-foreground">
          BLATT
        </text>
        {/* Fuß (Oval in der Mitte) */}
        <ellipse cx="92" cy="70" rx="9" ry="20" className="fill-accent" />
        {/* Animierter Phone-Marker — wandert entlang des orbit-path */}
        <g>
          <circle r="5" className="fill-foreground">
            <animateMotion dur="6s" repeatCount="indefinite">
              <mpath href="#orbit-path" />
            </animateMotion>
          </circle>
          {/* Trail-Punkte mit gestaffelter Animation für Bewegungs-Eindruck */}
          <circle r="3" className="fill-foreground/50">
            <animateMotion dur="6s" repeatCount="indefinite" begin="-0.4s">
              <mpath href="#orbit-path" />
            </animateMotion>
          </circle>
          <circle r="2" className="fill-foreground/30">
            <animateMotion dur="6s" repeatCount="indefinite" begin="-0.8s">
              <mpath href="#orbit-path" />
            </animateMotion>
          </circle>
        </g>
      </svg>
      <p className="text-[11px] text-muted-foreground text-center">
        Du läufst langsam um Fuß + Blatt rum. Phone bleibt auf den Fuß gerichtet.
      </p>
    </div>
  );
}
