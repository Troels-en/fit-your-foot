import { CheckCircle2, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { MeasurementResult } from "@/lib/scan/twoPhotoApi";

type Props = {
  measurements: MeasurementResult | null;
  onReset: () => void;
};

export default function DonePhaseView({ measurements, onReset }: Props) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-background text-foreground">
      <CheckCircle2 className="h-16 w-16 mb-4 text-emerald-600" />
      <h1 className="text-2xl font-bold mb-2">Scan abgeschlossen</h1>
      {measurements?.measurements && (
        <div className="text-sm space-y-1 mb-4 mt-2">
          <p>
            Länge: <strong>{measurements.measurements.foot_length_mm.toFixed(0)} mm</strong>
          </p>
          <p>
            Ballenbreite: <strong>{measurements.measurements.ball_width_mm.toFixed(0)} mm</strong>
          </p>
          <p>
            Fersenbreite: <strong>{measurements.measurements.heel_width_mm.toFixed(0)} mm</strong>
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            EU-Größe: {measurements.measurements.eu_size}
          </p>
        </div>
      )}
      <Button onClick={onReset} variant="outline" className="gap-2">
        <RotateCw className="h-4 w-4" /> Neuer Scan
      </Button>
    </div>
  );
}
