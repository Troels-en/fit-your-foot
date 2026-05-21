import type { ShoeRow } from "@/lib/shoeQueries";

export type FootMm = {
  foot_length_mm: number;
  ball_width_mm: number;
  heel_width_mm: number;
  arch_type: "low" | "medium" | "high";
  eu_size: number;
  foot_toebox_height_mm?: number;
  preferred_drop_mm?: number;
};

export type MatchScore = {
  score: number; // 0..100
  band: "great" | "ok" | "poor";
  label: string;
  reasons: string[];
  needsWider: boolean;
  needsRoomierToebox: boolean;
};

const WIDTH_GRADE_ORDER: Record<string, number> = {
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
};

const ROOMY_TOEBOX = new Set(["Roomy", "roomy", "Rounded", "rounded", "Square", "square"]);

export function scoreShoe(foot: FootMm, shoe: ShoeRow): MatchScore {
  const reasons: string[] = [];
  let needsWider = false;
  let needsRoomierToebox = false;

  // Foot width grades: Wide >= 99mm, Regular >= 96mm, else Narrow.
  // Threshold 99 (not 102) so a 99mm foot — wider than Vaporfly's 94mm last but
  // narrower than Wide-grade alternatives at 100mm — still classifies as Wide
  // and gets a 0-gap match against Wide-grade shoes.
  const footGrade = foot.ball_width_mm >= 99 ? 2 : foot.ball_width_mm >= 96 ? 1 : 0;

  // Ball width (40%) — length is intentionally excluded; length is solved by EU-size choice.
  const shoeWidth = shoe.width_mm ?? 96;
  const widthDelta = foot.ball_width_mm - shoeWidth; // positive = foot wider than shoe
  const widthAbs = Math.abs(widthDelta);
  let ballScore: number;
  if (widthAbs <= 2) ballScore = 100;
  else if (widthAbs <= 5) ballScore = 100 - (widthAbs - 2) * 7; // 93..79
  else if (widthAbs <= 10) ballScore = 79 - (widthAbs - 5) * 10; // 69..29
  else ballScore = Math.max(15, 29 - (widthAbs - 10) * 5);

  if (widthDelta >= 3) {
    needsWider = true;
    reasons.push(
      `Ballenbreite ${Math.round(widthDelta)}mm zu schmal (Leisten ${shoeWidth}mm vs. dein Fuß ${foot.ball_width_mm}mm).`
    );
  } else if (widthDelta < -8) {
    reasons.push("Leisten deutlich breiter als dein Fuß — Halt könnte fehlen.");
  }

  // Heel width (20%)
  const shoeHeel = shoe.heel_width_mm ?? 68;
  const heelDelta = foot.heel_width_mm - shoeHeel;
  const heelAbsDelta = Math.abs(heelDelta);
  let heelScore: number;
  if (heelAbsDelta <= 2) heelScore = 100;
  else if (heelAbsDelta <= 5) heelScore = 100 - (heelAbsDelta - 2) * 7; // 93..79
  else if (heelAbsDelta <= 10) heelScore = 79 - (heelAbsDelta - 5) * 10; // 69..29
  else heelScore = Math.max(20, 29 - (heelAbsDelta - 10) * 5);

  if (Math.abs(heelDelta) > 4) {
    if (heelDelta > 0) reasons.push("Ferse sitzt eng — kann drücken.");
    else reasons.push("Ferse hat Spiel — weniger Stabilität.");
  }

  // Width-grade consistency (25%) — categorical mismatch is a strong signal
  const grade = WIDTH_GRADE_ORDER[shoe.width_grade ?? "Regular"] ?? 1;
  const gradeGap = Math.abs(grade - footGrade);
  const widthClassScore = gradeGap === 0 ? 100 : gradeGap === 1 ? 15 : 0;

  // Toebox category (10%)
  const roomyShoe = shoe.toebox ? ROOMY_TOEBOX.has(shoe.toebox) : false;
  const wideFoot = foot.ball_width_mm >= 99;
  const toeboxScore = wideFoot ? (roomyShoe ? 100 : 40) : roomyShoe ? 90 : 100;
  if (wideFoot && !roomyShoe) {
    needsRoomierToebox = true;
    reasons.push("Zehenbox eng geformt — bei breitem Vorfuß suboptimal.");
  }

  // Drop preference (15%) — high enough to differentiate alternatives that are
  // identical in width/heel but have different heel-to-toe drops.
  const dropDiff =
    foot.preferred_drop_mm != null && shoe.heel_drop_mm != null
      ? Math.abs(foot.preferred_drop_mm - shoe.heel_drop_mm)
      : null;
  let dropScore: number;
  if (dropDiff == null) dropScore = 75;
  else if (dropDiff <= 1) dropScore = 100;
  else if (dropDiff <= 3) dropScore = 85 - (dropDiff - 1) * 5; // 85..75
  else if (dropDiff <= 6) dropScore = 65 - (dropDiff - 3) * 8; // 65..41
  else dropScore = Math.max(20, 35 - (dropDiff - 6) * 5);

  if (dropDiff != null && dropDiff > 4) {
    if ((shoe.heel_drop_mm ?? 0) > (foot.preferred_drop_mm ?? 0)) {
      reasons.push(`Sprengung ${shoe.heel_drop_mm}mm — höher als deine bevorzugten ${foot.preferred_drop_mm}mm.`);
    } else {
      reasons.push(`Sprengung ${shoe.heel_drop_mm}mm — flacher als deine bevorzugten ${foot.preferred_drop_mm}mm.`);
    }
  }

  // Weights tuned for catalog reality: most "Wide+Roomy" shoes share ball
  // width 99-100mm and heel 71-72mm, so ball/heel barely differentiate the
  // top-tier alternatives. Drop and width-class do the differentiation work.
  const score = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        ballScore * 0.3 +
          heelScore * 0.15 +
          widthClassScore * 0.25 +
          toeboxScore * 0.05 +
          dropScore * 0.25
      )
    )
  );

  console.info("[fit-score]", {
    shoeId: shoe.id,
    shoe: `${shoe.brand_name} ${shoe.name}`,
    subscores: {
      ball: Math.round(ballScore),
      heel: Math.round(heelScore),
      widthClass: widthClassScore,
      toebox: toeboxScore,
      drop: dropScore,
    },
    deltas: {
      ball_mm: Math.round(widthDelta),
      heel_mm: Math.round(heelDelta),
      drop_mm: dropDiff,
    },
    total: score,
  });

  let band: MatchScore["band"];
  let label: string;
  if (score >= 80) {
    band = "great";
    label = "Passt sehr gut";
  } else if (score >= 60) {
    band = "ok";
    label = "Passt mit Einschränkungen";
  } else {
    band = "poor";
    label = "Passt nicht optimal";
  }

  if (reasons.length === 0) {
    reasons.push("Leisten-Geometrie passt zu deiner Fuß-Anatomie.");
  }

  return { score, band, label, reasons: reasons.slice(0, 3), needsWider, needsRoomierToebox };
}

export type RankedAlternative = { shoe: ShoeRow; match: MatchScore };

export function rankAlternatives(
  foot: FootMm,
  shoes: ShoeRow[],
  excludeShoeId?: string,
  limit = 3
): RankedAlternative[] {
  const ranked = shoes
    .filter((s) => s.id !== excludeShoeId)
    .map((shoe) => ({ shoe, match: scoreShoe(foot, shoe) }))
    .sort((a, b) => b.match.score - a.match.score);

  // Brand-diverse pick: best per brand first, so we don't show 3× HOKA Bondi.
  // After every brand has contributed, fill remaining slots with next best regardless.
  const result: RankedAlternative[] = [];
  const usedBrands = new Set<string>();
  for (const alt of ranked) {
    if (result.length >= limit) break;
    const brand = alt.shoe.brand_name ?? "";
    if (!usedBrands.has(brand)) {
      result.push(alt);
      usedBrands.add(brand);
    }
  }
  for (const alt of ranked) {
    if (result.length >= limit) break;
    if (!result.includes(alt)) result.push(alt);
  }

  console.info("[fit-rank] alternatives", {
    catalogSize: shoes.length,
    excluded: excludeShoeId,
    picked: result.map((r) => `${r.shoe.brand_name} ${r.shoe.name} (${r.match.score}%)`),
  });

  return result.slice(0, limit);
}
