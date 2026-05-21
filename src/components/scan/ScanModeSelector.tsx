import { useState } from "react";
import { Camera, Layers, ArrowRight, Clock, Target, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Mode-Selector vor jedem Scan.
 *
 * Quick-Scan-Lite (2-Foto, UA-Prior-Calibration, ±5mm hartfloor, 60-90sec)
 * Premium-Scan (KIRI-Photogrammetry, ~70 Frames, ±3mm, 90sec) — wird
 * in Phase 4 auf Premium-Scan-Pro (5-Frame-Calibration + 2-Foto + Bankkarte,
 * ±3mm typical, max 4 min) umgestellt.
 *
 * Klick auf Card → onSelect(mode). Parent routet zur Capture-Component.
 */

export type ScanMode = "quick" | "premium";

type Props = {
  onSelect: (mode: ScanMode) => void;
  defaultMode?: ScanMode;
};

export default function ScanModeSelector({ onSelect, defaultMode }: Props) {
  const [selected, setSelected] = useState<ScanMode | null>(defaultMode ?? null);

  return (
    <div className="min-h-screen flex flex-col items-center justify-start p-6 overflow-y-auto bg-background text-foreground">
      <div className="w-full max-w-md mx-auto pt-8 pb-6">
        <Smartphone className="h-10 w-10 mb-2 text-accent mx-auto" />
        <h1 className="text-2xl font-bold mb-2 text-center">Wie soll dein Fuß gescannt werden?</h1>
        <p className="text-sm text-muted-foreground text-center mb-6">
          Zwei Modi mit unterschiedlichen Tradeoffs zwischen Geschwindigkeit
          und Genauigkeit.
        </p>

        <div className="space-y-3 mb-6">
          {/* Quick-Scan-Lite-Card */}
          <button
            type="button"
            onClick={() => setSelected("quick")}
            className={`w-full text-left p-4 rounded-xl border-2 transition-colors ${
              selected === "quick"
                ? "border-accent bg-accent/10"
                : "border-border bg-card hover:border-muted-foreground"
            }`}
          >
            <div className="flex items-center gap-3 mb-2">
              <Camera className="h-6 w-6 text-accent" />
              <h2 className="text-lg font-bold">Quick-Scan-Lite</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              Zwei Fotos sitzend (oben + seitlich). Ideal wenn's schnell gehen
              soll. Auf hartem Boden (kein Teppich).
            </p>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="flex items-center gap-1.5">
                <Target className="h-3.5 w-3.5 text-emerald-600" />
                <span className="font-semibold">±5 mm</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-emerald-600" />
                <span className="font-semibold">60-90 sek</span>
              </div>
              <div className="text-muted-foreground text-[11px]">2D-Maße</div>
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">
              Setup: gedrucktes Blatt an Wand · Fuß auf dem Blatt · Ferse berührt Wand · harter Boden
            </p>
          </button>

          {/* Premium-Scan-Card */}
          <button
            type="button"
            onClick={() => setSelected("premium")}
            className={`w-full text-left p-4 rounded-xl border-2 transition-colors ${
              selected === "premium"
                ? "border-accent bg-accent/10"
                : "border-border bg-card hover:border-muted-foreground"
            }`}
          >
            <div className="flex items-center gap-3 mb-2">
              <Layers className="h-6 w-6 text-accent" />
              <h2 className="text-lg font-bold">Premium-Scan</h2>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-accent text-white ml-auto">
                3D
              </span>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              Photogrammetry: rundherum gehen, ~70 Frames automatisch
              aufgenommen. Liefert vollständiges 3D-Mesh + Bogen-Detail.
            </p>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="flex items-center gap-1.5">
                <Target className="h-3.5 w-3.5 text-emerald-600" />
                <span className="font-semibold">±3 mm</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-emerald-600" />
                <span className="font-semibold">~90 sek</span>
              </div>
              <div className="text-muted-foreground text-[11px]">3D-Mesh</div>
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">
              Setup: gedrucktes Blatt + gemusterte Socke + Stativ empfohlen
            </p>
          </button>
        </div>

        <Button
          size="lg"
          disabled={!selected}
          onClick={() => selected && onSelect(selected)}
          className="w-full gap-2"
        >
          {selected ? "Weiter" : "Wähle einen Modus"}
          {selected && <ArrowRight className="h-5 w-5" />}
        </Button>

        <p className="text-[11px] text-muted-foreground text-center mt-4">
          Beide Modi liefern dir Schuhgrößen-Empfehlungen. Premium gibt dir
          zusätzlich Daten zu Bogen, Pronation und Custom-Fit.
        </p>
      </div>
    </div>
  );
}
