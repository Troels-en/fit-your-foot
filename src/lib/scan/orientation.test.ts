import { describe, expect, it } from "vitest";
import {
  yawDelta,
  normalizeYaw,
  relativeYaw,
  angularVelocity,
  isOrientationValid,
} from "./orientation";

describe("yawDelta — wraparound-aware", () => {
  it("simple positive delta", () => {
    expect(yawDelta(50, 30)).toBe(20);
  });
  it("simple negative delta", () => {
    expect(yawDelta(30, 50)).toBe(-20);
  });
  it("wraparound short positive: 5 vs 355 → +10", () => {
    expect(yawDelta(5, 355)).toBe(10);
  });
  it("wraparound short negative: 355 vs 5 → -10", () => {
    expect(yawDelta(355, 5)).toBe(-10);
  });
  it("180° boundary: 180 vs 0 → 180", () => {
    expect(yawDelta(180, 0)).toBe(180);
  });
});

describe("normalizeYaw", () => {
  it("positive in range stays", () => {
    expect(normalizeYaw(45)).toBe(45);
  });
  it("370 → 10", () => {
    expect(normalizeYaw(370)).toBe(10);
  });
  it("-10 → 350", () => {
    expect(normalizeYaw(-10)).toBe(350);
  });
  it("720 → 0", () => {
    expect(normalizeYaw(720)).toBe(0);
  });
});

describe("relativeYaw", () => {
  it("zero offset: relative = raw", () => {
    expect(relativeYaw(50, 0)).toBe(50);
  });
  it("subtracts offset: 100 - 30 = 70", () => {
    expect(relativeYaw(100, 30)).toBe(70);
  });
  it("wraparound: raw 5, offset 350 → 15", () => {
    expect(relativeYaw(5, 350)).toBe(15);
  });
  it("negative result wraps: raw 10, offset 50 → 320", () => {
    expect(relativeYaw(10, 50)).toBe(320);
  });
});

describe("angularVelocity", () => {
  it("0 ms delta returns 0 (defensive)", () => {
    expect(angularVelocity(
      { alpha: 10, beta: 0, gamma: 0 },
      { alpha: 5, beta: 0, gamma: 0 },
      0
    )).toBe(0);
  });
  it("5° in 1000ms = 5°/s along yaw axis", () => {
    const v = angularVelocity(
      { alpha: 5, beta: 0, gamma: 0 },
      { alpha: 0, beta: 0, gamma: 0 },
      1000
    );
    expect(v).toBeCloseTo(5, 4);
  });
  it("multi-axis combines via L2 norm", () => {
    // 3-4-5 triangle: dα=3, dβ=4 → norm = 5 in 1000ms = 5°/s
    const v = angularVelocity(
      { alpha: 3, beta: 4, gamma: 0 },
      { alpha: 0, beta: 0, gamma: 0 },
      1000
    );
    expect(v).toBeCloseTo(5, 4);
  });
  it("wraparound-safe yaw component", () => {
    const v = angularVelocity(
      { alpha: 5, beta: 0, gamma: 0 },
      { alpha: 355, beta: 0, gamma: 0 },
      1000
    );
    // Should be 10°/s, not 350°/s
    expect(v).toBeCloseTo(10, 4);
  });
});

describe("isOrientationValid", () => {
  it("valid orientation", () => {
    expect(isOrientationValid({ alpha: 0, beta: 0, gamma: 0 })).toBe(true);
  });
  it("null", () => {
    expect(isOrientationValid(null)).toBe(false);
  });
  it("undefined", () => {
    expect(isOrientationValid(undefined)).toBe(false);
  });
  it("missing alpha", () => {
    expect(isOrientationValid({ beta: 0, gamma: 0 })).toBe(false);
  });
  it("NaN values", () => {
    expect(isOrientationValid({ alpha: NaN, beta: 0, gamma: 0 })).toBe(false);
  });
  it("null components (DeviceOrientation can return these)", () => {
    expect(isOrientationValid({ alpha: null as unknown as number, beta: 0, gamma: 0 })).toBe(false);
  });
});
