import {
  BALL_WIDTH_TARGET_DELTA,
  DROP_SWEET_SPOT,
  FIT_PREFERENCE_LENGTH_OFFSET,
  FIT_PREFERENCE_WIDTH_OFFSET,
  HEEL_TARGET_DELTA,
  RETOUR_RATE_THRESHOLDS_PCT,
  ROOMY_TOEBOX_VALUES,
  TAPERED_TOEBOX_VALUES,
  TARGET_ALLOWANCE_BY_RUNNER_TYPE,
  TOEBOX_HEIGHT_THRESHOLDS,
  TOEBOX_RATIO_THRESHOLDS,
  WIDE_FOOT_THRESHOLD_MM,
  WIDTH_GRADE_BOUNDS_MM,
  WIDTH_GRADE_REFERENCE_LENGTH,
} from "./constants";
import type { FootProfile, ShoeDims, SubScore } from "./types";

const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));

const round1 = (v: number) => Math.round(v * 10) / 10;

// DB-Konvention: inner_length_mm ist bei Referenz-Größe EU 38 gespeichert.
// Reale Innenlänge skaliert linear ~6.67 mm pro EU-Schritt.
const REFERENCE_EU_SIZE = 38;
const MM_PER_EU_SIZE = 6.67;

const resolveInnerLength = (shoe: ShoeDims, footEuSize?: number | null): number | null => {
  const baseInner =
    typeof shoe.inner_length_mm === "number"
      ? shoe.inner_length_mm
      : typeof shoe.outer_length_mm === "number"
        ? shoe.outer_length_mm - 15
        : null;
  if (baseInner == null) return null;
  if (footEuSize == null) return baseInner;
  return baseInner + (footEuSize - REFERENCE_EU_SIZE) * MM_PER_EU_SIZE;
};

const resolveShoeBallWidth = (shoe: ShoeDims): number | null =>
  shoe.forefoot_width_mm ?? shoe.width_mm ?? null;

const resolveFootBallWidth = (foot: FootProfile): number =>
  foot.ball_width_mm ?? foot.foot_width_mm ?? 0;

export function scoreLength(foot: FootProfile, shoe: ShoeDims): SubScore {
  const inner = resolveInnerLength(shoe, foot.eu_size);
  if (inner === null) {
    // Neutral-tendierend statt strafend: bei fehlender Längen-Info wollen wir
    // den Schuh nicht künstlich runter-ranken (sonst dominieren Schuhe mit
    // zufällig vorhandener Length-Spalte das Ranking).
    return {
      key: "length",
      score: 75,
      reason: "Schuh-Innenlänge unbekannt — Längenpassung geschätzt.",
    };
  }
  const allowance = inner - foot.foot_length_mm;
  const profile = foot.runner_type ?? "daily";
  const pref = foot.fit_preference ?? "regular";
  const base = TARGET_ALLOWANCE_BY_RUNNER_TYPE[profile];
  const offset = FIT_PREFERENCE_LENGTH_OFFSET[pref];
  const idealMin = base.min + offset;
  const idealMax = base.max + offset;

  let score: number;
  let reason: string | undefined;

  if (allowance < idealMin - 4) {
    score = 0;
    reason = `Schuh ist ${round1(idealMin - allowance)}mm zu kurz — Black-Toe-Risiko.`;
  } else if (allowance < idealMin - 2) {
    score = 30;
    reason = `Nur ${round1(allowance)}mm Zehraum (mind. ${idealMin}mm empfohlen).`;
  } else if (allowance < idealMin) {
    score = 70;
    reason = `Knapper Zehraum ${round1(allowance)}mm — bei langen Läufen evtl. zu eng.`;
  } else if (allowance <= idealMax) {
    score = 100;
  } else if (allowance < idealMax + 3) {
    score = 70;
    reason = `Etwas locker (${round1(allowance)}mm Zehraum, ideal ≤ ${idealMax}mm).`;
  } else if (allowance < idealMax + 6) {
    score = 40;
    reason = `${round1(allowance)}mm Zehraum — Fuß rutscht beim Bergablaufen.`;
  } else if (allowance < idealMax + 10) {
    score = 25;
    reason = `Schuh deutlich zu lang (${round1(allowance)}mm Zehraum).`;
  } else {
    score = 10;
    reason = `Schuh viel zu lang (${round1(allowance)}mm Zehraum) — eine Größe kleiner.`;
  }

  return { key: "length", score, reason };
}

export function scoreBallWidth(foot: FootProfile, shoe: ShoeDims): SubScore {
  const shoeBall = resolveShoeBallWidth(shoe);
  const footBall = resolveFootBallWidth(foot);
  if (!shoeBall || !footBall) {
    return {
      key: "ballWidth",
      score: 60,
      reason: "Vorfuß-Maße unvollständig — Breitenpassung geschätzt.",
    };
  }
  const delta = shoeBall - footBall;
  const pref = foot.fit_preference ?? "regular";
  const widthOffset = FIT_PREFERENCE_WIDTH_OFFSET[pref];
  const targetMin = BALL_WIDTH_TARGET_DELTA.min + widthOffset;
  const targetMax = BALL_WIDTH_TARGET_DELTA.max + widthOffset;

  let score: number;
  let reason: string | undefined;

  if (delta < -3) {
    score = 10;
    reason = `Leisten ${Math.round(-delta)}mm schmaler als dein Vorfuß — drückt seitlich.`;
  } else if (delta < 0) {
    score = clamp(40 + (delta + 3) * 10);
    reason = `Vorfuß ${Math.round(-delta)}mm breiter als der Leisten — kein Splay-Raum.`;
  } else if (delta < targetMin) {
    score = clamp(70 + delta * 5);
    reason = `Leisten kaum breiter als dein Fuß (${round1(delta)}mm Reserve).`;
  } else if (delta <= targetMax) {
    score = 100;
  } else if (delta < targetMax + 3) {
    score = 80;
  } else if (delta < targetMax + 6) {
    score = 60;
    reason = `Leisten ${round1(delta)}mm breiter — Fuß könnte rutschen.`;
  } else {
    score = 40;
    reason = `Leisten zu breit (${round1(delta)}mm Spiel) — Halt fehlt.`;
  }

  return { key: "ballWidth", score, reason };
}

export function scoreHeelFit(foot: FootProfile, shoe: ShoeDims): SubScore {
  if (foot.heel_width_mm == null || shoe.heel_width_mm == null) {
    return {
      key: "heelFit",
      score: 75,
      reason: undefined,
    };
  }
  const delta = shoe.heel_width_mm - foot.heel_width_mm;

  let score: number;
  let reason: string | undefined;

  if (delta < HEEL_TARGET_DELTA.min) {
    score = 30;
    reason = `Ferse ${Math.round(-delta)}mm enger — kann an Achillessehne drücken.`;
  } else if (delta <= HEEL_TARGET_DELTA.max) {
    score = 100;
  } else if (delta < 2) {
    score = 90;
  } else if (delta < 4) {
    score = 60;
    reason = `Ferse hat ${round1(delta)}mm Spiel — leichter Heel-Slip möglich.`;
  } else {
    score = 25;
    reason = `Ferse rutscht (${round1(delta)}mm zu weit) — Blasenrisiko.`;
  }

  return { key: "heelFit", score, reason };
}

export function scoreToebox(foot: FootProfile, shoe: ShoeDims): SubScore {
  const subs: number[] = [];
  let primaryReason: string | undefined;
  const footBall = resolveFootBallWidth(foot);
  const wideFoot = footBall >= WIDE_FOOT_THRESHOLD_MM;

  if (
    typeof shoe.toebox_width_mm === "number" &&
    typeof shoe.forefoot_width_mm === "number" &&
    shoe.forefoot_width_mm > 0
  ) {
    const ratio = shoe.toebox_width_mm / shoe.forefoot_width_mm;
    let t1: number;
    if (ratio >= TOEBOX_RATIO_THRESHOLDS.perfect) t1 = 100;
    else if (ratio >= TOEBOX_RATIO_THRESHOLDS.good) t1 = 85;
    else if (ratio >= TOEBOX_RATIO_THRESHOLDS.ok) t1 = 65;
    else {
      t1 = 35;
      primaryReason = "Toebox stark verjüngt — Zehen werden zusammengedrückt.";
    }
    subs.push(t1);
  }

  if (typeof shoe.toebox === "string") {
    let t2: number;
    if (ROOMY_TOEBOX_VALUES.has(shoe.toebox)) t2 = 100;
    else if (TAPERED_TOEBOX_VALUES.has(shoe.toebox)) {
      t2 = wideFoot ? 25 : 70;
      if (wideFoot && !primaryReason) {
        primaryReason = "Toebox-Form spitz — bei breitem Vorfuß suboptimal.";
      }
    } else t2 = 80;
    subs.push(t2);
  }

  if (foot.arch_type === "high" && typeof shoe.toebox_height_mm === "number") {
    let t3: number;
    if (shoe.toebox_height_mm >= TOEBOX_HEIGHT_THRESHOLDS.good) t3 = 100;
    else if (shoe.toebox_height_mm >= TOEBOX_HEIGHT_THRESHOLDS.ok) t3 = 80;
    else {
      t3 = 55;
      if (!primaryReason) {
        primaryReason = `Toebox flach (${shoe.toebox_height_mm}mm) — bei Hohlfuß drückt es oben.`;
      }
    }
    subs.push(t3);
  }

  if (subs.length === 0) {
    return { key: "toebox", score: 75 };
  }

  const score = Math.round(subs.reduce((a, b) => a + b, 0) / subs.length);
  return { key: "toebox", score, reason: score < 70 ? primaryReason : undefined };
}

export function expectedWidthGrade(
  ballWidthMm: number,
  footLengthMm: number
): "Narrow" | "Regular" | "Wide" | "ExtraWide" {
  if (footLengthMm <= 0) return "Regular";
  const normalized = ballWidthMm * (WIDTH_GRADE_REFERENCE_LENGTH / footLengthMm);
  if (normalized < WIDTH_GRADE_BOUNDS_MM.Narrow) return "Narrow";
  if (normalized < WIDTH_GRADE_BOUNDS_MM.Regular) return "Regular";
  if (normalized < WIDTH_GRADE_BOUNDS_MM.Wide) return "Wide";
  return "ExtraWide";
}

const GRADE_INDEX: Record<string, number> = {
  Narrow: 0,
  narrow: 0,
  Regular: 1,
  regular: 1,
  Medium: 1,
  medium: 1,
  Wide: 2,
  wide: 2,
  "Extra-Wide": 3,
  "extra-wide": 3,
  ExtraWide: 3,
  "Extra Wide": 3,
};

export function scoreWidthGrade(foot: FootProfile, shoe: ShoeDims): SubScore {
  if (!shoe.width_grade) return { key: "widthGrade", score: 80 };
  const expected = expectedWidthGrade(
    resolveFootBallWidth(foot),
    foot.foot_length_mm
  );
  const expectedIdx = GRADE_INDEX[expected] ?? 1;
  const shoeIdx = GRADE_INDEX[shoe.width_grade] ?? 1;
  const gap = Math.abs(expectedIdx - shoeIdx);

  let score: number;
  let reason: string | undefined;
  if (gap === 0) score = 100;
  else if (gap === 1) score = 80;
  else if (gap === 2) {
    score = 50;
    reason = `Width-Grade „${shoe.width_grade}" passt nicht zu deiner Vorfuß-Klasse „${expected}".`;
  } else {
    score = 20;
    reason = `Width-Grade „${shoe.width_grade}" stark vom Bedarf „${expected}" entfernt.`;
  }

  return { key: "widthGrade", score, reason };
}

const ARCH_MATRIX: Record<string, Record<string, number>> = {
  low: {
    "motion-control": 100,
    "motion control": 100,
    motioncontrol: 100,
    max: 100,
    stability: 100,
    neutral: 65,
    cushion: 65,
    cushioned: 65,
  },
  medium: {
    neutral: 100,
    stability: 100,
    "motion-control": 80,
    "motion control": 80,
    max: 80,
    cushion: 80,
    cushioned: 80,
  },
  high: {
    neutral: 100,
    cushion: 100,
    cushioned: 100,
    stability: 60,
    "motion-control": 60,
    "motion control": 60,
    max: 60,
  },
};

export function scoreArchSupport(foot: FootProfile, shoe: ShoeDims): SubScore {
  if (!foot.arch_type || !shoe.arch_support) {
    return { key: "archSupport", score: 80 };
  }
  const arch = ARCH_MATRIX[foot.arch_type];
  const support = shoe.arch_support.toLowerCase();
  const score = arch?.[support] ?? 75;
  let reason: string | undefined;
  if (score < 70) {
    reason =
      foot.arch_type === "low"
        ? "Plattfuß braucht mehr Stabilität — Schuh wirkt zu neutral."
        : foot.arch_type === "high"
          ? "Hohlfuß bevorzugt neutrale Dämpfung — zu viel Stabilität drückt."
          : "Stützung passt nicht ideal zu deinem Bogen.";
  }
  return { key: "archSupport", score, reason };
}

export function scoreDropStack(_foot: FootProfile, shoe: ShoeDims): SubScore {
  if (typeof shoe.heel_drop_mm !== "number") {
    return { key: "dropStack", score: 85 };
  }
  const d = shoe.heel_drop_mm;
  let score: number;
  let reason: string | undefined;
  if (d >= DROP_SWEET_SPOT.min && d <= DROP_SWEET_SPOT.max) {
    score = 100;
  } else if (d < 0 || d > 14) {
    score = 70;
    reason = `Drop ${d}mm — extrem; nur für spezialisierte Läufer.`;
  } else {
    score = 85;
  }
  return { key: "dropStack", score, reason };
}

export function scoreReturnSignal(_foot: FootProfile, shoe: ShoeDims): SubScore {
  if (typeof shoe.retour_rate_pct !== "number") {
    return { key: "returnSig", score: 80 };
  }
  const r = shoe.retour_rate_pct;
  let score: number;
  let reason: string | undefined;
  if (r < RETOUR_RATE_THRESHOLDS_PCT.excellent) score = 100;
  else if (r < RETOUR_RATE_THRESHOLDS_PCT.good) score = 90;
  else if (r < RETOUR_RATE_THRESHOLDS_PCT.ok) score = 70;
  else if (r < RETOUR_RATE_THRESHOLDS_PCT.poor) {
    score = 50;
    reason = `Retour-Rate ${Math.round(r)}% — andere Kunden hatten oft Fit-Probleme.`;
  } else {
    score = 25;
    reason = `Retour-Rate ${Math.round(r)}% — sehr hoher Anteil zurückgesendeter Schuhe.`;
  }
  return { key: "returnSig", score, reason };
}
