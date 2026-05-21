/**
 * Unit-Tests für gates.ts pure-functions.
 *
 * Coverage-Goal: ≥80% pro Function. Test-Strategy: representative valid +
 * invalid inputs, edge-cases, gate-severity-correctness.
 */

import { describe, expect, it } from "vitest";

import {
  composeClientGates,
  evaluateBrightnessGate,
  evaluateFootCentralFrame,
  evaluateGyroGate,
  evaluateMarkerCoverage,
  evaluatePhoneOrientation,
  type Orientation,
  PNP_Z_MIN_MM,
  PNP_Z_MAX_MM,
  SIDE_YAW_MAX_DELTA_DEG,
} from "./gates";

const O = (beta: number | null, gamma: number | null): Orientation => ({
  alpha: 0,
  beta,
  gamma,
});

describe("evaluatePhoneOrientation", () => {
  it("accepts portrait-primary in top phase", () => {
    const r = evaluatePhoneOrientation("portrait-primary", "top");
    expect(r.ok).toBe(true);
    expect(r.severity).toBe("hard");
  });

  it("rejects landscape in top phase", () => {
    const r = evaluatePhoneOrientation("landscape-primary", "top");
    expect(r.ok).toBe(false);
    expect(r.severity).toBe("hard");
  });

  it("rejects portrait-secondary (upside-down) in top phase", () => {
    expect(evaluatePhoneOrientation("portrait-secondary", "top").ok).toBe(false);
  });

  it("accepts both landscape orientations in side phase", () => {
    expect(evaluatePhoneOrientation("landscape-primary", "side").ok).toBe(true);
    expect(evaluatePhoneOrientation("landscape-secondary", "side").ok).toBe(true);
  });

  it("rejects portrait in side phase", () => {
    expect(evaluatePhoneOrientation("portrait-primary", "side").ok).toBe(false);
  });

  it("falls back to ok when orientation-type unavailable (legacy)", () => {
    expect(evaluatePhoneOrientation(undefined, "top").ok).toBe(true);
  });
});

describe("evaluateGyroGate top-phase", () => {
  it("accepts beta=0 (perfectly flat)", () => {
    expect(evaluateGyroGate(O(0, 0), "top").ok).toBe(true);
  });

  it("accepts |beta|=15 (boundary)", () => {
    expect(evaluateGyroGate(O(15, 0), "top").ok).toBe(true);
    expect(evaluateGyroGate(O(-15, 0), "top").ok).toBe(true);
  });

  it("rejects |beta|=20 (over tolerance)", () => {
    expect(evaluateGyroGate(O(20, 0), "top").ok).toBe(false);
  });

  it("rejects beta=180 (display-down — Iter-3-Regression-Fix)", () => {
    expect(evaluateGyroGate(O(180, 0), "top").ok).toBe(false);
  });

  it("rejects null-beta (Math.abs(null)=0 silent-fail prevention)", () => {
    const r = evaluateGyroGate(O(null, 0), "top");
    expect(r.ok).toBe(false);
    expect(r.severity).toBe("hard");
  });

  it("rejects null-gamma even on top phase", () => {
    expect(evaluateGyroGate(O(0, null), "top").ok).toBe(false);
  });
});

describe("evaluateGyroGate side-phase", () => {
  it("accepts portraitTilt: beta=60, gamma=0", () => {
    expect(evaluateGyroGate(O(60, 0), "side").ok).toBe(true);
  });

  it("accepts landscapeTilt: gamma=-50, beta=0", () => {
    expect(evaluateGyroGate(O(0, -50), "side").ok).toBe(true);
  });

  it("rejects flat-phone-with-wrist-roll: beta=0, gamma=20 (Codex-Iter-3-Fix)", () => {
    // gamma=20 below SIDE_TILT_MIN=30 → landscapeTilt fails
    // beta=0 below SIDE_TILT_MIN → portraitTilt fails
    expect(evaluateGyroGate(O(0, 20), "side").ok).toBe(false);
  });

  it("rejects diagonal pose (both axes tilted)", () => {
    // beta=40 in tilt-range BUT gamma=40 above SIDE_CROSS_MAX=25 → portraitTilt fails
    // gamma=40 in tilt-range BUT beta=40 above SIDE_CROSS_MAX → landscapeTilt fails
    expect(evaluateGyroGate(O(40, 40), "side").ok).toBe(false);
  });

  it("rejects beyond SIDE_TILT_MAX=80", () => {
    expect(evaluateGyroGate(O(85, 0), "side").ok).toBe(false);
  });

  it("rejects below SIDE_TILT_MIN=30", () => {
    expect(evaluateGyroGate(O(25, 0), "side").ok).toBe(false);
  });
});

describe("evaluateBrightnessGate", () => {
  it("accepts mid-range brightness", () => {
    expect(evaluateBrightnessGate(150).ok).toBe(true);
  });

  it("rejects too-dark (<50)", () => {
    expect(evaluateBrightnessGate(40).ok).toBe(false);
    expect(evaluateBrightnessGate(40).severity).toBe("soft");
  });

  it("rejects too-bright (>230)", () => {
    expect(evaluateBrightnessGate(240).ok).toBe(false);
  });

  it("accepts within ±30% of baseline", () => {
    // baseline 150, value 180 → 20% delta → ok
    expect(evaluateBrightnessGate(180, 150).ok).toBe(true);
  });

  it("rejects >30% delta against baseline", () => {
    // baseline 100, value 200 → 100% delta
    expect(evaluateBrightnessGate(200, 100).ok).toBe(false);
  });

  it("ignores baseline when null", () => {
    expect(evaluateBrightnessGate(150, null).ok).toBe(true);
    expect(evaluateBrightnessGate(150, undefined).ok).toBe(true);
  });

  it("ignores zero-baseline (defensive)", () => {
    expect(evaluateBrightnessGate(150, 0).ok).toBe(true);
  });
});

describe("evaluateFootCentralFrame", () => {
  it("accepts when isLitePath=false (Pro tolerates edges)", () => {
    expect(evaluateFootCentralFrame([0, 0, 100, 100], 1920, 1080, false).ok).toBe(true);
  });

  it("accepts when bbox-null", () => {
    expect(evaluateFootCentralFrame(null, 1920, 1080, true).ok).toBe(true);
  });

  it("accepts foot in central 60% of frame", () => {
    // image 1920x1080, central 60%: x in [384, 1536], y in [216, 864]
    // bbox center at (960, 540) — dead center → ok
    expect(evaluateFootCentralFrame([910, 490, 100, 100], 1920, 1080, true).ok).toBe(true);
  });

  it("rejects foot near left edge", () => {
    // bbox at x=0, foot-center=50 (well below 384 threshold)
    expect(evaluateFootCentralFrame([0, 490, 100, 100], 1920, 1080, true).ok).toBe(false);
  });

  it("rejects foot near top edge", () => {
    // bbox at y=0, foot-center=50 (below 216)
    expect(evaluateFootCentralFrame([910, 0, 100, 100], 1920, 1080, true).ok).toBe(false);
  });
});

describe("evaluateMarkerCoverage", () => {
  it("accepts ≥3 markers in top with hull-coverage", () => {
    expect(evaluateMarkerCoverage(5, 0.8, "top").ok).toBe(true);
  });

  it("rejects <3 markers in top", () => {
    expect(evaluateMarkerCoverage(2, 0.8, "top").ok).toBe(false);
  });

  it("accepts ≥2 markers in side (lower min)", () => {
    expect(evaluateMarkerCoverage(2, null, "side").ok).toBe(true);
  });

  it("rejects clustered markers in top (hull-area <70%)", () => {
    expect(evaluateMarkerCoverage(5, 0.5, "top").ok).toBe(false);
  });

  it("ignores hull-area-fraction when null", () => {
    expect(evaluateMarkerCoverage(5, null, "top").ok).toBe(true);
  });

  it("hull-area-check applies only to top phase", () => {
    // Side has lower demands — clustered side-markers OK because foot-axis-spread
    // is checked separately by backend
    expect(evaluateMarkerCoverage(2, 0.3, "side").ok).toBe(true);
  });
});

describe("composeClientGates", () => {
  const baseInput = {
    orientationType: "portrait-primary",
    orient: O(0, 0),
    phase: "top" as const,
    brightnessMean: 150,
    brightnessBaseline: null,
    footBboxPx: [910, 490, 100, 100] as [number, number, number, number],
    imageWidth: 1920,
    imageHeight: 1080,
    isLitePath: true,
    markerCount: 5,
    markerHullAreaFraction: 0.8,
  };

  it("all-green when all gates pass", () => {
    const r = composeClientGates(baseInput);
    expect(r.allHardOk).toBe(true);
    expect(r.allSoftOk).toBe(true);
    expect(r.failedHard).toEqual([]);
    expect(r.failedSoft).toEqual([]);
  });

  it("isolates hard-fail (orientation) from soft-fail (brightness)", () => {
    const r = composeClientGates({
      ...baseInput,
      orientationType: "landscape-primary", // hard fail
      brightnessMean: 30, // soft fail
    });
    expect(r.allHardOk).toBe(false);
    expect(r.allSoftOk).toBe(false);
    expect(r.failedHard.length).toBeGreaterThanOrEqual(1);
    expect(r.failedSoft.length).toBeGreaterThanOrEqual(1);
  });

  it("hard-fail when only marker-coverage fails", () => {
    const r = composeClientGates({ ...baseInput, markerCount: 1 });
    expect(r.allHardOk).toBe(false);
    expect(r.allSoftOk).toBe(true);
  });
});

// Constants-Sanity-Tests — ensure config-changes don't break thresholds-relations
describe("constants consistency", () => {
  it("PnP-Z range covers Knöchelhöhe (70-120mm)", () => {
    expect(PNP_Z_MIN_MM).toBeLessThan(120);
    expect(PNP_Z_MAX_MM).toBeGreaterThan(120);
  });

  it("SIDE_YAW_MAX_DELTA_DEG within reasonable usability range", () => {
    expect(SIDE_YAW_MAX_DELTA_DEG).toBeGreaterThanOrEqual(10);
    expect(SIDE_YAW_MAX_DELTA_DEG).toBeLessThanOrEqual(25);
  });
});
