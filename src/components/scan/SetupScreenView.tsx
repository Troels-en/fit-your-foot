import { ArrowLeft, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SetupIllustration } from "@/components/scan/PhotoIllustrations";
import type { SelectedFoot } from "@/lib/scan/voiceStrings";

type Props = {
  selectedFoot: SelectedFoot;
  onStart: () => void;
  onCancel: () => void;
};

/**
 * Pre-Capture Setup-Screen (v11). Pflicht-Icon-Leiste + 3-Sätze-Anweisung.
 * Pure-View-Component — alle State + Permission-Flow im Top-Level (V2).
 */
export default function SetupScreenView({ selectedFoot, onStart, onCancel }: Props) {
  const sideLabel = selectedFoot === "right" ? "rechten" : "linken";
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-start p-6 overflow-y-auto bg-background text-foreground">
      <div className="w-full max-w-md mx-auto pt-6 pb-6">
        <Camera className="h-10 w-10 mb-2 text-accent mx-auto" />
        <h1 className="text-2xl font-bold mb-1 text-center">Setup</h1>
        <p className="text-sm text-muted-foreground text-center mb-4">
          So bereitest du dich vor — das macht den Scan genauer.
        </p>

        <div className="grid grid-cols-4 gap-2 mb-4">
          {[
            { emoji: "🦶", label: "Barfuß" },
            { emoji: "👖", label: "Hosenbein hoch" },
            { emoji: "📍", label: "Knöchel frei" },
            { emoji: "✋", label: "Zehen locker" },
          ].map((item) => (
            <div
              key={item.label}
              className="flex flex-col items-center text-center p-2 rounded-lg bg-muted/30 border border-border"
            >
              <span className="text-xl mb-1" aria-hidden="true">{item.emoji}</span>
              <span className="text-[10px] font-medium leading-tight">{item.label}</span>
            </div>
          ))}
        </div>

        <div className="bg-muted/30 rounded-lg p-3 mb-4 flex justify-center">
          <SetupIllustration />
        </div>

        <ol className="space-y-2 text-sm mb-5 list-decimal list-inside text-foreground">
          <li>
            Leg das Blatt mit der kurzen Kante <strong>(↑ WAND-SEITE-Label)</strong> an die Wand.
          </li>
          <li>
            Setz dich auf einen normalen Stuhl. Beide Füße flach am Boden, Knie über dem Fuß. Stell deinen{" "}
            <strong>{sideLabel} Fuß</strong> mittig aufs Blatt — Ferse berührt die Wand. Belaste den Fuß normal, Zehen locker.
          </li>
          <li>
            Mach erst <strong>Foto 1 von oben</strong> (Phone hochkant), dann <strong>Foto 2 seitlich von außen</strong> (Phone querformat). Bewege Fuß und Blatt zwischen den Fotos NICHT.
          </li>
        </ol>

        <Button size="lg" onClick={onStart} className="w-full gap-2">
          <Camera className="h-5 w-5" /> Start Quick-Scan
        </Button>
        <Button variant="ghost" size="sm" onClick={onCancel} className="w-full mt-2 text-xs gap-1">
          <ArrowLeft className="h-3.5 w-3.5" /> Zurück
        </Button>
      </div>
    </div>
  );
}
