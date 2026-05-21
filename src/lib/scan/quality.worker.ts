// Web-Worker für Frame-Quality-Scoring. Off-main-thread um Video-Preview
// nicht zu janken. Wenn OffscreenCanvas nicht verfügbar (alte Browser),
// signalisiert Worker einen Fallback-Wunsch zurück und Main-Thread macht's.

const HAS_OFFSCREEN = typeof OffscreenCanvas !== "undefined";

export type QualityRequest = {
  blob: Blob;
  id: number;
};

export type QualityResponse =
  | {
      id: number;
      ok: true;
      blurScore: number;
      brightness: number;
    }
  | {
      id: number;
      ok: false;
      reason: "no-offscreen" | "decode-failed";
    };

self.onmessage = async (e: MessageEvent<QualityRequest>) => {
  const { blob, id } = e.data;
  if (!HAS_OFFSCREEN) {
    (self as unknown as Worker).postMessage({ id, ok: false, reason: "no-offscreen" } satisfies QualityResponse);
    return;
  }
  try {
    const bitmap = await createImageBitmap(blob, {
      resizeWidth: 320,
      resizeHeight: 240,
      resizeQuality: "low",
    });
    const canvas = new OffscreenCanvas(320, 240);
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      (self as unknown as Worker).postMessage({ id, ok: false, reason: "decode-failed" } satisfies QualityResponse);
      return;
    }
    ctx.drawImage(bitmap, 0, 0, 320, 240);
    const imgData = ctx.getImageData(0, 0, 320, 240);

    const blurScore = laplacianVariance(imgData);
    const brightness = averageLuminance(imgData);

    (self as unknown as Worker).postMessage({
      id,
      ok: true,
      blurScore,
      brightness,
    } satisfies QualityResponse);
  } catch {
    (self as unknown as Worker).postMessage({ id, ok: false, reason: "decode-failed" } satisfies QualityResponse);
  }
};

/**
 * Laplacian-Variance Blur-Score. Higher = sharper.
 * Klassiker aus OpenCV: Apply Laplacian kernel, compute variance of result.
 * Threshold-Tuning kommt aus Spike-Tag-1 mit echten Captures.
 */
function laplacianVariance(imgData: ImageData): number {
  const { data, width, height } = imgData;
  const gray = new Float32Array(width * height);
  // RGBA → grayscale via luminance
  for (let i = 0; i < gray.length; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    gray[i] = 0.299 * r + 0.587 * g + 0.114 * b;
  }

  // Apply 4-connectivity Laplacian: center*-4 + neighbors
  const lap = new Float32Array((width - 2) * (height - 2));
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const c = gray[y * width + x];
      const u = gray[(y - 1) * width + x];
      const d = gray[(y + 1) * width + x];
      const l = gray[y * width + (x - 1)];
      const r = gray[y * width + (x + 1)];
      lap[(y - 1) * (width - 2) + (x - 1)] = u + d + l + r - 4 * c;
    }
  }

  // Compute variance
  let mean = 0;
  for (let i = 0; i < lap.length; i++) mean += lap[i];
  mean /= lap.length;
  let varSum = 0;
  for (let i = 0; i < lap.length; i++) {
    const d = lap[i] - mean;
    varSum += d * d;
  }
  return varSum / lap.length;
}

/**
 * Average luminance [0..255] über das Bild.
 */
function averageLuminance(imgData: ImageData): number {
  const { data } = imgData;
  let sum = 0;
  const pixels = data.length / 4;
  for (let i = 0; i < pixels; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    sum += 0.299 * r + 0.587 * g + 0.114 * b;
  }
  return sum / pixels;
}

export {};
