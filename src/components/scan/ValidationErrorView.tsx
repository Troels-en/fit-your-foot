import { ArrowLeft, RotateCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export type ValidationErrorContext =
  | "probe-ua"
  | "probe-other"
  | "top"
  | "side"
  | "orientation"
  | "submit";

type Props = {
  context: ValidationErrorContext;
  reason: string | null;
  onRetake: () => void;
  /** Side-Phase only: re-take both photos (foot may have moved). */
  onRetakeFromTop?: () => void;
  /** UA-unknown: switch to Premium-Pro path. */
  onSwitchPremium?: () => void;
  onCancel: () => void;
};

/**
 * Context-parametrized Error-View — pro errorContext eigenes Layout +
 * Button-Set:
 *   probe-ua: "Premium-Scan starten" + cancel
 *   probe-other: "Erneut versuchen" + cancel
 *   top: "Foto 1 neu" + cancel
 *   side: "Foto 2 neu" + "Beide Fotos neu" + cancel
 *   orientation: "Erneut versuchen" + cancel
 *   submit: "Erneut senden" + cancel
 */
export default function ValidationErrorView({
  context,
  reason,
  onRetake,
  onRetakeFromTop,
  onSwitchPremium,
  onCancel,
}: Props) {
  const layout = LAYOUTS[context];
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-background text-foreground">
      <div className="max-w-md mx-auto">
        <h1 className="text-xl font-bold mb-2">{layout.title}</h1>
        <p className="text-sm text-muted-foreground mb-2">{layout.description}</p>
        {reason && (
          <p className="text-xs text-amber-600 mb-6 max-w-sm mx-auto">{reason}</p>
        )}

        <div className="space-y-2 max-w-xs mx-auto">
          {context === "probe-ua" && onSwitchPremium && (
            <Button size="lg" onClick={onSwitchPremium} className="w-full gap-2">
              <Sparkles className="h-4 w-4" /> Premium-Scan starten
            </Button>
          )}
          {context !== "probe-ua" && (
            <Button size="lg" onClick={onRetake} className="w-full gap-2">
              <RotateCw className="h-4 w-4" /> {layout.primaryAction}
            </Button>
          )}
          {context === "side" && onRetakeFromTop && (
            <Button variant="outline" size="sm" onClick={onRetakeFromTop} className="w-full">
              Beide Fotos neu
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={onCancel} className="w-full text-xs gap-1">
            <ArrowLeft className="h-3.5 w-3.5" /> Abbrechen
          </Button>
        </div>
      </div>
    </div>
  );
}

const LAYOUTS: Record<
  ValidationErrorContext,
  { title: string; description: string; primaryAction: string }
> = {
  "probe-ua": {
    title: "Phone-Modell nicht unterstützt",
    description:
      "Dein Phone-Modell ist nicht im Quick-Scan-Lookup. Premium-Scan kalibriert die Camera selbst — daher unterstützt es jedes Phone.",
    primaryAction: "",
  },
  "probe-other": {
    title: "Camera-Setup-Check fehlgeschlagen",
    description: "Probe-Frame konnte nicht ausgewertet werden.",
    primaryAction: "Erneut versuchen",
  },
  top: {
    title: "Foto 1 muss neu gemacht werden",
    description: "Etwas hat im ersten Foto nicht gepasst.",
    primaryAction: "Foto 1 neu",
  },
  side: {
    title: "Foto 2 muss neu gemacht werden",
    description: "Etwas hat im zweiten Foto nicht gepasst.",
    primaryAction: "Foto 2 neu",
  },
  orientation: {
    title: "Phone-Drehung nicht erkannt",
    description: "Wir konnten kein Querformat detecten.",
    primaryAction: "Erneut versuchen",
  },
  submit: {
    title: "Senden fehlgeschlagen",
    description: "Die Maße konnten nicht berechnet werden.",
    primaryAction: "Erneut senden",
  },
};
