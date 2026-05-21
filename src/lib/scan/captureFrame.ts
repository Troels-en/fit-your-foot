// Frame-Extraction aus dem Live-Video-Stream.
// Nutzt OffscreenCanvas wenn verfügbar (off-main-thread für JPEG-encoding),
// sonst regular Canvas im Main-Thread.

const HAS_OFFSCREEN = typeof OffscreenCanvas !== "undefined";

export type CaptureOptions = {
  /** JPEG-Qualität 0-1, default 0.92 */
  quality?: number;
  /** Maximum-File-Size in Bytes; bei größer wird neu encoded mit niedriger Qualität */
  maxBytes?: number;
};

const DEFAULT_OPTIONS: Required<CaptureOptions> = {
  quality: 0.92,
  maxBytes: 1.5 * 1024 * 1024, // 1.5 MB
};

/**
 * Extracted frame from <video>-Element als JPEG-Blob.
 * Mit Per-Frame-Size-Cap: encoded zuerst mit options.quality, wenn zu groß
 * re-encoded mit reduzierter Qualität (Schritte 0.85, 0.75).
 */
export async function captureFrame(
  video: HTMLVideoElement,
  options: CaptureOptions = {}
): Promise<Blob> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (w === 0 || h === 0) {
    throw new Error("Video stream nicht ready (videoWidth/Height = 0)");
  }

  const qualities = [opts.quality, 0.85, 0.75];
  for (const q of qualities) {
    const blob = await renderToJpeg(video, w, h, q);
    if (blob.size <= opts.maxBytes) return blob;
  }
  // Selbst bei q=0.75 zu groß — gib trotzdem zurück; Caller entscheidet
  return renderToJpeg(video, w, h, 0.75);
}

async function renderToJpeg(
  video: HTMLVideoElement,
  w: number,
  h: number,
  quality: number
): Promise<Blob> {
  if (HAS_OFFSCREEN) {
    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("OffscreenCanvas 2D context nicht verfügbar");
    ctx.drawImage(video, 0, 0, w, h);
    return canvas.convertToBlob({ type: "image/jpeg", quality });
  }
  // Fallback: regular Canvas im Main-Thread
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context nicht verfügbar");
  ctx.drawImage(video, 0, 0, w, h);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("toBlob returned null"))),
      "image/jpeg",
      quality
    );
  });
}
