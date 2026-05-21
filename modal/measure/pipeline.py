"""Top-level orchestrator. Takes raw image bytes (top + side) and returns
Measurements + warnings.

All errors that indicate a user-retake-able problem should surface as the
custom exception classes already defined in submodules (A4NotFoundError,
FootNotFoundError). The FastAPI layer maps those to HTTP 422 with a clear
issue code; anything else → 500.
"""

from __future__ import annotations

import io

import numpy as np
from PIL import Image

from . import a4, segment
from .fuse import combine
from .measure_side import measure_side
from .measure_top import measure_top
from .models import Measurements


def measure_feet(photo_top_bytes: bytes, photo_side_bytes: bytes) -> tuple[Measurements, list[str]]:
    img_top = _decode(photo_top_bytes)
    img_side = _decode(photo_side_bytes)
    pipeline_warnings: list[str] = []

    # TOP (required) — needs A4 for scale
    det_top = a4.detect_a4(img_top, rectify=True)
    top_canvas = det_top.rectified if det_top.rectified is not None else img_top
    mask_top = segment.segment_foot(top_canvas, view="top")
    if segment.mask_touches_border(mask_top):
        pipeline_warnings.append(
            "Fuß auf dem Top-Foto berührt den Bildrand — Länge möglicherweise ungenau."
        )
    top_results = measure_top(mask_top, det_top.mm_per_px)

    # SIDE (optional) — A4 often obscured or poorly lit from low angle; degrade
    # gracefully if it can't be read, rather than failing the whole request.
    side_results = None
    try:
        det_side = a4.detect_a4(img_side, rectify=False)
        mask_side = segment.segment_foot(img_side, view="side")
        if segment.mask_touches_border(mask_side):
            pipeline_warnings.append(
                "Fuß auf dem Seiten-Foto berührt den Bildrand — Höhe möglicherweise ungenau."
            )
        side_results = measure_side(mask_side, det_side.mm_per_px)
    except a4.A4NotFoundError:
        pipeline_warnings.append(
            "A4 auf dem Seiten-Foto nicht erkannt — Bogenhöhe/Spann bleibt ein Durchschnittswert."
        )
    except segment.FootNotFoundError:
        pipeline_warnings.append(
            "Fuß auf dem Seiten-Foto nicht erkannt — Bogenhöhe/Spann bleibt ein Durchschnittswert."
        )

    measurements, combine_warnings = combine(top_results, side_results)
    return measurements, pipeline_warnings + combine_warnings


def _decode(raw: bytes) -> np.ndarray:
    img = Image.open(io.BytesIO(raw)).convert("RGB")
    return np.array(img)
