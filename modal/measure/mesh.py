"""Personalized 3D foot mesh generation.

Loads a base glTF (public/models/foot.glb) and scales it UNIFORMLY so the
longest extent matches the user's measured foot length. This preserves
the anatomical proportions of the original model — we don't know which
axis in the source represents length vs width vs height, and getting it
wrong distorts the mesh. Uniform scaling is safe and still gives a
correctly-sized foot visualization.

Returns a glTF-binary (.glb) ready for three.js / react-three-fiber.

Phase-2 (later): detect the length axis reliably from mesh topology (foot
has a clear heel→toe axis) and apply per-axis scaling for a
length × width × height personalized shape.
"""

from __future__ import annotations

import io

import numpy as np
import trimesh

BASE_MESH_PATH = "/root/models/foot.glb"


def deform_foot(
    foot_length_mm: float,
    foot_width_mm: float,
    instep_height_mm: float | None,
) -> bytes:
    """Return a glb byte string of the base foot mesh uniformly scaled to length."""

    target_length_m = foot_length_mm / 1000.0

    # Load as a Scene and bake all node transforms into a single concatenated
    # mesh. `scene.dump()` walks the scene graph and applies each node's
    # transform to its geometry, so we work with the final visual shape
    # instead of raw geometries that would miss their scene-level placement.
    scene = trimesh.load(BASE_MESH_PATH, file_type="glb", force="scene")
    if isinstance(scene, trimesh.Scene):
        mesh = scene.dump(concatenate=True)
    else:
        mesh = scene

    if not hasattr(mesh, "vertices"):
        raise RuntimeError(f"base mesh has no vertices (got {type(mesh).__name__})")

    # Longest current extent is assumed to be the length axis (typical for
    # foot assets). We scale everything by the same factor so proportions
    # survive.
    extents = mesh.extents
    current_length = float(np.max(extents))
    if current_length <= 0:
        raise RuntimeError("base mesh has zero extent")

    scale_factor = target_length_m / current_length

    # Center on origin first, scale, then leave it at origin. The front-end
    # camera will framework-center the mesh anyway.
    center = (mesh.bounds[0] + mesh.bounds[1]) / 2.0
    T1 = trimesh.transformations.translation_matrix(-center)
    S = np.eye(4)
    S[0, 0] = S[1, 1] = S[2, 2] = scale_factor
    M = S @ T1
    mesh.apply_transform(M)

    buf = io.BytesIO()
    mesh.export(buf, file_type="glb")
    return buf.getvalue()
