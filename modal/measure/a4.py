"""A4 paper detection + perspective rectification.

Multi-strategy approach: try Canny+contours first (works best for clean
shots), fall back to threshold-based detection (white paper on darker
floor), then to morphological closing. Aspect-ratio tolerance is
deliberately loose (25%) so tilted shots still pass.

Returns a rectified image at 10 px/mm scale when `rectify=True`, else
just the detected quad + approximate mm-per-pixel derived from the
longest edge.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

import cv2
import numpy as np

A4_WIDTH_MM = 210.0
A4_HEIGHT_MM = 297.0
A4_ASPECT = A4_HEIGHT_MM / A4_WIDTH_MM  # 1.414
ASPECT_TOL = 0.25
MIN_AREA_FRAC = 0.015
TARGET_PX_PER_MM = 10.0


@dataclass
class A4Detection:
    quad: np.ndarray
    mm_per_px: float
    rectified: Optional[np.ndarray] = None


class A4NotFoundError(Exception):
    pass


def detect_a4(image: np.ndarray, rectify: bool = True) -> A4Detection:
    if image.ndim != 3 or image.shape[2] != 3:
        raise ValueError("expected HxWx3 image")

    gray = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    h, w = image.shape[:2]
    min_area = MIN_AREA_FRAC * h * w

    strategies = [
        ("canny_50_150", lambda g: _canny(g, 50, 150)),
        ("canny_30_100", lambda g: _canny(g, 30, 100)),
        ("canny_80_200", lambda g: _canny(g, 80, 200)),
        ("otsu", lambda g: _otsu(g)),
        ("adaptive", lambda g: _adaptive(g)),
    ]

    all_candidates: list[tuple[float, np.ndarray]] = []
    for _name, fn in strategies:
        edges = fn(blurred)
        candidates = _find_quads(edges, min_area)
        all_candidates.extend(candidates)
        if candidates:
            break  # take the first strategy that produced anything; don't over-explore

    if not all_candidates:
        raise A4NotFoundError("no 4-sided contour with A4 aspect found")

    all_candidates.sort(key=lambda t: t[0], reverse=True)
    quad = _order_corners(all_candidates[0][1])

    if not rectify:
        long_side_px = max(
            float(np.linalg.norm(quad[1] - quad[0])),
            float(np.linalg.norm(quad[2] - quad[1])),
        )
        return A4Detection(quad=quad, mm_per_px=A4_HEIGHT_MM / long_side_px)

    top_edge = float(np.linalg.norm(quad[1] - quad[0]))
    right_edge = float(np.linalg.norm(quad[2] - quad[1]))
    if top_edge > right_edge:
        target_w = int(A4_HEIGHT_MM * TARGET_PX_PER_MM)
        target_h = int(A4_WIDTH_MM * TARGET_PX_PER_MM)
    else:
        target_w = int(A4_WIDTH_MM * TARGET_PX_PER_MM)
        target_h = int(A4_HEIGHT_MM * TARGET_PX_PER_MM)

    dst = np.array(
        [[0, 0], [target_w - 1, 0], [target_w - 1, target_h - 1], [0, target_h - 1]],
        dtype=np.float32,
    )
    M = cv2.getPerspectiveTransform(quad.astype(np.float32), dst)
    rectified = cv2.warpPerspective(image, M, (target_w, target_h))
    return A4Detection(quad=quad, mm_per_px=1.0 / TARGET_PX_PER_MM, rectified=rectified)


def _canny(gray: np.ndarray, lo: int, hi: int) -> np.ndarray:
    edges = cv2.Canny(gray, lo, hi)
    return cv2.dilate(edges, np.ones((3, 3), np.uint8), iterations=1)


def _otsu(gray: np.ndarray) -> np.ndarray:
    _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    edges = cv2.morphologyEx(binary, cv2.MORPH_GRADIENT, np.ones((3, 3), np.uint8))
    return edges


def _adaptive(gray: np.ndarray) -> np.ndarray:
    binary = cv2.adaptiveThreshold(
        gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 21, 5
    )
    edges = cv2.morphologyEx(binary, cv2.MORPH_GRADIENT, np.ones((3, 3), np.uint8))
    return edges


def _find_quads(edges: np.ndarray, min_area: float) -> list[tuple[float, np.ndarray]]:
    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return []

    candidates: list[tuple[float, np.ndarray]] = []
    for c in contours:
        area = cv2.contourArea(c)
        if area < min_area:
            continue
        # Try multiple approximation tolerances — noisy edges need looser fits
        for eps_frac in (0.02, 0.03, 0.05):
            perim = cv2.arcLength(c, True)
            approx = cv2.approxPolyDP(c, eps_frac * perim, True)
            if len(approx) == 4:
                pts = approx.reshape(4, 2).astype(np.float32)
                if _is_a4_aspect(pts):
                    candidates.append((area, pts))
                    break
    return candidates


def _is_a4_aspect(quad: np.ndarray) -> bool:
    edges_len = [np.linalg.norm(quad[(i + 1) % 4] - quad[i]) for i in range(4)]
    long_side, short_side = max(edges_len), min(edges_len)
    if short_side <= 0:
        return False
    aspect = long_side / short_side
    return abs(aspect - A4_ASPECT) / A4_ASPECT <= ASPECT_TOL


def _order_corners(pts: np.ndarray) -> np.ndarray:
    ordered = np.zeros_like(pts)
    s = pts.sum(axis=1)
    d = pts[:, 0] - pts[:, 1]
    ordered[0] = pts[np.argmin(s)]  # TL
    ordered[2] = pts[np.argmax(s)]  # BR
    ordered[1] = pts[np.argmax(d)]  # TR
    ordered[3] = pts[np.argmin(d)]  # BL
    return ordered
