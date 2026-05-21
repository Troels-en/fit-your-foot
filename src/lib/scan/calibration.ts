// Calibration-State und Stillness-Detector.
//
// User hält Phone in Start-Pose (~30cm über Fuß) ruhig. Wenn Stillness
// erreicht (1.5s lang Angular-Velocity < 5°/s), lock yaw_zero = current alpha.
// Floor-Tilt wird NICHT gemessen — KIRI's SfM rekonstruiert World-Frame
// aus Bildern selbst, Gyro ist nur für Live-Guidance.

import { angularVelocity, type Orientation } from "./orientation";

// Stillness-Detection-Tuning für hand-held Phone-Capture.
//
// 5°/s war zu strict: bei 60Hz Sensor-Polling und Hand-Tremor sind L2-Norm-
// Velocity-Spikes von 10-25°/s normal selbst beim "ruhig halten". Das führte
// zu konstantem stillSince=null → Timeout nach 8s ohne dass der User je den
// Threshold reißen würde.
//
// 25°/s deckt Hand-Tremor + Sensor-Noise ab, fängt aber echte Rotations-
// Versuche (>30°/s = sichtbare Bewegung) zuverlässig.
//
// 1200ms statt 1500ms = User braucht knappe 2x Threshold-Hold-Zeit nicht.
// 15000ms Timeout statt 8000 = User hat genug Puffer fürs Positionieren.
export const CALIBRATION_STILLNESS_MS = 1200;
export const CALIBRATION_THRESHOLD_DEG_PER_S = 25;
export const CALIBRATION_TIMEOUT_MS = 15000;

export type CalibrationState =
  | { phase: "waiting"; startedAt: number; stillSince: number | null }
  | { phase: "calibrated"; yawZero: number; calibratedAt: number };

export function startCalibration(now = Date.now()): CalibrationState {
  return { phase: "waiting", startedAt: now, stillSince: null };
}

/**
 * Update-Funktion: gegeben aktuelle Orientation + letzte Orientation + Zeit-Diff,
 * entscheide ob Calibration fertig ist.
 *
 * @returns neuer State + ob Stillness aktuell erreicht ist
 */
export function updateCalibration(
  state: CalibrationState,
  curr: Orientation,
  prev: Orientation | null,
  prevTimestamp: number,
  currTimestamp: number
): { state: CalibrationState; isStill: boolean; timedOut: boolean } {
  if (state.phase === "calibrated") {
    return { state, isStill: true, timedOut: false };
  }

  const timedOut = currTimestamp - state.startedAt > CALIBRATION_TIMEOUT_MS;
  if (timedOut) {
    return { state, isStill: false, timedOut: true };
  }

  if (!prev) {
    // Allererste Sample: kann noch keine velocity berechnen
    return { state, isStill: false, timedOut: false };
  }

  const velocity = angularVelocity(curr, prev, currTimestamp - prevTimestamp);
  const isStill = velocity < CALIBRATION_THRESHOLD_DEG_PER_S;

  if (!isStill) {
    // Nicht ruhig → reset stillSince
    return {
      state: { ...state, stillSince: null },
      isStill: false,
      timedOut: false,
    };
  }

  // isStill true
  const stillSince = state.stillSince ?? currTimestamp;
  const stillFor = currTimestamp - stillSince;

  if (stillFor >= CALIBRATION_STILLNESS_MS) {
    return {
      state: { phase: "calibrated", yawZero: curr.alpha, calibratedAt: currTimestamp },
      isStill: true,
      timedOut: false,
    };
  }

  return {
    state: { ...state, stillSince },
    isStill: true,
    timedOut: false,
  };
}
