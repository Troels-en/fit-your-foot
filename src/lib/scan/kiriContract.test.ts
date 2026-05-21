import { describe, expect, it } from "vitest";
import { KIRI_LIMITS, validateFramesForKiri, type FrameMeta } from "./kiriContract";

const mkFrame = (sizeBytes: number, type = "image/jpeg"): FrameMeta => ({
  blob: new Blob([new Uint8Array(sizeBytes)], { type }),
  yawAtCapture: 0,
  capturedAt: 0,
});

describe("validateFramesForKiri", () => {
  it("rejects too few frames", () => {
    const frames = Array.from({ length: 10 }, () => mkFrame(100_000));
    const r = validateFramesForKiri(frames);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/Mindestens.*nötig/);
  });

  it("rejects too many frames", () => {
    const frames = Array.from({ length: 301 }, () => mkFrame(100_000));
    const r = validateFramesForKiri(frames);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/Maximal.*erlaubt/);
  });

  it("accepts MIN frames at 100KB each", () => {
    const frames = Array.from({ length: KIRI_LIMITS.MIN_FRAMES_PER_SCAN }, () => mkFrame(100_000));
    const r = validateFramesForKiri(frames);
    expect(r.ok).toBe(true);
  });

  it("rejects oversized single frame", () => {
    const frames = [
      ...Array.from({ length: 19 }, () => mkFrame(100_000)),
      mkFrame(2 * 1024 * 1024), // 2 MB > 1.5 MB cap
    ];
    const r = validateFramesForKiri(frames);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/zu groß|max.*pro Frame|Frame.*MB/);
  });

  it("rejects invalid MIME type", () => {
    const frames = [
      ...Array.from({ length: 19 }, () => mkFrame(100_000)),
      mkFrame(100_000, "image/heic"),
    ];
    const r = validateFramesForKiri(frames);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/MIME-Type/);
  });

  it("rejects total payload over cap", () => {
    // 60 × 1MB = 60 MB > 50 MB cap
    const frames = Array.from({ length: 60 }, () => mkFrame(1_000_000));
    const r = validateFramesForKiri(frames);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/Total-Payload/);
  });

  it("accepts realistic 40-frame submission at ~500KB each", () => {
    const frames = Array.from({ length: 40 }, () => mkFrame(500_000));
    const r = validateFramesForKiri(frames);
    expect(r.ok).toBe(true);
  });

  it("limits sanity", () => {
    expect(KIRI_LIMITS.MIN_FRAMES_PER_SCAN).toBe(20);
    expect(KIRI_LIMITS.MAX_FRAMES_PER_SCAN).toBe(300);
    expect(KIRI_LIMITS.MAX_BYTES_PER_FRAME).toBe(1.5 * 1024 * 1024);
  });
});
