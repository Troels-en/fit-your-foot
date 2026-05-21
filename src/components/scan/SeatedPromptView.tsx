import { Camera, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidePhotoIllustration } from "@/components/scan/PhotoIllustrations";
import type { SelectedFoot } from "@/lib/scan/voiceStrings";

type Props = {
  selectedFoot: SelectedFoot;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * Zwischen-Prompt nach Top-Foto: User bestätigt sitzbereit → next-Phase
 * (orientation-switch). Phase-View bleibt pure (kein Camera-Stream-Manage).
 */
export default function SeatedPromptView({ selectedFoot, onConfirm, onCancel }: Props) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-background text-foreground overflow-y-auto">
      <div className="w-full max-w-md mx-auto py-6">
        <CheckCircle2 className="h-12 w-12 mb-3 text-emerald-600 mx-auto" />
        <h1 className="text-xl font-bold mb-2">Foto 1 im Kasten</h1>
        <p className="text-sm text-muted-foreground mb-4">
          Jetzt das zweite Foto — von der Seite. Bequemer im Sitzen.
        </p>

        <div className="bg-white/95 rounded-lg p-3 mb-4">
          <SidePhotoIllustration selectedFoot={selectedFoot} />
        </div>

        <div className="text-left bg-card border border-border rounded-lg p-3 mb-4 text-sm">
          <p className="font-semibold mb-1">So geht's weiter:</p>
          <ol className="space-y-1 text-xs text-muted-foreground list-decimal list-inside">
            <li>Setz dich auf einen Stuhl neben dem Blatt.</li>
            <li>Dein Fuß bleibt auf dem Blatt — Ferse weiter an der Wand.</li>
            <li>Halte das Phone auf Knöchel-Höhe, leicht gekippt Richtung Fuß.</li>
          </ol>
        </div>

        <Button size="lg" onClick={onConfirm} className="w-full gap-2">
          <Camera className="h-5 w-5" /> Bin sitzbereit — Foto 2 starten
        </Button>
        <Button variant="ghost" size="sm" onClick={onCancel} className="w-full mt-2 text-xs">
          Scan abbrechen
        </Button>
      </div>
    </div>
  );
}
