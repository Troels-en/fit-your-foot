/**
 * Phase 3: Pose-Stepper-UI als Bullet-Bar.
 *
 * 6 Pose-Anchors mit Labels. Aktiver Pose-Slot wird highlightet basierend auf
 * currentInWindow. Reached-Posen sind grün checkmark, in-progress amber pulse.
 *
 * WICHTIG: das ist purely UI-Layer — beeinflusst KEINE Frame-Acceptance.
 * Frame-Acceptance läuft via yaw-bucket-Logic (poseBuckets.ts) unverändert.
 * Stepper-State wird unit-test-verified als independent (poseStepper.test.ts).
 */

import { POSE_LABELS, type PoseState } from "@/lib/scan/poseStepper";
import { CheckCircle2, Circle } from "lucide-react";

type Props = {
  state: PoseState;
};

export default function PoseStepperBar({ state }: Props) {
  return (
    <div className="bg-black/40 backdrop-blur-sm rounded-lg p-2">
      <p className="text-[10px] font-mono text-white/60 mb-1.5 text-center">
        Pose-Schritte
      </p>
      <div className="flex items-center justify-between gap-1">
        {POSE_LABELS.map((label, i) => {
          const isReached = state.reached[i];
          const isActive = state.currentInWindow === i && !isReached;
          return (
            <div
              key={i}
              className={`flex flex-col items-center gap-0.5 flex-1 ${
                isActive ? "scale-110" : ""
              } transition-transform`}
            >
              {isReached ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              ) : isActive ? (
                <Circle className="h-4 w-4 text-amber-400 animate-pulse" />
              ) : (
                <Circle className="h-4 w-4 text-white/30" />
              )}
              <span
                className={`text-[8px] font-mono leading-tight text-center ${
                  isReached
                    ? "text-emerald-200"
                    : isActive
                    ? "text-amber-200"
                    : "text-white/40"
                }`}
              >
                {label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
