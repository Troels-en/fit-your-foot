"""Spike 0b: ArUco-Marker-Detection für Mat-Scale-Reference.

Decision: client-side (OpenCV.js bundle) vs server-side (Modal-Python).
This module provides server-side detection. Client-side stays as a future
optimization if the round-trip-latency proves too slow in real-world tests.

Algorithm:
1. Detect ArUco-markers (we use DICT_4X4_50 as a reasonable default)
2. For each detected marker: corner-coords (sub-pixel via cornerSubPix)
3. Return list of {id, corners[4][2]} per marker
4. Compute mat-pixel-to-mm-scale via known marker-spacing on the mat

Note: the scan-mat.html generates 24 pseudo-random patterns NOT real ArUco
codes. So we have two options:
  Option A: switch the scan-mat to actual DICT_4X4_50 markers (requires
            re-generating the mat with known marker-IDs)
  Option B: detect ANY high-contrast checkerboard-like pattern (less robust)

For Spike 0b we recommend Option A — re-generate scan-mat with real ArUco-
codes. This module assumes that.
"""

from __future__ import annotations

import io
from dataclasses import dataclass
from typing import Optional

import numpy as np


@dataclass
class ArucoMarker:
    id: int
    corners: list[list[float]]  # 4 corners, each [x, y] in image pixels


@dataclass
class ArucoDetectionResult:
    markers: list[ArucoMarker]
    image_size: tuple[int, int]  # (width, height)
    pixel_to_mm_scale: Optional[float] = None  # mm per pixel, if computable


# Mat-Geometry: scan-mat ist ein 4×6-Grid von Markern mit format-abhängiger
# Cell-Pitch. A4 = 30mm-Pitch (120×180mm Mat), A3 = 45mm-Pitch (180×270mm Mat,
# 1.5× scale). Adjacent markers center-to-center entspricht der Pitch.
MAT_MARKER_SPACING_MM_A4 = 30.0
MAT_MARKER_SPACING_MM_A3 = 45.0


def mat_marker_spacing_mm(mat_format: str) -> float:
    """Liefert Marker-Center-to-Center-Pitch in mm pro Mat-Format.

    Args:
        mat_format: "A4" oder "A3" (case-insensitive)

    Returns:
        Marker-spacing in mm

    Raises:
        ValueError bei unbekanntem Format
    """
    fmt = mat_format.upper()
    if fmt == "A4":
        return MAT_MARKER_SPACING_MM_A4
    if fmt == "A3":
        return MAT_MARKER_SPACING_MM_A3
    raise ValueError(f"Unbekanntes mat_format: {mat_format!r}. Erlaubt: A4, A3.")


# Backwards-compat alias für bestehende Aufrufer (default A4).
MAT_MARKER_SPACING_MM = MAT_MARKER_SPACING_MM_A4


def detect_aruco_markers(
    image_bytes: bytes,
    mat_format: str = "A4",
) -> ArucoDetectionResult:
    """Detect ArUco markers in an image. Returns marker info + scale.

    Args:
        image_bytes: JPEG/PNG image bytes (from camera capture)
        mat_format: "A4" (default, 30mm-Pitch) oder "A3" (45mm-Pitch). Vom
                    Frontend übergeben basierend auf User-PDF-Wahl im Pre-Flow.

    Returns:
        ArucoDetectionResult with markers and pixel_to_mm_scale (if computable)

    Raises:
        ValueError if image cannot be decoded or mat_format unknown
    """
    spacing_mm = mat_marker_spacing_mm(mat_format)
    import cv2
    from cv2 import aruco

    # Decode image
    np_arr = np.frombuffer(image_bytes, dtype=np.uint8)
    img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Image decode failed")

    h, w = img.shape[:2]
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # Use DICT_4X4_50 (50 unique markers, 4×4 binary patterns).
    # Sufficient for our 24-marker mat. DICT_4X4_50 is fast to detect.
    aruco_dict = aruco.getPredefinedDictionary(aruco.DICT_4X4_50)

    # Detector parameters: cornerRefinementMethod=CORNER_REFINE_SUBPIX gives
    # sub-pixel-accurate corners (critical for mm-scale calibration).
    params = aruco.DetectorParameters()
    params.cornerRefinementMethod = aruco.CORNER_REFINE_SUBPIX
    params.cornerRefinementWinSize = 5

    detector = aruco.ArucoDetector(aruco_dict, params)
    corners_list, ids, _rejected = detector.detectMarkers(gray)

    markers: list[ArucoMarker] = []
    if ids is not None:
        for i, marker_id in enumerate(ids.flatten()):
            corners = corners_list[i][0]  # shape (4, 2)
            markers.append(
                ArucoMarker(
                    id=int(marker_id),
                    corners=[[float(c[0]), float(c[1])] for c in corners],
                )
            )

    # Compute pixel-to-mm-scale via Marker-ID-based-Adjacent-Pair-Matching
    # (Gemini-Sprint-1-Critical-Fix: nearest-neighbor-heuristic war fragil
    # unter perspective distortion — diagonal marker konnte näher pixel-distance
    # haben als true-adjacent → ~30% scale-error).
    #
    # Mat-Layout: 4 cols × 6 rows = 24 markers, IDs 0-23 row-major:
    #   row r, col c → id = r * 4 + c
    # Adjacent-Pairs:
    #   horizontal: ids differ by 1 AND not crossing row-boundary (col<3)
    #   vertical:   ids differ by 4 (always same column)
    # Adjacent-Distance = spacing_mm.
    #
    # Strategy: collect all detected adjacent pairs, median pixel-distance.
    # Median statt mean weil robust gegen outlier-Detection-Errors.
    pixel_to_mm = None
    if len(markers) >= 2:
        marker_by_id: dict[int, ArucoMarker] = {m.id: m for m in markers}
        adjacent_distances: list[float] = []
        for marker_id, m in marker_by_id.items():
            row = marker_id // 4
            col = marker_id % 4
            cx = sum(c[0] for c in m.corners) / 4
            cy = sum(c[1] for c in m.corners) / 4
            # Right neighbor
            if col < 3 and (marker_id + 1) in marker_by_id:
                n = marker_by_id[marker_id + 1]
                ncx = sum(c[0] for c in n.corners) / 4
                ncy = sum(c[1] for c in n.corners) / 4
                adjacent_distances.append(((cx - ncx) ** 2 + (cy - ncy) ** 2) ** 0.5)
            # Down neighbor
            if row < 5 and (marker_id + 4) in marker_by_id:
                n = marker_by_id[marker_id + 4]
                ncx = sum(c[0] for c in n.corners) / 4
                ncy = sum(c[1] for c in n.corners) / 4
                adjacent_distances.append(((cx - ncx) ** 2 + (cy - ncy) ** 2) ** 0.5)
        if adjacent_distances:
            # Median für robustness gegen ein outlier-Distance.
            adjacent_distances.sort()
            n = len(adjacent_distances)
            median_dist = (
                adjacent_distances[n // 2]
                if n % 2 == 1
                else (adjacent_distances[n // 2 - 1] + adjacent_distances[n // 2]) / 2
            )
            if median_dist > 0:
                pixel_to_mm = spacing_mm / median_dist

    return ArucoDetectionResult(
        markers=markers,
        image_size=(w, h),
        pixel_to_mm_scale=pixel_to_mm,
    )


def generate_aruco_mat_pdf_data() -> bytes:
    """Generate a PNG-bytes mat with real DICT_4X4_50 markers (4×6 grid, IDs 0-23).

    For Spike 0b: this creates a usable mat-image we can print or display.
    The current scan-mat.html generates pseudo-random patterns which are NOT
    valid ArUco — to actually use server-side ArUco-detection, the mat must
    show real DICT_4X4_50 markers.

    Returns PNG bytes of the mat at 1200dpi (A4 ~9920×14040 px).
    """
    import cv2
    from cv2 import aruco

    aruco_dict = aruco.getPredefinedDictionary(aruco.DICT_4X4_50)

    # 4 columns × 6 rows of 30mm markers on 120 × 180mm mat.
    # Render at 10 px/mm = 1200 × 1800 px (printable resolution).
    # ArUco detection requires a white "quiet zone" of ≥1 marker-cell-width
    # around each marker. So we shrink the inner marker to 80% of cell-size
    # and leave 10% padding all around (= 3mm white between adjacent markers).
    px_per_mm = 10
    marker_cell_mm = 30  # full cell incl. padding
    marker_inner_fraction = 0.8  # marker fills 80% of cell
    cell_size_px = marker_cell_mm * px_per_mm
    marker_size_px = int(cell_size_px * marker_inner_fraction)
    pad_px = (cell_size_px - marker_size_px) // 2

    cols, rows = 4, 6
    mat_w_px = cols * cell_size_px
    mat_h_px = rows * cell_size_px

    canvas = np.full((mat_h_px, mat_w_px), 255, dtype=np.uint8)

    for row in range(rows):
        for col in range(cols):
            marker_id = row * cols + col
            marker_img = aruco.generateImageMarker(aruco_dict, marker_id, marker_size_px)
            x = col * cell_size_px + pad_px
            y = row * cell_size_px + pad_px
            canvas[y:y + marker_size_px, x:x + marker_size_px] = marker_img

    success, png_data = cv2.imencode(".png", canvas)
    if not success:
        raise RuntimeError("PNG encode failed")
    return png_data.tobytes()
