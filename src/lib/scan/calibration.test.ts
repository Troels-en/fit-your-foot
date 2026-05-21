import { describe, expect, it } from "vitest";
import {
  CALIBRATION_STILLNESS_MS,
  CALIBRATION_TIMEOUT_MS,
  startCalibration,
  updateCalibration,
} from "./calibration";

const o = (alpha: number, beta = 0, gamma = 0) => ({ alpha, beta, gamma });

describe("startCalibration", () => {
  it("starts in waiting phase", () => {
    const s = startCalibration(1000);
    expect(s.phase).toBe("waiting");
    if (s.phase === "waiting") {
      expect(s.startedAt).toBe(1000);
      expect(s.stillSince).toBeNull();
    }
  });
});

describe("updateCalibration", () => {
  it("first sample without prev → not still, no calibrate", () => {
    const s = startCalibration(0);
    const r = updateCalibration(s, o(45), null, 0, 0);
    expect(r.isStill).toBe(false);
    expect(r.timedOut).toBe(false);
    expect(r.state.phase).toBe("waiting");
  });

  it("low velocity triggers stillSince", () => {
    let s = startCalibration(0);
    let r = updateCalibration(s, o(45), o(45), 0, 100);
    expect(r.isStill).toBe(true);
    if (r.state.phase === "waiting") {
      expect(r.state.stillSince).toBe(100);
    }
  });

  it("high velocity resets stillSince", () => {
    let s = startCalibration(0);
    // First sample stable
    let r = updateCalibration(s, o(45), o(45), 0, 100);
    s = r.state;
    // Then sudden movement (yawDelta 50° in 100ms = 500°/s)
    r = updateCalibration(s, o(95), o(45), 100, 200);
    expect(r.isStill).toBe(false);
    if (r.state.phase === "waiting") {
      expect(r.state.stillSince).toBeNull();
    }
  });

  it("stillness for CALIBRATION_STILLNESS_MS triggers calibrated state", () => {
    let s = startCalibration(0);
    // Tick 1 at t=100: stillSince := 100
    let r = updateCalibration(s, o(45), o(45), 0, 100);
    s = r.state;
    // Tick 2 just below threshold: still waiting
    const justBelowT = 100 + CALIBRATION_STILLNESS_MS - 50;
    r = updateCalibration(s, o(45), o(45), 100, justBelowT);
    expect(r.state.phase).toBe("waiting");
    s = r.state;
    // Tick 3 above threshold: calibrated
    const aboveT = 100 + CALIBRATION_STILLNESS_MS + 50;
    r = updateCalibration(s, o(45.01), o(45), justBelowT, aboveT);
    expect(r.state.phase).toBe("calibrated");
    if (r.state.phase === "calibrated") {
      expect(r.state.yawZero).toBeCloseTo(45.01, 2);
    }
  });

  it("times out after CALIBRATION_TIMEOUT_MS without success", () => {
    const s = startCalibration(0);
    const r = updateCalibration(s, o(45), o(45), 0, CALIBRATION_TIMEOUT_MS + 1);
    expect(r.timedOut).toBe(true);
    expect(r.state.phase).toBe("waiting");
  });

  it("calibrated state stays calibrated", () => {
    let s = startCalibration(0);
    let r = updateCalibration(s, o(45), o(45), 0, 100);
    s = r.state;
    r = updateCalibration(s, o(45), o(45), 100, 1700);
    expect(r.state.phase).toBe("calibrated");
    s = r.state;
    // Even with motion, stays calibrated
    r = updateCalibration(s, o(180), o(45), 1700, 2000);
    expect(r.state.phase).toBe("calibrated");
  });
});

describe("constants sanity", () => {
  it("stillness threshold > 1s, < 5s", () => {
    expect(CALIBRATION_STILLNESS_MS).toBeGreaterThan(1000);
    expect(CALIBRATION_STILLNESS_MS).toBeLessThan(5000);
  });
  it("timeout > stillness", () => {
    expect(CALIBRATION_TIMEOUT_MS).toBeGreaterThan(CALIBRATION_STILLNESS_MS);
  });
});
