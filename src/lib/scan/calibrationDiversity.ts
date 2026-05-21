/**
 * Pure-function View-Angle-Diversity-Check für Premium-Scan-Pro Multi-Frame
 * Calibration. Zhang's Method braucht 5+ Frames mit unterschiedlicher
 * Camera-Pose vs. Mat — sonst degeneriert die Calibration auf eine ebene
 * Pose-Familie ohne Distortion-Recovery.
 *
 * Diversity-Gate:
 *   - Mindestens ≥15° Rotation-Delta (Yaw oder Pitch oder Roll) ggü. einem
 *     der bisherigen Frames, ODER
 *   - Mindestens ≥150mm Translation (Marker-Center-Shift in Pixeln, mapped
 *     auf marker-coords-mm wenn Pixel-zu-mm-Skala bekannt).
 *
 * Returns true wenn Frame neu genug ist, false wenn zu nah an existierendem.
 */

export type CapturedPose = {
  alpha: number | null;
  beta: number | null;
  gamma: number | null;
  /** Marker-Center-Pixel als grobe Translation-Reference. Optional. */
  markerCenterPx?: { x: number; y: number } | null;
};

const ROTATION_DIVERSITY_DEG = 15;
const TRANSLATION_DIVERSITY_PX = 150; // ~1/10 of frame-width as proxy

/**
 * Returns true wenn `candidate` Frame ausreichend Diversity vs. ALLEN
 * `existing` Frames hat. False wenn candidate zu nah an mindestens einem.
 */
export function hasViewAngleDiversity(
  candidate: CapturedPose,
  existing: CapturedPose[],
): boolean {
  if (existing.length === 0) return true;
  for (const prev of existing) {
    const rotDelta = computeRotationDelta(candidate, prev);
    const transDelta = computeTranslationDelta(candidate, prev);
    if (rotDelta < ROTATION_DIVERSITY_DEG && transDelta < TRANSLATION_DIVERSITY_PX) {
      // Zu nah an diesem Frame — diversity verletzt.
      return false;
    }
  }
  return true;
}

export function computeRotationDelta(a: CapturedPose, b: CapturedPose): number {
  const deltas: number[] = [];
  if (a.alpha != null && b.alpha != null) deltas.push(angleDelta(a.alpha, b.alpha));
  if (a.beta != null && b.beta != null) deltas.push(Math.abs(a.beta - b.beta));
  if (a.gamma != null && b.gamma != null) deltas.push(Math.abs(a.gamma - b.gamma));
  return deltas.length === 0 ? Infinity : Math.max(...deltas);
}

export function computeTranslationDelta(a: CapturedPose, b: CapturedPose): number {
  if (!a.markerCenterPx || !b.markerCenterPx) return Infinity;
  const dx = a.markerCenterPx.x - b.markerCenterPx.x;
  const dy = a.markerCenterPx.y - b.markerCenterPx.y;
  return Math.hypot(dx, dy);
}

/** Wrapped-around alpha-delta (0-360°). */
function angleDelta(a: number, b: number): number {
  const raw = Math.abs(a - b) % 360;
  return raw > 180 ? 360 - raw : raw;
}

export const CALIBRATION_FRAME_COUNT_TARGET = 5;
export const CALIBRATION_FRAME_COUNT_MIN = 3;
export const CALIBRATION_FRAME_COUNT_MAX = 8;
