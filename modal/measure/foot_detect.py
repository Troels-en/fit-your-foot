"""Spike 0c: Foot-Detection im Frame (Pre-Trigger-Gate).

Workplan-Frage: was funktioniert für Foot-In-Frame-Detection in Top-Down-
Foot-Scans? MediaPipe-Selfie-Segmentation ist Selfie-trained und liefert
unzuverlässige Ergebnisse auf Foot-Frames (kein menschliches Gesicht/
Oberkörper im Bild).

Approach: 3 lokale Strategien parallel, jede gibt Confidence-Score zurück.
Cloud-Fallback (SAM) wenn alle 3 unter Threshold.

Strategien:
1. Center-Region-Variance: hoch-variance im Center vs flach-uniform am Rand
   → Foot ist im Center
2. HSV-Skin-Color-Mask: Skin-Tones (HSV-Range typisch 0-25 H, 30-150 S,
   60-200 V) → für barfüßige Captures
3. LBP-Texture-Energy: Local-Binary-Pattern-Energy in Center vs Edge → für
   gemusterte Socke (LBP fängt Streifen/Rauten/Zickzack)

Each returns: (confidence: float [0-1], detected_bbox: optional)
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

import numpy as np


@dataclass
class FootDetectionResult:
    """Output einer einzelnen Detection-Strategie."""

    strategy: str
    confidence: float  # 0-1, höher = eher Foot-im-Frame
    foot_bbox: Optional[tuple[int, int, int, int]] = None  # (x, y, w, h) in pixels
    diagnostics: Optional[dict] = None


# Confidence-Thresholds für „Foot detected"
FOOT_DETECTED_THRESHOLD = 0.6


def detect_via_center_variance(image_bytes: bytes) -> FootDetectionResult:
    """Strategie 1: Center-Region hat höhere Variance als Edge-Regions.

    Annahme: Foot ist im zentralen 50%×50% Frame-Bereich. Edges (~25% Rand)
    sind matter Hintergrund (uniform-dunkel). Variance-Ratio Center/Edge >
    1.5x = Foot detected.
    """
    import cv2

    np_arr = np.frombuffer(image_bytes, dtype=np.uint8)
    img = cv2.imdecode(np_arr, cv2.IMREAD_GRAYSCALE)
    if img is None:
        return FootDetectionResult("center_variance", 0.0)

    h, w = img.shape
    cx, cy = w // 2, h // 2
    cw, ch = w // 4, h // 4  # half-widths of central 50%×50%

    center = img[cy - ch : cy + ch, cx - cw : cx + cw]
    # Edge-region: alle Pixel außerhalb des center
    edge_mask = np.ones_like(img, dtype=bool)
    edge_mask[cy - ch : cy + ch, cx - cw : cx + cw] = False
    edge = img[edge_mask]

    var_center = float(np.var(center))
    var_edge = float(np.var(edge))
    ratio = var_center / max(var_edge, 1.0)

    # Map ratio to confidence: ratio 1.0 → 0.0, ratio 3.0+ → 1.0
    confidence = min(1.0, max(0.0, (ratio - 1.0) / 2.0))

    return FootDetectionResult(
        strategy="center_variance",
        confidence=confidence,
        foot_bbox=(cx - cw, cy - ch, 2 * cw, 2 * ch) if confidence > 0.3 else None,
        diagnostics={"variance_center": var_center, "variance_edge": var_edge, "ratio": ratio},
    )


def detect_via_skin_color(image_bytes: bytes) -> FootDetectionResult:
    """Strategie 2: HSV-Skin-Color-Mask im Center-Region.

    Funktioniert bei nackter Haut. Bei dunkler Haut limitiert (HSV-Skin-
    Range muss erweitert werden). Bei Socke: liefert keine Detection (kein
    Skin) → Strategie funktioniert NICHT für Premium-Mode-mit-Socke.
    """
    import cv2

    np_arr = np.frombuffer(image_bytes, dtype=np.uint8)
    img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
    if img is None:
        return FootDetectionResult("skin_color", 0.0)

    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    # HSV-Skin-Range — generic, funktioniert für hellere Hauttöne
    lower = np.array([0, 30, 60], dtype=np.uint8)
    upper = np.array([25, 150, 220], dtype=np.uint8)
    mask = cv2.inRange(hsv, lower, upper)

    h, w = img.shape[:2]
    cy, cx = h // 2, w // 2
    cw, ch = w // 4, h // 4

    center_mask = mask[cy - ch : cy + ch, cx - cw : cx + cw]
    skin_pixel_ratio = float(np.sum(center_mask > 0)) / center_mask.size

    # Map skin-ratio to confidence: 0% skin → 0.0, ≥40% skin → 1.0
    confidence = min(1.0, skin_pixel_ratio / 0.4)

    # Estimate bbox via mask largest connected component
    bbox = None
    if confidence > 0.3:
        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if contours:
            largest = max(contours, key=cv2.contourArea)
            x, y, bw, bh = cv2.boundingRect(largest)
            bbox = (x, y, bw, bh)

    return FootDetectionResult(
        strategy="skin_color",
        confidence=confidence,
        foot_bbox=bbox,
        diagnostics={"skin_pixel_ratio_center": skin_pixel_ratio},
    )


def detect_via_lbp_texture(image_bytes: bytes) -> FootDetectionResult:
    """Strategie 3: Local-Binary-Pattern-Texture-Energy.

    Funktioniert für gemusterte Sockes. LBP misst lokale Texture-Variation
    (jeder Pixel wird gegen 8 Nachbarn binär kodiert). Center-LBP-Energy
    high → Pattern (z.B. Streifen-Socke). Edge-LBP-Energy low → uniform
    Hintergrund.
    """
    import cv2

    np_arr = np.frombuffer(image_bytes, dtype=np.uint8)
    img = cv2.imdecode(np_arr, cv2.IMREAD_GRAYSCALE)
    if img is None:
        return FootDetectionResult("lbp_texture", 0.0)

    h, w = img.shape
    # Approximation des LBP via local-stddev (computational cheap, similar
    # ground-truth — pattern-rich regions have higher stddev, uniform regions
    # have lower).
    kernel_size = 9
    mean = cv2.boxFilter(img.astype(np.float32), -1, (kernel_size, kernel_size))
    sqr_mean = cv2.boxFilter((img.astype(np.float32)) ** 2, -1, (kernel_size, kernel_size))
    local_var = sqr_mean - mean ** 2
    local_stddev = np.sqrt(np.maximum(local_var, 0))

    cy, cx = h // 2, w // 2
    cw, ch = w // 4, h // 4
    center_stddev = float(np.mean(local_stddev[cy - ch : cy + ch, cx - cw : cx + cw]))

    edge_mask = np.ones_like(img, dtype=bool)
    edge_mask[cy - ch : cy + ch, cx - cw : cx + cw] = False
    edge_stddev = float(np.mean(local_stddev[edge_mask]))

    ratio = center_stddev / max(edge_stddev, 1.0)
    # Map to confidence: ratio 1.5 → 0.0, ratio 4.0+ → 1.0
    confidence = min(1.0, max(0.0, (ratio - 1.5) / 2.5))

    return FootDetectionResult(
        strategy="lbp_texture",
        confidence=confidence,
        foot_bbox=(cx - cw, cy - ch, 2 * cw, 2 * ch) if confidence > 0.3 else None,
        diagnostics={"stddev_center": center_stddev, "stddev_edge": edge_stddev, "ratio": ratio},
    )


def detect_foot_in_frame(image_bytes: bytes) -> dict:
    """Run all 3 strategies, return combined result.

    Frontend uses the strategy with highest confidence. If all <0.5 → fallback
    to Cloud-SAM (separate function) or coach-hint to user.
    """
    r1 = detect_via_center_variance(image_bytes)
    r2 = detect_via_skin_color(image_bytes)
    r3 = detect_via_lbp_texture(image_bytes)
    results = [r1, r2, r3]
    best = max(results, key=lambda r: r.confidence)
    return {
        "best_strategy": best.strategy,
        "best_confidence": best.confidence,
        "best_bbox": best.foot_bbox,
        "all_strategies": [
            {"strategy": r.strategy, "confidence": r.confidence, "diagnostics": r.diagnostics}
            for r in results
        ],
        "needs_cloud_fallback": all(r.confidence < FOOT_DETECTED_THRESHOLD for r in results),
    }
