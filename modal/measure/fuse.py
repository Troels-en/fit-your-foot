"""Combine top-view and side-view results into a single Measurements object.

- Derives arch_type from arch_height_mm ranges
- Derives eu_size from foot_length_mm using a continental sizing curve
- Cross-checks top length vs side length; large disagreement lowers confidence
- Emits human-readable German warnings for anomalies
"""

from __future__ import annotations

from .models import ArchType, Confidence, Measurements


LENGTH_DISAGREEMENT_WARN_MM = 4.0
LENGTH_DISAGREEMENT_FAIL_MM = 10.0


def combine(top: dict, side: dict | None) -> tuple[Measurements, list[str]]:
    warnings: list[str] = []
    confidence: Confidence = "high"

    foot_length_mm = top["foot_length_mm"]
    foot_width_mm = top["foot_width_mm"]
    ball_width_mm = top["ball_width_mm"]
    heel_width_mm = top["heel_width_mm"]

    arch_height_mm = None
    instep_height_mm = None

    if side is not None:
        arch_height_mm = side.get("arch_height_mm")
        instep_height_mm = side.get("instep_height_mm")
        side_len = side.get("side_length_mm")

        if side_len is not None:
            diff = abs(foot_length_mm - side_len)
            if diff >= LENGTH_DISAGREEMENT_FAIL_MM:
                confidence = "low"
                warnings.append(
                    f"Top und Seite weichen um {diff:.0f}mm ab — Messung unzuverlässig."
                )
            elif diff >= LENGTH_DISAGREEMENT_WARN_MM:
                confidence = _downgrade(confidence, "medium")
                warnings.append(
                    f"Top und Seite weichen um {diff:.0f}mm ab — Ergebnis mit Vorsicht nutzen."
                )

    arch_type: ArchType = _classify_arch(arch_height_mm)
    eu_size = _length_to_eu_size(foot_length_mm)

    return (
        Measurements(
            foot_length_mm=foot_length_mm,
            foot_width_mm=foot_width_mm,
            ball_width_mm=ball_width_mm,
            heel_width_mm=heel_width_mm,
            arch_type=arch_type,
            arch_height_mm=arch_height_mm,
            instep_height_mm=instep_height_mm,
            eu_size=eu_size,
            confidence=confidence,
        ),
        warnings,
    )


def _classify_arch(arch_height_mm: float | None) -> ArchType:
    if arch_height_mm is None:
        return "medium"
    if arch_height_mm < 10:
        return "low"
    if arch_height_mm >= 20:
        return "high"
    return "medium"


def _length_to_eu_size(length_mm: float) -> int:
    """Approximate continental sizing: size = round((length_mm * 1.5) / 10).
    Based on the Paris point (1 size = 2/3 cm = 6.667 mm). Length increments of
    6.67 mm per size. Add ~10 mm fitting allowance to foot length → shoe length.
    """
    shoe_length_mm = length_mm + 10.0
    size = shoe_length_mm / 6.667
    return int(round(size))


def _downgrade(current: Confidence, target: Confidence) -> Confidence:
    order = {"low": 0, "medium": 1, "high": 2}
    if order[target] < order[current]:
        return target
    return current
