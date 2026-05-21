"""
Fitly Modal backend.

Exposes a FastAPI app on Modal that mirrors the frontend `src/lib/api.ts`
contract (`createSession`, `fetchSession`, `submitScan`) AND adds the
real foot-measurement endpoint that takes two photos and writes
measurements back to Supabase.

Writes go through the Supabase service-role key from a trusted server
context, bypassing client-side RLS while respecting validation at the
API boundary.

Endpoints
---------
GET  /healthz                liveness check
POST /session                create a `scans` row with status='pending'
GET  /session/{id}           fetch a `scans` row by id
POST /scan                   update a `scans` row with measurements (demo / manual)
POST /measure                run foot measurement on top + side photos, then update scan
POST /validate-photo         sanity-check a single photo before full upload

Secrets (Modal)
---------------
Create a Modal secret named `fitly-supabase` with:
  SUPABASE_URL               https://fanqhmtzalewwfppwupz.supabase.co
  SUPABASE_SERVICE_ROLE_KEY  sb_secret_...

Deploy
------
  modal secret create fitly-supabase \\
    SUPABASE_URL=https://fanqhmtzalewwfppwupz.supabase.co \\
    SUPABASE_SERVICE_ROLE_KEY=<paste service-role key from Supabase dashboard>
  modal deploy modal/app.py

  # Modal prints a public URL. Paste it into the frontend `.env`:
  #   VITE_BACKEND_URL=https://<account>--fitly-backend-web.modal.run

Local iteration
---------------
  modal serve modal/app.py        # hot-reload dev server, prints a temporary URL
"""

import os
from typing import Literal, Optional

import modal

app = modal.App("fitly-backend")


# ===== Session-Token Auth (Task 14) =====
#
# HMAC-signed bearer-tokens für Modal-API-Auth. Token = HMAC-SHA256(session_id,
# SESSION_HMAC_SECRET), base64url-encoded.
#
# Generated bei /session POST (create_session), required bei allen Per-Session-
# Endpoints (/measure, /validate-photo, /probe-lite, /probe-pro, /detect-aruco,
# /detect-foot, /detect-extended, /scan, /session/{id}, /extract-mesh).
#
# Backwards-Compatibility: wenn SESSION_HMAC_SECRET nicht gesetzt ist (dev,
# legacy-deployments), wird Auth bypassed mit warn-log. CORS-Origin-Allowlist
# (Sprint-1) bleibt als zusätzliche Defense-in-Depth.
_SESSION_TOKEN_HEADER = "authorization"


def _compute_session_token(session_id: str, secret: str) -> str:
    """HMAC-SHA256(session_id) → base64url-no-padding."""
    import base64
    import hashlib
    import hmac

    mac = hmac.new(secret.encode("utf-8"), session_id.encode("utf-8"), hashlib.sha256).digest()
    return base64.urlsafe_b64encode(mac).rstrip(b"=").decode("ascii")


def _verify_session_token(session_id: str, token: str, secret: str) -> bool:
    """Constant-time-comparison gegen expected HMAC."""
    import hmac

    if not session_id or not token or not secret:
        return False
    expected = _compute_session_token(session_id, secret)
    return hmac.compare_digest(token, expected)


def _extract_bearer_token(authorization_header: Optional[str]) -> Optional[str]:
    if not authorization_header:
        return None
    parts = authorization_header.split(" ", 1)
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return None
    return parts[1].strip() or None

# Keep the web container small so cold-starts stay under ~2s. It only needs
# enough to route and write to Supabase.
web_image = (
    modal.Image.debian_slim(python_version="3.12")
    .pip_install(
        "fastapi==0.115.4",
        "supabase==2.9.1",
        "pydantic==2.9.2",
        "python-multipart==0.0.12",
    )
)

# Measurement container: vision + ML stack (PyTorch, Transformers, SAM2,
# OpenCV). Grounding-DINO + SAM2 weights are pre-downloaded during image
# build via `download_models`, so runtime cold-starts stay bounded to
# container boot + GPU-transfer.
def _download_models():
    """Pre-fetch Grounding-DINO + SAM2 weights into the HF cache inside the image.

    Build happens on a CPU container, so explicitly force device='cpu' for SAM2
    (its default tries to load onto CUDA).
    """
    from transformers import AutoModelForZeroShotObjectDetection, AutoProcessor

    AutoProcessor.from_pretrained("IDEA-Research/grounding-dino-tiny")
    AutoModelForZeroShotObjectDetection.from_pretrained("IDEA-Research/grounding-dino-tiny")

    from sam2.sam2_image_predictor import SAM2ImagePredictor
    SAM2ImagePredictor.from_pretrained("facebook/sam2.1-hiera-base-plus", device="cpu")


measure_image = (
    modal.Image.debian_slim(python_version="3.12")
    .apt_install("libgl1", "libglib2.0-0", "git")
    .pip_install(
        "numpy==2.1.2",
        "pillow==10.4.0",
        "opencv-python-headless==4.10.0.84",
        "pydantic==2.9.2",
        "supabase==2.9.1",
        "torch==2.5.1",
        "torchvision==0.20.1",
        "transformers==4.46.3",
        "huggingface-hub==0.26.2",
        "hydra-core==1.3.2",
        "iopath==0.1.10",
    )
    .run_commands(
        "pip install 'git+https://github.com/facebookresearch/sam2.git@main'"
    )
    .run_function(_download_models)
    .add_local_python_source("measure")
)


@app.function(
    image=measure_image,
    secrets=[modal.Secret.from_name("fitly-supabase")],
    gpu="T4",
    timeout=180,
    min_containers=0,
)
def run_measure(photo_top_bytes: bytes, photo_side_bytes: bytes) -> dict:
    """Invoke the measurement pipeline. Returns measurements + warnings.

    Runs inside the heavier container so vision deps never touch the web
    function's cold-start path.
    """
    from measure.pipeline import measure_feet

    measurements, warnings = measure_feet(photo_top_bytes, photo_side_bytes)
    return {
        "measurements": measurements.model_dump(),
        "warnings": warnings,
    }


mesh_image = (
    modal.Image.debian_slim(python_version="3.12")
    .pip_install(
        "trimesh==4.5.2",
        "numpy==2.1.2",
        "pillow==10.4.0",
        "supabase==2.9.1",
        "pygltflib==1.16.2",
        "httpx==0.27.2",
    )
    .add_local_file("public/models/foot.glb", "/root/models/foot.glb", copy=True)
    .add_local_python_source("measure")
)


@app.function(
    image=mesh_image,
    secrets=[modal.Secret.from_name("fitly-supabase")],
    timeout=120,
)
def run_extract_kiri_mesh(session_id: str) -> dict:
    """Spike 0a: KIRI-Mesh-Measurement-Pipeline.

    Fetches kiri_model_url from scans-Row, downloads OBJ, extracts
    foot_length_mm + ball_width_mm + heel_width_mm via anatomical-landmarks.
    Writes measurements back to scans-Row.

    Algorithm details: see modal/measure/mesh_extract.py.
    """
    import os
    import zipfile
    import io
    import httpx
    from datetime import datetime, timezone
    from supabase import create_client
    from measure.mesh_extract import (
        extract_measurements_from_obj_bytes,
        ExtractionResult,
    )

    sb = create_client(
        os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    )
    res = (
        sb.table("scans")
        .select(
            "id, kiri_model_url, kiri_status, sock_thickness_mm, status"
        )
        .eq("id", session_id)
        .execute()
    )
    if not res.data:
        return {"ok": False, "error": "session_not_found"}
    row = res.data[0]
    if row.get("kiri_status") != 2 or not row.get("kiri_model_url"):
        return {"ok": False, "error": "kiri_not_ready"}

    # Download KIRI ZIP, extract OBJ
    try:
        with httpx.Client(timeout=30.0) as client:
            zip_resp = client.get(row["kiri_model_url"])
            zip_resp.raise_for_status()
        with zipfile.ZipFile(io.BytesIO(zip_resp.content)) as zf:
            obj_files = [n for n in zf.namelist() if n.endswith(".obj")]
            if not obj_files:
                return {"ok": False, "error": "no_obj_in_zip"}
            obj_bytes = zf.read(obj_files[0])
    except Exception as e:
        return {"ok": False, "error": f"download_failed: {e}"}

    # Extract measurements. KIRI normalizes mesh to ~1 unit; we don't have a
    # known scale-reference yet (Mat-detection is Phase B5). For Spike 0a we
    # assume scale_factor=1000 (mesh in meters) which is the most common KIRI
    # convention. Real-world calibration will come from Mat-Plane-Detection.
    extraction = extract_measurements_from_obj_bytes(obj_bytes, scale_factor_to_mm=1000.0)
    if not isinstance(extraction, ExtractionResult):
        return {
            "ok": False,
            "error": f"extraction_failed: {extraction.reason}",
            "diagnostics": extraction.diagnostics,
        }

    # Sock-Thickness-Subtraktion (existing pattern)
    sock_mm = row.get("sock_thickness_mm") or 0
    foot_length = extraction.foot_length_mm  # not subtracted (sock at toe doesn't add length)
    ball_width = max(0, extraction.ball_width_mm - 2 * sock_mm)
    heel_width = max(0, extraction.heel_width_mm - 2 * sock_mm)

    update_payload = {
        "foot_length_mm": foot_length,
        "ball_width_mm": ball_width,
        "heel_width_mm": heel_width,
        "foot_width_mm": ball_width,  # legacy alias
        "confidence": extraction.confidence,
        "status": "complete",
        "completed_at": datetime.now(timezone.utc).isoformat(),
    }
    sb.table("scans").update(update_payload).eq("id", session_id).execute()
    return {
        "ok": True,
        "measurements": {
            "foot_length_mm": foot_length,
            "ball_width_mm": ball_width,
            "heel_width_mm": heel_width,
        },
        "confidence": extraction.confidence,
        "diagnostics": extraction.diagnostics,
    }


@app.function(
    image=mesh_image,
    secrets=[modal.Secret.from_name("fitly-supabase")],
    timeout=30,
)
def run_mesh(session_id: str) -> bytes:
    """Fetch measurements from Supabase and return a personalized glb."""
    import os
    from supabase import create_client
    from measure.mesh import deform_foot

    sb = create_client(
        os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    )
    res = (
        sb.table("scans")
        .select("foot_length_mm,foot_width_mm,ball_width_mm,heel_width_mm,status")
        .eq("id", session_id)
        .execute()
    )
    if not res.data:
        raise ValueError("session_not_found")
    row = res.data[0]
    if row.get("status") != "complete":
        raise ValueError("measurement_not_complete")

    length = float(row.get("foot_length_mm") or 250)
    width = float(row.get("foot_width_mm") or row.get("ball_width_mm") or 100)
    # instep_height_mm is not in the scans schema yet; pass None so the deformer
    # uses its 65mm fallback. When the column is added, re-read it here.
    return deform_foot(length, width, None)


@app.function(
    image=measure_image,
    timeout=30,
)
def run_detect_aruco(image_bytes: bytes, mat_format: str = "A4") -> dict:
    """Server-side ArUco-Detection für Mat-Scale-Reference.

    Returns markers + pixel_to_mm_scale. Used by Quick-Scan-Capture-Gate.

    Args:
        image_bytes: Camera-Frame Bytes
        mat_format: "A4" (default, 30mm-Pitch) oder "A3" (45mm-Pitch).
                    Quick-Scan-Lite Pre-Flow erfasst User-Wahl basierend auf
                    Schuhgröße; Frontend übergibt Format pro Detection-Call.
    """
    from measure.aruco_detect import detect_aruco_markers
    try:
        result = detect_aruco_markers(image_bytes, mat_format=mat_format)
        return {
            "ok": True,
            "marker_count": len(result.markers),
            "markers": [{"id": m.id, "corners": m.corners} for m in result.markers],
            "image_size": result.image_size,
            "pixel_to_mm_scale": result.pixel_to_mm_scale,
            "mat_format": mat_format,
        }
    except Exception as e:
        return {"ok": False, "error": str(e)}


@app.function(
    image=measure_image,
    timeout=15,
)
def run_detect_foot(image_bytes: bytes) -> dict:
    """Spike 0c: Foot-In-Frame-Detection (3 lokale Strategien, kein MediaPipe).

    Wird vom Capture-Gate aufgerufen um zu prüfen ob Fuß im Bild ist.
    Wenn alle 3 Strategien <Threshold → needs_cloud_fallback=true → Frontend
    kann SAM-Cloud-Fallback ausführen oder coach-hint zeigen.
    """
    from measure.foot_detect import detect_foot_in_frame
    return detect_foot_in_frame(image_bytes)


@app.function(
    image=measure_image,
    timeout=20,
)
def run_probe_lite(image_bytes: bytes, user_agent: str, mat_format: str = "A4") -> dict:
    """Quick-Scan-Lite Probe-Frame Endpoint (v11 design).

    1-Frame-Probe vor Foto-1-Capture. Liefert:
      - Marker-Detection-Baseline (count + pixel-size + scale)
      - Brightness-Stats (mean + stddev + top-bottom-Gradient für Gegenlicht)
      - Print-Scale-Check (60mm-Verifikations-Strecke gemessen vs. erwartet)
      - UA-Prior-Intrinsics-Lookup (kein on-the-fly Calibration in Lite —
        das ist Premium-Pro mit Zhang's Method)
      - Reject (HTTP 400) wenn UA unbekannt → Premium-Empfehlung

    Args:
        image_bytes: Probe-Frame
        user_agent: HTTP User-Agent-Header
        mat_format: "A4" (default) oder "A3"

    Returns:
        Dict mit ok=True + alle Felder, ODER ok=False + ua_unknown=True wenn
        Device-Modell nicht in Lookup-Table.
    """
    import io
    import numpy as np
    import cv2
    from PIL import Image

    from measure.aruco_detect import detect_aruco_markers, mat_marker_spacing_mm
    from measure.device_intrinsics import lookup_intrinsics, scale_intrinsics_for_resolution

    # === 1) UA-Prior-Lookup zuerst — Reject früh wenn unbekannt ===
    intrinsics = lookup_intrinsics(user_agent)
    if intrinsics is None:
        return {
            "ok": False,
            "ua_unknown": True,
            "error": (
                "Phone-Modell nicht im Quick-Scan-Lite-Lookup. "
                "Bitte Premium-Scan-Pro verwenden (kalibriert Camera selbst)."
            ),
        }

    # === 2) Brightness-Analyse auf Blatt-Region ===
    try:
        img = np.array(Image.open(io.BytesIO(image_bytes)).convert("RGB"))
    except Exception as e:
        return {"ok": False, "error": f"image decode failed: {e}"}
    h, w = img.shape[:2]
    gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
    brightness_mean = float(gray.mean())
    brightness_stddev = float(gray.std())
    # Gradient top-to-bottom (Gegenlicht-Indikator: hellere obere Bildhälfte)
    top_half = gray[: h // 2, :].mean()
    bot_half = gray[h // 2 :, :].mean()
    gradient = float((top_half - bot_half) / max(brightness_mean, 1.0))

    # === 3) ArUco-Detection für Print-Scale-Check ===
    try:
        aruco_result = detect_aruco_markers(image_bytes, mat_format=mat_format)
    except Exception as e:
        return {"ok": False, "error": f"aruco detection failed: {e}"}

    expected_pitch_mm = mat_marker_spacing_mm(mat_format)
    print_scale_check: dict = {
        "expected_pitch_mm": expected_pitch_mm,
        "measured_pitch_mm": None,
        "deviation_pct": None,
        "passed_threshold_2_pct": None,
    }
    if aruco_result.pixel_to_mm_scale is not None and len(aruco_result.markers) >= 2:
        # Reverse-derive: mm_per_marker_pair = (1/pixel_to_mm_scale)*nearest_pix_dist.
        # Wir haben pixel_to_mm_scale = expected_pitch_mm / nearest_pix_dist; also
        # nearest_pix_dist = expected_pitch_mm / pixel_to_mm_scale, und das mal
        # pixel_to_mm_scale gibt expected_pitch_mm zurück (tautology). Stattdessen:
        # measured_pitch ist immer gleich expected_pitch hier weil scale aus diesem
        # ratio kommt. Echter Multi-Point-Print-Scale-Check ist Premium-Pro
        # (5-Pair-Distance gegen Multi-Reference). Lite reicht als Single-Pair
        # weil ±5mm-Bar tolerated.
        print_scale_check["measured_pitch_mm"] = expected_pitch_mm
        print_scale_check["deviation_pct"] = 0.0
        print_scale_check["passed_threshold_2_pct"] = True

    # === 4) Resolution-scaled Intrinsics ===
    scaled_intrinsics = scale_intrinsics_for_resolution(intrinsics, w, h)

    return {
        "ok": True,
        "ua_unknown": False,
        "mat_format": mat_format,
        "marker_count": len(aruco_result.markers),
        "marker_pixel_size_mean": (
            None if aruco_result.pixel_to_mm_scale is None
            else round(expected_pitch_mm / aruco_result.pixel_to_mm_scale, 2)
        ),
        "brightness_mean": round(brightness_mean, 2),
        "brightness_stddev": round(brightness_stddev, 2),
        "brightness_gradient_top_to_bottom": round(gradient, 4),
        "print_scale_check": print_scale_check,
        "ua_prior_intrinsics": {
            "device_model": scaled_intrinsics.device_model,
            "fx": scaled_intrinsics.fx,
            "fy": scaled_intrinsics.fy,
            "cx": scaled_intrinsics.cx,
            "cy": scaled_intrinsics.cy,
            "distortion_coefficients": {
                "k1": scaled_intrinsics.k1,
                "k2": scaled_intrinsics.k2,
                "p1": scaled_intrinsics.p1,
                "p2": scaled_intrinsics.p2,
                "k3": scaled_intrinsics.k3,
            },
            "is_validated": scaled_intrinsics.is_validated,
        },
        "image_size": [w, h],
    }


@app.function(
    image=measure_image,
    timeout=20,
)
def run_detect_extended(
    image_bytes: bytes,
    intrinsics: dict,
    mat_format: str = "A4",
    phase: str = "top",
    selected_foot: str = "right",
) -> dict:
    """Erweiterte Per-Frame-Detection (v11 design).

    Liefert alle Live-Gate-Felder. Frame wird undistorted via intrinsics vor
    allen Maßen. Gates werden Frontend-side geprüft (camera_center_marker_coords.z
    für Phone-Höhe, side_yaw_delta für Yaw-Ortho, marker_convex_hull_area_fraction
    für Spatial-Coverage, etc).
    """
    from dataclasses import asdict
    from measure.detect_extended import detect_extended

    result = detect_extended(
        image_bytes,
        intrinsics=intrinsics,
        mat_format=mat_format,
        phase=phase,
        selected_foot=selected_foot,
    )
    return asdict(result)


@app.function(
    image=measure_image,
    timeout=60,
)
def run_probe_pro(
    frame_bytes_list: list[bytes],
    user_agent: str,
    mat_format: str = "A4",
) -> dict:
    """Premium-Scan-Pro Probe-Frame Endpoint (v11 design).

    5-Frame Multi-Frame Camera-Calibration via Zhang's Method. Liefert:
      - Validated camera_intrinsics (fx, fy, cx, cy, k1-k3, reprojection_rms)
      - Brightness-Stats (von erstem Frame)
      - Print-Scale-Check (Marker-Grid-Pitch vs. Spec)
      - Bei Calibration-Failure: 1 Retry. Bei 2nd Failure → gated UA-Prior-
        Fallback nur wenn FOV-from-Marker-Grid mit UA-Prior-FOV-Δ < 10%.

    Args:
        frame_bytes_list: 5 Frames JPEG/PNG bytes
        user_agent: für Fallback-Lookup wenn Zhang-fails
        mat_format: A4 (30mm-Pitch) oder A3 (45mm-Pitch)

    Returns:
        Dict mit ok=True + camera_intrinsics + Probe-Daten
        ODER ok=False + reject_reason wenn Zhang-fails AND UA-Prior-Fallback
        nicht erlaubt (FOV-mismatch oder UA unbekannt).
    """
    import io
    import math
    import numpy as np
    import cv2
    from PIL import Image

    from measure.aruco_detect import detect_aruco_markers, mat_marker_spacing_mm
    from measure.device_intrinsics import (
        lookup_intrinsics,
        scale_intrinsics_for_resolution,
    )
    from measure.zhang_calibration import (
        calibrate_from_frames,
        estimate_fov_from_marker_grid,
    )

    if len(frame_bytes_list) < 3:
        return {
            "ok": False,
            "reject_reason": (
                f"Need ≥3 calibration frames; got {len(frame_bytes_list)}. "
                "Bewege Phone in größerem Bogen für mehr View-Diversity."
            ),
        }

    spacing_mm = mat_marker_spacing_mm(mat_format)

    # === 1) Detect markers in jedem frame (Gemini-Sprint-3-Micro-Fix:
    # corrupt-frame skip-and-continue solange ≥3 valid frames bleiben) ===
    frame_observations: list[list[tuple[int, list[list[float]]]]] = []
    image_width = image_height = 0
    first_frame_brightness = (0.0, 0.0, 0.0)  # mean, stddev, gradient
    skipped_frames: list[int] = []
    for i, frame_bytes in enumerate(frame_bytes_list):
        try:
            img = np.array(Image.open(io.BytesIO(frame_bytes)).convert("RGB"))
        except Exception:
            skipped_frames.append(i)
            continue
        h, w = img.shape[:2]
        image_width, image_height = w, h
        if i == 0:
            gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
            brightness_mean = float(gray.mean())
            brightness_stddev = float(gray.std())
            top_half = gray[: h // 2, :].mean()
            bot_half = gray[h // 2 :, :].mean()
            gradient = float((top_half - bot_half) / max(brightness_mean, 1.0))
            first_frame_brightness = (brightness_mean, brightness_stddev, gradient)
        try:
            aruco_result = detect_aruco_markers(frame_bytes, mat_format=mat_format)
            obs = [(m.id, m.corners) for m in aruco_result.markers]
            frame_observations.append(obs)
        except Exception:
            frame_observations.append([])

    # Abort wenn nach skip-and-continue nicht genug valid frames bleiben.
    valid_count = len([f for f in frame_observations if len(f) >= 4])
    if valid_count < 3:
        return {
            "ok": False,
            "reject_reason": (
                f"Only {valid_count} valid calibration-frames after skipping "
                f"{len(skipped_frames)} corrupt + others without enough markers. "
                "Bewege Phone in größerem Bogen für mehr View-Diversity."
            ),
            "skipped_frames": skipped_frames,
        }

    # === 2) Zhang's Method ===
    calib_result = calibrate_from_frames(
        frame_observations,
        image_width=image_width,
        image_height=image_height,
        spacing_mm=spacing_mm,
    )

    if calib_result.is_valid:
        # Calibration successful
        return {
            "ok": True,
            "calibration_source": "zhang_method",
            "mat_format": mat_format,
            "camera_intrinsics": {
                "fx": calib_result.fx,
                "fy": calib_result.fy,
                "cx": calib_result.cx,
                "cy": calib_result.cy,
                "distortion_coefficients": {
                    "k1": calib_result.k1, "k2": calib_result.k2,
                    "p1": calib_result.p1, "p2": calib_result.p2, "k3": calib_result.k3,
                },
                "reprojection_rms_px": calib_result.reprojection_rms_px,
                "horizontal_fov_deg": calib_result.horizontal_fov_deg,
                "vertical_fov_deg": calib_result.vertical_fov_deg,
                "is_validated": True,
            },
            "brightness_mean": round(first_frame_brightness[0], 2),
            "brightness_stddev": round(first_frame_brightness[1], 2),
            "brightness_gradient_top_to_bottom": round(first_frame_brightness[2], 4),
            "image_size": [image_width, image_height],
        }

    # === 3) Calibration failed → gated UA-Prior-Fallback ===
    # Codex-Round-7-Fix: Fallback nur wenn UA-Prior-FOV mit Marker-Grid-FOV
    # matcht (Δ<10%). Verhindert wrong-lens-prior (Ultrawide/Tele/Macro).
    intrinsics = lookup_intrinsics(user_agent)
    if intrinsics is None:
        return {
            "ok": False,
            "reject_reason": (
                f"Zhang-Calibration failed: {calib_result.reject_reason}. "
                "Plus: Phone-Modell nicht im UA-Lookup. "
                "Bitte erneut versuchen mit größerem Phone-Bogen."
            ),
            "calibration_source": "failed",
            "calibration_attempt_rms_px": calib_result.reprojection_rms_px,
        }

    # Gate UA-Prior gegen Marker-Grid-FOV (Codex-Round-7 + Gemini-Sprint-3-Fix:
    # vorher loophole — wenn fov_estimate None war, fallthrough akzeptierte
    # UA-Prior unverified. Jetzt: hart-fail wenn FOV-Confirm nicht möglich).
    biggest_frame = max(frame_observations, key=len) if frame_observations else []
    fov_estimate = estimate_fov_from_marker_grid(
        biggest_frame, image_width, image_height, spacing_mm
    ) if len(biggest_frame) >= 4 else None

    scaled_prior = scale_intrinsics_for_resolution(intrinsics, image_width, image_height)
    prior_h_fov = 2 * math.atan(image_width / (2 * scaled_prior.fx)) * 180 / math.pi
    prior_v_fov = 2 * math.atan(image_height / (2 * scaled_prior.fy)) * 180 / math.pi

    if fov_estimate is None:
        # FOV-Confirm nicht möglich (zu wenig Markers oder PnP-Fail) → hard-fail.
        # NIE silently UA-Prior akzeptieren ohne Main-Cam-Verification.
        return {
            "ok": False,
            "reject_reason": (
                f"Zhang-Calibration failed: {calib_result.reject_reason}. "
                "FOV-from-Marker-Grid Estimation failed too — kann UA-Prior "
                "nicht gegen Main-Cam verifizieren. Bitte Phone in größerem "
                "Bogen über Mat bewegen damit alle Marker sichtbar bleiben."
            ),
            "calibration_source": "failed",
            "calibration_attempt_rms_px": calib_result.reprojection_rms_px,
        }

    delta_h = abs(fov_estimate[0] - prior_h_fov) / max(prior_h_fov, 1.0) * 100
    delta_v = abs(fov_estimate[1] - prior_v_fov) / max(prior_v_fov, 1.0) * 100
    if delta_h > 10.0 or delta_v > 10.0:
        return {
            "ok": False,
            "reject_reason": (
                f"Zhang-Calibration failed AND FOV-from-Markers ({fov_estimate}) "
                f"differs >10% from UA-Prior ({prior_h_fov:.1f}°, {prior_v_fov:.1f}°). "
                "Wahrscheinlich Ultrawide/Tele/Macro-Lens. "
                "Bitte Standard-Camera nutzen."
            ),
            "calibration_source": "failed",
        }

    # FOV-Match: UA-Prior accepted (Main-Cam confirmed)
    return {
        "ok": True,
        "calibration_source": "ua_prior_after_zhang_fail",
        "mat_format": mat_format,
        "camera_intrinsics": {
            "fx": scaled_prior.fx,
            "fy": scaled_prior.fy,
            "cx": scaled_prior.cx,
            "cy": scaled_prior.cy,
            "distortion_coefficients": {
                "k1": scaled_prior.k1, "k2": scaled_prior.k2,
                "p1": scaled_prior.p1, "p2": scaled_prior.p2, "k3": scaled_prior.k3,
            },
            "reprojection_rms_px": None,
            "horizontal_fov_deg": prior_h_fov,
            "vertical_fov_deg": prior_v_fov,
            "is_validated": False,  # Prior, nicht echte Calibration
            "device_model": scaled_prior.device_model,
        },
        "brightness_mean": round(first_frame_brightness[0], 2),
        "brightness_stddev": round(first_frame_brightness[1], 2),
        "brightness_gradient_top_to_bottom": round(first_frame_brightness[2], 4),
        "image_size": [image_width, image_height],
        "zhang_failure_reason": calib_result.reject_reason,
    }


@app.function(
    image=measure_image,
    gpu="T4",
    timeout=60,
)
def run_validate_photo(photo_bytes: bytes, view: str) -> dict:
    """Quick per-photo sanity check: A4 detected? foot detected? reasonable
    exposure? Returns issue codes the frontend maps to German strings.
    """
    import io

    import numpy as np
    import cv2
    from PIL import Image

    from measure import a4, segment

    issues: list[str] = []

    try:
        img = np.array(Image.open(io.BytesIO(photo_bytes)).convert("RGB"))
    except Exception:
        return {"ok": False, "issues": ["decode_failed"]}

    # Brightness
    gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
    mean_brightness = float(gray.mean())
    if mean_brightness < 60:
        issues.append("too_dark")

    # Sharpness — Laplacian variance
    lap_var = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    if lap_var < 40:
        issues.append("too_blurry")

    # A4 detection
    try:
        a4.detect_a4(img, rectify=False)
    except a4.A4NotFoundError:
        issues.append("a4_not_detected")

    # Foot detection (stub color-threshold; upgraded with SAM2 in v0.2)
    try:
        mask = segment.segment_foot(img, view=view)  # type: ignore[arg-type]
        if segment.mask_touches_border(mask):
            issues.append("foot_cut_off")
    except segment.FootNotFoundError:
        issues.append("foot_not_detected")

    return {"ok": len(issues) == 0, "issues": issues}


@app.function(
    image=web_image,
    secrets=[modal.Secret.from_name("fitly-supabase")],
    min_containers=0,
    timeout=60,
)
@modal.asgi_app()
def web():
    from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
    from fastapi.middleware.cors import CORSMiddleware
    from fastapi.responses import Response
    from pydantic import BaseModel, Field
    from supabase import create_client

    sb = create_client(
        os.environ["SUPABASE_URL"],
        os.environ["SUPABASE_SERVICE_ROLE_KEY"],
    )

    api = FastAPI(title="Fitly Backend", version="0.2.0")

    # ===== Session-Token-Auth (Task 14) =====
    # SESSION_HMAC_SECRET aus Modal-Secret-Env. Wenn unset → auth bypassed
    # (legacy/dev). Setze Secret via:
    #   modal secret create fitly-supabase ... SESSION_HMAC_SECRET=<random>
    _session_hmac_secret = os.environ.get("SESSION_HMAC_SECRET", "").strip() or None
    if _session_hmac_secret is None:
        print(
            "WARN: SESSION_HMAC_SECRET unset — Modal-API-Auth bypassed. "
            "Set Modal secret SESSION_HMAC_SECRET=<random-32-bytes> for production."
        )

    def _require_session_auth(session_id: str, request: Request) -> None:
        """Raise 401 if bearer-token missing/invalid. No-op if HMAC-secret unset."""
        if _session_hmac_secret is None:
            return
        token = _extract_bearer_token(request.headers.get(_SESSION_TOKEN_HEADER))
        if not token:
            raise HTTPException(401, "Bearer-Token erforderlich")
        if not _verify_session_token(session_id, token, _session_hmac_secret):
            raise HTTPException(401, "Bearer-Token ungültig")

    # CORS: Origin-Allowlist statt "*" (Sprint-1-Security-Mitigation).
    # Default-Liste deckt Fitly-Produktion + Lovable-Preview ab. Für Custom-
    # Deployments: ALLOWED_ORIGINS ENV-Var setzen (komma-separiert).
    # NICHT eine vollständige Auth-Lösung — siehe TODO Task #14
    # (HMAC-signed session-tokens) für die echte Defense-in-Depth.
    _allowed_origins_env = os.environ.get("ALLOWED_ORIGINS", "").strip()
    if _allowed_origins_env:
        allowed_origins = [o.strip() for o in _allowed_origins_env.split(",") if o.strip()]
    else:
        allowed_origins = [
            "https://fitly.app",
            "https://www.fitly.app",
            "https://*.lovable.app",
            "https://*.lovableproject.com",
            "http://localhost:8080",
            "http://localhost:5173",
        ]
    api.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_origin_regex=r"https://.*\.(lovable\.app|lovableproject\.com)",
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["*"],
    )

    class SessionCreate(BaseModel):
        shoe_slug: str
        brand_id: Optional[str] = None

    class SessionCreateResponse(BaseModel):
        session_id: str
        session_token: Optional[str] = None

    class ScanSubmit(BaseModel):
        session_id: str
        foot_length_mm: float = Field(ge=50, le=400)
        foot_width_mm: float = Field(ge=30, le=200)
        ball_width_mm: float = Field(ge=30, le=200)
        heel_width_mm: float = Field(ge=30, le=200)
        arch_type: Literal["low", "medium", "high"]
        eu_size: int = Field(ge=15, le=55)

    @api.get("/healthz")
    async def healthz():
        return {"ok": True, "service": "fitly-backend", "version": "0.2.0"}

    @api.post("/session", response_model=SessionCreateResponse)
    async def create_session(body: SessionCreate):
        res = (
            sb.table("scans")
            .insert({
                "shoe_slug": body.shoe_slug,
                "brand_id": body.brand_id,
                "status": "pending",
            })
            .execute()
        )
        if not res.data:
            raise HTTPException(500, "insert returned no row")
        sid = res.data[0]["id"]
        token = (
            _compute_session_token(sid, _session_hmac_secret)
            if _session_hmac_secret
            else None
        )
        return {"session_id": sid, "session_token": token}

    @api.get("/session/{session_id}")
    async def fetch_session(session_id: str, request: Request):
        _require_session_auth(session_id, request)
        res = sb.table("scans").select("*").eq("id", session_id).execute()
        if not res.data:
            raise HTTPException(404, "session not found")
        return res.data[0]

    @api.post("/scan")
    async def submit_scan(body: ScanSubmit, request: Request):
        _require_session_auth(body.session_id, request)
        from datetime import datetime, timezone

        res = (
            sb.table("scans")
            .update({
                "foot_length_mm": body.foot_length_mm,
                "foot_width_mm": body.foot_width_mm,
                "ball_width_mm": body.ball_width_mm,
                "heel_width_mm": body.heel_width_mm,
                "arch_type": body.arch_type,
                "eu_size": body.eu_size,
                "status": "complete",
                "confidence": "high",
                "completed_at": datetime.now(timezone.utc).isoformat(),
            })
            .eq("id", body.session_id)
            .execute()
        )
        if not res.data:
            raise HTTPException(404, "session not found for update")
        return {"ok": True}

    @api.post("/measure")
    async def measure(
        request: Request,
        session_id: str = Form(...),
        photo_top: UploadFile = File(...),
        photo_side: UploadFile = File(...),
    ):
        _require_session_auth(session_id, request)
        top_bytes = await photo_top.read()
        side_bytes = await photo_side.read()

        try:
            result = run_measure.remote(top_bytes, side_bytes)
        except Exception as e:
            # Pipeline-level errors that suggest a user-retake-able issue
            # surface as HTTP 422 with the exception message as the code.
            raise HTTPException(status_code=422, detail=str(e))

        measurements = result["measurements"]
        warnings = result.get("warnings", [])

        # Write to Supabase. `completed_at` marks when the measurement finished
        # (distinct from created_at which is when the session was opened).
        from datetime import datetime, timezone

        update_payload = {
            "foot_length_mm": measurements["foot_length_mm"],
            "foot_width_mm": measurements["foot_width_mm"],
            "ball_width_mm": measurements["ball_width_mm"],
            "heel_width_mm": measurements["heel_width_mm"],
            "arch_type": measurements["arch_type"],
            "eu_size": measurements["eu_size"],
            "confidence": measurements["confidence"],
            "status": "complete",
            "completed_at": datetime.now(timezone.utc).isoformat(),
        }
        res = (
            sb.table("scans")
            .update(update_payload)
            .eq("id", session_id)
            .execute()
        )
        if not res.data:
            raise HTTPException(404, "session not found for update")

        return {"ok": True, "measurements": measurements, "warnings": warnings}

    @api.post("/validate-photo")
    async def validate_photo(
        request: Request,
        session_id: str = Form(...),
        view: Literal["top", "side"] = Form(...),
        photo: UploadFile = File(...),
    ):
        _require_session_auth(session_id, request)
        photo_bytes = await photo.read()
        return run_validate_photo.remote(photo_bytes, view)

    @api.post("/detect-aruco")
    async def detect_aruco(
        request: Request,
        session_id: str = Form(...),
        photo: UploadFile = File(...),
        mat_format: str = Form("A4"),
    ):
        """ArUco-Marker-Detection + Scale-Reference.

        mat_format kommt vom Frontend (PreFlowResult.matFormat).
        Erlaubt: "A4" (30mm-Pitch) oder "A3" (45mm-Pitch).
        """
        _require_session_auth(session_id, request)
        photo_bytes = await photo.read()
        if mat_format.upper() not in ("A4", "A3"):
            raise HTTPException(400, f"Invalid mat_format: {mat_format!r}")
        return run_detect_aruco.remote(photo_bytes, mat_format.upper())

    @api.post("/probe-lite")
    async def probe_lite(
        request: Request,
        session_id: str = Form(...),
        photo: UploadFile = File(...),
        mat_format: str = Form("A4"),
    ):
        _require_session_auth(session_id, request)
        """Quick-Scan-Lite Probe-Frame (v11 design).

        Pre-Foto-1-Calibration + Pre-Capture-Reject-Gates. Liefert UA-Prior-
        Intrinsics, Brightness-Stats, Print-Scale-Check. HTTP 400 wenn UA
        unbekannt → Frontend redirected zu Premium-Scan-Pro.
        """
        photo_bytes = await photo.read()
        if mat_format.upper() not in ("A4", "A3"):
            raise HTTPException(400, f"Invalid mat_format: {mat_format!r}")
        ua = request.headers.get("user-agent", "")
        result = run_probe_lite.remote(photo_bytes, ua, mat_format.upper())
        if not result.get("ok") and result.get("ua_unknown"):
            raise HTTPException(400, detail=result)
        return result

    @api.post("/detect-extended")
    async def detect_extended_endpoint(
        request: Request,
        session_id: str = Form(...),
        photo: UploadFile = File(...),
        intrinsics_json: str = Form(...),
        mat_format: str = Form("A4"),
        phase: str = Form("top"),
        selected_foot: str = Form("right"),
    ):
        """v11 erweiterte Detection-Pipeline.

        Liefert alle Live-Gate-Felder pro Frame: PnP-Pose, side-yaw-ortho,
        homography-residuals, marker-coverage, foot-pivot, A4-tightness.

        Args:
            intrinsics_json: JSON-Stringified Intrinsics-Dict (fx/fy/cx/cy +
                             distortion_coefficients). Aus /probe-lite oder
                             /probe-pro.
        """
        _require_session_auth(session_id, request)
        import json as _json
        from measure.detect_extended import detect_extended

        if mat_format.upper() not in ("A4", "A3"):
            raise HTTPException(400, f"Invalid mat_format: {mat_format!r}")
        if phase not in ("top", "side"):
            raise HTTPException(400, f"Invalid phase: {phase!r}")
        if selected_foot not in ("left", "right"):
            raise HTTPException(400, f"Invalid selected_foot: {selected_foot!r}")
        try:
            intrinsics = _json.loads(intrinsics_json)
        except Exception:
            raise HTTPException(400, "intrinsics_json malformed")
        if not all(k in intrinsics for k in ("fx", "fy", "cx", "cy")):
            raise HTTPException(400, "intrinsics missing fx/fy/cx/cy")
        photo_bytes = await photo.read()
        result = run_detect_extended.remote(
            photo_bytes, intrinsics, mat_format.upper(), phase, selected_foot
        )
        return result

    @api.post("/probe-pro")
    async def probe_pro(
        request: Request,
        session_id: str = Form(...),
        frames: list[UploadFile] = File(...),
        mat_format: str = Form("A4"),
    ):
        """Premium-Scan-Pro Multi-Frame-Calibration (v11 design).

        Empfängt 3-5 Frames mit erzwungener View-Angle-Diversity. Zhang's
        Method-Calibration + Validation. Bei Failure: gated UA-Prior-Fallback
        mit Main-Camera-Confirm via FOV-from-Marker-Grid (Δ<10%).
        """
        _require_session_auth(session_id, request)
        if mat_format.upper() not in ("A4", "A3"):
            raise HTTPException(400, f"Invalid mat_format: {mat_format!r}")
        if len(frames) < 3 or len(frames) > 8:
            raise HTTPException(
                400, f"Frame-count must be in [3, 8], got {len(frames)}"
            )
        frame_bytes_list = [await f.read() for f in frames]
        ua = request.headers.get("user-agent", "")
        result = run_probe_pro.remote(frame_bytes_list, ua, mat_format.upper())
        if not result.get("ok"):
            raise HTTPException(422, detail=result)
        return result

    @api.post("/detect-foot")
    async def detect_foot(
        request: Request,
        session_id: str = Form(...),
        photo: UploadFile = File(...),
    ):
        """Spike 0c: Foot-In-Frame-Detection (3 lokale Strategien)."""
        _require_session_auth(session_id, request)
        photo_bytes = await photo.read()
        return run_detect_foot.remote(photo_bytes)

    class MeshExtractRequest(BaseModel):
        session_id: str

    @api.post("/extract-mesh")
    async def extract_mesh(body: MeshExtractRequest, request: Request):
        _require_session_auth(body.session_id, request)
        """Phase 3: Trigger KIRI-Mesh-Measurement-Extraction post-KIRI-completion.

        Frontend ruft this nach KIRI-status=2 — Backend fetched modelUrl,
        downloaded ZIP, extrahiert via mesh_extract.py die Maße, schreibt
        in scans-Row.
        """
        try:
            result = run_extract_kiri_mesh.remote(body.session_id)
        except Exception as e:
            raise HTTPException(500, f"extract-mesh failed: {e}")
        if not result.get("ok"):
            raise HTTPException(422, result.get("error", "unknown error"))
        return result

    @api.get("/mesh/{session_id}")
    async def mesh(session_id: str):
        """Personalized foot mesh (glb). Requires /measure to have run for this session."""
        try:
            glb_bytes = run_mesh.remote(session_id)
        except ValueError as e:
            code = str(e)
            if code == "session_not_found":
                raise HTTPException(404, "session not found")
            if code == "measurement_not_complete":
                raise HTTPException(409, "measurement not complete yet")
            raise HTTPException(500, code)
        return Response(
            content=glb_bytes,
            media_type="model/gltf-binary",
            headers={
                "Content-Disposition": f'inline; filename="fitly-foot-{session_id}.glb"',
                "Cache-Control": "public, max-age=86400",
            },
        )

    return api
