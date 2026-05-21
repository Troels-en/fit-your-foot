import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Loader2, XCircle, Download, RotateCw } from "lucide-react";
import PhotogrammetryCapture, {
  type CaptureMode,
  type SockThickness,
} from "@/components/scan/PhotogrammetryCapture";
import ScanModeSelector, { type ScanMode } from "@/components/scan/ScanModeSelector";
import PreFlowScreen, { type PreFlowResult } from "@/components/scan/PreFlowScreen";
import TwoPhotoCapture from "@/components/scan/TwoPhotoCapture";
import TwoPhotoCaptureV2 from "@/components/scan/TwoPhotoCaptureV2";
import type { FrameMeta } from "@/lib/scan/kiriContract";
import {
  pollKiriUntilDone,
  submitKiriFrames,
  triggerMeshExtraction,
  type KiriStatusResult,
  type KiriStatusText,
} from "@/lib/scan/kiriClient";
import { Button } from "@/components/ui/button";

const SOCK_THICKNESS_MM: Record<SockThickness, number> = {
  none: 0,
  thin: 1,
  medium: 3,
  thick: 6,
};

/**
 * E2E-Test der Photogrammetry-Pipeline:
 *   capture → kiri-submit → poll kiri-status → modelUrl anzeigen.
 *
 * AbortController stoppt Polling bei Unmount oder Reset, damit kein Zombie-
 * Polling-Loop weitere KIRI-Credits verbrennt.
 */

type UploadPhase =
  | { kind: "uploading"; frameCount: number; totalBytes: number }
  | { kind: "polling"; status: KiriStatusResult; elapsed: number }
  | { kind: "done"; status: KiriStatusResult }
  | { kind: "error"; message: string };

const STATUS_LABEL: Record<KiriStatusText, string> = {
  uploading: "Wird zu KIRI hochgeladen…",
  queuing: "In KIRI-Queue (warte auf Slot)…",
  processing: "KIRI rechnet das 3D-Mesh…",
  successful: "Fertig!",
  failed: "Reconstruction fehlgeschlagen",
  expired: "Job ist expired",
  unknown: "Unbekannter Status",
};

export default function PhotogrammetryTest() {
  // Phase 1: Mode-Selector — User wählt Quick vs Premium pro Scan.
  // null = Selector noch sichtbar, sonst direkt zur Capture-Component.
  const [scanMode, setScanMode] = useState<ScanMode | null>(null);
  // Phase 1.5: PreFlow für Quick-Scan-Lite — sammelt selectedFoot + Hard-
  // Floor-Confirm vor Capture-Stream-Start. null = noch nicht gemacht.
  const [preFlow, setPreFlow] = useState<PreFlowResult | null>(null);
  const [phase, setPhase] = useState<UploadPhase | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  // Cleanup: bei Unmount Polling abbrechen damit keine weiteren KIRI-Credit-
  // Calls feuern.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  const safeSetPhase = (p: UploadPhase | null) => {
    if (mountedRef.current) setPhase(p);
  };

  const handleSubmit = async (
    frames: FrameMeta[],
    meta: { sockThickness: SockThickness; captureMode: CaptureMode }
  ) => {
    const totalBytes = frames.reduce((s, f) => s + f.blob.size, 0);
    safeSetPhase({ kind: "uploading", frameCount: frames.length, totalBytes });
    startedAtRef.current = Date.now();

    let submitResult;
    try {
      submitResult = await submitKiriFrames(frames, {
        sockThicknessMm: SOCK_THICKNESS_MM[meta.sockThickness],
        captureMode: meta.captureMode,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload fehlgeschlagen";
      safeSetPhase({ kind: "error", message: msg });
      toast.error(`Submit fehlgeschlagen: ${msg}`);
      return;
    }

    if (!mountedRef.current) return;
    toast.success(`${submitResult.frame_count} Frames an KIRI übergeben`);
    console.info("[kiri] submit ok", submitResult);

    // Neuer AbortController für diesen Polling-Run.
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    try {
      const finalState = await pollKiriUntilDone(
        submitResult.session_id,
        submitResult.client_token,
        (status) => {
          if (!mountedRef.current) return;
          const elapsed = startedAtRef.current ? Date.now() - startedAtRef.current : 0;
          safeSetPhase({ kind: "polling", status, elapsed });
          console.info("[kiri] status", status);
        },
        { signal: ac.signal }
      );
      if (!mountedRef.current) return;
      safeSetPhase({ kind: "done", status: finalState });
      if (finalState.kiri_status === 2) {
        toast.success("3D-Mesh ready!");
        // Phase 3: Trigger Mesh-Extraction (Modal /extract-mesh) für
        // foot_length_mm / ball_width_mm / heel_width_mm aus dem OBJ.
        // Fire-and-forget — User sieht Toast wenn measurements reinkommen.
        void triggerMeshExtraction(submitResult.session_id).then((extr) => {
          if (!mountedRef.current) return;
          if (extr.ok && extr.measurements) {
            const m = extr.measurements;
            toast.success(
              `Maße extrahiert: ${(m.foot_length_mm ?? 0).toFixed(0)}mm Länge`
            );
          } else if (extr.error) {
            console.warn("mesh-extraction failed", extr.error);
          }
        });
      } else {
        toast.error(`KIRI: ${finalState.kiri_status_text}`);
      }
    } catch (err) {
      if (!mountedRef.current) return;
      // Aborts sind erwartet (Unmount/Reset) — nicht als Fehler anzeigen.
      const msg = err instanceof Error ? err.message : "Polling abgebrochen";
      if (msg === "polling aborted") return;
      safeSetPhase({ kind: "error", message: msg });
      toast.error(msg);
    }
  };

  const reset = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setPhase(null);
    startedAtRef.current = null;
    setScanMode(null); // zurück zum Mode-Selector
    setPreFlow(null); // PreFlow-State auch reseten
  };

  // Phase 1: Mode-Selector vor jedem Scan zeigen
  if (scanMode === null && phase === null) {
    return <ScanModeSelector onSelect={setScanMode} />;
  }

  // Phase 1.5: PreFlow-Gate (Fußwahl + Hard-Floor-Confirm) — Cross-Tier-
  // Constraint: Hard-Floor + selectedFoot werden für BEIDE Modi gebraucht
  // (Quick und Premium). Soft-Floor blockt beide Tiers.
  if (scanMode !== null && preFlow === null && phase === null) {
    return (
      <PreFlowScreen
        onContinue={setPreFlow}
        onCancel={() => setScanMode(null)}
      />
    );
  }

  // Quick-Scan-Path → 2-Foto-Component. preFlow.selectedFoot wird via Prop
  // weitergereicht damit Side-Direction-Mirror in Capture-Pipeline ankommt.
  // Feature-Flag ?v11=true → V2 (refactored, v11 design). Default false bis
  // Manual-Test-Pass + Modal-Deploy. Old TwoPhotoCapture bleibt als Fallback
  // bis Phase-5-Cleanup.
  const useV11 = (() => {
    if (typeof window === "undefined") return false;
    const params = new URLSearchParams(window.location.search);
    return params.get("v11") === "true";
  })();
  if (scanMode === "quick" && preFlow && phase === null) {
    const QuickCapture = useV11 ? TwoPhotoCaptureV2 : TwoPhotoCapture;
    return (
      <QuickCapture
        selectedFoot={preFlow.selectedFoot}
        matFormat={preFlow.matFormat}
        onSubmit={(result) => {
          if (result.ok) {
            toast.success(
              `Quick-Scan: ${result.measurements?.foot_length_mm.toFixed(0)}mm Länge`
            );
          } else {
            toast.error(`Quick-Scan failed: ${result.error}`);
          }
        }}
        onCancel={() => {
          setPreFlow(null);
          setScanMode(null);
        }}
      />
    );
  }

  // Premium-Scan-Path → existing PhotogrammetryCapture
  if (scanMode === "premium" && phase === null) {
    return <PhotogrammetryCapture onSubmit={handleSubmit} />;
  }

  if (phase.kind === "uploading") {
    return (
      <CenteredScreen>
        <Loader2 className="h-12 w-12 animate-spin mb-4 text-accent" />
        <h1 className="text-xl font-bold mb-1">Frames werden hochgeladen…</h1>
        <p className="text-sm text-muted-foreground">
          {phase.frameCount} Frames · {(phase.totalBytes / 1024 / 1024).toFixed(2)} MB
        </p>
      </CenteredScreen>
    );
  }

  if (phase.kind === "polling") {
    const s = phase.status;
    const elapsedSec = Math.floor(phase.elapsed / 1000);
    return (
      <CenteredScreen>
        <Loader2 className="h-12 w-12 animate-spin mb-4 text-accent" />
        <h1 className="text-xl font-bold mb-1">{STATUS_LABEL[s.kiri_status_text]}</h1>
        <p className="text-sm text-muted-foreground mb-1">
          KIRI-Status: <code className="bg-muted px-1 rounded">{s.kiri_status_text}</code>
        </p>
        <p className="text-xs text-muted-foreground mb-1">
          Job: <code className="bg-muted px-1 rounded">{s.kiri_serialize.slice(0, 12)}…</code>
        </p>
        <p className="text-xs text-muted-foreground">Wartet seit {elapsedSec}s</p>
      </CenteredScreen>
    );
  }

  if (phase.kind === "done") {
    const s = phase.status;
    if (s.kiri_status === 2 && s.kiri_model_url) {
      return (
        <CenteredScreen>
          <CheckCircle2 className="h-16 w-16 mb-4 text-emerald-600" />
          <h1 className="text-2xl font-bold mb-2">3D-Scan erfolgreich</h1>
          <p className="text-sm text-muted-foreground mb-1">
            {s.kiri_frame_count} Frames verarbeitet
          </p>
          <p className="text-xs text-muted-foreground mb-6">
            Job: <code className="bg-muted px-1 rounded">{s.kiri_serialize}</code>
          </p>
          <a
            href={s.kiri_model_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-foreground text-background mb-3"
          >
            <Download className="h-4 w-4" /> Mesh-ZIP herunterladen
          </a>
          <p className="text-xs text-muted-foreground mb-6">
            Link ist 60min gültig — danach automatisch refreshed beim nächsten Poll
          </p>
          <Button onClick={reset} variant="outline" className="gap-2">
            <RotateCw className="h-4 w-4" /> Neuer Test-Scan
          </Button>
        </CenteredScreen>
      );
    }
    return (
      <CenteredScreen>
        <XCircle className="h-16 w-16 mb-4 text-red-500" />
        <h1 className="text-2xl font-bold mb-2">Scan fehlgeschlagen</h1>
        <p className="text-sm text-muted-foreground mb-1">
          KIRI-Status: <code className="bg-muted px-1 rounded">{s.kiri_status_text}</code>
        </p>
        {s.kiri_error && (
          <p className="text-sm text-red-500 mb-6 max-w-sm">{s.kiri_error}</p>
        )}
        <Button onClick={reset} variant="outline" className="gap-2">
          <RotateCw className="h-4 w-4" /> Neuer Test-Scan
        </Button>
      </CenteredScreen>
    );
  }

  return (
    <CenteredScreen>
      <XCircle className="h-16 w-16 mb-4 text-red-500" />
      <h1 className="text-2xl font-bold mb-2">Fehler</h1>
      <p className="text-sm text-red-500 mb-6 max-w-sm">{phase.message}</p>
      <Button onClick={reset} variant="outline" className="gap-2">
        <RotateCw className="h-4 w-4" /> Neuer Test-Scan
      </Button>
    </CenteredScreen>
  );
}

function CenteredScreen({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
      {children}
    </div>
  );
}
