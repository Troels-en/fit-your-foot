"""
Zhang's Method Camera-Intrinsics-Calibration für Premium-Scan-Pro.

Quick-Scan-Lite nutzt UA-String-Device-Camera-Prior (kein on-the-fly
Calibration). Premium-Pro kalibriert via Zhang's Method aus 5 Frames mit
view-angle-diversity.

Algorithm:
  1. Detect ArUco-Markers in jedem Frame (24 Marker, IDs 0-23, known 3D-positions
     auf Floor-Plane mit z=0).
  2. cv2.calibrateCamera mit object-points (3D, mm) + image-points (2D, px).
  3. Validate: Reprojection-RMS < 0.5px, FOV-Bounds [25°, 80°], k1/k2-bounds.
  4. Wenn fail: 2nd retry. Wenn auch fail: Caller fallback auf gated-UA-Prior
     mit FOV-from-Marker-Grid Main-Camera-Confirm.

Reference:
  Zhang, Z. (2000). "A flexible new technique for camera calibration."
  IEEE TPAMI. https://www.microsoft.com/en-us/research/wp-content/uploads/2016/02/tr98-71.pdf
"""

from dataclasses import dataclass
from typing import Optional
import math


@dataclass(frozen=True)
class CalibrationResult:
    """Result of Zhang-Calibration. is_valid=False bei Reject-Bedingung."""

    is_valid: bool
    fx: float
    fy: float
    cx: float
    cy: float
    k1: float
    k2: float
    p1: float
    p2: float
    k3: float
    reprojection_rms_px: float
    horizontal_fov_deg: float
    vertical_fov_deg: float
    image_width: int
    image_height: int
    reject_reason: Optional[str] = None  # None wenn is_valid=True


def _build_object_points_for_mat(
    marker_ids: list[int], spacing_mm: float
) -> list[tuple[float, float, float]]:
    """Liefert 3D-Welt-Coords der Marker-Centers (z=0, Floor-Plane).

    Mat-Layout: 4 cols × 6 rows row-major. Marker-Center bei (col*spacing,
    row*spacing, 0). Center der Mat ist (1.5*spacing, 2.5*spacing, 0).
    """
    points: list[tuple[float, float, float]] = []
    for marker_id in marker_ids:
        row = marker_id // 4
        col = marker_id % 4
        x = col * spacing_mm
        y = row * spacing_mm
        points.append((x, y, 0.0))
    return points


def calibrate_from_frames(
    frame_marker_observations: list[list[tuple[int, list[list[float]]]]],
    image_width: int,
    image_height: int,
    spacing_mm: float = 30.0,
) -> CalibrationResult:
    """Kalibriert Camera-Intrinsics aus mehreren Frame-Observations.

    Args:
        frame_marker_observations: Liste pro Frame. Jeder Frame ist Liste
            von (marker_id, corners-4×2-pixels).
        image_width, image_height: Frame-Resolution
        spacing_mm: Mat-Marker-Pitch (30mm A4, 45mm A3)

    Returns:
        CalibrationResult mit is_valid + Intrinsics oder reject_reason.

    Validation-Constraints:
      - ≥3 frames mit ≥4 detected markers each
      - Reprojection-RMS < 0.5 px
      - FOV in [25°, 80°] beide Achsen
      - |k1| < 0.5, |k2| < 0.3 (Brown-Conrady plausible-bounds)
      - Principal-Point in [0.3, 0.7] image-fraction
    """
    # Lazy-import cv2/numpy — Modal-image-bound (gleiche Image wie aruco_detect)
    import cv2
    import numpy as np

    valid_frames = [f for f in frame_marker_observations if len(f) >= 4]
    if len(valid_frames) < 3:
        return CalibrationResult(
            is_valid=False, fx=0, fy=0, cx=0, cy=0, k1=0, k2=0, p1=0, p2=0, k3=0,
            reprojection_rms_px=float("inf"), horizontal_fov_deg=0, vertical_fov_deg=0,
            image_width=image_width, image_height=image_height,
            reject_reason="Need ≥3 frames mit ≥4 markers each (got "
                          f"{len(valid_frames)} frames).",
        )

    object_points_per_frame = []
    image_points_per_frame = []

    for frame in valid_frames:
        marker_ids = [m_id for m_id, _ in frame]
        # Object-Points: Marker-Center in mm (z=0)
        obj_pts = _build_object_points_for_mat(marker_ids, spacing_mm)
        # Image-Points: Marker-Center in pixels
        img_pts = []
        for _, corners in frame:
            cx_px = sum(c[0] for c in corners) / 4
            cy_px = sum(c[1] for c in corners) / 4
            img_pts.append([cx_px, cy_px])
        object_points_per_frame.append(np.array(obj_pts, dtype=np.float32))
        image_points_per_frame.append(np.array(img_pts, dtype=np.float32))

    flags = 0  # default Brown-Conrady-Modell mit k1, k2, p1, p2, k3
    rms, camera_matrix, dist_coeffs, _rvecs, _tvecs = cv2.calibrateCamera(
        object_points_per_frame,
        image_points_per_frame,
        (image_width, image_height),
        None,
        None,
        flags=flags,
    )
    fx = float(camera_matrix[0, 0])
    fy = float(camera_matrix[1, 1])
    cx = float(camera_matrix[0, 2])
    cy = float(camera_matrix[1, 2])
    dist = dist_coeffs.flatten().tolist()
    k1, k2, p1, p2, k3 = (dist + [0.0] * 5)[:5]

    # Validation
    horizontal_fov = 2 * math.atan(image_width / (2 * fx)) * 180 / math.pi
    vertical_fov = 2 * math.atan(image_height / (2 * fy)) * 180 / math.pi

    rejects: list[str] = []
    if rms > 0.5:
        rejects.append(f"Reprojection-RMS {rms:.3f} > 0.5 px")
    if not (25.0 <= horizontal_fov <= 80.0):
        rejects.append(f"horizontal-FOV {horizontal_fov:.1f}° outside [25°, 80°]")
    if not (25.0 <= vertical_fov <= 80.0):
        rejects.append(f"vertical-FOV {vertical_fov:.1f}° outside [25°, 80°]")
    if abs(k1) > 0.5:
        rejects.append(f"|k1|={abs(k1):.3f} > 0.5")
    if abs(k2) > 0.3:
        rejects.append(f"|k2|={abs(k2):.3f} > 0.3")
    cx_frac = cx / image_width
    cy_frac = cy / image_height
    if not (0.3 <= cx_frac <= 0.7):
        rejects.append(f"principal-point cx-fraction {cx_frac:.3f} outside [0.3, 0.7]")
    if not (0.3 <= cy_frac <= 0.7):
        rejects.append(f"principal-point cy-fraction {cy_frac:.3f} outside [0.3, 0.7]")

    is_valid = not rejects
    return CalibrationResult(
        is_valid=is_valid,
        fx=fx, fy=fy, cx=cx, cy=cy,
        k1=k1, k2=k2, p1=p1, p2=p2, k3=k3,
        reprojection_rms_px=float(rms),
        horizontal_fov_deg=horizontal_fov,
        vertical_fov_deg=vertical_fov,
        image_width=image_width,
        image_height=image_height,
        reject_reason=None if is_valid else "; ".join(rejects),
    )


def estimate_fov_from_marker_grid(
    marker_observations: list[tuple[int, list[list[float]]]],
    image_width: int,
    image_height: int,
    spacing_mm: float,
) -> Optional[tuple[float, float]]:
    """Schätzt Camera-FOV aus einem Frame mit erkannten Markers.

    Used für Main-Camera-Confirmation (Codex-Round-7-Fix): wenn Zhang-Calibration
    fail-1 → fallback zu UA-Prior NUR wenn FOV-from-Marker-Grid mit UA-Prior-FOV
    matched (Δ<10%). Verhindert dass UA-Prior für falsche Lens (Ultrawide/Tele)
    verwendet wird.

    Args:
        marker_observations: Liste von (marker_id, corners-4×2-pixels)
        image_width/height
        spacing_mm: Mat-spacing für scale-reference

    Returns:
        (horizontal_fov_deg, vertical_fov_deg) oder None wenn unable.
    """
    if len(marker_observations) < 4:
        return None
    import numpy as np
    import cv2

    obj_pts = np.array(
        _build_object_points_for_mat([m_id for m_id, _ in marker_observations], spacing_mm),
        dtype=np.float32,
    )
    img_pts = np.array(
        [
            [sum(c[0] for c in corners) / 4, sum(c[1] for c in corners) / 4]
            for _, corners in marker_observations
        ],
        dtype=np.float32,
    )
    # Single-frame solvePnP-with-initial-guess geht nicht direkt für Intrinsics.
    # Stattdessen: cv2.calibrateCamera mit single-Frame und CALIB_USE_INTRINSIC_GUESS.
    # Initial fy = image_height entspricht 53.1° vertikalem FOV (mid-range mobile
    # camera typical). Iterative refinement bringt es ≈ true value wenn Marker-
    # Coverage gut ist.
    initial_fy = float(image_height)
    initial_fx = initial_fy
    camera_matrix = np.array(
        [[initial_fx, 0, image_width / 2], [0, initial_fy, image_height / 2], [0, 0, 1]],
        dtype=np.float32,
    )
    try:
        rms, K, _dist, _r, _t = cv2.calibrateCamera(
            [obj_pts], [img_pts], (image_width, image_height), camera_matrix, None,
            flags=cv2.CALIB_USE_INTRINSIC_GUESS | cv2.CALIB_FIX_PRINCIPAL_POINT,
        )
        fx = float(K[0, 0])
        fy = float(K[1, 1])
        h_fov = 2 * math.atan(image_width / (2 * fx)) * 180 / math.pi
        v_fov = 2 * math.atan(image_height / (2 * fy)) * 180 / math.pi
        return (h_fov, v_fov)
    except Exception:
        return None
