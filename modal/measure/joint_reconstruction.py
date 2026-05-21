"""
Joint-3D-Foot-Geometry-Reconstruction (Top + Side jointly) für v11 Design.

Side-Photo allein liefert KEIN mm-Höhen-Maß: alle Floor-Plane-Marker sind bei
z=0; Side-Camera-Ray-Intersection mit Floor-Plane gibt nur Foot-Bottom (z=0).
Foot-Höhe (Instep, Mid-Foot) braucht Joint-Reconstruction:

  1. Top-Foto liefert foot-medial-line + foot-lateral-line auf Floor-Plane
     (3D x, y, z=0) im Marker-Coord-System.
  2. Side-Foto liefert Foot-Profile-Silhouette (top-edge polyline) im
     undistorted-2D-Camera-Frame + Side-Camera-Pose extrinsic (R, T) via PnP
     auf erkannte Markers.
  3. Joint: für jeden Pixel auf Side-Foot-Top-Edge:
       - Cast Ray vom Side-Camera-Center durch undistorted-Pixel
       - Intersect Ray mit Vertical-Plane through foot-LATERAL-line
         (Camera-nah; Silhouette-Top-Edge ist Lateral-Tangent —
         Round-5+6-Critical-Sign-Fix: Medial-Plane wäre Camera-fern und
         würde Höhe systematisch unterschätzen 5-15mm)
       - 3D-Punkt (x,y,z) im Marker-Coord-System
  4. Foot-Height-mm = max(z) along foot-x-axis from joint-points.
     Instep-Height = z(x = midfoot-x).

Sprint-3 Implementation: Algorithmus + Function-Skeleton. Side-Foot-Top-Edge-
Polyline-Extraction ist Phase-3-TODO (braucht segmentation-quality-side-photo
und proper foot-profile-mask). Für jetzt: stub mit foot-bbox-derived-top-edge.
"""

from dataclasses import dataclass
from typing import Optional


@dataclass(frozen=True)
class JointReconstructionResult:
    ok: bool
    error: Optional[str]
    foot_length_mm: Optional[float]
    foot_width_mm: Optional[float]
    ball_width_mm: Optional[float]
    heel_width_mm: Optional[float]
    foot_height_mm: Optional[float]
    instep_height_mm: Optional[float]
    midfoot_x_mm: Optional[float]
    # Diagnostic-fields
    side_camera_center_mm: Optional[dict]
    foot_lateral_line_x_mm: Optional[float]
    side_top_edge_3d_points: list[dict]


def _cast_ray_to_vertical_plane(
    camera_center: list[float],
    ray_direction: list[float],
    plane_x: float,
) -> Optional[tuple[float, float, float]]:
    """Intersect ray (camera_center + t·ray_direction) mit Vertical-Plane x=plane_x.

    Vertical-Plane through line (x=plane_x, y=any, z=any): parametrized als
    {(plane_x, y, z) : y∈ℝ, z∈ℝ}. Plane-equation: x = plane_x, normal (1,0,0).

    Returns 3D-point (x, y, z) oder None wenn Ray parallel zur Plane.
    """
    cx, cy, cz = camera_center
    dx, dy, dz = ray_direction
    if abs(dx) < 1e-9:
        return None  # Ray parallel to plane
    t = (plane_x - cx) / dx
    if t < 0:
        return None  # Plane is behind camera
    return (plane_x, cy + t * dy, cz + t * dz)


def reconstruct_foot_geometry(
    top_result: dict,
    side_result: dict,
    selected_foot: str = "right",
) -> JointReconstructionResult:
    """Joint-Reconstruction aus Top + Side detect-extended-Outputs.

    Args:
        top_result: dict aus detect_extended für Top-Foto (Phase="top").
                    Erwartet foot_bounding_box_marker_coords_mm + heel_position_
                    marker_coords_mm + toe_tip_position_marker_coords_mm.
        side_result: dict aus detect_extended für Side-Foto (Phase="side").
                     Erwartet camera_center_marker_coords_mm + intrinsics
                     + foot_bounding_box_marker_coords_mm.
        selected_foot: "left" oder "right" — bestimmt welche Foot-Edge die
                       Lateral-Edge ist (right-foot lateral = +x edge;
                       left-foot lateral = -x edge).

    Returns:
        JointReconstructionResult mit Foot-Maßen oder error.
    """
    # === 1) Validate Inputs ===
    top_bbox = top_result.get("foot_bounding_box_marker_coords_mm")
    if top_bbox is None or len(top_bbox) != 4:
        return _error("Top-Foto liefert keine foot_bbox in marker-coords")
    heel = top_result.get("heel_position_marker_coords_mm")
    toe = top_result.get("toe_tip_position_marker_coords_mm")
    if heel is None or toe is None:
        return _error("Top-Foto liefert keine heel/toe-positions")

    side_camera = side_result.get("camera_center_marker_coords_mm")
    if side_camera is None:
        return _error("Side-Foto liefert keine camera_center (PnP-Pose-Fail)")

    side_bbox = side_result.get("foot_bounding_box_marker_coords_mm")
    if side_bbox is None or len(side_bbox) != 4:
        return _error("Side-Foto liefert keine foot_bbox in marker-coords")

    # === 2) Top-Foto-Maße (orthographic from Floor-Plane) ===
    foot_x_min, foot_y_min, foot_w_mm, foot_h_mm = top_bbox
    foot_x_max = foot_x_min + foot_w_mm
    foot_y_max = foot_y_min + foot_h_mm

    # Foot-Length: heel-to-toe-distance in y-direction (Floor-Plane). Heel
    # ist näher an Wand (kleinerer y), Toe weiter weg.
    foot_length_mm = abs(toe["y"] - heel["y"])

    # Foot-Width: max-extent in x-direction at ball-position (rough: 2/3 along
    # heel-to-toe). Sprint 3 simplified: full bbox-width.
    foot_width_mm = foot_w_mm

    # Ball-Width: width at 2/3 heel-to-toe — currently same as bbox-width
    # (Sprint-3-stub; Phase-3 nutzt segmentation-mask cross-section)
    ball_width_mm = foot_w_mm

    # Heel-Width: width at heel (1/6 along) — currently 0.7 × bbox-width as
    # heuristic (heel typically narrower than ball)
    heel_width_mm = foot_w_mm * 0.7

    # === 3) Lateral-Line in Marker-Coords (für Joint-Reconstruction) ===
    # selectedFoot=right + Camera-on-right-side (lateral-side):
    #   Lateral-Edge ist right edge of foot in mat-coords = foot_x_max
    # selectedFoot=left + Camera-on-left-side:
    #   Lateral-Edge ist left edge = foot_x_min
    if selected_foot == "right":
        lateral_x = foot_x_max
    else:
        lateral_x = foot_x_min

    # === 4) Side-Foto Top-Edge in Marker-Coords ===
    # Sprint-3-Stub: Side-foot-bbox top-edge wird als horizontal-line bei
    # y=side_bbox_top in marker-coords approximiert. Phase-3 nutzt full
    # segmentation-mask top-edge-polyline.
    #
    # Side-bbox in marker-coords kommt direkt aus detect_extended (mit
    # Inverse-Homography-Warp angewendet). top-y ist also der höchste y-Wert
    # am Foot-Top in 2D-Marker-Plane-Projection — aber Side-Foto sieht den
    # Foot von der Seite, also ist diese 2D-Marker-Coord-Projektion eine
    # Floor-Plane-shadow, NICHT der echte 3D-Foot-Top.
    #
    # ECHTE Lösung: extract Side-Foot-Top-Edge-Pixels aus Side-Foto, cast
    # rays. Sprint-3 stub: assume foot-height proportional zur Apparent-
    # Height-in-Side-Bbox vs. Foot-Length aus Top.
    #
    # Heuristic Sprint-3: foot_height_mm ≈ side_bbox_height_mm * sin(camera-
    # tilt-angle). Wenn Camera horizontal (tilt=0), apparent height = real
    # height. Wenn tilted, height-projection shrinkt um cos(tilt).
    side_bbox_h_mm = side_bbox[3]
    # Rough scaling: für realistic side-photo (Camera horizontal), bbox-height
    # entspricht foot-height. Phase-3 macht echte ray-cast-intersection.
    foot_height_mm = side_bbox_h_mm

    # Instep-Height = foot_height (Sprint-3 simplification — Phase-3 separates
    # Instep-Mid vs Total-Max).
    instep_height_mm = foot_height_mm
    midfoot_x_mm = (foot_x_min + foot_x_max) / 2

    return JointReconstructionResult(
        ok=True,
        error=None,
        foot_length_mm=foot_length_mm,
        foot_width_mm=foot_width_mm,
        ball_width_mm=ball_width_mm,
        heel_width_mm=heel_width_mm,
        foot_height_mm=foot_height_mm,
        instep_height_mm=instep_height_mm,
        midfoot_x_mm=midfoot_x_mm,
        side_camera_center_mm=side_camera,
        foot_lateral_line_x_mm=lateral_x,
        side_top_edge_3d_points=[],  # Phase-3 fills mit ray-cast-points
    )


def _error(msg: str) -> JointReconstructionResult:
    return JointReconstructionResult(
        ok=False,
        error=msg,
        foot_length_mm=None,
        foot_width_mm=None,
        ball_width_mm=None,
        heel_width_mm=None,
        foot_height_mm=None,
        instep_height_mm=None,
        midfoot_x_mm=None,
        side_camera_center_mm=None,
        foot_lateral_line_x_mm=None,
        side_top_edge_3d_points=[],
    )
