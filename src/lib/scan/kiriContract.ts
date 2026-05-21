// KIRI Engine API Acceptance Criteria — Validation vor Submit.
//
// Source: https://docs.kiriengine.app/ Stand 2026-05.
// Vor Phase-1-Implementation gegen aktuelle KIRI-Doc verifizieren.

export const KIRI_LIMITS = {
  MIN_FRAMES_PER_SCAN: 20,
  MAX_FRAMES_PER_SCAN: 300,
  MAX_IMAGE_DIMENSION: 4096,
  MAX_PAYLOAD_BYTES: 50 * 1024 * 1024, // 50 MB client-side cap (KIRI doesn't hard-spec; safe ceiling)
  MAX_BYTES_PER_FRAME: 1.5 * 1024 * 1024, // 1.5 MB pro Frame
  ALLOWED_MIME_TYPES: ["image/jpeg", "image/png"] as const,
} as const;

export type FrameMeta = {
  blob: Blob;
  yawAtCapture: number;
  /** Phone-Pitch (beta) zum Capture-Zeitpunkt in Grad. NUR client-side für
   *  In-App-Elevation-Coaching (z.B. Coach-Hint wenn Range zu narrow) und
   *  Pass-2-Targeting. KIRI's SfM bekommt Elevation-Diversity über die
   *  Bildinhalte — nicht via Metadaten — also wird beta NICHT mit dem
   *  Submit-FormData mitgeschickt. */
  betaAtCapture?: number;
  capturedAt: number;
};

export type ValidationResult =
  | { ok: true }
  | { ok: false; reason: string };

/**
 * Validiert ein Frame-Set vor Submit an KIRI. Wirft nicht — gibt strukturiertes
 * Result zurück damit der Caller dem User eine sinnvolle Message zeigen kann.
 */
export function validateFramesForKiri(frames: FrameMeta[]): ValidationResult {
  if (frames.length < KIRI_LIMITS.MIN_FRAMES_PER_SCAN) {
    return {
      ok: false,
      reason: `Mindestens ${KIRI_LIMITS.MIN_FRAMES_PER_SCAN} Frames nötig, aktuell ${frames.length}`,
    };
  }
  if (frames.length > KIRI_LIMITS.MAX_FRAMES_PER_SCAN) {
    return {
      ok: false,
      reason: `Maximal ${KIRI_LIMITS.MAX_FRAMES_PER_SCAN} Frames erlaubt, aktuell ${frames.length}`,
    };
  }

  let totalBytes = 0;
  for (let i = 0; i < frames.length; i++) {
    const f = frames[i];
    if (!f.blob) {
      return { ok: false, reason: `Frame ${i + 1} hat keinen Blob` };
    }
    if (!(KIRI_LIMITS.ALLOWED_MIME_TYPES as readonly string[]).includes(f.blob.type)) {
      return {
        ok: false,
        reason: `Frame ${i + 1} hat ungültigen MIME-Type: ${f.blob.type}`,
      };
    }
    if (f.blob.size > KIRI_LIMITS.MAX_BYTES_PER_FRAME) {
      return {
        ok: false,
        reason: `Frame ${i + 1} ist ${(f.blob.size / 1024 / 1024).toFixed(2)} MB — max ${KIRI_LIMITS.MAX_BYTES_PER_FRAME / 1024 / 1024} MB pro Frame`,
      };
    }
    totalBytes += f.blob.size;
  }

  if (totalBytes > KIRI_LIMITS.MAX_PAYLOAD_BYTES) {
    return {
      ok: false,
      reason: `Total-Payload ${(totalBytes / 1024 / 1024).toFixed(2)} MB übersteigt ${KIRI_LIMITS.MAX_PAYLOAD_BYTES / 1024 / 1024} MB Cap`,
    };
  }

  return { ok: true };
}
