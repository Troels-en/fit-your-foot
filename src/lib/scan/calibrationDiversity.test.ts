import { describe, expect, it } from "vitest";
import {
  computeRotationDelta,
  computeTranslationDelta,
  hasViewAngleDiversity,
  type CapturedPose,
} from "./calibrationDiversity";

const pose = (alpha: number, beta: number, gamma: number, x?: number, y?: number): CapturedPose => ({
  alpha,
  beta,
  gamma,
  markerCenterPx: x != null && y != null ? { x, y } : null,
});

describe("computeRotationDelta", () => {
  it("returns max-axis delta", () => {
    const a = pose(0, 0, 0);
    const b = pose(0, 20, 5);
    expect(computeRotationDelta(a, b)).toBe(20);
  });

  it("wraps alpha across 360°", () => {
    const a = pose(350, 0, 0);
    const b = pose(10, 0, 0);
    expect(computeRotationDelta(a, b)).toBe(20);
  });

  it("returns Infinity if no axis available", () => {
    const a: CapturedPose = { alpha: null, beta: null, gamma: null };
    const b: CapturedPose = { alpha: null, beta: null, gamma: null };
    expect(computeRotationDelta(a, b)).toBe(Infinity);
  });
});

describe("computeTranslationDelta", () => {
  it("computes Euclidean distance", () => {
    const a = pose(0, 0, 0, 100, 100);
    const b = pose(0, 0, 0, 200, 100);
    expect(computeTranslationDelta(a, b)).toBe(100);
  });

  it("returns Infinity if marker-pos missing", () => {
    const a = pose(0, 0, 0);
    const b = pose(0, 0, 0, 100, 100);
    expect(computeTranslationDelta(a, b)).toBe(Infinity);
  });
});

describe("hasViewAngleDiversity", () => {
  it("first frame always diverse", () => {
    expect(hasViewAngleDiversity(pose(0, 0, 0), [])).toBe(true);
  });

  it("rejects near-duplicate (rotation < 15° AND translation < 150px)", () => {
    const a = pose(0, 0, 0, 500, 500);
    const b = pose(0, 5, 5, 510, 510);
    expect(hasViewAngleDiversity(b, [a])).toBe(false);
  });

  it("accepts when rotation ≥ 15°", () => {
    const a = pose(0, 0, 0, 500, 500);
    const b = pose(0, 20, 0, 510, 510);
    expect(hasViewAngleDiversity(b, [a])).toBe(true);
  });

  it("accepts when translation ≥ 150px", () => {
    const a = pose(0, 0, 0, 500, 500);
    const b = pose(0, 5, 5, 700, 500);
    expect(hasViewAngleDiversity(b, [a])).toBe(true);
  });

  it("checks against ALL existing frames (rejects if too close to any)", () => {
    const a = pose(0, 0, 0, 100, 100);
    const c = pose(0, 30, 0, 400, 400); // diverse from a
    const candidate = pose(0, 30, 5, 410, 410); // diverse from a but close to c
    expect(hasViewAngleDiversity(candidate, [a, c])).toBe(false);
  });

  it("missing marker-pos still allows rotation-based diversity", () => {
    const a: CapturedPose = { alpha: 0, beta: 0, gamma: 0 };
    const b: CapturedPose = { alpha: 0, beta: 30, gamma: 0 };
    expect(hasViewAngleDiversity(b, [a])).toBe(true);
  });
});
