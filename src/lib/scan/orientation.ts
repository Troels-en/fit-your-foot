// Cross-browser DeviceOrientation Helpers.
//
// alpha = compass-yaw (0-360°), beta = pitch (-180 bis 180°), gamma = roll (-90 bis 90°)
// auf den meisten Geräten. iOS Safari liefert diese in deviceorientation-Events,
// Android Chrome auch (mit absolute=true für magnetometer-fused yaw).

export type Orientation = {
  alpha: number; // yaw in degrees [0, 360)
  beta: number;  // pitch in degrees [-180, 180]
  gamma: number; // roll in degrees [-90, 90]
};

/**
 * Yaw-Wraparound-aware Differenz: gibt den kürzeren Pfad zwischen 2 Yaw-Werten.
 * z. B. prevYaw=355°, currYaw=5° → +10° (nicht -350°).
 * Ergebnis im Range (-180, 180].
 */
export function yawDelta(currYaw: number, prevYaw: number): number {
  let d = currYaw - prevYaw;
  while (d > 180) d -= 360;
  while (d <= -180) d += 360;
  return d;
}

/**
 * Normalisiert Yaw auf [0, 360).
 */
export function normalizeYaw(yaw: number): number {
  let n = yaw % 360;
  if (n < 0) n += 360;
  return n;
}

/**
 * Calibration-relativer Yaw: subtrahiert den Calibration-Offset, mit
 * Wraparound-aware Math. Ergebnis im [0, 360) Range.
 */
export function relativeYaw(rawYaw: number, yawZero: number): number {
  return normalizeYaw(yawDelta(rawYaw, yawZero));
}

/**
 * Approximate angular velocity (deg/s) zwischen zwei Orientation-Samples.
 * Nutzt die L2-Norm der Komponenten-Differenzen — gut genug für Stillness-
 * Detection ohne in Quaternion-Welt zu gehen.
 */
export function angularVelocity(
  curr: Orientation,
  prev: Orientation,
  deltaTimeMs: number
): number {
  if (deltaTimeMs <= 0) return 0;
  const dAlpha = Math.abs(yawDelta(curr.alpha, prev.alpha));
  const dBeta = Math.abs(curr.beta - prev.beta);
  const dGamma = Math.abs(curr.gamma - prev.gamma);
  const totalDeg = Math.sqrt(dAlpha * dAlpha + dBeta * dBeta + dGamma * dGamma);
  return (totalDeg * 1000) / deltaTimeMs;
}

/**
 * Validiert dass alle Komponenten von Orientation Numbers sind (nicht null/NaN).
 * DeviceOrientation kann sporadisch null liefern — dann skip.
 */
export function isOrientationValid(o: Partial<Orientation> | null | undefined): o is Orientation {
  if (!o) return false;
  return (
    typeof o.alpha === "number" && !Number.isNaN(o.alpha) &&
    typeof o.beta === "number" && !Number.isNaN(o.beta) &&
    typeof o.gamma === "number" && !Number.isNaN(o.gamma)
  );
}
