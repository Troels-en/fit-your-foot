import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Multi-Tier-Constraint-Retry für getUserMedia. Versucht 1080p → 720p → 540p.
 * Hard-Floor: 540p. Drunter Error.
 *
 * Lifecycle-safety: cancel-flag verhindert dass eine Race-Condition (Unmount
 * während getUserMedia await) einen orphan-Stream hinterlässt.
 */
const TIERS = [
  { width: 1920, height: 1080 },
  { width: 1280, height: 720 },
  { width: 960, height: 540 },
] as const;

export type CameraStreamState =
  | { phase: "idle" }
  | { phase: "starting" }
  | { phase: "ready"; width: number; height: number }
  | { phase: "error"; reason: string };

/**
 * Wartet bis das Video-Element loadedmetadata gefired hat ODER Timeout.
 * Per Spec ist videoWidth/Height erst danach verlässlich (iOS Safari).
 */
function waitForMetadata(video: HTMLVideoElement, timeoutMs = 3000): Promise<boolean> {
  return new Promise((resolve) => {
    if (video.readyState >= 1 /* HAVE_METADATA */ && video.videoWidth > 0) {
      return resolve(true);
    }
    const onLoaded = () => {
      cleanup();
      resolve(true);
    };
    const onError = () => {
      cleanup();
      resolve(false);
    };
    const timeout = window.setTimeout(() => {
      cleanup();
      resolve(false);
    }, timeoutMs);
    const cleanup = () => {
      video.removeEventListener("loadedmetadata", onLoaded);
      video.removeEventListener("error", onError);
      window.clearTimeout(timeout);
    };
    video.addEventListener("loadedmetadata", onLoaded);
    video.addEventListener("error", onError);
  });
}

export function useCameraStream(videoRef: React.RefObject<HTMLVideoElement>) {
  const [state, setState] = useState<CameraStreamState>({ phase: "idle" });
  const streamRef = useRef<MediaStream | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, []);

  const start = useCallback(async () => {
    if (streamRef.current) return;
    if (!mountedRef.current) return;
    setState({ phase: "starting" });

    for (const tier of TIERS) {
      let candidate: MediaStream | null = null;
      try {
        candidate = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: tier.width },
            height: { ideal: tier.height },
          },
          audio: false,
        });
      } catch (err) {
        console.error("getUserMedia tier failed", tier, err);
        continue;
      }

      if (!mountedRef.current) {
        // Unmounted während des Awaits → orphan stream cleanup
        candidate.getTracks().forEach((t) => t.stop());
        return;
      }

      const video = videoRef.current;
      if (!video) {
        candidate.getTracks().forEach((t) => t.stop());
        if (mountedRef.current) setState({ phase: "error", reason: "Video-Element nicht ready" });
        return;
      }

      video.srcObject = candidate;
      video.muted = true;
      video.playsInline = true;
      try {
        await video.play();
      } catch {
        // Autoplay-Policy may block — stream still active, ok
      }

      if (!mountedRef.current) {
        candidate.getTracks().forEach((t) => t.stop());
        return;
      }

      // Wait for metadata vor videoWidth-Check
      const hasMetadata = await waitForMetadata(video);
      if (!mountedRef.current) {
        candidate.getTracks().forEach((t) => t.stop());
        return;
      }

      const w = video.videoWidth;
      const h = video.videoHeight;
      if (hasMetadata && w >= 960 && h >= 540) {
        streamRef.current = candidate;
        setState({ phase: "ready", width: w, height: h });
        return;
      }
      candidate.getTracks().forEach((t) => t.stop());
      video.srcObject = null;
    }

    if (mountedRef.current) {
      setState({
        phase: "error",
        reason: "Kamera-Auflösung zu niedrig (< 960×540). Bitte aktuelles Phone nutzen.",
      });
    }
  }, [videoRef]);

  const stop = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    if (mountedRef.current) setState({ phase: "idle" });
  }, [videoRef]);

  return { state, start, stop };
}
