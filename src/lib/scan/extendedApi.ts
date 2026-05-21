/**
 * API-Wrappers für v11 Backend-Endpoints (/probe-lite, /probe-pro,
 * /detect-extended). Replace /detect-aruco + /detect-foot dual-call durch
 * single /detect-extended-call mit allen Gate-Feldern in einem Response.
 *
 * Caller-Pattern (Quick-Scan-Lite):
 *   1. Pre-flow: probe-lite once vor Foto-1
 *   2. Pro-Tick: detectExtended mit returned-intrinsics
 *   3. Post-capture: existing /measure call
 */

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL as string | undefined;
const DEV_FAKE_OK = import.meta.env.VITE_SCAN_DEV_FAKE_OK === "true";

export type SessionAuth = {
  sessionId: string;
  sessionToken?: string | null;
};

function authHeaders(auth?: SessionAuth | null): HeadersInit | undefined {
  if (!auth?.sessionToken) return undefined;
  return { Authorization: `Bearer ${auth.sessionToken}` };
}

export type CameraIntrinsics = {
  fx: number;
  fy: number;
  cx: number;
  cy: number;
  distortion_coefficients: {
    k1: number;
    k2: number;
    p1: number;
    p2: number;
    k3: number;
  };
  is_validated?: boolean;
  device_model?: string;
};

export type ProbeLiteResult = {
  ok: boolean;
  ua_unknown?: boolean;
  error?: string;
  mat_format?: string;
  marker_count?: number;
  marker_pixel_size_mean?: number | null;
  brightness_mean?: number;
  brightness_stddev?: number;
  brightness_gradient_top_to_bottom?: number;
  print_scale_check?: {
    expected_pitch_mm: number;
    measured_pitch_mm: number | null;
    deviation_pct: number | null;
    passed_threshold_2_pct: boolean | null;
  };
  ua_prior_intrinsics?: CameraIntrinsics;
  image_size?: [number, number];
};

export type ProbeProResult = {
  ok: boolean;
  reject_reason?: string;
  calibration_source?: "zhang_method" | "ua_prior_after_zhang_fail" | "failed";
  mat_format?: string;
  camera_intrinsics?: CameraIntrinsics & {
    reprojection_rms_px?: number | null;
    horizontal_fov_deg?: number;
    vertical_fov_deg?: number;
  };
  brightness_mean?: number;
  brightness_stddev?: number;
  brightness_gradient_top_to_bottom?: number;
  image_size?: [number, number];
  zhang_failure_reason?: string;
  skipped_frames?: number[];
};

export type DetectExtendedResult = {
  ok: boolean;
  error?: string | null;
  marker_count: number;
  markers: Array<{ id: number; corners: number[][] }>;
  mat_format: string;
  homography: number[][] | null;
  homography_residuals_px: number | null;
  plane_normal: number[] | null;
  camera_center_marker_coords_mm: { x: number; y: number; z: number } | null;
  camera_forward_dot_normal: number | null;
  side_yaw_delta_to_expected_medial_deg: number | null;
  side_sign_matches_selected_foot: boolean | null;
  foot_bounding_box_marker_coords_mm: number[] | null;
  foot_confidence: number;
  heel_position_marker_coords_mm: { x: number; y: number } | null;
  toe_tip_position_marker_coords_mm: { x: number; y: number } | null;
  foot_yaw_angle_deg: number | null;
  foot_bbox_to_paper_edge_min_mm: number | null;
  marker_convex_hull_area_fraction: number | null;
  marker_spread_along_foot_axis_mm: number | null;
  brightness_mean: number;
  brightness_stddev: number;
};

/**
 * Probe-Frame Step 0 für Quick-Scan-Lite. Server liefert UA-Prior-Intrinsics
 * + Brightness-Baseline + Print-Scale-Check. HTTP 400 wenn UA-Modell nicht
 * im Lookup → Caller redirected zu Premium-Scan-Pro.
 */
export async function probeLite(
  photo: Blob,
  matFormat: "A4" | "A3" = "A4",
  auth?: SessionAuth | null,
): Promise<ProbeLiteResult> {
  if (!BACKEND_URL) {
    if (DEV_FAKE_OK) {
      return {
        ok: true,
        mat_format: matFormat,
        marker_count: 24,
        brightness_mean: 150,
        brightness_stddev: 20,
        brightness_gradient_top_to_bottom: 0.05,
        ua_prior_intrinsics: {
          fx: 1450,
          fy: 1452,
          cx: 960,
          cy: 540,
          distortion_coefficients: { k1: -0.08, k2: 0.05, p1: 0, p2: 0, k3: 0 },
          is_validated: true,
          device_model: "DEV_FAKE",
        },
        image_size: [1920, 1080],
      };
    }
    return { ok: false, error: "Backend nicht konfiguriert (VITE_BACKEND_URL)" };
  }

  const fd = new FormData();
  fd.append("photo", photo, "probe.jpg");
  fd.append("mat_format", matFormat);
  if (auth?.sessionId) fd.append("session_id", auth.sessionId);

  const res = await fetch(`${BACKEND_URL}/probe-lite`, {
    method: "POST",
    headers: authHeaders(auth),
    body: fd,
  });
  if (res.status === 400) {
    // UA-unknown ist HTTP 400 mit detail-payload (siehe modal/app.py probe_lite).
    const detail = await res.json().catch(() => null);
    if (detail && detail.detail && detail.detail.ua_unknown) {
      return { ok: false, ua_unknown: true, error: detail.detail.error };
    }
    return { ok: false, error: `HTTP 400: ${JSON.stringify(detail)}` };
  }
  if (!res.ok) {
    return { ok: false, error: `HTTP ${res.status}` };
  }
  return res.json();
}

/**
 * Premium-Scan-Pro Multi-Frame-Calibration Endpoint. Sendet 3-8 Frames an
 * /probe-pro für Zhang's-Method-Calibration. Bei Calibration-Fail führt
 * Backend automatisch gated UA-Prior-Fallback durch (FOV-Confirm-Gate Δ<10%).
 *
 * HTTP 422 → ok=false mit reject_reason (Zhang-fail + UA-Fallback-disqualified).
 * Caller zeigt ValidationErrorView mit "Premium-Scan später erneut versuchen".
 */
export async function probePro(
  frames: Blob[],
  matFormat: "A4" | "A3" = "A4",
  auth?: SessionAuth | null,
): Promise<ProbeProResult> {
  if (!BACKEND_URL) {
    if (DEV_FAKE_OK) {
      return {
        ok: true,
        calibration_source: "zhang_method",
        mat_format: matFormat,
        camera_intrinsics: {
          fx: 1450,
          fy: 1452,
          cx: 960,
          cy: 540,
          distortion_coefficients: { k1: -0.08, k2: 0.05, p1: 0, p2: 0, k3: 0 },
          reprojection_rms_px: 0.7,
          horizontal_fov_deg: 67.4,
          vertical_fov_deg: 41.5,
          is_validated: true,
          device_model: "DEV_FAKE",
        },
        brightness_mean: 150,
        brightness_stddev: 20,
        image_size: [1920, 1080],
      };
    }
    return { ok: false, reject_reason: "Backend nicht konfiguriert (VITE_BACKEND_URL)" };
  }
  if (frames.length < 3 || frames.length > 8) {
    return {
      ok: false,
      reject_reason: `Frame-count must be in [3, 8], got ${frames.length}`,
    };
  }

  const fd = new FormData();
  for (let i = 0; i < frames.length; i++) {
    fd.append("frames", frames[i], `frame-${i}.jpg`);
  }
  fd.append("mat_format", matFormat);
  if (auth?.sessionId) fd.append("session_id", auth.sessionId);

  const res = await fetch(`${BACKEND_URL}/probe-pro`, {
    method: "POST",
    headers: authHeaders(auth),
    body: fd,
  });
  if (res.status === 422) {
    const detail = await res.json().catch(() => null);
    if (detail && detail.detail) {
      return {
        ok: false,
        reject_reason: detail.detail.reject_reason ?? "Calibration fehlgeschlagen",
        calibration_source: detail.detail.calibration_source,
      };
    }
    return { ok: false, reject_reason: `HTTP 422: ${JSON.stringify(detail)}` };
  }
  if (!res.ok) {
    return { ok: false, reject_reason: `HTTP ${res.status}` };
  }
  return res.json();
}

/**
 * Per-Frame Detection für Live-Gates. Replace dual /detect-aruco + /detect-
 * foot calls durch single endpoint mit Pose + Foot + alle Gate-Felder.
 */
export async function detectExtended(
  photo: Blob,
  intrinsics: CameraIntrinsics,
  matFormat: "A4" | "A3" = "A4",
  phase: "top" | "side" = "top",
  selectedFoot: "left" | "right" = "right",
  auth?: SessionAuth | null,
): Promise<DetectExtendedResult> {
  if (!BACKEND_URL) {
    if (DEV_FAKE_OK) {
      return {
        ok: true,
        marker_count: 24,
        markers: [],
        mat_format: matFormat,
        homography: null,
        homography_residuals_px: 0.5,
        plane_normal: [0, 0, 1],
        camera_center_marker_coords_mm: { x: 60, y: 90, z: 200 },
        camera_forward_dot_normal: 0.97,
        side_yaw_delta_to_expected_medial_deg: 2.0,
        side_sign_matches_selected_foot: true,
        foot_bounding_box_marker_coords_mm: [10, 10, 80, 200],
        foot_confidence: 0.92,
        heel_position_marker_coords_mm: { x: 50, y: 10 },
        toe_tip_position_marker_coords_mm: { x: 50, y: 210 },
        foot_yaw_angle_deg: 1.5,
        foot_bbox_to_paper_edge_min_mm: 15,
        marker_convex_hull_area_fraction: 0.85,
        marker_spread_along_foot_axis_mm: 150,
        brightness_mean: 150,
        brightness_stddev: 20,
      };
    }
    return {
      ok: false,
      error: "Backend nicht konfiguriert",
      marker_count: 0,
      markers: [],
      mat_format: matFormat,
      homography: null,
      homography_residuals_px: null,
      plane_normal: null,
      camera_center_marker_coords_mm: null,
      camera_forward_dot_normal: null,
      side_yaw_delta_to_expected_medial_deg: null,
      side_sign_matches_selected_foot: null,
      foot_bounding_box_marker_coords_mm: null,
      foot_confidence: 0,
      heel_position_marker_coords_mm: null,
      toe_tip_position_marker_coords_mm: null,
      foot_yaw_angle_deg: null,
      foot_bbox_to_paper_edge_min_mm: null,
      marker_convex_hull_area_fraction: null,
      marker_spread_along_foot_axis_mm: null,
      brightness_mean: 0,
      brightness_stddev: 0,
    };
  }

  const fd = new FormData();
  fd.append("photo", photo, "frame.jpg");
  fd.append("intrinsics_json", JSON.stringify(intrinsics));
  fd.append("mat_format", matFormat);
  fd.append("phase", phase);
  fd.append("selected_foot", selectedFoot);
  if (auth?.sessionId) fd.append("session_id", auth.sessionId);

  const res = await fetch(`${BACKEND_URL}/detect-extended`, {
    method: "POST",
    headers: authHeaders(auth),
    body: fd,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return {
      ok: false,
      error: `HTTP ${res.status}: ${text.slice(0, 200)}`,
      marker_count: 0,
      markers: [],
      mat_format: matFormat,
      homography: null,
      homography_residuals_px: null,
      plane_normal: null,
      camera_center_marker_coords_mm: null,
      camera_forward_dot_normal: null,
      side_yaw_delta_to_expected_medial_deg: null,
      side_sign_matches_selected_foot: null,
      foot_bounding_box_marker_coords_mm: null,
      foot_confidence: 0,
      heel_position_marker_coords_mm: null,
      toe_tip_position_marker_coords_mm: null,
      foot_yaw_angle_deg: null,
      foot_bbox_to_paper_edge_min_mm: null,
      marker_convex_hull_area_fraction: null,
      marker_spread_along_foot_axis_mm: null,
      brightness_mean: 0,
      brightness_stddev: 0,
    };
  }
  return res.json();
}
