/**
 * Pure-Function Gate-Evaluators für Quick-Scan-Lite + Premium-Scan-Pro.
 *
 * Decomposition aus runTickBody-Monolith — jede Function ist:
 *   - Pure (deterministic, no side-effects)
 *   - ≤30 LOC
 *   - Unit-testable in vitest ohne Component-Mounting
 *
 * Hard-vs-Soft-Distinction (v11 design):
 *   - Hard-Gates: Tap-Fallback NIE bypass-bar (Phone-Orientation, Marker-Count+
 *     Spatial-Coverage, Yaw-Ortho, Foot-BBox-Edge, Camera-Zoom, Planarity,
 *     Heel-Wand-Gap, Foot-Confidence-rolling-mean, Print-Scale, PnP-Z, Side-
 *     Sign, Foot-Central-60%-Frame).
 *   - Soft-Gates: Tap bypass-bar mit Warning-Toast (Gyro-Variance, Brightness,
 *     Foot-BBox-Stability, Light-Delta).
 */

export type Phase = "top" | "side";
export type SelectedFoot = "left" | "right";
export type GateSeverity = "hard" | "soft";

export type GateResult = {
  ok: boolean;
  severity: GateSeverity;
  reason?: string;
};

export type Orientation = {
  alpha: number | null;
  beta: number | null;
  gamma: number | null;
};

// ===== Constants (matched zu v11-design + Iter-3-Pivot) =====

export const TOP_GYRO_TOLERANCE_DEG = 15;
export const SIDE_TILT_MIN_DEG = 30;
export const SIDE_TILT_MAX_DEG = 80;
export const SIDE_CROSS_MAX_DEG = 25;

export const BRIGHTNESS_ABS_MIN = 50;
export const BRIGHTNESS_ABS_MAX = 230;
export const BRIGHTNESS_RELATIVE_DELTA = 0.3; // ±30% gegen probe-baseline

export const PNP_Z_MIN_MM = 80;
export const PNP_Z_MAX_MM = 350;

export const SIDE_YAW_MAX_DELTA_DEG = 15;
export const HEEL_WAND_GAP_MAX_MM = 3;
export const FOOT_CONFIDENCE_MIN = 0.85;
export const PRINT_SCALE_MAX_DEVIATION_PCT = 2.0;
export const HOMOGRAPHY_RESIDUALS_MAX_PX = 3.0;
export const MARKER_HULL_AREA_MIN_FRACTION = 0.7;
export const MARKER_COUNT_MIN_TOP = 3;
export const MARKER_COUNT_MIN_SIDE = 2;
export const FOOT_CENTRAL_FRAME_FRACTION = 0.6; // central 60% (Lite)

export const HOLD_TIME_TOP_MS = 1500;
export const HOLD_TIME_SIDE_MS = 2500;
export const TAP_FALLBACK_AFTER_MS = 8000;

// ===== Phone-Orientation Gate (Hard) =====

/**
 * Side-Photo erlaubt landscape-primary ODER landscape-secondary (User-choice).
 * Top-Photo erzwingt portrait-primary (kein upside-down — Iter-3-Regression-Fix).
 */
export function evaluatePhoneOrientation(
  orientationType: string | undefined,
  phase: Phase,
): GateResult {
  if (!orientationType) {
    // screen.orientation.type nicht verfügbar — accept (legacy-fallback).
    return { ok: true, severity: "hard" };
  }
  if (phase === "top") {
    if (orientationType === "portrait-primary") return { ok: true, severity: "hard" };
    return {
      ok: false,
      severity: "hard",
      reason: "Phone normal halten — Lade-Buchse unten, kein Querformat, kein Kopfüber.",
    };
  }
  // side phase
  if (orientationType === "landscape-primary" || orientationType === "landscape-secondary") {
    return { ok: true, severity: "hard" };
  }
  return {
    ok: false,
    severity: "hard",
    reason: "Phone seitlich drehen — Querformat für Foto 2.",
  };
}

// ===== Gyro Gate (Hard) =====

/**
 * Top-Photo: Phone flat über Fuß. |beta|≤15°.
 * Side-Photo: Phone tilted forward — exclusive-axis-pose. EINE Achse 30-80°,
 *   ANDERE <25° (excludes phone-flat-mit-wrist-roll).
 */
export function evaluateGyroGate(orient: Orientation, phase: Phase): GateResult {
  if (orient.beta == null || orient.gamma == null) {
    // Null beta/gamma würde via Math.abs als 0° fälschen. Frame-skip.
    return {
      ok: false,
      severity: "hard",
      reason: "Bewegungssensor liefert keine Werte — Phone kurz neigen.",
    };
  }
  const absBeta = Math.abs(orient.beta);
  const absGamma = Math.abs(orient.gamma);
  if (phase === "top") {
    if (absBeta <= TOP_GYRO_TOLERANCE_DEG) return { ok: true, severity: "hard" };
    return {
      ok: false,
      severity: "hard",
      reason: "Phone parallel zum Boden halten — wie ein Tablett.",
    };
  }
  // side phase
  const portraitTilt =
    absBeta >= SIDE_TILT_MIN_DEG &&
    absBeta <= SIDE_TILT_MAX_DEG &&
    absGamma < SIDE_CROSS_MAX_DEG;
  const landscapeTilt =
    absGamma >= SIDE_TILT_MIN_DEG &&
    absGamma <= SIDE_TILT_MAX_DEG &&
    absBeta < SIDE_CROSS_MAX_DEG;
  if (portraitTilt || landscapeTilt) return { ok: true, severity: "hard" };
  return {
    ok: false,
    severity: "hard",
    reason: "Phone seitlich kippen, Camera Richtung Fuß.",
  };
}

// ===== Brightness Gate (Soft) =====

/**
 * Brightness must be within absolute-bounds AND within ±30% of probe-baseline.
 * Soft because moderate light-changes are recoverable via Tap-fallback.
 */
export function evaluateBrightnessGate(
  brightnessMean: number,
  baseline?: number | null,
): GateResult {
  if (brightnessMean < BRIGHTNESS_ABS_MIN) {
    return { ok: false, severity: "soft", reason: "Mehr Licht bitte." };
  }
  if (brightnessMean > BRIGHTNESS_ABS_MAX) {
    return { ok: false, severity: "soft", reason: "Zu hell — direktes Sonnenlicht meiden." };
  }
  if (baseline != null && baseline > 0) {
    const rel = Math.abs(brightnessMean - baseline) / baseline;
    if (rel > BRIGHTNESS_RELATIVE_DELTA) {
      return {
        ok: false,
        severity: "soft",
        reason: "Licht hat sich seit dem Probe-Frame geändert.",
      };
    }
  }
  return { ok: true, severity: "soft" };
}

// ===== Foot-Central-60%-Frame Gate (Hard, Lite-only) =====

/**
 * Distortion=0 (Lite-UA-Prior) gibt 1-3mm Radial-Bias wenn foot near edge.
 * Pro mit echter Calibration kann das tolerieren.
 */
export function evaluateFootCentralFrame(
  footBboxPx: [number, number, number, number] | null,
  imageWidth: number,
  imageHeight: number,
  isLitePath: boolean,
): GateResult {
  if (!isLitePath) return { ok: true, severity: "hard" };
  if (!footBboxPx) return { ok: true, severity: "hard" };
  const [bx, by, bw, bh] = footBboxPx;
  const footCenterX = bx + bw / 2;
  const footCenterY = by + bh / 2;
  const margin = (1 - FOOT_CENTRAL_FRAME_FRACTION) / 2;
  const xMin = imageWidth * margin;
  const xMax = imageWidth * (1 - margin);
  const yMin = imageHeight * margin;
  const yMax = imageHeight * (1 - margin);
  if (
    footCenterX < xMin ||
    footCenterX > xMax ||
    footCenterY < yMin ||
    footCenterY > yMax
  ) {
    return {
      ok: false,
      severity: "hard",
      reason: "Phone besser zentrieren — Fuß in die Mitte.",
    };
  }
  return { ok: true, severity: "hard" };
}

// ===== Marker-Count + Spatial-Coverage Gate (Hard) =====

export function evaluateMarkerCoverage(
  markerCount: number,
  hullAreaFraction: number | null,
  phase: Phase,
): GateResult {
  const minCount = phase === "top" ? MARKER_COUNT_MIN_TOP : MARKER_COUNT_MIN_SIDE;
  if (markerCount < minCount) {
    return {
      ok: false,
      severity: "hard",
      reason: `Phone weiter weg — alle ${minCount}+ Marker müssen sichtbar sein.`,
    };
  }
  if (hullAreaFraction != null && phase === "top" && hullAreaFraction < MARKER_HULL_AREA_MIN_FRACTION) {
    return {
      ok: false,
      severity: "hard",
      reason: "Marker zu cluster-verteilt — Phone weiter weg.",
    };
  }
  return { ok: true, severity: "hard" };
}

// ===== Composer =====

export type AllGatesInput = {
  orientationType: string | undefined;
  orient: Orientation;
  phase: Phase;
  brightnessMean: number;
  brightnessBaseline?: number | null;
  footBboxPx: [number, number, number, number] | null;
  imageWidth: number;
  imageHeight: number;
  isLitePath: boolean;
  markerCount: number;
  markerHullAreaFraction: number | null;
};

export type ComposedGates = {
  allHardOk: boolean;
  allSoftOk: boolean;
  failedHard: GateResult[];
  failedSoft: GateResult[];
};

/**
 * Compose all client-side-evaluatable gates. Server-side-gates (PnP-Z, Side-
 * Yaw, Heel-Wand-Gap, Foot-Pivot, Homography-Residuals) sind separate via
 * detectExtended-Response — Caller prüft die zusätzlich.
 */
export function composeClientGates(input: AllGatesInput): ComposedGates {
  const results: GateResult[] = [
    evaluatePhoneOrientation(input.orientationType, input.phase),
    evaluateGyroGate(input.orient, input.phase),
    evaluateBrightnessGate(input.brightnessMean, input.brightnessBaseline),
    evaluateFootCentralFrame(
      input.footBboxPx,
      input.imageWidth,
      input.imageHeight,
      input.isLitePath,
    ),
    evaluateMarkerCoverage(input.markerCount, input.markerHullAreaFraction, input.phase),
  ];
  const failedHard = results.filter((r) => !r.ok && r.severity === "hard");
  const failedSoft = results.filter((r) => !r.ok && r.severity === "soft");
  return {
    allHardOk: failedHard.length === 0,
    allSoftOk: failedSoft.length === 0,
    failedHard,
    failedSoft,
  };
}
