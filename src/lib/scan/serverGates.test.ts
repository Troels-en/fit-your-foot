import { describe, expect, it } from "vitest";
import { evaluateServerGates, type TopPoseRef } from "./serverGates";
import type { DetectExtendedResult } from "./extendedApi";

function baseResult(overrides: Partial<DetectExtendedResult> = {}): DetectExtendedResult {
  return {
    ok: true,
    marker_count: 24,
    markers: [],
    mat_format: "A4",
    homography: null,
    homography_residuals_px: 0.5,
    plane_normal: null,
    camera_center_marker_coords_mm: { x: 60, y: 90, z: 200 },
    camera_forward_dot_normal: 0.97,
    side_yaw_delta_to_expected_medial_deg: 2,
    side_sign_matches_selected_foot: true,
    foot_bounding_box_marker_coords_mm: [10, 10, 80, 200],
    foot_confidence: 0.92,
    heel_position_marker_coords_mm: { x: 50, y: 1 },
    toe_tip_position_marker_coords_mm: { x: 50, y: 210 },
    foot_yaw_angle_deg: 1.5,
    foot_bbox_to_paper_edge_min_mm: 15,
    marker_convex_hull_area_fraction: 0.85,
    marker_spread_along_foot_axis_mm: 150,
    brightness_mean: 150,
    brightness_stddev: 20,
    ...overrides,
  };
}

describe("evaluateServerGates", () => {
  it("returns hard-fail when result is null", () => {
    const res = evaluateServerGates({
      result: null,
      phase: "top",
      selectedFoot: "right",
      topPose: null,
    });
    expect(res.allHardOk).toBe(false);
    expect(res.failedHard).toHaveLength(1);
  });

  it("returns hard-fail when result.ok=false", () => {
    const res = evaluateServerGates({
      result: baseResult({ ok: false, error: "boom" }),
      phase: "top",
      selectedFoot: "right",
      topPose: null,
    });
    expect(res.allHardOk).toBe(false);
    expect(res.failedHard[0].reason).toContain("boom");
  });

  it("passes for valid top-phase frame", () => {
    const res = evaluateServerGates({
      result: baseResult(),
      phase: "top",
      selectedFoot: "right",
      topPose: null,
    });
    expect(res.allHardOk).toBe(true);
    expect(res.failedHard).toHaveLength(0);
  });

  it("hard-fails heel-wand-gap when heel.y > 3mm (top-phase only)", () => {
    const res = evaluateServerGates({
      result: baseResult({ heel_position_marker_coords_mm: { x: 50, y: 8 } }),
      phase: "top",
      selectedFoot: "right",
      topPose: null,
    });
    expect(res.allHardOk).toBe(false);
    expect(res.failedHard.some((g) => g.reason?.includes("Wand"))).toBe(true);
  });

  it("ignores heel-wand-gap in side-phase", () => {
    const res = evaluateServerGates({
      result: baseResult({ heel_position_marker_coords_mm: { x: 50, y: 8 } }),
      phase: "side",
      selectedFoot: "right",
      topPose: null,
    });
    // heel-wand-gap not checked in side; other gates pass
    expect(res.allHardOk).toBe(true);
  });

  it("hard-fails PnP-Z too low (side-phase)", () => {
    const res = evaluateServerGates({
      result: baseResult({ camera_center_marker_coords_mm: { x: 60, y: 90, z: 50 } }),
      phase: "side",
      selectedFoot: "right",
      topPose: null,
    });
    expect(res.allHardOk).toBe(false);
    expect(res.failedHard.some((g) => g.reason?.includes("höher"))).toBe(true);
  });

  it("hard-fails PnP-Z too high (side-phase)", () => {
    const res = evaluateServerGates({
      result: baseResult({ camera_center_marker_coords_mm: { x: 60, y: 90, z: 500 } }),
      phase: "side",
      selectedFoot: "right",
      topPose: null,
    });
    expect(res.allHardOk).toBe(false);
    expect(res.failedHard.some((g) => g.reason?.includes("tiefer"))).toBe(true);
  });

  it("hard-fails side-yaw-ortho when delta > 15° (side-phase)", () => {
    const res = evaluateServerGates({
      result: baseResult({ side_yaw_delta_to_expected_medial_deg: 25 }),
      phase: "side",
      selectedFoot: "right",
      topPose: null,
    });
    expect(res.allHardOk).toBe(false);
    expect(res.failedHard.some((g) => g.reason?.includes("parallel"))).toBe(true);
  });

  it("hard-fails camera-side-sign mismatch", () => {
    const res = evaluateServerGates({
      result: baseResult({ side_sign_matches_selected_foot: false }),
      phase: "side",
      selectedFoot: "right",
      topPose: null,
    });
    expect(res.allHardOk).toBe(false);
    expect(res.failedHard.some((g) => g.reason?.includes("falscher"))).toBe(true);
  });

  it("hard-fails foot-confidence < 0.85", () => {
    const res = evaluateServerGates({
      result: baseResult({ foot_confidence: 0.5 }),
      phase: "top",
      selectedFoot: "right",
      topPose: null,
    });
    expect(res.allHardOk).toBe(false);
    expect(res.failedHard.some((g) => g.reason?.includes("verdeckt"))).toBe(true);
  });

  it("hard-fails homography-residuals > 3px", () => {
    const res = evaluateServerGates({
      result: baseResult({ homography_residuals_px: 5 }),
      phase: "top",
      selectedFoot: "right",
      topPose: null,
    });
    expect(res.allHardOk).toBe(false);
    expect(res.failedHard.some((g) => g.reason?.includes("flach"))).toBe(true);
  });

  it("hard-fails foot-pivot when heel moves >5mm vs top-pose (side-phase)", () => {
    const topPose: TopPoseRef = {
      heel: { x: 50, y: 1 },
      toe: { x: 50, y: 210 },
      yawDeg: 1.5,
    };
    const res = evaluateServerGates({
      result: baseResult({ heel_position_marker_coords_mm: { x: 60, y: 1 } }),
      phase: "side",
      selectedFoot: "right",
      topPose,
    });
    expect(res.allHardOk).toBe(false);
    expect(res.failedHard.some((g) => g.reason?.includes("bewegt"))).toBe(true);
  });

  it("hard-fails foot-pivot when foot-yaw moves >3° vs top-pose (side-phase)", () => {
    const topPose: TopPoseRef = {
      heel: { x: 50, y: 1 },
      toe: { x: 50, y: 210 },
      yawDeg: 1.5,
    };
    const res = evaluateServerGates({
      result: baseResult({ foot_yaw_angle_deg: 10 }),
      phase: "side",
      selectedFoot: "right",
      topPose,
    });
    expect(res.allHardOk).toBe(false);
    expect(res.failedHard.some((g) => g.reason?.includes("bewegt"))).toBe(true);
  });

  it("passes side-phase with all green + matching top-pose", () => {
    const topPose: TopPoseRef = {
      heel: { x: 50, y: 1 },
      toe: { x: 50, y: 210 },
      yawDeg: 1.5,
    };
    const res = evaluateServerGates({
      result: baseResult(),
      phase: "side",
      selectedFoot: "right",
      topPose,
    });
    expect(res.allHardOk).toBe(true);
    expect(res.failedHard).toHaveLength(0);
  });

  it("hard-fails when foot-bbox extends past paper edge", () => {
    const res = evaluateServerGates({
      result: baseResult({ foot_bbox_to_paper_edge_min_mm: -5 }),
      phase: "top",
      selectedFoot: "right",
      topPose: null,
    });
    expect(res.allHardOk).toBe(false);
    expect(res.failedHard.some((g) => g.reason?.includes("A3"))).toBe(true);
  });
});
