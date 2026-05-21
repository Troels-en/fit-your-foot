import { useEffect, useRef, useState } from "react";

/**
 * Wired-Worker für Frame-Quality-Scoring. Off-main-thread für Blur+Brightness.
 * Fallback auf Inline-Scoring wenn:
 *  - Worker-Construct schlägt fehl (alte Browser, stricter CSP)
 *  - Worker liefert "no-offscreen" zurück (kein OffscreenCanvas im Worker)
 */

export type QualityScore = { blur: number; brightness: number };

export function useFrameQuality() {
  const workerRef = useRef<Worker | null>(null);
  const pendingRef = useRef<Map<number, (s: QualityScore | null) => void>>(new Map());
  const idCounterRef = useRef(0);
  // Status-Ref damit `score` immer den aktuellen Status sieht — auch wenn
  // die Closure aus einem alten Render captured wurde (z. B. setInterval).
  const statusRef = useRef<"unknown" | "ok" | "fallback">("unknown");
  const [workerStatus, setWorkerStatus] = useState<"unknown" | "ok" | "fallback">("unknown");

  const updateStatus = (s: "unknown" | "ok" | "fallback") => {
    statusRef.current = s;
    setWorkerStatus(s);
  };

  useEffect(() => {
    let worker: Worker | null = null;
    try {
      worker = new Worker(
        new URL("../../lib/scan/quality.worker.ts", import.meta.url),
        { type: "module" }
      );
      worker.onmessage = (e: MessageEvent) => {
        const { id, ok, blurScore, brightness, reason } = e.data ?? {};
        const resolver = pendingRef.current.get(id);
        if (!resolver) return;
        pendingRef.current.delete(id);
        if (ok) {
          resolver({ blur: blurScore, brightness });
        } else {
          if (reason === "no-offscreen") updateStatus("fallback");
          resolver(null);
        }
      };
      worker.onerror = () => {
        updateStatus("fallback");
      };
      workerRef.current = worker;
      updateStatus("ok");
    } catch {
      updateStatus("fallback");
    }
    return () => {
      if (worker) {
        worker.terminate();
        workerRef.current = null;
      }
      pendingRef.current.clear();
    };
  }, []);

  /** Score a frame. Returns null if blocked → caller should use inline fallback. */
  const score = async (blob: Blob): Promise<QualityScore | null> => {
    const w = workerRef.current;
    if (!w || statusRef.current === "fallback") return inlineScore(blob);

    const id = ++idCounterRef.current;
    return new Promise<QualityScore | null>((resolve) => {
      const timeout = window.setTimeout(() => {
        pendingRef.current.delete(id);
        // Worker hängt? Fallback inline statt null returnen — sonst dropt
        // der Capture-Loop alle Frames bis Worker recovered.
        inlineScore(blob).then(resolve);
      }, 5000);
      pendingRef.current.set(id, (result) => {
        window.clearTimeout(timeout);
        if (!result) {
          inlineScore(blob).then(resolve);
        } else {
          resolve(result);
        }
      });
      try {
        w.postMessage({ blob, id });
      } catch {
        pendingRef.current.delete(id);
        window.clearTimeout(timeout);
        inlineScore(blob).then(resolve);
      }
    });
  };

  return { score, workerStatus };
}

/** Inline-Scoring im Main-Thread als Fallback. Performance-Hit auf low-end. */
async function inlineScore(blob: Blob): Promise<QualityScore> {
  try {
    const bitmap = await createImageBitmap(blob, {
      resizeWidth: 320,
      resizeHeight: 240,
      resizeQuality: "low",
    });
    const canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = 240;
    const ctx = canvas.getContext("2d");
    if (!ctx) return { blur: 0, brightness: 0 };
    ctx.drawImage(bitmap, 0, 0);
    const img = ctx.getImageData(0, 0, 320, 240);

    const gray = new Float32Array(320 * 240);
    for (let i = 0; i < gray.length; i++) {
      const r = img.data[i * 4];
      const g = img.data[i * 4 + 1];
      const b = img.data[i * 4 + 2];
      gray[i] = 0.299 * r + 0.587 * g + 0.114 * b;
    }
    let sum = 0;
    for (let i = 0; i < gray.length; i++) sum += gray[i];
    const brightness = sum / gray.length;

    let mean = 0;
    let n = 0;
    const lap: number[] = [];
    for (let y = 1; y < 239; y++) {
      for (let x = 1; x < 319; x++) {
        const c = gray[y * 320 + x];
        const u = gray[(y - 1) * 320 + x];
        const d = gray[(y + 1) * 320 + x];
        const l = gray[y * 320 + (x - 1)];
        const r = gray[y * 320 + (x + 1)];
        const v = u + d + l + r - 4 * c;
        lap.push(v);
        mean += v;
        n += 1;
      }
    }
    mean /= n;
    let varSum = 0;
    for (const v of lap) varSum += (v - mean) ** 2;
    return { blur: varSum / n, brightness };
  } catch {
    return { blur: 0, brightness: 0 };
  }
}
