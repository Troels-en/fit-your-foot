import { useState } from "react";
import { ArrowRight, ArrowLeft, Footprints, Layers, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Pre-Flow vor Quick-Scan-Lite — sammelt zwei Pflicht-Antworten bevor
 * Capture-Stream startet:
 *   1. Welcher Fuß wird gescannt? → links/rechts (Side-Direction-Mirror)
 *   2. Welcher Boden? → hart (weiter) / weich (block-screen)
 *
 * Hartboden-Constraint ist cross-tier: weicher Boden (Teppich/Schaumstoff/
 * Yoga-Matte) deformiert sich unter dem Fuß und unter dem Blatt → Floor-
 * Plane-Assumption gebrochen. In keinem Tier supported. Premium-Scan hilft
 * dabei nicht — User braucht Hartboden-Setup.
 *
 * A3-Hint sichtbar: Schuhgröße ≥43 → A4 zu klein, A3-PDF nutzen.
 */

export type SelectedFoot = "left" | "right";
export type FloorType = "hard" | "soft";
export type MatFormat = "A4" | "A3";

export type PreFlowResult = {
  selectedFoot: SelectedFoot;
  floorType: "hard"; // nur hard kann durch — soft führt zum Block-Screen
  matFormat: MatFormat;
};

type Props = {
  onContinue: (result: PreFlowResult) => void;
  onCancel: () => void;
};

export default function PreFlowScreen({ onContinue, onCancel }: Props) {
  const [foot, setFoot] = useState<SelectedFoot | null>(null);
  const [floor, setFloor] = useState<FloorType | null>(null);
  const [matFormat, setMatFormat] = useState<MatFormat>("A4");

  const allReady = foot !== null && floor === "hard";
  const showSoftBlock = floor === "soft";

  if (showSoftBlock) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background text-foreground">
        <div className="w-full max-w-md mx-auto text-center">
          <AlertTriangle className="h-14 w-14 mb-4 text-destructive mx-auto" />
          <h1 className="text-2xl font-bold mb-3">Weicher Boden geht nicht</h1>
          <p className="text-sm text-muted-foreground mb-4">
            Auf Teppich, Schaumstoff oder einer Yoga-Matte verformt sich der
            Untergrund unter dem Fuß und unter dem Blatt — die Maße werden
            ungenau. Das gilt für Quick-Scan und Premium-Scan gleichermaßen.
          </p>
          <p className="text-sm font-semibold mb-6">
            Bitte einen harten Boden suchen: Fliesen, Holz, Laminat, PVC.
          </p>
          <div className="space-y-2">
            <Button
              size="lg"
              onClick={() => setFloor(null)}
              className="w-full gap-2"
            >
              Ich habe jetzt harten Boden
              <ArrowRight className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onCancel}
              className="w-full text-xs"
            >
              Scan abbrechen
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-start p-6 overflow-y-auto bg-background text-foreground">
      <div className="w-full max-w-md mx-auto pt-8 pb-6">
        <h1 className="text-2xl font-bold mb-2 text-center">Vor dem Scan</h1>
        <p className="text-sm text-muted-foreground text-center mb-6">
          Zwei kurze Fragen — dann geht's los.
        </p>

        {/* Frage 1: Welcher Fuß? */}
        <section className="mb-6">
          <p className="text-sm font-semibold mb-2" id="foot-question">1. Welcher Fuß wird gescannt?</p>
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-labelledby="foot-question">
            {(["left", "right"] as SelectedFoot[]).map((f) => (
              <button
                key={f}
                type="button"
                role="radio"
                aria-checked={foot === f}
                tabIndex={foot === f || (foot === null && f === "right") ? 0 : -1}
                onKeyDown={(e) => {
                  if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
                    e.preventDefault();
                    setFoot(f === "left" ? "right" : "left");
                  }
                }}
                onClick={() => setFoot(f)}
                className={`p-4 rounded-xl border-2 transition-colors flex flex-col items-center gap-2 ${
                  foot === f
                    ? "border-accent bg-accent/10"
                    : "border-border bg-card hover:border-muted-foreground"
                }`}
              >
                <Footprints
                  className={`h-7 w-7 ${f === "left" ? "" : "-scale-x-100"} ${
                    foot === f ? "text-accent" : "text-muted-foreground"
                  }`}
                />
                <span className="text-sm font-semibold">
                  {f === "left" ? "Linker Fuß" : "Rechter Fuß"}
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* Frage 2: Welcher Boden? */}
        <section className="mb-6">
          <p className="text-sm font-semibold mb-2" id="floor-question">2. Was für ein Boden?</p>
          <div className="space-y-2" role="radiogroup" aria-labelledby="floor-question">
            <button
              type="button"
              role="radio"
              aria-checked={floor === "hard"}
              tabIndex={floor === "hard" || (floor === null) ? 0 : -1}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                  e.preventDefault();
                  setFloor("soft");
                }
              }}
              onClick={() => setFloor("hard")}
              className={`w-full p-3 rounded-xl border-2 text-left transition-colors flex items-start gap-3 ${
                floor === "hard"
                  ? "border-accent bg-accent/10"
                  : "border-border bg-card hover:border-muted-foreground"
              }`}
            >
              <Layers className={`h-5 w-5 mt-0.5 flex-none ${
                floor === "hard" ? "text-accent" : "text-muted-foreground"
              }`} />
              <div>
                <p className="text-sm font-semibold">Hart</p>
                <p className="text-xs text-muted-foreground">Fliesen, Holz, Laminat, PVC</p>
              </div>
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={floor === "soft"}
              tabIndex={floor === "soft" ? 0 : -1}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                  e.preventDefault();
                  setFloor("hard");
                }
              }}
              onClick={() => setFloor("soft")}
              className={`w-full p-3 rounded-xl border-2 text-left transition-colors flex items-start gap-3 ${
                floor === "soft"
                  ? "border-destructive bg-destructive/10"
                  : "border-border bg-card hover:border-muted-foreground"
              }`}
            >
              <Layers className={`h-5 w-5 mt-0.5 flex-none ${
                floor === "soft" ? "text-destructive" : "text-muted-foreground"
              }`} />
              <div>
                <p className="text-sm font-semibold">Weich</p>
                <p className="text-xs text-muted-foreground">Teppich, Schaumstoff, Yoga-Matte</p>
              </div>
            </button>
          </div>
        </section>

        {/* Frage 3: Welches Mat-Format? — bestimmt Backend-Skala (30mm vs 45mm) */}
        <section className="mb-6">
          <p className="text-sm font-semibold mb-2" id="mat-question">
            3. Welches Format hast du gedruckt?
          </p>
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-labelledby="mat-question">
            <button
              type="button"
              role="radio"
              aria-checked={matFormat === "A4"}
              onClick={() => setMatFormat("A4")}
              className={`p-3 rounded-xl border-2 text-left transition-colors ${
                matFormat === "A4"
                  ? "border-accent bg-accent/10"
                  : "border-border bg-card hover:border-muted-foreground"
              }`}
            >
              <p className="text-sm font-semibold">A4</p>
              <p className="text-xs text-muted-foreground">Schuhgröße bis EU 42</p>
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={matFormat === "A3"}
              onClick={() => setMatFormat("A3")}
              className={`p-3 rounded-xl border-2 text-left transition-colors ${
                matFormat === "A3"
                  ? "border-accent bg-accent/10"
                  : "border-border bg-card hover:border-muted-foreground"
              }`}
            >
              <p className="text-sm font-semibold">A3</p>
              <p className="text-xs text-muted-foreground">Schuhgröße EU 43+</p>
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">
            Noch nicht gedruckt? PDF herunterladen:{" "}
            <a
              href={matFormat === "A3" ? "/scan-mat-a3.html" : "/scan-mat.html"}
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-medium"
            >
              {matFormat === "A3" ? "scan-mat-a3.html" : "scan-mat.html"}
            </a>
          </p>
        </section>

        <Button
          size="lg"
          disabled={!allReady}
          onClick={() => {
            if (foot && floor === "hard") {
              onContinue({ selectedFoot: foot, floorType: "hard", matFormat });
            }
          }}
          className="w-full gap-2"
        >
          {allReady ? "Weiter zum Setup" : "Beide Fragen beantworten"}
          {allReady && <ArrowRight className="h-5 w-5" />}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
          className="w-full mt-2 text-xs gap-1"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Zurück zur Mode-Wahl
        </Button>
      </div>
    </div>
  );
}
