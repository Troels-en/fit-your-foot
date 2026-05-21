// Bucket-Coverage-Tracking für den Orbit-Capture.
// 12 Buckets à 30° = 360° Goal. Submit-Gate: 9-von-12 konsekutive Buckets,
// jeweils ≥3 Frames. Konsekutiv heißt: keine 2 leeren Buckets in Folge.

export const BUCKET_COUNT = 12;
export const BUCKET_DEG = 360 / BUCKET_COUNT; // 30°
// Sprint-1-Tuning: Frame-Density pro Bucket verdoppelt (3 → 6) für ~70%
// pairwise-overlap, was photogrammetry braucht. KIRI hatte bei 3/Bucket
// fragmentiert — Geister-Füße im Output-Atlas weil SfM nicht genug Common-
// Features zwischen adjacent Buckets fand.
export const MIN_FRAMES_PER_BUCKET = 6;
export const MIN_CONSECUTIVE_BUCKETS = 9;

export type BucketState = {
  /** Frame-Counts pro Bucket, Index 0 = Yaw [0,30), Index 1 = [30,60) etc. */
  counts: number[];
};

export function emptyBucketState(): BucketState {
  return { counts: new Array(BUCKET_COUNT).fill(0) };
}

/** Welcher Bucket-Index gehört zu diesem (relativen, [0,360)) Yaw-Wert? */
export function bucketIndexForYaw(relYaw: number): number {
  const norm = ((relYaw % 360) + 360) % 360;
  return Math.min(BUCKET_COUNT - 1, Math.floor(norm / BUCKET_DEG));
}

/** Erhöht den Frame-Counter für den Bucket dieses Yaw-Wertes. Returnt neuen State. */
export function recordFrame(state: BucketState, relYaw: number): BucketState {
  const idx = bucketIndexForYaw(relYaw);
  const counts = state.counts.slice();
  counts[idx] += 1;
  return { counts };
}

/**
 * Summe aller Frames im State.
 */
export function totalFrames(state: BucketState): number {
  return state.counts.reduce((a, b) => a + b, 0);
}

/**
 * Anzahl Buckets die ≥ minPerBucket Frames haben.
 */
export function filledBucketCount(state: BucketState, minPerBucket = MIN_FRAMES_PER_BUCKET): number {
  return state.counts.filter((c) => c >= minPerBucket).length;
}

/**
 * Findet die längste konsekutive Sequenz gefüllter Buckets (zirkulär).
 * Bsp: counts = [3,3,0,3,3,3,3,3,3,3,3,3] → 11 (10 mit Wraparound).
 *      counts = [3,3,3,3,3,3,3,3,3,0,0,3] → 10 (9 + 1 wraparound).
 */
export function longestConsecutiveFilled(
  state: BucketState,
  minPerBucket = MIN_FRAMES_PER_BUCKET
): number {
  const filled = state.counts.map((c) => c >= minPerBucket);
  const allFilled = filled.every(Boolean);
  if (allFilled) return BUCKET_COUNT;
  // Doppel-Array für Wraparound
  const doubled = [...filled, ...filled];
  let best = 0;
  let curr = 0;
  for (const f of doubled) {
    if (f) {
      curr += 1;
      if (curr > best) best = curr;
    } else {
      curr = 0;
    }
  }
  return Math.min(best, BUCKET_COUNT);
}

/**
 * Submit-Gate: ≥ minTotal Frames UND ≥ minConsecutive konsekutive Buckets gefüllt.
 */
export function isSubmitReady(
  state: BucketState,
  minTotal = 30,
  minConsecutive = MIN_CONSECUTIVE_BUCKETS,
  minPerBucket = MIN_FRAMES_PER_BUCKET
): boolean {
  return (
    totalFrames(state) >= minTotal &&
    longestConsecutiveFilled(state, minPerBucket) >= minConsecutive
  );
}
