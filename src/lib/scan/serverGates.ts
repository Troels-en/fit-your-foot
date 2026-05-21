/**
 * Server-side gate-evaluator (v11 design). Konsumiert DetectExtendedResult
 * und prüft alle Gates die nur server-side computable sind: PnP-Z, Side-Yaw-
 * Ortho, Camera-Side-Sign, Heel-Wand-Gap, Foot-Confidence, Homography-
 * Residuals, Foot-Pivot-Gate (heel/toe/yaw delta zu Top-Pose).
 *
 * Pure-function: deterministic, no side-effects, easily unit-testable. Hard-
 * vs-Soft-Severity matched zur gates.ts-Konvention.
 */

import {
  type DetectExtendedResult,
} from "@/lib/scan/extendedApi";
import {
  type GateResult,
  type Phase,
  type SelectedFoot,
  PNP_Z_MIN_MM,
  PNP_Z_MAX_MM,
  SIDE_YAW_MAX_DELTA_DEG,
  HEEL_WAND_GAP_MAX_MM,
  FOOT_CONFIDENCE_MIN,
  HOMOGRAPHY_RESIDUALS_MAX_PX,
} from "@/lib/scan/gates";

export type TopPoseRef = {
  heel: { x: number; y: number };
  toe: { x: number; y: number };
  yawDeg: number;
};

export type ServerGatesInput = {
  result: DetectExtendedResult | null;
  phase: Phase;
  selectedFoot: SelectedFoot;
  /** Top-pose reference for foot-pivot-gate (Side-Phase only). */
  topPose: TopPoseRef | null;
};

export type ComposedServerGates = {
  allHardOk: boolean;
  allSoftOk: boolean;
  failedHard: GateResult[];
  failedSoft: GateResult[];
};

const FOOT_PIVOT_HEEL_TOE_MAX_MM = 5;
const FOOT_PIVOT_YAW_MAX_DEG = 3;

export function evaluateServerGates(input: ServerGatesInput): ComposedServerGates {
  const { result, phase, selectedFoot, topPose } = input;
  const failed: GateResult[] = [];

  if (!result) {
    return {
      allHardOk: false,
      allSoftOk: true,
      failedHard: [
        { ok: false, severity: "hard", reason: "Server liefert noch keine Detection." },
      ],
      failedSoft: [],
    };
  }
  if (!result.ok) {
    return {
      allHardOk: false,
      allSoftOk: true,
      failedHard: [
        {
          ok: false,
          severity: "hard",
          reason: result.error ?? "Server-Detection fehlgeschlagen.",
        },
      ],
      failedSoft: [],
    };
  }

  // ===== Side-Phase only =====
  if (phase === "side") {
    if (result.camera_center_marker_coords_mm) {
      const z = result.camera_center_marker_coords_mm.z;
      if (z < PNP_Z_MIN_MM) {
        failed.push({
          ok: false,
          severity: "hard",
          reason: "Phone etwas höher halten — Knöchelhöhe.",
        });
      } else if (z > PNP_Z_MAX_MM) {
        failed.push({
          ok: false,
          severity: "hard",
          reason: "Phone tiefer halten — Knöchelhöhe.",
        });
      }
    }
    if (
      result.side_yaw_delta_to_expected_medial_deg !== null &&
      Math.abs(result.side_yaw_delta_to_expected_medial_deg) > SIDE_YAW_MAX_DELTA_DEG
    ) {
      const dir = selectedFoot === "right" ? "rechts" : "links";
      failed.push({
        ok: false,
        severity: "hard",
        reason: `Phone gerade ausrichten — Camera von ${dir} parallel zum Fuß.`,
      });
    }
    if (result.side_sign_matches_selected_foot === false) {
      const correctSide = selectedFoot === "right" ? "rechten" : "linken";
      failed.push({
        ok: false,
        severity: "hard",
        reason: `Camera auf falscher Seite — vom ${correctSide} Fuß aus fotografieren.`,
      });
    }
    if (
      topPose &&
      result.heel_position_marker_coords_mm &&
      result.toe_tip_position_marker_coords_mm &&
      result.foot_yaw_angle_deg !== null
    ) {
      const heelDx = result.heel_position_marker_coords_mm.x - topPose.heel.x;
      const heelDy = result.heel_position_marker_coords_mm.y - topPose.heel.y;
      const heelMove = Math.hypot(heelDx, heelDy);
      const toeDx = result.toe_tip_position_marker_coords_mm.x - topPose.toe.x;
      const toeDy = result.toe_tip_position_marker_coords_mm.y - topPose.toe.y;
      const toeMove = Math.hypot(toeDx, toeDy);
      const yawDelta = Math.abs(result.foot_yaw_angle_deg - topPose.yawDeg);
      if (
        heelMove > FOOT_PIVOT_HEEL_TOE_MAX_MM ||
        toeMove > FOOT_PIVOT_HEEL_TOE_MAX_MM ||
        yawDelta > FOOT_PIVOT_YAW_MAX_DEG
      ) {
        failed.push({
          ok: false,
          severity: "hard",
          reason: "Fuß hat sich bewegt — bitte stillhalten.",
        });
      }
    }
  }

  // ===== Top-Phase only =====
  if (phase === "top") {
    if (
      result.heel_position_marker_coords_mm &&
      result.heel_position_marker_coords_mm.y > HEEL_WAND_GAP_MAX_MM
    ) {
      failed.push({
        ok: false,
        severity: "hard",
        reason: "Ferse fest gegen die Wand drücken.",
      });
    }
  }

  // ===== Cross-Phase =====
  if (result.foot_confidence < FOOT_CONFIDENCE_MIN) {
    failed.push({
      ok: false,
      severity: "hard",
      reason: "Fuß teilweise verdeckt — Hosenbein hoch, Knöchel frei, Zehen sichtbar.",
    });
  }
  if (
    result.homography_residuals_px !== null &&
    result.homography_residuals_px > HOMOGRAPHY_RESIDUALS_MAX_PX
  ) {
    failed.push({
      ok: false,
      severity: "hard",
      reason: "Blatt liegt nicht flach — Wellen oder Knicke glätten.",
    });
  }
  if (
    result.foot_bbox_to_paper_edge_min_mm !== null &&
    result.foot_bbox_to_paper_edge_min_mm < 0
  ) {
    failed.push({
      ok: false,
      severity: "hard",
      reason: "Fuß ragt über das Blatt hinaus — größeres Format (A3) drucken.",
    });
  }

  const failedHard = failed.filter((f) => f.severity === "hard");
  const failedSoft = failed.filter((f) => f.severity === "soft");
  return {
    allHardOk: failedHard.length === 0,
    allSoftOk: failedSoft.length === 0,
    failedHard,
    failedSoft,
  };
}
