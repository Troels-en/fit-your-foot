"""
Erweiterte Detection-Pipeline für /detect-extended (v11 design).

Liefert pro Frame alle Felder die das Live-Gate-System braucht:
  - Markers (subset of /detect-aruco)
  - Homography + Residuals (Blatt-Planarity-Check)
  - Plane-Normal (Camera-vs-Floor-Geometry)
  - PnP-Pose: camera_center_marker_coords (Phone-Höhe via Z + Side-Direction)
  - side_yaw_delta_to_expected_medial_deg (Side-Yaw-Ortho-Gate)
  - side_sign_matches_selected_foot (Camera-Side-Sign-Check)
  - Foot-Bounding-Box in Marker-Coords (mm)
  - Heel + Toe + Foot-Yaw-Angle in Marker-Coords
  - foot_bbox_to_paper_edge_min_mm (A4-Tightness-Check)

Frame wird vor allen Maßen undistorted basierend auf calibration-Intrinsics.
Wenn Lite: distortion-coefficients=0; Pro: aus Zhang oder UA-Prior.
"""

from dataclasses import dataclass
from typing import Optional


@dataclass(frozen=True)
class DetectExtendedResult:
    ok: bool
    error: Optional[str]
    # Marker-Detection
    marker_count: int
    markers: list[dict]
    # Mat-Geometry
    mat_format: str
    homography: Optional[list[list[float]]]
    homography_residuals_px: Optional[float]
    plane_normal: Optional[list[float]]
    # PnP-Pose
    camera_center_marker_coords_mm: Optional[dict]  # {"x":..., "y":..., "z":...}
    camera_forward_dot_normal: Optional[float]
    side_yaw_delta_to_expected_medial_deg: Optional[float]
    side_sign_matches_selected_foot: Optional[bool]
    # Foot-Geometry (in Marker-Coords mm)
    foot_bounding_box_marker_coords_mm: Optional[list[float]]  # [x, y, w, h]
    foot_confidence: float
    heel_position_marker_coords_mm: Optional[dict]
    toe_tip_position_marker_coords_mm: Optional[dict]
    foot_yaw_angle_deg: Optional[float]
    foot_bbox_to_paper_edge_min_mm: Optional[float]
    # Marker-Spatial-Coverage (Codex-Round-4-Hard-Failure-Fix)
    marker_convex_hull_area_fraction: Optional[float]
    marker_spread_along_foot_axis_mm: Optional[float]
    # Brightness-Stats
    brightness_mean: float
    brightness_stddev: float


def _build_object_points_for_mat(
    marker_ids: list[int], spacing_mm: float
) -> list[tuple[float, float, float]]:
    """3D-Welt-Coords der Marker-Centers auf Floor-Plane."""
    points: list[tuple[float, float, float]] = []
    for marker_id in marker_ids:
        row = marker_id // 4
        col = marker_id % 4
        points.append((col * spacing_mm, row * spacing_mm, 0.0))
    return points


def detect_extended(
    image_bytes: bytes,
    intrinsics: dict,
    mat_format: str = "A4",
    phase: str = "top",
    selected_foot: str = "right",
) -> DetectExtendedResult:
    """Vollständige Pre-Capture-Frame-Analyse.

    Args:
        image_bytes: Camera-Frame
        intrinsics: dict mit fx, fy, cx, cy, distortion_coefficients{k1,k2,p1,p2,k3}
        mat_format: A4 oder A3
        phase: "top" oder "side" (steuert side-yaw-checks)
        selected_foot: "left" oder "right"

    Returns:
        DetectExtendedResult mit allen Gate-Feldern.
    """
    import io
    import math
    import numpy as np
    import cv2
    from PIL import Image

    from measure.aruco_detect import detect_aruco_markers, mat_marker_spacing_mm
    from measure.foot_detect import detect_foot_in_frame

    spacing_mm = mat_marker_spacing_mm(mat_format)

    # === 1) Decode + undistort ===
    try:
        img = np.array(Image.open(io.BytesIO(image_bytes)).convert("RGB"))
    except Exception as e:
        return DetectExtendedResult(
            ok=False, error=f"image decode failed: {e}",
            marker_count=0, markers=[], mat_format=mat_format,
            homography=None, homography_residuals_px=None, plane_normal=None,
            camera_center_marker_coords_mm=None, camera_forward_dot_normal=None,
            side_yaw_delta_to_expected_medial_deg=None,
            side_sign_matches_selected_foot=None,
            foot_bounding_box_marker_coords_mm=None, foot_confidence=0.0,
            heel_position_marker_coords_mm=None,
            toe_tip_position_marker_coords_mm=None,
            foot_yaw_angle_deg=None, foot_bbox_to_paper_edge_min_mm=None,
            marker_convex_hull_area_fraction=None,
            marker_spread_along_foot_axis_mm=None,
            brightness_mean=0.0, brightness_stddev=0.0,
        )
    h, w = img.shape[:2]

    fx = intrinsics["fx"]
    fy = intrinsics["fy"]
    cx = intrinsics["cx"]
    cy = intrinsics["cy"]
    dist = intrinsics.get("distortion_coefficients", {})
    K = np.array([[fx, 0, cx], [0, fy, cy], [0, 0, 1]], dtype=np.float64)
    dist_arr = np.array(
        [
            dist.get("k1", 0.0),
            dist.get("k2", 0.0),
            dist.get("p1", 0.0),
            dist.get("p2", 0.0),
            dist.get("k3", 0.0),
        ],
        dtype=np.float64,
    )
    img_undistorted = cv2.undistort(img, K, dist_arr)
    gray_u = cv2.cvtColor(img_undistorted, cv2.COLOR_RGB2GRAY)
    brightness_mean = float(gray_u.mean())
    brightness_stddev = float(gray_u.std())

    # === 2) Marker-Detection auf undistorted-Frame ===
    # JPEG-roundtrip vermeiden (lossy + slow). Re-encode nur als minimal-loss
    # PNG falls detect_aruco_markers downstream JPEG-bytes erwartet.
    # TODO Phase-3: detect_aruco_markers refactor um numpy-array direkt zu
    # akzeptieren und encode/decode komplett zu eliminieren.
    encoded = cv2.imencode(".png", cv2.cvtColor(img_undistorted, cv2.COLOR_RGB2BGR))
    img_undist_bytes = encoded[1].tobytes()
    aruco_result = detect_aruco_markers(img_undist_bytes, mat_format=mat_format)

    if len(aruco_result.markers) < 3:
        return DetectExtendedResult(
            ok=False, error=f"only {len(aruco_result.markers)} markers detected (need ≥3)",
            marker_count=len(aruco_result.markers),
            markers=[{"id": m.id, "corners": m.corners} for m in aruco_result.markers],
            mat_format=mat_format,
            homography=None, homography_residuals_px=None, plane_normal=None,
            camera_center_marker_coords_mm=None, camera_forward_dot_normal=None,
            side_yaw_delta_to_expected_medial_deg=None,
            side_sign_matches_selected_foot=None,
            foot_bounding_box_marker_coords_mm=None, foot_confidence=0.0,
            heel_position_marker_coords_mm=None,
            toe_tip_position_marker_coords_mm=None,
            foot_yaw_angle_deg=None, foot_bbox_to_paper_edge_min_mm=None,
            marker_convex_hull_area_fraction=None,
            marker_spread_along_foot_axis_mm=None,
            brightness_mean=brightness_mean, brightness_stddev=brightness_stddev,
        )

    # === 3) Marker-Centers in Pixel + Object-Coords ===
    marker_ids = [m.id for m in aruco_result.markers]
    obj_pts = np.array(_build_object_points_for_mat(marker_ids, spacing_mm), dtype=np.float64)
    img_pts = np.array(
        [
            [sum(c[0] for c in m.corners) / 4, sum(c[1] for c in m.corners) / 4]
            for m in aruco_result.markers
        ],
        dtype=np.float64,
    )

    # === 4) PnP-Pose (R, T) ===
    success, rvec, tvec = cv2.solvePnP(
        obj_pts, img_pts, K, np.zeros(5),  # already-undistorted
        flags=cv2.SOLVEPNP_ITERATIVE,
    )
    camera_center_marker = None
    camera_forward_dot_normal = None
    side_yaw_delta = None
    side_sign_matches = None
    plane_normal = [0.0, 0.0, 1.0]  # Floor-plane normal in marker-coords

    if success:
        R, _ = cv2.Rodrigues(rvec)
        # Camera-center in marker-coords: -R^T · T
        camera_center_world = -R.T @ tvec
        camera_center_marker = {
            "x": float(camera_center_world[0, 0]),
            "y": float(camera_center_world[1, 0]),
            "z": float(camera_center_world[2, 0]),
        }
        # Camera-forward direction in marker-coords
        camera_forward_world = R.T @ np.array([[0], [0], [1]], dtype=np.float64)
        plane_n = np.array(plane_normal, dtype=np.float64)
        camera_forward_dot_normal = float(np.dot(camera_forward_world.flatten(), plane_n))

        # Side-Yaw-Ortho (Codex-Round-4-Hard-Failure-Fix für side phase)
        if phase == "side":
            # Project camera-forward onto floor-plane (drop z)
            cf_proj = np.array(
                [camera_forward_world[0, 0], camera_forward_world[1, 0]],
                dtype=np.float64,
            )
            cf_proj_norm = cf_proj / max(np.linalg.norm(cf_proj), 1e-9)
            # Expected medial-direction: für selectedFoot=right, Camera schaut
            # nach LINKS (negative-x in mat-coords). Heel-to-Toe-axis ist y-axis.
            # Right-Foot: medial = -x direction (Camera right of foot, looking left)
            # Left-Foot:  medial = +x direction
            expected_medial_x = -1.0 if selected_foot == "right" else 1.0
            # Signed angle via atan2 — positive = camera-forward rotated CCW
            # gegenüber expected medial. Frontend nutzt Sign für UX-Hint
            # ("rotate left" vs "rotate right"). Magnitude für Reject-Threshold.
            # cross-product (2D z-component) = sin*|a||b|, dot = cos*|a||b|.
            cross_z = expected_medial_x * cf_proj_norm[1] - 0.0 * cf_proj_norm[0]
            dot = expected_medial_x * cf_proj_norm[0] + 0.0 * cf_proj_norm[1]
            side_yaw_delta = math.degrees(math.atan2(cross_z, dot))

            # Camera-Center-Side-Sign-Check
            cam_x = camera_center_marker["x"]
            mat_center_x = 1.5 * spacing_mm  # 4 cols, center between col 1 and 2
            if selected_foot == "right":
                # Camera muss rechts vom Mat-Center sein: cam_x > mat_center_x
                side_sign_matches = cam_x > mat_center_x
            else:
                side_sign_matches = cam_x < mat_center_x

    # === 5) Homography + Residuals ===
    homography = None
    homography_residuals_px = None
    if len(aruco_result.markers) >= 4:
        # Object-points in 2D (z=0): (x_mm, y_mm)
        obj_pts_2d = obj_pts[:, :2].astype(np.float32)
        H, mask = cv2.findHomography(obj_pts_2d, img_pts.astype(np.float32), cv2.RANSAC, 3.0)
        if H is not None:
            homography = H.tolist()
            # Residuals: re-project obj_pts via H and compute RMS pixel-error
            ones = np.ones((obj_pts_2d.shape[0], 1), dtype=np.float32)
            obj_h = np.hstack([obj_pts_2d, ones])
            proj = (H @ obj_h.T).T
            proj_2d = proj[:, :2] / proj[:, 2:3]
            residuals = np.linalg.norm(proj_2d - img_pts.astype(np.float32), axis=1)
            homography_residuals_px = float(np.sqrt(np.mean(residuals ** 2)))

    # === 6) Marker-Spatial-Coverage (Codex-Round-4-Hard-Failure-Fix) ===
    marker_convex_hull_area_fraction = None
    marker_spread_along_foot_axis_mm = None
    if len(img_pts) >= 3:
        try:
            hull = cv2.convexHull(img_pts.astype(np.float32))
            hull_area = cv2.contourArea(hull)
            frame_area = w * h
            marker_convex_hull_area_fraction = float(hull_area / frame_area)
        except Exception:
            pass
        # Spread along foot-axis (y-axis in marker-coords). Heel-to-Toe ist y direction.
        ys_mm = [m_id // 4 * spacing_mm for m_id in marker_ids]
        if ys_mm:
            marker_spread_along_foot_axis_mm = float(max(ys_mm) - min(ys_mm))

    # === 7) Foot-Detection mit Inverse-Homography-Warp ===
    # Gemini-Sprint-3-Critical-Fix: vorher px*scale = orthographic-approximation,
    # ignoriert Perspective. Side-View-Measurements waren systematisch falsch.
    # Jetzt: bbox-corners durch H_inv (Bild-px → Marker-mm) projizieren.
    foot_result = detect_foot_in_frame(image_bytes)
    foot_bbox_marker = None
    foot_bbox_to_edge_mm = None
    heel_pos = None
    toe_pos = None
    foot_yaw = None
    if foot_result.get("best_bbox") is not None and homography is not None:
        bx, by, bw, bh = foot_result["best_bbox"]  # [x, y, w, h] in pixels
        try:
            H_arr = np.array(homography, dtype=np.float64)
            H_inv = np.linalg.inv(H_arr)
            # Bbox-corners + heel/toe-anchors in homogeneous-pixel-coords.
            # Heel-anchor: top-edge-center (kleinerer y = näher zur Wand,
            # entspricht Mat-Heel-Side row=0). Toe-anchor: bottom-edge-center.
            corners_px = np.array(
                [
                    [bx, by, 1.0],                   # top-left
                    [bx + bw, by, 1.0],              # top-right
                    [bx + bw, by + bh, 1.0],         # bottom-right
                    [bx, by + bh, 1.0],              # bottom-left
                    [bx + bw / 2, by, 1.0],          # heel-anchor (top-center)
                    [bx + bw / 2, by + bh, 1.0],     # toe-anchor (bottom-center)
                ],
                dtype=np.float64,
            ).T  # shape (3, 6)
            warped = H_inv @ corners_px  # (3, 6)
            warped_mm = warped[:2, :] / np.maximum(np.abs(warped[2:, :]), 1e-12)
            xs_mm = warped_mm[0, :]
            ys_mm = warped_mm[1, :]
            x_min, x_max = float(xs_mm[:4].min()), float(xs_mm[:4].max())
            y_min, y_max = float(ys_mm[:4].min()), float(ys_mm[:4].max())
            foot_bbox_marker = [x_min, y_min, x_max - x_min, y_max - y_min]
            heel_pos = {"x": float(xs_mm[4]), "y": float(ys_mm[4])}
            toe_pos = {"x": float(xs_mm[5]), "y": float(ys_mm[5])}
            dx = toe_pos["x"] - heel_pos["x"]
            dy = toe_pos["y"] - heel_pos["y"]
            foot_yaw = math.degrees(math.atan2(dx, dy))
            # Distance to mat-edge (mat is 4*spacing × 6*spacing in marker-coords)
            mat_w_mm = 4 * spacing_mm
            mat_h_mm = 6 * spacing_mm
            edges = [
                x_min,                       # left
                mat_w_mm - x_max,            # right
                y_min,                       # top
                mat_h_mm - y_max,            # bottom
            ]
            foot_bbox_to_edge_mm = float(min(edges))
        except Exception:
            # Homography-Inversion failed — silent skip, foot-fields stay None.
            pass

    return DetectExtendedResult(
        ok=True, error=None,
        marker_count=len(aruco_result.markers),
        markers=[{"id": m.id, "corners": m.corners} for m in aruco_result.markers],
        mat_format=mat_format,
        homography=homography,
        homography_residuals_px=homography_residuals_px,
        plane_normal=plane_normal,
        camera_center_marker_coords_mm=camera_center_marker,
        camera_forward_dot_normal=camera_forward_dot_normal,
        side_yaw_delta_to_expected_medial_deg=side_yaw_delta,
        side_sign_matches_selected_foot=side_sign_matches,
        foot_bounding_box_marker_coords_mm=foot_bbox_marker,
        foot_confidence=float(foot_result.get("best_confidence", 0)),
        heel_position_marker_coords_mm=heel_pos,
        toe_tip_position_marker_coords_mm=toe_pos,
        foot_yaw_angle_deg=foot_yaw,
        foot_bbox_to_paper_edge_min_mm=foot_bbox_to_edge_mm,
        marker_convex_hull_area_fraction=marker_convex_hull_area_fraction,
        marker_spread_along_foot_axis_mm=marker_spread_along_foot_axis_mm,
        brightness_mean=brightness_mean,
        brightness_stddev=brightness_stddev,
    )
