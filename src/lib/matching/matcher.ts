import {
  BAND_THRESHOLDS,
  FIT_PREFERENCE_LENGTH_OFFSET,
  SIZE_AVAILABILITY_TOLERANCE,
  TARGET_ALLOWANCE_BY_RUNNER_TYPE,
  WEIGHTS,
} from "./constants";
import {
  scoreArchSupport,
  scoreBallWidth,
  scoreDropStack,
  scoreHeelFit,
  scoreLength,
  scoreReturnSignal,
  scoreToebox,
  scoreWidthGrade,
} from "./scorers";
import type {
  FitBand,
  FitFlags,
  FitResult,
  FootProfile,
  RankedShoe,
  ShoeDims,
  SubScore,
} from "./types";

const labelFor = (band: FitBand): string => {
  if (band === "great") return "Passt sehr gut";
  if (band === "ok") return "Passt mit Einschränkungen";
  return "Passt nicht optimal";
};

const sizeAvailable = (foot: FootProfile, shoe: ShoeDims): boolean => {
  if (!shoe.available_sizes || shoe.available_sizes.length === 0) return true;
  if (foot.eu_size == null) return true;
  return shoe.available_sizes.some(
    (s) => Math.abs(s - foot.eu_size!) <= SIZE_AVAILABILITY_TOLERANCE
  );
};

// DB-Konvention: inner_length_mm ist bei Referenz-Größe EU 38 gespeichert.
const REFERENCE_EU_SIZE = 38;
const MM_PER_EU_SIZE = 6.67;

const computeFlags = (foot: FootProfile, shoe: ShoeDims, subs: SubScore[]): FitFlags => {
  const baseInner =
    shoe.inner_length_mm ??
    (shoe.outer_length_mm != null ? shoe.outer_length_mm - 15 : null);
  const inner =
    baseInner != null && foot.eu_size != null
      ? baseInner + (foot.eu_size - REFERENCE_EU_SIZE) * MM_PER_EU_SIZE
      : baseInner;
  const profile = foot.runner_type ?? "daily";
  const pref = foot.fit_preference ?? "regular";
  const base = TARGET_ALLOWANCE_BY_RUNNER_TYPE[profile];
  const offset = FIT_PREFERENCE_LENGTH_OFFSET[pref];
  const idealMin = base.min + offset;
  const idealMax = base.max + offset;
  const allowance = inner != null ? inner - foot.foot_length_mm : null;

  const shoeBall = shoe.forefoot_width_mm ?? shoe.width_mm ?? null;
  const footBall = foot.ball_width_mm ?? foot.foot_width_mm ?? 0;
  const ballDelta = shoeBall != null ? shoeBall - footBall : null;

  const archScore = subs.find((s) => s.key === "archSupport")?.score ?? 100;
  const toeboxScore = subs.find((s) => s.key === "toebox")?.score ?? 100;

  return {
    needsBigger: allowance != null && allowance < idealMin,
    needsSmaller: allowance != null && allowance > idealMax + 6,
    needsWider: ballDelta != null && ballDelta < 0,
    needsNarrower: ballDelta != null && ballDelta > 11,
    needsRoomierToebox: toeboxScore < 70,
    needsMoreArchSupport: archScore < 70 && foot.arch_type === "low",
  };
};

const pickReasons = (subs: SubScore[]): string[] => {
  const ranked = subs
    .filter((s) => s.score < 70 && s.reason)
    .map((s) => ({ s, impact: WEIGHTS[s.key] * (100 - s.score) }))
    .sort((a, b) => b.impact - a.impact)
    .slice(0, 3)
    .map((x) => x.s.reason!);
  if (ranked.length === 0) {
    return ["Leisten-Geometrie passt zu deiner Fuß-Anatomie."];
  }
  return ranked;
};

const classify = (score: number): FitBand => {
  if (score >= BAND_THRESHOLDS.great) return "great";
  if (score >= BAND_THRESHOLDS.ok) return "ok";
  return "poor";
};

export function scoreShoe(foot: FootProfile, shoe: ShoeDims): FitResult {
  if (!sizeAvailable(foot, shoe)) {
    return {
      score: 0,
      band: "poor",
      label: "Größe nicht verfügbar",
      reasons: [`Schuh ist in EU ${foot.eu_size} nicht erhältlich.`],
      flags: {
        needsBigger: false,
        needsSmaller: false,
        needsWider: false,
        needsNarrower: false,
        needsRoomierToebox: false,
        needsMoreArchSupport: false,
      },
      subScores: [],
    };
  }

  const subs: SubScore[] = [
    scoreLength(foot, shoe),
    scoreBallWidth(foot, shoe),
    scoreHeelFit(foot, shoe),
    scoreToebox(foot, shoe),
    scoreWidthGrade(foot, shoe),
    scoreArchSupport(foot, shoe),
    scoreDropStack(foot, shoe),
    scoreReturnSignal(foot, shoe),
  ];

  const total = subs.reduce((sum, s) => sum + s.score * WEIGHTS[s.key], 0);
  const score = Math.max(0, Math.min(100, Math.round(total)));
  const band = classify(score);

  return {
    score,
    band,
    label: labelFor(band),
    reasons: pickReasons(subs),
    flags: computeFlags(foot, shoe, subs),
    subScores: subs,
  };
}

export function rankShoes<S extends ShoeDims>(
  foot: FootProfile,
  shoes: S[],
  options: { excludeId?: string; limit?: number; minScore?: number } = {}
): RankedShoe<S>[] {
  const { excludeId, limit = 3, minScore = 0 } = options;
  return shoes
    .filter((s) => s.id !== excludeId)
    .map((shoe) => ({ shoe, fit: scoreShoe(foot, shoe) }))
    .filter((r) => r.fit.score >= minScore)
    .sort((a, b) => b.fit.score - a.fit.score)
    .slice(0, limit);
}
