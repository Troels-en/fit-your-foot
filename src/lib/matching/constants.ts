import type { FitPreference, RunnerType, SubScoreKey } from "./types";

export const TARGET_ALLOWANCE_BY_RUNNER_TYPE: Record<
  RunnerType,
  { min: number; max: number }
> = {
  casual: { min: 8, max: 12 },
  racing: { min: 8, max: 11 },
  daily: { min: 11, max: 14 },
  long: { min: 13, max: 16 },
  trail: { min: 14, max: 17 },
};

export const FIT_PREFERENCE_LENGTH_OFFSET: Record<FitPreference, number> = {
  snug: -1.5,
  regular: 0,
  roomy: 1.5,
};

export const FIT_PREFERENCE_WIDTH_OFFSET: Record<FitPreference, number> = {
  snug: -1,
  regular: 0,
  roomy: 1,
};

export const BALL_WIDTH_TARGET_DELTA = { min: 2, max: 5 } as const;

export const HEEL_TARGET_DELTA = { min: -3, max: 0 } as const;

export const TOEBOX_RATIO_THRESHOLDS = {
  perfect: 0.95,
  good: 0.9,
  ok: 0.85,
} as const;

export const TOEBOX_HEIGHT_THRESHOLDS = { good: 22, ok: 18 } as const;

export const WIDE_FOOT_THRESHOLD_MM = 100;

export const WIDTH_GRADE_BOUNDS_MM = {
  Narrow: 92,
  Regular: 100,
  Wide: 106,
} as const;

export const WIDTH_GRADE_REFERENCE_LENGTH = 268;

export const DROP_SWEET_SPOT = { min: 4, max: 12 } as const;

export const RETOUR_RATE_THRESHOLDS_PCT = {
  excellent: 5,
  good: 10,
  ok: 15,
  poor: 25,
} as const;

export const WEIGHTS: Record<SubScoreKey, number> = {
  length: 0.3,
  ballWidth: 0.25,
  heelFit: 0.15,
  toebox: 0.1,
  widthGrade: 0.05,
  archSupport: 0.05,
  dropStack: 0.05,
  returnSig: 0.05,
};

export const BAND_THRESHOLDS = { great: 80, ok: 60 } as const;

export const SIZE_AVAILABILITY_TOLERANCE = 0.5;

export const ROOMY_TOEBOX_VALUES = new Set([
  "roomy",
  "Roomy",
  "rounded",
  "Rounded",
  "square",
  "Square",
]);

export const TAPERED_TOEBOX_VALUES = new Set([
  "tapered",
  "Tapered",
  "pointy",
  "Pointy",
  "narrow",
  "Narrow",
]);
