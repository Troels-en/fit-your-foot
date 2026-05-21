import { describe, expect, it } from "vitest";
import {
  BUCKET_COUNT,
  BUCKET_DEG,
  MIN_FRAMES_PER_BUCKET,
  bucketIndexForYaw,
  emptyBucketState,
  filledBucketCount,
  isSubmitReady,
  longestConsecutiveFilled,
  recordFrame,
  totalFrames,
} from "./poseBuckets";

// Helper: füllt einen Bucket bis MIN_FRAMES_PER_BUCKET erreicht ist.
function fillBucket(state: ReturnType<typeof emptyBucketState>, yawDeg: number) {
  for (let j = 0; j < MIN_FRAMES_PER_BUCKET; j++) state = recordFrame(state, yawDeg);
  return state;
}

describe("bucketIndexForYaw", () => {
  it("0° → bucket 0", () => {
    expect(bucketIndexForYaw(0)).toBe(0);
  });
  it("29.9° → bucket 0", () => {
    expect(bucketIndexForYaw(29.9)).toBe(0);
  });
  it("30° → bucket 1", () => {
    expect(bucketIndexForYaw(30)).toBe(1);
  });
  it("359.9° → bucket 11 (last)", () => {
    expect(bucketIndexForYaw(359.9)).toBe(BUCKET_COUNT - 1);
  });
  it("360° wraps to bucket 0", () => {
    expect(bucketIndexForYaw(360)).toBe(0);
  });
  it("-30° wraps to bucket 11", () => {
    expect(bucketIndexForYaw(-30)).toBe(11);
  });
  it("390° wraps to bucket 1", () => {
    expect(bucketIndexForYaw(390)).toBe(1);
  });
});

describe("BUCKET constants", () => {
  it("12 buckets × 30° = 360°", () => {
    expect(BUCKET_COUNT).toBe(12);
    expect(BUCKET_DEG).toBe(30);
    expect(BUCKET_COUNT * BUCKET_DEG).toBe(360);
  });
});

describe("recordFrame + totalFrames + filledBucketCount", () => {
  it("empty state has 0 frames, 0 filled buckets", () => {
    const s = emptyBucketState();
    expect(totalFrames(s)).toBe(0);
    expect(filledBucketCount(s)).toBe(0);
  });
  it("single frame at 45° → bucket 1 has 1 frame, total 1, filled 0", () => {
    let s = emptyBucketState();
    s = recordFrame(s, 45);
    expect(s.counts[1]).toBe(1);
    expect(totalFrames(s)).toBe(1);
    expect(filledBucketCount(s)).toBe(0);
  });
  it("MIN_FRAMES_PER_BUCKET frames in same bucket → 1 filled", () => {
    let s = emptyBucketState();
    s = fillBucket(s, 45);
    expect(filledBucketCount(s)).toBe(1);
  });
  it("MIN_FRAMES_PER_BUCKET - 1 frames → 0 filled", () => {
    let s = emptyBucketState();
    for (let i = 0; i < MIN_FRAMES_PER_BUCKET - 1; i++) s = recordFrame(s, 45);
    expect(filledBucketCount(s)).toBe(0);
  });
});

describe("longestConsecutiveFilled", () => {
  it("all empty → 0", () => {
    const s = emptyBucketState();
    expect(longestConsecutiveFilled(s)).toBe(0);
  });
  it("all filled → BUCKET_COUNT", () => {
    let s = emptyBucketState();
    for (let i = 0; i < BUCKET_COUNT; i++) s = fillBucket(s, i * BUCKET_DEG);
    expect(longestConsecutiveFilled(s)).toBe(BUCKET_COUNT);
  });
  it("9 consecutive (no wrap)", () => {
    let s = emptyBucketState();
    for (let i = 0; i < 9; i++) s = fillBucket(s, i * BUCKET_DEG);
    expect(longestConsecutiveFilled(s)).toBe(9);
  });
  it("wraparound: buckets 0,1,11 filled → 3 consecutive (11→0→1)", () => {
    let s = emptyBucketState();
    s = fillBucket(s, 0); // bucket 0
    s = fillBucket(s, 30); // bucket 1
    s = fillBucket(s, 330); // bucket 11
    expect(longestConsecutiveFilled(s)).toBe(3);
  });
  it("gap interrupts: 5 filled, 1 empty, 5 filled → max 5 not 10", () => {
    let s = emptyBucketState();
    [0, 30, 60, 90, 120, 180, 210, 240, 270, 300].forEach((y) => {
      s = fillBucket(s, y);
    });
    // Buckets 0-4 + 6-10 filled, 5+11 leer
    expect(longestConsecutiveFilled(s)).toBe(5);
  });
});

describe("isSubmitReady", () => {
  it("empty state not ready", () => {
    expect(isSubmitReady(emptyBucketState())).toBe(false);
  });
  it("30+ frames in 9 consecutive buckets, MIN_FRAMES_PER_BUCKET each → ready", () => {
    let s = emptyBucketState();
    for (let i = 0; i < 9; i++) s = fillBucket(s, i * BUCKET_DEG);
    expect(totalFrames(s)).toBe(9 * MIN_FRAMES_PER_BUCKET);
    expect(totalFrames(s)).toBeGreaterThanOrEqual(30);
    expect(isSubmitReady(s)).toBe(true);
  });
  it("32 frames but only 8 consecutive buckets → not ready", () => {
    let s = emptyBucketState();
    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 4; j++) s = recordFrame(s, i * BUCKET_DEG);
    }
    expect(totalFrames(s)).toBe(32);
    expect(isSubmitReady(s)).toBe(false); // only 8 consecutive
  });
  it("9 consecutive buckets but under-filled → not ready", () => {
    let s = emptyBucketState();
    for (let i = 0; i < 9; i++) {
      for (let j = 0; j < MIN_FRAMES_PER_BUCKET - 1; j++) s = recordFrame(s, i * BUCKET_DEG);
    }
    expect(isSubmitReady(s)).toBe(false);
  });
});
