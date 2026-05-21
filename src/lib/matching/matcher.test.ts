import { describe, expect, it } from "vitest";
import { rankShoes, scoreShoe } from "./matcher";
import {
  expectedWidthGrade,
  scoreArchSupport,
  scoreBallWidth,
  scoreDropStack,
  scoreHeelFit,
  scoreLength,
  scoreReturnSignal,
  scoreToebox,
  scoreWidthGrade,
} from "./scorers";
import type { FootProfile, ShoeDims } from "./types";

const baseFoot: FootProfile = {
  foot_length_mm: 268,
  ball_width_mm: 98,
  heel_width_mm: 67,
  arch_type: "medium",
  eu_size: 42.5,
  runner_type: "daily",
  fit_preference: "regular",
};

// inner_length_mm in DB-Konvention = bei EU 38 Referenz. Realer Schuh ist
// für unseren EU 42.5 baseFoot (4.5 × 6.67 ≈ 30 mm) länger. 250 + 30 = 280
// → 12 mm allowance vs 268 mm Fuß (sweet spot für daily).
const idealShoe: ShoeDims = {
  id: "ideal",
  inner_length_mm: 250,
  forefoot_width_mm: 101, // 3 mm wider than foot — sweet spot
  width_mm: 99,
  heel_width_mm: 66, // -1 mm vs foot — snug
  toebox_width_mm: 96,
  toebox_height_mm: 24,
  toebox: "rounded",
  width_grade: "Regular",
  arch_support: "neutral",
  heel_drop_mm: 8,
  heel_stack_mm: 30,
  forefoot_stack_mm: 22,
  retour_rate_pct: 4,
  available_sizes: [42, 42.5, 43],
  category: "running",
};

describe("scoreLength", () => {
  it("scores ideal allowance as 100", () => {
    expect(scoreLength(baseFoot, idealShoe).score).toBe(100);
  });

  it("penalizes too-short shoe heavily", () => {
    // baseInner 240 → scaled 270 → allowance 2 mm (zu kurz)
    const tight: ShoeDims = { ...idealShoe, inner_length_mm: 240 };
    const r = scoreLength(baseFoot, tight);
    expect(r.score).toBeLessThan(40);
    expect(r.reason).toMatch(/zu kurz|Black-Toe|knapp/i);
  });

  it("penalizes too-long shoe", () => {
    // baseInner 265 → scaled 295 → allowance 27 mm (zu lang)
    const long: ShoeDims = { ...idealShoe, inner_length_mm: 265 };
    const r = scoreLength(baseFoot, long);
    expect(r.score).toBeLessThan(60);
    expect(r.reason).toMatch(/zu lang|rutscht/i);
  });

  it("falls back to outer_length_mm when inner_length missing", () => {
    // outer 265 - 15 = 250 base inner → scaled 280 → allowance 12 mm
    const fallback: ShoeDims = {
      inner_length_mm: null,
      outer_length_mm: 265,
    };
    const r = scoreLength(baseFoot, fallback);
    expect(r.score).toBe(100);
  });

  it("returns neutral 75 when no length data", () => {
    expect(scoreLength(baseFoot, {}).score).toBe(75);
  });

  it("widens ideal range for trail runners", () => {
    // 12 mm allowance ist sweet spot für daily, aber low für trail (ideal 14-17)
    const trailFoot: FootProfile = { ...baseFoot, runner_type: "trail" };
    expect(scoreLength(trailFoot, idealShoe).score).toBeLessThan(100);
  });

  it("respects fit_preference snug → smaller allowance is fine", () => {
    // snug shifts daily ideal from [11,14] to [9.5,12.5]
    // baseInner 248 → scaled 278 → allowance 10 mm → in snug-Range
    const snugFoot: FootProfile = { ...baseFoot, fit_preference: "snug" };
    const shoe: ShoeDims = { ...idealShoe, inner_length_mm: 248 };
    expect(scoreLength(snugFoot, shoe).score).toBe(100);
  });
});

describe("scoreBallWidth", () => {
  it("scores ideal +3mm delta as 100", () => {
    expect(scoreBallWidth(baseFoot, idealShoe).score).toBe(100);
  });

  it("penalizes shoe narrower than foot", () => {
    const narrow: ShoeDims = { ...idealShoe, forefoot_width_mm: 92 };
    const r = scoreBallWidth(baseFoot, narrow);
    expect(r.score).toBeLessThan(40);
    expect(r.reason).toMatch(/breiter|drückt/i);
  });

  it("penalizes very wide last", () => {
    const sloppy: ShoeDims = { ...idealShoe, forefoot_width_mm: 112 };
    expect(scoreBallWidth(baseFoot, sloppy).score).toBeLessThan(70);
  });

  it("falls back to width_mm when forefoot_width missing", () => {
    const shoe: ShoeDims = { ...idealShoe, forefoot_width_mm: null, width_mm: 101 };
    expect(scoreBallWidth(baseFoot, shoe).score).toBe(100);
  });
});

describe("scoreHeelFit", () => {
  it("scores -1mm heel delta as 100 (snug)", () => {
    expect(scoreHeelFit(baseFoot, idealShoe).score).toBe(100);
  });

  it("flags heel slip when shoe much wider", () => {
    const slip: ShoeDims = { ...idealShoe, heel_width_mm: 73 };
    const r = scoreHeelFit(baseFoot, slip);
    expect(r.score).toBeLessThanOrEqual(60);
    expect(r.reason).toMatch(/Heel.?Slip|rutscht/i);
  });

  it("returns neutral 75 when heel data missing", () => {
    expect(scoreHeelFit({ ...baseFoot, heel_width_mm: null }, idealShoe).score).toBe(75);
  });
});

describe("scoreToebox", () => {
  it("scores roomy toebox + good ratio + adequate height as ~100", () => {
    expect(scoreToebox(baseFoot, idealShoe).score).toBeGreaterThanOrEqual(95);
  });

  it("penalizes tapered toebox for wide foot", () => {
    const wideFoot: FootProfile = { ...baseFoot, ball_width_mm: 105 };
    const taper: ShoeDims = { ...idealShoe, toebox: "tapered" };
    const r = scoreToebox(wideFoot, taper);
    expect(r.score).toBeLessThan(75);
    expect(r.reason).toMatch(/spitz|breitem Vorfuß/i);
  });

  it("low toebox-width-ratio penalized", () => {
    const tapered: ShoeDims = {
      ...idealShoe,
      toebox_width_mm: 80, // 80/101 = 0.79 < 0.85 → t1 = 35
      toebox: "regular",
    };
    expect(scoreToebox(baseFoot, tapered).score).toBeLessThan(70);
  });
});

describe("expectedWidthGrade", () => {
  it("classifies 88mm @ 268mm as Narrow", () => {
    expect(expectedWidthGrade(88, 268)).toBe("Narrow");
  });
  it("classifies 96mm @ 268mm as Regular", () => {
    expect(expectedWidthGrade(96, 268)).toBe("Regular");
  });
  it("classifies 103mm @ 268mm as Wide", () => {
    expect(expectedWidthGrade(103, 268)).toBe("Wide");
  });
  it("classifies 110mm @ 268mm as ExtraWide", () => {
    expect(expectedWidthGrade(110, 268)).toBe("ExtraWide");
  });
  it("normalizes by length: 96mm @ 240mm → still relatively wide", () => {
    expect(expectedWidthGrade(96, 240)).not.toBe("Narrow");
  });
});

describe("scoreWidthGrade", () => {
  it("perfect grade match → 100", () => {
    expect(scoreWidthGrade(baseFoot, idealShoe).score).toBe(100);
  });
  it("two-grade gap heavily penalized", () => {
    const wideFoot: FootProfile = { ...baseFoot, ball_width_mm: 110 };
    const narrow: ShoeDims = { ...idealShoe, width_grade: "Narrow" };
    const r = scoreWidthGrade(wideFoot, narrow);
    expect(r.score).toBeLessThanOrEqual(50);
  });
});

describe("scoreArchSupport", () => {
  it("low arch + stability = 100", () => {
    const r = scoreArchSupport({ ...baseFoot, arch_type: "low" }, {
      ...idealShoe,
      arch_support: "stability",
    });
    expect(r.score).toBe(100);
  });
  it("low arch + neutral = 65", () => {
    const r = scoreArchSupport({ ...baseFoot, arch_type: "low" }, {
      ...idealShoe,
      arch_support: "neutral",
    });
    expect(r.score).toBe(65);
    expect(r.reason).toBeDefined();
  });
});

describe("scoreDropStack", () => {
  it("8mm drop is sweet-spot", () => {
    expect(scoreDropStack(baseFoot, idealShoe).score).toBe(100);
  });
  it("0mm drop falls in 'edge' band", () => {
    expect(scoreDropStack(baseFoot, { ...idealShoe, heel_drop_mm: 0 }).score).toBe(85);
  });
  it("missing drop → neutral 85", () => {
    expect(scoreDropStack(baseFoot, {}).score).toBe(85);
  });
});

describe("scoreReturnSignal", () => {
  it("low return-rate boosts to 100", () => {
    expect(scoreReturnSignal(baseFoot, { retour_rate_pct: 3 }).score).toBe(100);
  });
  it("high return-rate drops below 30", () => {
    expect(scoreReturnSignal(baseFoot, { retour_rate_pct: 30 }).score).toBe(25);
  });
  it("missing data is neutral", () => {
    expect(scoreReturnSignal(baseFoot, {}).score).toBe(80);
  });
});

describe("scoreShoe (aggregate)", () => {
  it("ideal shoe scores ≥ 95", () => {
    const r = scoreShoe(baseFoot, idealShoe);
    expect(r.score).toBeGreaterThanOrEqual(95);
    expect(r.band).toBe("great");
    expect(r.flags.needsBigger).toBe(false);
    expect(r.flags.needsWider).toBe(false);
  });

  it("shoe with multiple problems lands in 'poor'", () => {
    const bad: ShoeDims = {
      id: "bad",
      inner_length_mm: 238, // baseInner 238 → scaled 268 → 0mm allowance, too short
      forefoot_width_mm: 90, // foot way wider
      heel_width_mm: 75, // heel slip
      toebox_width_mm: 76,
      toebox: "tapered",
      width_grade: "Narrow",
      arch_support: "neutral",
      heel_drop_mm: 8,
      retour_rate_pct: 22,
      available_sizes: [42.5],
    };
    const r = scoreShoe(baseFoot, bad);
    expect(r.score).toBeLessThan(60);
    expect(r.band).toBe("poor");
    expect(r.flags.needsBigger).toBe(true);
    expect(r.flags.needsWider).toBe(true);
    expect(r.reasons.length).toBeGreaterThan(0);
    expect(r.reasons.length).toBeLessThanOrEqual(3);
  });

  it("filters unavailable size", () => {
    const wrongSize: ShoeDims = { ...idealShoe, available_sizes: [40, 41] };
    const r = scoreShoe(baseFoot, wrongSize);
    expect(r.score).toBe(0);
    expect(r.band).toBe("poor");
    expect(r.label).toBe("Größe nicht verfügbar");
  });

  it("subScores expose every weighted dimension", () => {
    const r = scoreShoe(baseFoot, idealShoe);
    const keys = r.subScores.map((s) => s.key).sort();
    expect(keys).toEqual([
      "archSupport",
      "ballWidth",
      "dropStack",
      "heelFit",
      "length",
      "returnSig",
      "toebox",
      "widthGrade",
    ]);
  });

  it("happy-path reasons fall back to positive message", () => {
    const r = scoreShoe(baseFoot, idealShoe);
    expect(r.reasons[0]).toMatch(/passt zu deiner Fuß-Anatomie/);
  });
});

describe("rankShoes", () => {
  const shoes: ShoeDims[] = [
    { ...idealShoe, id: "a" },
    { ...idealShoe, id: "b", inner_length_mm: 265, forefoot_width_mm: 112 }, // baseInner 265 → scaled 295 → 27mm allowance + ball way too wide
    { ...idealShoe, id: "c", inner_length_mm: 252, forefoot_width_mm: 102 }, // baseInner 252 → scaled 282 → 14mm, slight ballenwider — fine
  ];

  it("returns shoes sorted by score desc", () => {
    const ranked = rankShoes(baseFoot, shoes);
    expect(ranked[0].fit.score).toBeGreaterThanOrEqual(ranked[1].fit.score);
    expect(ranked[1].fit.score).toBeGreaterThanOrEqual(ranked[2].fit.score);
  });

  it("excludes shoe by id", () => {
    const ranked = rankShoes(baseFoot, shoes, { excludeId: "a" });
    expect(ranked.find((r) => r.shoe.id === "a")).toBeUndefined();
  });

  it("respects limit", () => {
    const ranked = rankShoes(baseFoot, shoes, { limit: 1 });
    expect(ranked.length).toBe(1);
  });

  it("filters by minScore", () => {
    const ranked = rankShoes(baseFoot, shoes, { minScore: 90 });
    expect(ranked.every((r) => r.fit.score >= 90)).toBe(true);
  });
});
