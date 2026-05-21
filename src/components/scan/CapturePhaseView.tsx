import { Camera, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  TopPhotoIllustration,
  SidePhotoIllustration,
} from "@/components/scan/PhotoIllustrations";
import type { GateResult, Phase, SelectedFoot } from "@/lib/scan/gates";

type Props = {
  phase: Phase; // "top" | "side"
  selectedFoot: SelectedFoot;
  /** 0..1 progress towards auto-trigger (HOLD_TIME_*_MS).  */
  holdProgress: number;
  /** Failed-hard gates (Tap NIE bypass-bar) für Hint + Disable-Reason. */
  failedHard: GateResult[];
  /** Failed-soft gates (Tap bypass-bar mit Warning). */
  failedSoft: GateResult[];
  /** Tap-Fallback-Button visible nach 8s ohne Auto-Trigger. */
  tapFallbackVisible: boolean;
  speechOn: boolean;
  speechSupported: boolean;
  /** Manual capture trigger (Tap-Button). Caller validates Hard-Gates. */
  onTap: () => void;
  onToggleSpeech: () => void;
  onCancel: () => void;
};

/**
 * Capture-UI für Top-Foto + Side-Foto. Single-Component für beide Phases —
 * differenzieren durch `phase` prop. Phase-View bleibt pure: Hold-progress +
 * Gates kommen vom Top-Level (TwoPhotoCaptureV2.runCaptureTick).
 *
 * Hard-vs-Soft-Distinction: Tap-Fallback-Button disabled wenn failedHard.length>0
 * (kein bypass von Phone-Orientation/Marker-Coverage/PnP-Z/etc). Soft-Fails
 * (Brightness, Gyro-Variance) lassen Tap zu mit Warning-Toast — caller-side.
 */
export default function CapturePhaseView({
  phase,
  selectedFoot,
  holdProgress,
  failedHard,
  failedSoft,
  tapFallbackVisible,
  speechOn,
  speechSupported,
  onTap,
  onToggleSpeech,
  onCancel,
}: Props) {
  const headline =
    phase === "top" ? "Foto 1 von 2 — von oben" : "Foto 2 von 2 — von der Seite";
  const Illustration =
    phase === "top" ? TopPhotoIllustration : SidePhotoIllustration;

  // Konkreter Hint aus failedHard zuerst (kritisch), dann failedSoft.
  // Bei all-green: positive feedback.
  let hintText = "Sieht gut aus — gleich kommt der Auslöser";
  if (failedHard.length > 0) {
    hintText = failedHard[0].reason ?? "Etwas stimmt nicht — checke Phone und Blatt";
  } else if (failedSoft.length > 0) {
    hintText = failedSoft[0].reason ?? "Wackelig — kurz stillhalten";
  } else if (holdProgress >= 1) {
    hintText = "Aufnahme!";
  } else if (holdProgress > 0) {
    hintText = "Stillhalten… Foto wird gleich ausgelöst";
  }

  const tapDisabled = failedHard.length > 0;
  const dashTotal = 219.9;
  return (
    <div className="absolute inset-0 flex flex-col">
      <div className="bg-gradient-to-b from-black/85 to-transparent p-3 text-center">
        <p className="text-base font-semibold mb-1">{headline}</p>
        <div className="bg-white/95 rounded-lg p-2 mx-auto max-w-[260px] mb-2">
          <Illustration selectedFoot={selectedFoot} />
        </div>
        <div className="flex items-center justify-center gap-3 text-[11px]">
          <Indicator label="Phone" ok={!isHardFailed(failedHard, ["Phone normal", "Phone seitlich", "Phone parallel", "Bewegungssensor"])} />
          <Indicator label="Blatt" ok={!isHardFailed(failedHard, ["Marker", "Phone weiter weg", "Blatt"])} />
          <Indicator label="Fuß" ok={!isHardFailed(failedHard, ["Fuß"])} />
          <Indicator label="Licht" ok={failedSoft.findIndex((g) => g.reason?.includes("Licht") || g.reason?.includes("hell")) === -1} />
          {speechSupported && (
            <button
              type="button"
              onClick={onToggleSpeech}
              className={`ml-1 px-1.5 py-0.5 rounded ${
                speechOn ? "bg-white/20" : "bg-white/5 text-white/50"
              }`}
              aria-label={speechOn ? "Voice aus" : "Voice an"}
            >
              {speechOn ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
            </button>
          )}
        </div>
      </div>

      <div className="flex-1" />

      <div className="bg-gradient-to-t from-black/80 to-transparent p-4 text-center">
        <div className="relative w-20 h-20 mx-auto mb-3">
          <svg viewBox="0 0 80 80" className="w-full h-full">
            <circle cx="40" cy="40" r="35" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="6" />
            <circle
              cx="40"
              cy="40"
              r="35"
              fill="none"
              stroke="#10b981"
              strokeWidth="6"
              strokeDasharray={`${holdProgress * dashTotal} ${dashTotal}`}
              transform="rotate(-90 40 40)"
              style={{ transition: "stroke-dasharray 100ms linear" }}
            />
          </svg>
          <Camera className="h-8 w-8 absolute inset-0 m-auto text-white" />
        </div>
        <p className="text-xs text-white/85 max-w-xs mx-auto">{hintText}</p>

        {tapFallbackVisible && (
          <Button
            size="sm"
            disabled={tapDisabled}
            onClick={onTap}
            className="mt-3 gap-2"
            title={tapDisabled ? "Hard-Gate blockiert Capture" : "Foto manuell auslösen"}
          >
            <Camera className="h-4 w-4" />
            {tapDisabled ? "Erst Hard-Gates fixen" : "Manuell auslösen"}
          </Button>
        )}

        <Button variant="ghost" size="sm" onClick={onCancel} className="mt-3 text-xs text-white/60 ml-2">
          Abbrechen
        </Button>
      </div>
    </div>
  );
}

function isHardFailed(failed: GateResult[], keywords: string[]): boolean {
  return failed.some((g) => keywords.some((k) => g.reason?.includes(k)));
}

function Indicator({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center gap-1">
      <span className={`inline-block w-2 h-2 rounded-full ${ok ? "bg-emerald-400" : "bg-red-400"}`} aria-hidden />
      <span className="text-white/80">{label}</span>
    </div>
  );
}
