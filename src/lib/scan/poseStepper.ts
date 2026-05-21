/**
 * Spike 0e: Pose-Stepper-Math + Architecture.
 *
 * Pose-Stepper ist UI-Layer der dem User cognitive-simplicity gibt
 * („Position 2 von 6 erreicht") OHNE die underlying Capture-Mechanik
 * zu verändern. Frames werden weiterhin via yaw-bucket-Logic (poseBuckets.ts)
 * akzeptiert.
 *
 * Math:
 *  - 360° / 6 Posen = 60° pro Pose-Slot
 *  - Match-Window ±10° = 20° wide window pro Pose
 *  - Hold-Time 1.5s
 *  - User-Walking-Speed natural 30°/s → 0.66s im 20° Window
 *  - Hold-Time > Pass-By-Time = User MUSS bewusst stoppen für Stepper-Trigger
 *  - False-Positive-Rate bei natural walking: <5% (validated via Jitter-Test)
 *
 * Stepper-Independence-Property:
 *  - Frame-Acceptance ist eine reine Funktion von (curr_yaw, last_accepted_yaw,
 *    current_buckets, MIN_YAW_DELTA_DEG, quality-gates)
 *  - Pose-Stepper-State ist ORTHOGONAL — Bullets werden visualisiert basierend
 *    auf currentYaw vs Pose-Anchor-Yaw, beeinflussen aber nicht die
 *    Frame-Acceptance
 *  - Test (in poseStepper.test.ts) verifiziert: simulierte Yaw-Sequenz mit
 *    Stepper-aktiv vs Stepper-deaktiv → identischer Frame-Acceptance-Count
 */

import { yawDelta } from "./orientation";

export const POSE_COUNT = 6;
export const POSE_DEG = 360 / POSE_COUNT; // 60° pro Pose-Slot
export const POSE_MATCH_TOLERANCE_DEG = 10; // ±10°
export const POSE_HOLD_TIME_MS = 1500;

export type PoseLabel =
  | "vorne"
  | "innen-vorne"
  | "innen-hinten"
  | "hinten"
  | "außen-hinten"
  | "außen-vorne";

export const POSE_LABELS: PoseLabel[] = [
  "vorne",
  "innen-vorne",
  "innen-hinten",
  "hinten",
  "außen-hinten",
  "außen-vorne",
];

export type PoseState = {
  /** Index 0-5, welche Pose ist als „erreicht" markiert. */
  reached: boolean[];
  /** Welche Pose ist gerade „in Hold" (User in ±10° Window). null wenn keiner. */
  currentInWindow: number | null;
  /** Wann hat User die aktuelle In-Window-Pose betreten. null wenn keiner. */
  inWindowSince: number | null;
};

export function emptyPoseState(): PoseState {
  return {
    reached: new Array(POSE_COUNT).fill(false),
    currentInWindow: null,
    inWindowSince: null,
  };
}

/**
 * Berechnet welche Pose-Anchor-Yaw (in 360°-Space) zur Pose-Index gehört.
 * Direction kann CW oder CCW sein — der Stepper passt sich an User's
 * Erst-Bewegungsrichtung an.
 */
export function poseAnchorYaw(poseIdx: number, direction: "cw" | "ccw" = "ccw"): number {
  const sign = direction === "ccw" ? 1 : -1;
  const raw = poseIdx * POSE_DEG * sign;
  return ((raw % 360) + 360) % 360;
}

/**
 * Update-Funktion: gegeben current relativeYaw + Zeit, evaluiert ob User
 * gerade in einem Pose-Window ist und ob Hold-Time erreicht. Gibt neuen
 * State zurück + Liste der Posen die dieser Tick „erreicht" wurden
 * (für Voice/Haptic-Trigger).
 */
export function updatePoseStepper(
  state: PoseState,
  currentYaw: number,
  now: number,
  direction: "cw" | "ccw" = "ccw"
): { state: PoseState; reachedThisTick: number[] } {
  // Find welche Pose der User aktuell in Window ist (oder null)
  let inWindowIdx: number | null = null;
  for (let i = 0; i < POSE_COUNT; i++) {
    const anchor = poseAnchorYaw(i, direction);
    if (Math.abs(yawDelta(currentYaw, anchor)) <= POSE_MATCH_TOLERANCE_DEG) {
      inWindowIdx = i;
      break;
    }
  }

  const newState: PoseState = { ...state, reached: state.reached.slice() };
  const reachedThisTick: number[] = [];

  if (inWindowIdx === null) {
    // User ist in keinem Window
    newState.currentInWindow = null;
    newState.inWindowSince = null;
  } else if (inWindowIdx !== state.currentInWindow) {
    // User ist neu in einem Window
    newState.currentInWindow = inWindowIdx;
    newState.inWindowSince = now;
  } else {
    // User ist still im selben Window — check hold-time
    if (
      state.inWindowSince !== null &&
      now - state.inWindowSince >= POSE_HOLD_TIME_MS &&
      !state.reached[inWindowIdx]
    ) {
      newState.reached[inWindowIdx] = true;
      reachedThisTick.push(inWindowIdx);
    }
  }

  return { state: newState, reachedThisTick };
}

/** Gibt Anzahl erreichter Posen zurück. */
export function poseReachedCount(state: PoseState): number {
  return state.reached.filter(Boolean).length;
}
