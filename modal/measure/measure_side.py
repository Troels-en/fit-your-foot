"""Extract heights from a side-view foot mask.

Input:
  mask: uint8 HxW, 0 = background, 255 = foot (side profile)
  mm_per_px: scale factor derived from the side A4
Output:
  dict with arch_height_mm, instep_height_mm, side_length_mm (cross-check)

Coordinate convention:
  Image y-axis increases downward (OpenCV default). The "floor" is the
  bottom-most point of the foot mask; heights are measured upward from
  there.
"""

from __future__ import annotations

import cv2
import numpy as np


def measure_side(mask: np.ndarray, mm_per_px: float) -> dict:
    if mask.ndim != 2:
        raise ValueError("expected HxW mask")

    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    if not contours:
        raise ValueError("empty mask")
    contour = max(contours, key=cv2.contourArea).reshape(-1, 2).astype(np.float32)

    xs = contour[:, 0]
    ys = contour[:, 1]

    x_min, x_max = float(xs.min()), float(xs.max())
    side_length_px = x_max - x_min
    side_length_mm = side_length_px * mm_per_px

    # Floor line = max y (lowest point of foot). Assume camera roughly level.
    floor_y = float(ys.max())

    # Heights = floor_y - y (positive upward) in pixels
    # For each x column in the mask, take the min(y) — the topmost foot pixel.
    col_top = _column_top(mask)  # array of len W; nan where no mask
    valid = ~np.isnan(col_top)
    if not valid.any():
        raise ValueError("no valid foot columns")

    heights_px = floor_y - col_top
    heights_mm = heights_px * mm_per_px

    # Instep height: max height across the foot
    instep_height_mm = float(np.nanmax(heights_mm))

    # Arch height: height at the midpoint of the foot (between heel and ball).
    # Approximation: at x = x_min + 0.55 * length (~arch position, slightly
    # forward of true center; true arch is a few cm ahead of heel).
    cols = np.arange(col_top.shape[0], dtype=np.float32)
    x_arch = x_min + 0.55 * side_length_px
    # Take a small window around x_arch and the MIN height inside it
    win = 0.05 * side_length_px
    win_mask = (cols >= x_arch - win) & (cols <= x_arch + win) & valid
    if win_mask.any():
        # Arch = the LOW point under the foot (i.e., closest-to-floor point of
        # the upper contour is wrong — we want the foot-bottom curve's height).
        # With a side mask the BOTTOM of the foot is also a curve. To get the
        # arch clearance above the floor, take the column where the BOTTOM of
        # mask is HIGHEST above the true floor.
        col_bot = _column_bottom(mask)
        bot_heights_mm = (floor_y - col_bot) * mm_per_px
        arch_height_mm = float(np.nanmax(bot_heights_mm[win_mask]))
    else:
        arch_height_mm = 0.0

    return {
        "arch_height_mm": round(float(arch_height_mm), 1),
        "instep_height_mm": round(float(instep_height_mm), 1),
        "side_length_mm": round(side_length_mm, 1),
    }


def _column_top(mask: np.ndarray) -> np.ndarray:
    """For each column, the smallest y where mask != 0, else NaN."""
    h, w = mask.shape
    out = np.full(w, np.nan, dtype=np.float32)
    ys_idx = np.arange(h, dtype=np.float32)[:, None]
    # Where mask is true, keep y; else inf, then min.
    y_masked = np.where(mask > 0, ys_idx, np.inf)
    mins = y_masked.min(axis=0)
    has_any = np.isfinite(mins)
    out[has_any] = mins[has_any]
    return out


def _column_bottom(mask: np.ndarray) -> np.ndarray:
    h, w = mask.shape
    out = np.full(w, np.nan, dtype=np.float32)
    ys_idx = np.arange(h, dtype=np.float32)[:, None]
    y_masked = np.where(mask > 0, ys_idx, -np.inf)
    maxs = y_masked.max(axis=0)
    has_any = np.isfinite(maxs)
    out[has_any] = maxs[has_any]
    return out
