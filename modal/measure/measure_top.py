"""Extract length and widths from a top-view foot mask.

Input:
  mask: uint8 HxW, 0 = background, 255 = foot
  mm_per_px: scale factor for the image the mask was drawn on
Output:
  dict with foot_length_mm, foot_width_mm, ball_width_mm, heel_width_mm
"""

from __future__ import annotations

import cv2
import numpy as np


def measure_top(mask: np.ndarray, mm_per_px: float) -> dict:
    if mask.ndim != 2:
        raise ValueError("expected HxW mask")

    # Find foot contour
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    if not contours:
        raise ValueError("empty mask")
    contour = max(contours, key=cv2.contourArea)
    pts = contour.reshape(-1, 2).astype(np.float32)  # (N, 2)  — (x, y)

    # Principal axis: PCA on contour points
    mean = pts.mean(axis=0)
    centered = pts - mean
    cov = np.cov(centered.T)
    eigvals, eigvecs = np.linalg.eigh(cov)
    # Largest eigenvalue = long axis
    axis_long = eigvecs[:, np.argmax(eigvals)]
    axis_short = np.array([-axis_long[1], axis_long[0]])

    # Project all points onto the two axes
    proj_long = centered @ axis_long   # length-direction coordinate
    proj_short = centered @ axis_short  # width-direction coordinate

    length_px = float(proj_long.max() - proj_long.min())
    length_mm = length_px * mm_per_px

    # Ensure "front" = larger projection value. Convention: foot tip = front.
    # We can't know from geometry alone which end is toe vs heel; so measure
    # widths relative to positions along the long axis as percentiles.
    proj_long_norm = (proj_long - proj_long.min()) / (length_px + 1e-9)  # 0 (back) .. 1 (front)

    # Binned width profile: 100 slices along the long axis
    widths_mm = np.zeros(100, dtype=np.float32)
    for i in range(100):
        t0, t1 = i / 100.0, (i + 1) / 100.0
        m = (proj_long_norm >= t0) & (proj_long_norm < t1)
        if not m.any():
            widths_mm[i] = 0.0
            continue
        widths_mm[i] = (proj_short[m].max() - proj_short[m].min()) * mm_per_px

    foot_width_mm = float(widths_mm.max())

    # Ball width: widest in 25-45% from one end
    # We don't know which end is the toe yet. Compute widths at both ends;
    # toe-end has a wider ball than heel-end in virtually all feet.
    front_25_45 = float(widths_mm[25:45].max())
    back_25_45 = float(widths_mm[55:75].max())  # mirrored window
    if front_25_45 >= back_25_45:
        ball_idx_range = slice(25, 45)
        heel_idx_range = slice(80, 100)
    else:
        ball_idx_range = slice(55, 75)
        heel_idx_range = slice(0, 20)

    ball_width_mm = float(widths_mm[ball_idx_range].max())
    heel_width_mm = float(widths_mm[heel_idx_range].max())

    return {
        "foot_length_mm": round(length_mm, 1),
        "foot_width_mm": round(foot_width_mm, 1),
        "ball_width_mm": round(ball_width_mm, 1),
        "heel_width_mm": round(heel_width_mm, 1),
    }
