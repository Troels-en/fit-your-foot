"""Empirical Validation Statistics-Script (Task 13).

Liest fixtures/empirical-validation-2026Q2.csv, berechnet pro Tier (Quick-
Lite, Premium-Pro) die Delta-Statistik vs. Caliper-Referenz, und schreibt
einen Markdown-Report.

Usage:
    uv run python scripts/empirical_validation.py \\
        --input fixtures/empirical-validation-2026Q2.csv \\
        --output reports/empirical-validation-2026Q2.md

Bar-Configuration (siehe EMPIRICAL-VALIDATION-2026Q2.md Section 5):
    Quick-Lite: ±5mm
    Premium-Pro: ±3mm
"""

from __future__ import annotations

import argparse
import csv
import math
import sys
from collections import defaultdict
from dataclasses import dataclass, field
from pathlib import Path
from statistics import mean, stdev
from typing import Iterable

QUICK_LITE_BAR_MM = 5.0
PREMIUM_PRO_BAR_MM = 3.0
LAUNCH_PASS_RATE_QUICK = 0.85
LAUNCH_PASS_RATE_PREMIUM = 0.90

MEASURES = ("length", "ball_width", "heel_width")


@dataclass
class FixtureRow:
    set_id: str
    subject_id: str
    phone_model: str
    lighting: str
    foot_side: str
    mat_format: str
    caliper: dict[str, float]  # measure -> mm
    scan_tier: str  # "quick-lite" | "premium-pro"
    scan: dict[str, float]
    notes: str = ""


@dataclass
class TierStats:
    tier: str
    n: int = 0
    deltas: dict[str, list[float]] = field(default_factory=lambda: {m: [] for m in MEASURES})
    per_phone_pass: dict[str, tuple[int, int]] = field(default_factory=dict)
    per_lighting_pass: dict[str, tuple[int, int]] = field(default_factory=dict)


def parse_csv(path: Path) -> list[FixtureRow]:
    rows: list[FixtureRow] = []
    with path.open(newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            try:
                rows.append(
                    FixtureRow(
                        set_id=row["set_id"].strip(),
                        subject_id=row["subject_id"].strip(),
                        phone_model=row["phone_model"].strip(),
                        lighting=row["lighting"].strip(),
                        foot_side=row["foot_side"].strip(),
                        mat_format=row["mat_format"].strip(),
                        caliper={
                            "length": float(row["caliper_length_mm"]),
                            "ball_width": float(row["caliper_ball_width_mm"]),
                            "heel_width": float(row["caliper_heel_width_mm"]),
                        },
                        scan_tier=row["scan_tier"].strip(),
                        scan={
                            "length": float(row["scan_length_mm"]),
                            "ball_width": float(row["scan_ball_width_mm"]),
                            "heel_width": float(row["scan_heel_width_mm"]),
                        },
                        notes=row.get("notes", "").strip(),
                    )
                )
            except (KeyError, ValueError) as e:
                print(f"WARN: row skipped (set_id={row.get('set_id', '?')}): {e}", file=sys.stderr)
    return rows


def percentile(values: list[float], p: float) -> float:
    if not values:
        return float("nan")
    s = sorted(values)
    k = (len(s) - 1) * p
    f = math.floor(k)
    c = math.ceil(k)
    if f == c:
        return s[int(k)]
    return s[f] + (s[c] - s[f]) * (k - f)


def aggregate(rows: Iterable[FixtureRow]) -> dict[str, TierStats]:
    out: dict[str, TierStats] = {
        "quick-lite": TierStats(tier="quick-lite"),
        "premium-pro": TierStats(tier="premium-pro"),
    }
    per_phone_total: dict[str, dict[str, list[bool]]] = {
        "quick-lite": defaultdict(list),
        "premium-pro": defaultdict(list),
    }
    per_lighting_total: dict[str, dict[str, list[bool]]] = {
        "quick-lite": defaultdict(list),
        "premium-pro": defaultdict(list),
    }
    for row in rows:
        if row.scan_tier not in out:
            continue
        stats = out[row.scan_tier]
        bar = QUICK_LITE_BAR_MM if row.scan_tier == "quick-lite" else PREMIUM_PRO_BAR_MM
        passed = True
        for m in MEASURES:
            d = row.scan[m] - row.caliper[m]
            stats.deltas[m].append(d)
            if abs(d) > bar:
                passed = False
        stats.n += 1
        per_phone_total[row.scan_tier][row.phone_model].append(passed)
        per_lighting_total[row.scan_tier][row.lighting].append(passed)

    for tier in out:
        out[tier].per_phone_pass = {
            phone: (sum(passes), len(passes))
            for phone, passes in per_phone_total[tier].items()
        }
        out[tier].per_lighting_pass = {
            light: (sum(passes), len(passes))
            for light, passes in per_lighting_total[tier].items()
        }
    return out


def fmt_mm(values: list[float]) -> str:
    if not values:
        return "n/a"
    if len(values) == 1:
        return f"{values[0]:+.2f}mm (n=1)"
    return (
        f"mean={mean(values):+.2f}mm σ={stdev(values):.2f}mm "
        f"p50={percentile(values, 0.5):+.2f}mm p95={percentile(values, 0.95):+.2f}mm "
        f"max={max(values, key=abs):+.2f}mm"
    )


def pass_rate(within: int, total: int) -> str:
    if total == 0:
        return "n/a"
    return f"{within}/{total} ({within / total * 100:.1f}%)"


def overall_pass_rate(stats: TierStats, bar_mm: float) -> tuple[int, int]:
    if stats.n == 0:
        return 0, 0
    within = 0
    n = stats.n
    for i in range(n):
        ok = all(abs(stats.deltas[m][i]) <= bar_mm for m in MEASURES)
        if ok:
            within += 1
    return within, n


def render_report(stats_per_tier: dict[str, TierStats], total_rows: int) -> str:
    lines: list[str] = []
    lines.append("# Empirical Validation Report — Q2 2026")
    lines.append("")
    lines.append(f"**Total Sets:** {total_rows}")
    lines.append(
        f"**Bars:** Quick-Lite ±{QUICK_LITE_BAR_MM}mm · Premium-Pro ±{PREMIUM_PRO_BAR_MM}mm"
    )
    lines.append(
        f"**Launch-Pass-Threshold:** Quick-Lite ≥{LAUNCH_PASS_RATE_QUICK * 100:.0f}% · "
        f"Premium-Pro ≥{LAUNCH_PASS_RATE_PREMIUM * 100:.0f}%"
    )
    lines.append("")

    for tier_key, stats in stats_per_tier.items():
        bar_mm = QUICK_LITE_BAR_MM if tier_key == "quick-lite" else PREMIUM_PRO_BAR_MM
        threshold = (
            LAUNCH_PASS_RATE_QUICK if tier_key == "quick-lite" else LAUNCH_PASS_RATE_PREMIUM
        )
        lines.append(f"## {tier_key.upper()} (bar ±{bar_mm}mm)")
        lines.append(f"**n = {stats.n}**")
        lines.append("")
        if stats.n == 0:
            lines.append("_No data._")
            lines.append("")
            continue
        lines.append("### Per-Measure Delta Statistik")
        lines.append("")
        lines.append("| Measure | Stats |")
        lines.append("|---------|-------|")
        for m in MEASURES:
            lines.append(f"| {m.replace('_', ' ').title()} | {fmt_mm(stats.deltas[m])} |")
        lines.append("")
        within, total = overall_pass_rate(stats, bar_mm)
        rate = within / total if total else 0
        verdict = "✅ PASS" if rate >= threshold else "❌ FAIL"
        lines.append(
            f"### Overall Pass-Rate: {pass_rate(within, total)} {verdict} (threshold {threshold * 100:.0f}%)"
        )
        lines.append("")
        if stats.per_phone_pass:
            lines.append("### Per-Phone Pass-Rate")
            lines.append("")
            lines.append("| Phone | Pass | Total | Rate |")
            lines.append("|-------|------|-------|------|")
            for phone in sorted(stats.per_phone_pass):
                w, t = stats.per_phone_pass[phone]
                lines.append(f"| {phone} | {w} | {t} | {pass_rate(w, t)} |")
            lines.append("")
        if stats.per_lighting_pass:
            lines.append("### Per-Lighting Pass-Rate")
            lines.append("")
            lines.append("| Lighting | Pass | Total | Rate |")
            lines.append("|----------|------|-------|------|")
            for light in sorted(stats.per_lighting_pass):
                w, t = stats.per_lighting_pass[light]
                lines.append(f"| {light} | {w} | {t} | {pass_rate(w, t)} |")
            lines.append("")
    lines.append("## Decision-Gate")
    lines.append("")
    lines.append(
        "_Vergleiche oben Verdicts mit `EMPIRICAL-VALIDATION-2026Q2.md` Section 5._"
    )
    return "\n".join(lines) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, required=True, help="CSV with fixture data")
    parser.add_argument("--output", type=Path, required=True, help="Markdown report")
    args = parser.parse_args()

    if not args.input.exists():
        print(f"ERROR: input {args.input} not found", file=sys.stderr)
        return 2
    args.output.parent.mkdir(parents=True, exist_ok=True)

    rows = parse_csv(args.input)
    stats = aggregate(rows)
    report = render_report(stats, total_rows=len(rows))
    args.output.write_text(report, encoding="utf-8")
    print(f"Wrote report: {args.output} ({len(rows)} rows)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
