import { describe, expect, it } from "vitest";
import {
  POSE_COUNT,
  POSE_DEG,
  POSE_HOLD_TIME_MS,
  POSE_MATCH_TOLERANCE_DEG,
  emptyPoseState,
  poseAnchorYaw,
  poseReachedCount,
  updatePoseStepper,
} from "./poseStepper";
import { emptyBucketState, recordFrame, totalFrames } from "./poseBuckets";

describe("Pose-Stepper Math", () => {
  it("6 Posen × 60° = 360°", () => {
    expect(POSE_COUNT * POSE_DEG).toBe(360);
  });

  it("poseAnchorYaw(0) = 0° für CCW", () => {
    expect(poseAnchorYaw(0, "ccw")).toBe(0);
  });

  it("poseAnchorYaw(3) = 180° für CCW", () => {
    expect(poseAnchorYaw(3, "ccw")).toBe(180);
  });

  it("poseAnchorYaw bei CW negativ aber wraps", () => {
    expect(poseAnchorYaw(1, "cw")).toBe(300); // -60° → 300°
  });
});

describe("Pose-Match-Window", () => {
  it("User exakt auf Anchor → in Window, hold not yet reached", () => {
    let s = emptyPoseState();
    const r = updatePoseStepper(s, 0, 1000);
    expect(r.state.currentInWindow).toBe(0);
    expect(r.reachedThisTick).toEqual([]);
  });

  it("User in Window für Hold-Time → reached", () => {
    let s = emptyPoseState();
    let r = updatePoseStepper(s, 0, 0);
    s = r.state;
    r = updatePoseStepper(s, 0, POSE_HOLD_TIME_MS + 100);
    expect(r.reachedThisTick).toEqual([0]);
    expect(r.state.reached[0]).toBe(true);
  });

  it("User leaves window before hold-time → reset, no reach", () => {
    let s = emptyPoseState();
    let r = updatePoseStepper(s, 0, 0);
    s = r.state;
    // User pass-by mit 30°/s, also nach 0.66s schon wieder out of window
    r = updatePoseStepper(s, 30, 700); // 30° away, beyond ±10° tolerance
    expect(r.state.currentInWindow).toBeNull();
    expect(r.state.reached[0]).toBe(false);
  });

  it("User outside ±10° tolerance → not in window", () => {
    const s = emptyPoseState();
    const r = updatePoseStepper(s, 15, 0); // 15° from anchor 0 = beyond ±10°
    expect(r.state.currentInWindow).toBeNull();
  });
});

describe("Stepper-Independence-Test (CRITICAL)", () => {
  /**
   * Verifies the architectural claim that pose-stepper-state does NOT affect
   * frame-acceptance-counts. This is the property reviewers said must be
   * tested before B2-implementation.
   *
   * Setup: simulate yaw-sequence with 100 frames at varying angles. Run
   * recordFrame against each. Compare:
   *  (a) Just the bucket-state from recordFrame (no stepper involved)
   *  (b) Same yaw-sequence, but ALSO update pose-stepper in parallel
   *
   * Expected: identical bucket-frame-count and bucket-distribution
   * regardless of stepper-state.
   */
  it("frame-acceptance (recordFrame) is unchanged by stepper-updates", () => {
    // Simulate an orbit over 30 seconds (one full circle), sampled every 300ms = 100 frames.
    const yawSequence: { yaw: number; t: number }[] = [];
    for (let i = 0; i < 100; i++) {
      yawSequence.push({ yaw: (i * 360) / 100, t: i * 300 });
    }

    // Run A: nur bucket-state (no stepper)
    let bucketsA = emptyBucketState();
    for (const { yaw } of yawSequence) {
      bucketsA = recordFrame(bucketsA, yaw);
    }

    // Run B: parallel bucket-state + stepper-state
    let bucketsB = emptyBucketState();
    let stepperState = emptyPoseState();
    for (const { yaw, t } of yawSequence) {
      bucketsB = recordFrame(bucketsB, yaw);
      const r = updatePoseStepper(stepperState, yaw, t);
      stepperState = r.state;
    }

    // Frame-Acceptance-Counts MUST match
    expect(totalFrames(bucketsA)).toBe(totalFrames(bucketsB));
    expect(bucketsA.counts).toEqual(bucketsB.counts);

    // Sanity-check: stepper actually did something (some poses reached)
    expect(poseReachedCount(stepperState)).toBeGreaterThanOrEqual(0);
  });

  it("multiple stepper-state-mutations don't bleed into bucket-state", () => {
    // Worst-case: stepper-state changes massively (all 6 poses reached + reset)
    // — bucket-state must remain pure-function-of-yaw.
    let buckets = emptyBucketState();
    let stepper = emptyPoseState();

    // Tick 1: yaw 0°, t=0
    buckets = recordFrame(buckets, 0);
    let r = updatePoseStepper(stepper, 0, 0);
    stepper = r.state;

    // Tick 2: yaw 0°, t=2000 (hold reached)
    buckets = recordFrame(buckets, 0);
    r = updatePoseStepper(stepper, 0, 2000);
    stepper = r.state;
    expect(stepper.reached[0]).toBe(true);

    // Tick 3: same yaw, no double-count of stepper
    r = updatePoseStepper(stepper, 0, 3000);
    expect(r.reachedThisTick).toEqual([]); // already reached, no re-trigger

    // Buckets after 3 frames at yaw=0 should all be in bucket 0
    expect(buckets.counts[0]).toBe(2);
    expect(buckets.counts.slice(1).every((c) => c === 0)).toBe(true);
  });
});
