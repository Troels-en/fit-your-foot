/**
 * Phase 3: Coverage-Heatmap mit echten Daten.
 *
 * Visualisiert die akzeptierten Frame-Verteilung über Yaw + Beta:
 *   12 Yaw-Buckets × 3 Beta-Bands = 36 Cells
 *
 * - Yaw-Buckets: 0-360° in 12 × 30°-Slices (existing bucket-system)
 * - Beta-Bands:
 *     low (<35°)  — Phone fast horizontal
 *     mid (35-60°) — Equator-Orbit
 *     high (>60°) — steiler Top-Down
 *
 * Cell-Color basierend auf Frame-Count:
 *   0           → grau (leer)
 *   1-2         → amber (teilweise)
 *   ≥3          → emerald (voll)
 *
 * User sieht direkt welche Yaw+Elevation-Combos noch fehlen.
 *
 * KEINE Vapor-Mesh-Animation — nur echte Daten aus den akzeptierten Frames.
 */

import type { BucketState } from "@/lib/scan/poseBuckets";
import { BUCKET_COUNT, BUCKET_DEG, MIN_FRAMES_PER_BUCKET } from "@/lib/scan/poseBuckets";

export type BetaBand = "low" | "mid" | "high";
export const BETA_BANDS: BetaBand[] = ["high", "mid", "low"]; // top→bottom

export function betaToBand(beta: number): BetaBand {
  const abs = Math.abs(beta);
  if (abs >= 60) return "high";
  if (abs >= 35) return "mid";
  return "low";
}

export type HeatmapState = {
  /** 12 yaw-buckets × 3 beta-bands. cells[yawIdx][betaBandIdx] = frame-count */
  cells: number[][];
};

export function emptyHeatmapState(): HeatmapState {
  return {
    cells: Array.from({ length: BUCKET_COUNT }, () => [0, 0, 0]),
  };
}

export function recordFrameInHeatmap(
  state: HeatmapState,
  yawDeg: number,
  betaDeg: number
): HeatmapState {
  const yawIdx = Math.floor((((yawDeg % 360) + 360) % 360) / BUCKET_DEG);
  const band = betaToBand(betaDeg);
  const bandIdx = BETA_BANDS.indexOf(band);
  const cells = state.cells.map((row) => row.slice());
  cells[yawIdx][bandIdx] += 1;
  return { cells };
}

/**
 * Returns 0-1 progress: percentage of cells that meet MIN_FRAMES_PER_BUCKET.
 * Used as a holistic „how good is the coverage" score.
 */
export function heatmapCoverageScore(state: HeatmapState): number {
  const totalCells = BUCKET_COUNT * BETA_BANDS.length;
  let filled = 0;
  for (const row of state.cells) {
    for (const count of row) {
      if (count >= MIN_FRAMES_PER_BUCKET) filled++;
    }
  }
  return filled / totalCells;
}

type Props = {
  state: HeatmapState;
  /** liveYaw + liveBeta für „you are here"-Marker. Optional. */
  liveYaw?: number | null;
  liveBeta?: number | null;
};

export default function CoverageHeatmap({ state, liveYaw, liveBeta }: Props) {
  // Render als 12-column × 3-row Grid mit Color-Coding.
  // 12 Spalten = Yaw 0°…330° in 30°-Steps.
  // Top-Down-Visualisierung: high-band oben, low-band unten — logisch wie
  // Phone-Tilt-Höhe.

  const liveYawIdx =
    liveYaw == null ? null : Math.floor((((liveYaw % 360) + 360) % 360) / BUCKET_DEG);
  const liveBandIdx =
    liveBeta == null ? null : BETA_BANDS.indexOf(betaToBand(liveBeta));

  return (
    <div className="bg-black/40 backdrop-blur-sm rounded-lg p-2">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] font-mono text-white/60">Coverage</span>
        <span className="text-[10px] font-mono text-white/80">
          {Math.round(heatmapCoverageScore(state) * 100)}%
        </span>
      </div>
      <div className="grid gap-px" style={{ gridTemplateColumns: "auto 1fr" }}>
        {/* Row labels (top→bottom: high, mid, low) */}
        {BETA_BANDS.map((band, bandIdx) => (
          <div key={band} className="contents">
            <span className="text-[9px] font-mono text-white/50 pr-1 self-center">
              {band === "high" ? "↧↧" : band === "mid" ? "↧" : "—"}
            </span>
            <div
              className="grid gap-px"
              style={{ gridTemplateColumns: `repeat(${BUCKET_COUNT}, 1fr)` }}
            >
              {state.cells.map((cells, yawIdx) => {
                const count = cells[bandIdx];
                const isLive = liveYawIdx === yawIdx && liveBandIdx === bandIdx;
                let bg = "bg-white/10";
                if (count >= MIN_FRAMES_PER_BUCKET) bg = "bg-emerald-500";
                else if (count >= 1) bg = "bg-amber-500";
                return (
                  <div
                    key={yawIdx}
                    className={`h-3 rounded-sm ${bg} ${
                      isLive ? "ring-2 ring-white" : ""
                    }`}
                    title={`Yaw ${yawIdx * BUCKET_DEG}° / ${band}: ${count} frames`}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <p className="text-[9px] font-mono text-white/40 mt-1 text-center">
        12 Yaw × 3 Tilt — grün = fertig
      </p>
    </div>
  );
}
