/**
 * Phase 2: API-Helpers für 2-Foto-Quick-Scan-Flow.
 *
 * Wraps Modal-Backend-Endpoints:
 *  - /detect-aruco: Pre-Capture-Validation (ArUco-Markers + Scale-Reference)
 *  - /detect-foot: Pre-Capture-Validation (Foot-In-Frame)
 *  - /measure: Final-Submit (Top + Side Photos → Maße)
 *  - /session: createSession
 *
 * Backend-URL aus VITE_BACKEND_URL env-var (Modal-deployed). Wenn nicht
 * gesetzt: Fallback-Mode mit dummy-success damit Frontend trotzdem
 * developable bleibt ohne Modal-Setup.
 */

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL as string | undefined;
// Dev-Fake-Mode: nur explizit aktiviert via env. Vorher returnten die Stubs
// IMMER ok=true wenn VITE_BACKEND_URL fehlte → User in Production hatte
// false-positive Auto-Trigger ohne dass Server validiert hatte.
const DEV_FAKE_OK = import.meta.env.VITE_SCAN_DEV_FAKE_OK === "true";

export type ArucoMarker = {
  id: number;
  corners: number[][]; // 4 × [x, y]
};

export type ArucoDetectionResult = {
  ok: boolean;
  marker_count: number;
  markers: ArucoMarker[];
  image_size: [number, number];
  pixel_to_mm_scale: number | null;
  error?: string;
};

export type FootDetectionResult = {
  best_strategy: string;
  best_confidence: number;
  best_bbox: [number, number, number, number] | null;
  needs_cloud_fallback: boolean;
  all_strategies: Array<{
    strategy: string;
    confidence: number;
    diagnostics: Record<string, unknown> | null;
  }>;
};

export type MeasurementResult = {
  ok: boolean;
  measurements?: {
    foot_length_mm: number;
    foot_width_mm: number;
    ball_width_mm: number;
    heel_width_mm: number;
    arch_type: "low" | "medium" | "high";
    eu_size: number;
    confidence: string;
  };
  warnings?: string[];
  error?: string;
};

export type SessionAuth = {
  sessionId: string;
  sessionToken?: string | null;
};

function authHeaders(auth?: SessionAuth | null): HeadersInit {
  if (!auth?.sessionToken) return {};
  return { Authorization: `Bearer ${auth.sessionToken}` };
}

/**
 * Validate a single photo against Modal /detect-aruco.
 * Returns marker-count + scale + error-detail.
 *
 * @param photo Camera-Frame
 * @param matFormat "A4" (default, 30mm-Pitch) oder "A3" (45mm-Pitch).
 *                  Aus PreFlowResult.matFormat. Backend nutzt das für korrekte
 *                  Pixel-zu-mm-Skala. Falsch übergeben = mm-Maße off um 50%.
 * @param auth      Session-Auth (Task 14). Optional bei legacy-Backends ohne
 *                  HMAC-Secret; required bei production.
 */
export async function detectAruco(
  photo: Blob,
  matFormat: "A4" | "A3" = "A4",
  auth?: SessionAuth | null,
): Promise<ArucoDetectionResult> {
  if (!BACKEND_URL) {
    if (DEV_FAKE_OK) {
      return {
        ok: true,
        marker_count: 24,
        markers: [],
        image_size: [1280, 720],
        pixel_to_mm_scale: 0.1,
      };
    }
    // Default ohne BACKEND_URL: explizit fail damit kein false-positive auto-trigger
    return {
      ok: false,
      marker_count: 0,
      markers: [],
      image_size: [0, 0],
      pixel_to_mm_scale: null,
      error: "Backend nicht konfiguriert (VITE_BACKEND_URL)",
    };
  }
  const fd = new FormData();
  fd.append("photo", photo, "photo.jpg");
  fd.append("mat_format", matFormat);
  if (auth?.sessionId) fd.append("session_id", auth.sessionId);
  const res = await fetch(`${BACKEND_URL}/detect-aruco`, {
    method: "POST",
    headers: authHeaders(auth),
    body: fd,
  });
  if (!res.ok) {
    return {
      ok: false,
      marker_count: 0,
      markers: [],
      image_size: [0, 0],
      pixel_to_mm_scale: null,
      error: `HTTP ${res.status}`,
    };
  }
  return res.json();
}

/**
 * Validate Foot-In-Frame via Modal /detect-foot.
 */
export async function detectFoot(
  photo: Blob,
  auth?: SessionAuth | null,
): Promise<FootDetectionResult> {
  if (!BACKEND_URL) {
    if (DEV_FAKE_OK) {
      return {
        best_strategy: "dev_fallback",
        best_confidence: 1.0,
        best_bbox: null,
        needs_cloud_fallback: false,
        all_strategies: [],
      };
    }
    // Default ohne BACKEND_URL: explizit fail damit kein false-positive auto-trigger
    return {
      best_strategy: "no_backend",
      best_confidence: 0,
      best_bbox: null,
      needs_cloud_fallback: true,
      all_strategies: [],
    };
  }
  const fd = new FormData();
  fd.append("photo", photo, "photo.jpg");
  if (auth?.sessionId) fd.append("session_id", auth.sessionId);
  const res = await fetch(`${BACKEND_URL}/detect-foot`, {
    method: "POST",
    headers: authHeaders(auth),
    body: fd,
  });
  if (!res.ok) {
    return {
      best_strategy: "error",
      best_confidence: 0,
      best_bbox: null,
      needs_cloud_fallback: true,
      all_strategies: [],
    };
  }
  return res.json();
}

/**
 * Final submit: 2 Fotos + session_id → Modal /measure → Maße.
 */
export async function submitTwoPhotoMeasurement(
  sessionId: string,
  topPhoto: Blob,
  sidePhoto: Blob,
  sessionToken?: string | null,
): Promise<MeasurementResult> {
  if (!BACKEND_URL) {
    if (DEV_FAKE_OK) {
      // Dev-Fallback: dummy measurements (nur wenn explizit aktiviert)
      return {
        ok: true,
        measurements: {
          foot_length_mm: 270,
          foot_width_mm: 100,
          ball_width_mm: 100,
          heel_width_mm: 65,
          arch_type: "medium",
          eu_size: 43,
          confidence: "dev_fallback",
        },
        warnings: ["Modal-Backend nicht konfiguriert (VITE_BACKEND_URL)"],
      };
    }
    return {
      ok: false,
      error: "Backend nicht konfiguriert (VITE_BACKEND_URL)",
    };
  }
  const fd = new FormData();
  fd.append("session_id", sessionId);
  fd.append("photo_top", topPhoto, "top.jpg");
  fd.append("photo_side", sidePhoto, "side.jpg");
  const res = await fetch(`${BACKEND_URL}/measure`, {
    method: "POST",
    headers: sessionToken ? { Authorization: `Bearer ${sessionToken}` } : undefined,
    body: fd,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { ok: false, error: `HTTP ${res.status}: ${text.slice(0, 200)}` };
  }
  return res.json();
}
