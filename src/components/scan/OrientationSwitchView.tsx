import { useEffect, useRef } from "react";
import { RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  useScreenOrientation,
  type OrientationType,
} from "@/hooks/scan/useScreenOrientation";

const TIMEOUT_MS = 30_000;

type Props = {
  onLandscapeDetected: (type: OrientationType) => void;
  onTimeout: () => void;
  onCancel: () => void;
};

/**
 * Wartet auf Phone-Rotation zu landscape-primary ODER landscape-secondary.
 * Auto-advance bei Detection, Timeout 30s → onTimeout (Frontend zeigt
 * ValidationErrorView mit context="orientation"). Browser ohne
 * screen.orientation: Hook returnt undefined → User braucht Tap-Fallback
 * "Trotzdem weiter".
 */
export default function OrientationSwitchView({
  onLandscapeDetected,
  onTimeout,
  onCancel,
}: Props) {
  const orient = useScreenOrientation();
  const startedAtRef = useRef<number>(Date.now());
  const advancedRef = useRef(false);

  useEffect(() => {
    if (advancedRef.current) return;
    if (orient === "landscape-primary" || orient === "landscape-secondary") {
      advancedRef.current = true;
      onLandscapeDetected(orient);
    }
  }, [orient, onLandscapeDetected]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (advancedRef.current) return;
      if (Date.now() - startedAtRef.current >= TIMEOUT_MS) {
        advancedRef.current = true;
        onTimeout();
      }
    }, 500);
    return () => window.clearInterval(interval);
  }, [onTimeout]);

  const orientationApiAvailable = typeof window !== "undefined" && !!window.screen?.orientation;

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-background text-foreground">
      <div className="max-w-md mx-auto">
        <RotateCw className="h-14 w-14 mb-4 text-accent mx-auto animate-pulse" />
        <h1 className="text-xl font-bold mb-2">Phone seitlich drehen</h1>
        <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
          Foto 2 muss <strong>querformat</strong> sein. Dreh dein Phone um 90° —
          Lade-Buchse zur Seite, Camera zeigt zum Fuß.
        </p>

        <div className="flex justify-center mb-6">
          <svg viewBox="0 0 120 80" className="w-32 h-20" aria-hidden>
            <rect
              x="50"
              y="10"
              width="20"
              height="36"
              rx="3"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-muted-foreground animate-pulse"
            />
            <text x="60" y="60" textAnchor="middle" fontSize="14" fill="currentColor" className="text-accent">
              ↻
            </text>
            <rect
              x="44"
              y="32"
              width="36"
              height="16"
              rx="3"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-accent"
            />
          </svg>
        </div>

        {!orientationApiAvailable && (
          <p className="text-xs text-amber-600 mb-3">
            Browser meldet Orientation nicht — wenn Phone schon quer ist, manuell weiter:
          </p>
        )}

        {!orientationApiAvailable && (
          <Button
            size="lg"
            onClick={() => onLandscapeDetected("landscape-primary")}
            className="w-full mb-2"
          >
            Phone ist schon quer — weiter
          </Button>
        )}

        <Button variant="ghost" size="sm" onClick={onCancel} className="text-xs">
          Scan abbrechen
        </Button>
      </div>
    </div>
  );
}
