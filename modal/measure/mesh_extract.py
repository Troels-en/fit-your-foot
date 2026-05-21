"""Spike 0a: KIRI-Mesh-Measurement-Pipeline.

Extracts foot measurements (length/ball-width/heel-width) from a KIRI-Engine
OBJ-Mesh. Designed for the Premium-Photogrammetry-Mode where KIRI returns
a 3D foot reconstruction.

Algorithm overview:
1. Load OBJ via trimesh
2. Detect ground/mat-plane — for now we assume the mesh-bottom IS the ground
   (KIRI orients mesh with foot standing on the floor). Future: Mat-Plane-
   Detection via ArUco-Marker-Cluster or known scale-reference.
3. Foot-vs-Calf-Isolation: ankle-detection-cascade
   - Primary: Z-Histogram-Inflection-Point (foot transitions to calf at ankle)
   - Fallback: fixed cutoff at 80mm above ground (anthropometric malleolus)
4. Convex-Hull on isolated foot region
5. Heel-Cluster: rear extremum cluster (largest cluster of points within 5mm
   of rear-most Y-coordinate)
6. Toe-Tip: front extremum (single point at frontmost Y)
7. Length = || HeelCenter - ToeTip ||
8. Cross-Section at 70% Length → Ball-Width
9. Cross-Section at 15% Length → Heel-Width

Returns dict with foot_length_mm / ball_width_mm / heel_width_mm + confidence-
flags + diagnostic-info.

Spike-Goal: validate that ±3mm Length-Extraction is achievable on real KIRI
meshes. Run against:
- The existing chimera-blob mesh (test-bench, expected: garbage out because
  input is garbage)
- Ideally: 1-2 real-world KIRI scans with ground-truth Brannock measurements
"""

from __future__ import annotations

import io
from dataclasses import dataclass
from typing import Optional

import numpy as np
import trimesh


# Anthropometric constants (95th-percentile adult, in mm)
ANATOMIC_ANKLE_HEIGHT_FALLBACK_MM = 80.0
HEEL_CLUSTER_RADIUS_MM = 5.0
BALL_CROSS_SECTION_FRACTION = 0.70  # 70% from heel
HEEL_CROSS_SECTION_FRACTION = 0.15  # 15% from heel


@dataclass
class ExtractionResult:
    foot_length_mm: float
    ball_width_mm: float
    heel_width_mm: float
    confidence: str  # "high" | "medium" | "low"
    diagnostics: dict


@dataclass
class ExtractionFailure:
    reason: str
    diagnostics: dict


def extract_measurements_from_obj_bytes(
    obj_bytes: bytes,
    scale_factor_to_mm: float = 1000.0,
    vertical_axis: int = 2,
) -> ExtractionResult | ExtractionFailure:
    """Main entry point. Loads OBJ from bytes, runs full pipeline.

    Args:
        obj_bytes: raw OBJ file content
        scale_factor_to_mm: multiplier to convert mesh units to mm.
            KIRI-Engine outputs in unitless space (no real-world scale by
            default — it normalizes meshes to ~1.0 unit dimension). For
            real-world calibration we need an external reference (mat,
            known marker). Default 1000 assumes mesh-units are meters.
        vertical_axis: which axis (0=X, 1=Y, 2=Z) is vertical (gravity).
            Default 2 (Z-up), which is KIRI's convention. We do NOT auto-
            detect via argmin(extents) because that picks the foot's
            width-axis (typically smallest) instead of vertical when
            calf-stub adds height (foot+calf combined extent on Z is
            larger than width).

    Returns ExtractionResult on success, ExtractionFailure on detectable
    pipeline failures (no foot found, no clear ankle, etc.).
    """
    try:
        scene = trimesh.load(io.BytesIO(obj_bytes), file_type="obj", force="scene")
    except Exception as e:
        return ExtractionFailure(reason=f"load_failed: {e}", diagnostics={})

    if isinstance(scene, trimesh.Scene):
        try:
            mesh = scene.dump(concatenate=True)
        except Exception as e:
            return ExtractionFailure(reason=f"scene_dump_failed: {e}", diagnostics={})
    else:
        mesh = scene

    if not hasattr(mesh, "vertices") or len(mesh.vertices) == 0:
        return ExtractionFailure(reason="no_vertices", diagnostics={})

    return _extract_from_mesh(mesh, scale_factor_to_mm, vertical_axis)


def _extract_from_mesh(
    mesh: trimesh.Trimesh,
    scale_factor_to_mm: float,
    vertical_axis: int,
) -> ExtractionResult | ExtractionFailure:
    """Algorithm-internal — pre-loaded mesh, run full pipeline."""
    diag: dict = {
        "vertex_count": int(len(mesh.vertices)),
        "face_count": int(len(mesh.faces)) if hasattr(mesh, "faces") else 0,
        "bbox_extents_raw": mesh.extents.tolist(),
    }

    # Step 1: Orient mesh — ground-plane is at min-Z. KIRI typically outputs
    # mesh with Y-up or Z-up depending on settings; we detect the "vertical"
    # axis as the smallest extent direction (foot is short in vertical).
    # For initial spike, assume Z-up (gravity along -Z). Future: detect via
    # mat-plane or PCA.
    vertices = mesh.vertices.copy()
    bbox_min = vertices.min(axis=0)
    bbox_max = vertices.max(axis=0)
    extents = bbox_max - bbox_min

    diag["vertical_axis_used"] = vertical_axis
    diag["axis_extent_ratios"] = (extents / extents.max()).tolist()

    # Anti-pattern check: if all extents are within 20% of each other, the
    # mesh is cubic-blob-like, not foot-shaped. Real foot has 3:1.5:1 ratio.
    aspect_ratio = extents.max() / max(extents.min(), 1e-9)
    diag["aspect_ratio_max_min"] = float(aspect_ratio)
    if aspect_ratio < 1.8:
        # Not foot-shaped at all — chimera-blob territory
        return ExtractionFailure(
            reason="mesh_not_foot_shaped (cubic blob)",
            diagnostics=diag,
        )

    # Translate so ground is at z=0 (or whatever vertical-axis is at 0)
    vertices_centered = vertices - bbox_min

    # Step 2: Foot-vs-Calf-Isolation (ankle-detection-cascade)
    ankle_z = _detect_ankle_height(vertices_centered, vertical_axis, diag)
    if ankle_z is None:
        # Fallback: use fixed anthropometric cutoff (in mesh units)
        # We need scale_factor_to_mm to know what 80mm means in mesh units.
        # Inverse: 80mm / scale_factor_to_mm = 80/1000 = 0.08 if mesh in meters
        ankle_z_mesh_units = ANATOMIC_ANKLE_HEIGHT_FALLBACK_MM / scale_factor_to_mm
        diag["ankle_method"] = "anthropometric_fallback"
        diag["ankle_z_mesh_units"] = float(ankle_z_mesh_units)
    else:
        ankle_z_mesh_units = ankle_z
        diag["ankle_method"] = "z_histogram_inflection"
        diag["ankle_z_mesh_units"] = float(ankle_z)

    # Filter to foot region (below ankle)
    foot_mask = vertices_centered[:, vertical_axis] <= ankle_z_mesh_units
    foot_vertices = vertices_centered[foot_mask]
    diag["foot_vertex_count_after_isolation"] = int(len(foot_vertices))

    if len(foot_vertices) < 100:
        return ExtractionFailure(
            reason=f"too_few_foot_vertices_after_ankle_cutoff ({len(foot_vertices)})",
            diagnostics=diag,
        )

    # Step 3: Identify horizontal axes (length + width)
    # Length-axis = horizontal axis with larger extent
    horizontal_axes = [a for a in range(3) if a != vertical_axis]
    foot_extents_h = [foot_vertices[:, a].max() - foot_vertices[:, a].min() for a in horizontal_axes]
    if foot_extents_h[0] >= foot_extents_h[1]:
        length_axis = horizontal_axes[0]
        width_axis = horizontal_axes[1]
    else:
        length_axis = horizontal_axes[1]
        width_axis = horizontal_axes[0]
    diag["length_axis"] = length_axis
    diag["width_axis"] = width_axis

    # Step 4: Find Heel + Toe — extrema along length-axis
    length_coords = foot_vertices[:, length_axis]
    rear_z = length_coords.min()
    front_z = length_coords.max()

    # Heel-Cluster: vertices within HEEL_CLUSTER_RADIUS of rear extremum.
    # Used for ROBUSTNESS — gives info about heel-shape spread + cluster-size
    # for confidence-scoring. But for LENGTH-MEASUREMENT we use the actual
    # extrema (rear_z and front_z) along the length-axis directly. Using
    # cluster-mean would systematically underestimate length by ~cluster-radius.
    heel_radius_mesh = HEEL_CLUSTER_RADIUS_MM / scale_factor_to_mm
    heel_mask = (length_coords - rear_z) < heel_radius_mesh
    heel_cluster = foot_vertices[heel_mask]
    if len(heel_cluster) == 0:
        return ExtractionFailure(reason="no_heel_cluster", diagnostics=diag)
    diag["heel_cluster_size"] = int(len(heel_cluster))

    toe_mask = (front_z - length_coords) < heel_radius_mesh
    toe_cluster = foot_vertices[toe_mask]
    if len(toe_cluster) == 0:
        return ExtractionFailure(reason="no_toe_cluster", diagnostics=diag)
    diag["toe_cluster_size"] = int(len(toe_cluster))

    # Step 5: Length = direct extent along length-axis (extrema-to-extrema).
    # Lateral position of heel/toe doesn't matter for length — only the
    # length-axis projection-distance.
    foot_length_mesh = float(front_z - rear_z)
    foot_length_mm = foot_length_mesh * scale_factor_to_mm
    diag["foot_length_mesh_units"] = foot_length_mesh

    # Step 6: Cross-Sections for Ball + Heel Width
    ball_z = rear_z + (front_z - rear_z) * BALL_CROSS_SECTION_FRACTION
    heel_z = rear_z + (front_z - rear_z) * HEEL_CROSS_SECTION_FRACTION

    ball_width_mm = _cross_section_width(
        foot_vertices, length_axis, width_axis, ball_z, foot_length_mesh
    ) * scale_factor_to_mm
    heel_width_mm = _cross_section_width(
        foot_vertices, length_axis, width_axis, heel_z, foot_length_mesh
    ) * scale_factor_to_mm

    # Confidence-Score:
    #  - high: aspect_ratio > 2.5 AND inflection-method ankle AND big clusters
    #  - medium: aspect_ratio > 2.0 AND clusters > 50
    #  - low: anything else
    if (
        aspect_ratio > 2.5
        and diag["ankle_method"] == "z_histogram_inflection"
        and len(heel_cluster) > 50
        and len(toe_cluster) > 20
    ):
        confidence = "high"
    elif aspect_ratio > 2.0 and len(heel_cluster) > 20:
        confidence = "medium"
    else:
        confidence = "low"

    return ExtractionResult(
        foot_length_mm=foot_length_mm,
        ball_width_mm=ball_width_mm,
        heel_width_mm=heel_width_mm,
        confidence=confidence,
        diagnostics=diag,
    )


def _detect_ankle_height(
    vertices: np.ndarray,
    vertical_axis: int,
    diag: dict,
) -> Optional[float]:
    """Z-Histogram-Inflection-Point for Ankle-Detection.

    Approach: histogram of vertical-axis-coords. Foot has ~constant cross-
    section-area at given heights, but at ankle the cross-section narrows
    sharply (foot transitions to calf). This shows up as a local minimum
    in the cross-section-width vs height curve.

    Returns mesh-unit z-coordinate of detected ankle, or None if not
    detectable with high confidence.
    """
    z_coords = vertices[:, vertical_axis]
    z_min = z_coords.min()
    z_max = z_coords.max()
    z_range = z_max - z_min

    if z_range == 0:
        return None

    # Histogram bins covering bottom 80% (foot + lower-leg-stub typical KIRI output)
    n_bins = 30
    bin_edges = np.linspace(z_min, z_min + z_range * 0.8, n_bins + 1)
    bin_widths = []  # cross-section-bbox-width at each height-bin
    for i in range(n_bins):
        mask = (z_coords >= bin_edges[i]) & (z_coords < bin_edges[i + 1])
        bin_verts = vertices[mask]
        if len(bin_verts) < 3:
            bin_widths.append(0.0)
            continue
        # Use bbox-extent of this slice in horizontal axes
        h_axes = [a for a in range(3) if a != vertical_axis]
        slice_extent = np.linalg.norm(
            bin_verts[:, h_axes].max(axis=0) - bin_verts[:, h_axes].min(axis=0)
        )
        bin_widths.append(float(slice_extent))

    bin_widths_arr = np.array(bin_widths)
    diag["z_histogram_widths"] = bin_widths_arr.tolist()

    # Look for a clear local minimum in upper-half of the histogram (above
    # the foot-region). Foot is widest near the ball, narrows at ankle.
    # We search for: max-width-in-upper-half - min-width-in-upper-half > 30%
    # of max-width (= clear inflection signature).
    upper_half = bin_widths_arr[n_bins // 2:]
    if len(upper_half) < 3 or upper_half.max() == 0:
        diag["ankle_inflection_confidence"] = "low_no_signal"
        return None

    width_drop = upper_half.max() - upper_half.min()
    relative_drop = width_drop / max(upper_half.max(), 1e-9)
    diag["ankle_inflection_relative_drop"] = float(relative_drop)

    if relative_drop < 0.3:
        diag["ankle_inflection_confidence"] = "low_no_clear_minimum"
        return None

    # Take the bin where the minimum is reached (counting from upper-half start)
    min_idx_in_upper = int(np.argmin(upper_half))
    ankle_bin = (n_bins // 2) + min_idx_in_upper
    ankle_z = (bin_edges[ankle_bin] + bin_edges[ankle_bin + 1]) / 2.0
    diag["ankle_inflection_confidence"] = "high"
    return float(ankle_z)


def _cross_section_width(
    vertices: np.ndarray,
    length_axis: int,
    width_axis: int,
    target_length: float,
    foot_length: float,
) -> float:
    """Compute width of mesh at given length-position.

    Picks vertices within ±2.5% of foot_length around target_length and
    measures their extent along width-axis.
    """
    slice_thickness = foot_length * 0.025
    length_coords = vertices[:, length_axis]
    mask = np.abs(length_coords - target_length) < slice_thickness
    slice_verts = vertices[mask]
    if len(slice_verts) < 3:
        return 0.0
    width_coords = slice_verts[:, width_axis]
    return float(width_coords.max() - width_coords.min())
