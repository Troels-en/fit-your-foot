import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  Camera,
  CheckCircle2,
  Loader2,
  AlertCircle,
  RotateCcw,
  ArrowRight,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { submitScan } from "@/lib/api";
import { DEMO_FOOT_MM } from "@/lib/demoFoot";
import { buildReturnUrl, readClientToken } from "@/lib/scanRedirectUrls";
import ScanModeSelector, { type ScanMode } from "@/components/scan/ScanModeSelector";

type Step = "intro" | "top" | "side" | "submitting" | "success";
type ValidationState = "idle" | "validating" | "ok" | "issues";

type ValidateResponse = { ok: boolean; issues: string[] };

const ISSUE_MESSAGES: Record<string, string> = {
  a4_not_detected:
    "Kein A4-Blatt im Bild erkannt. Leg ein A4-Blatt neben den Fuß.",
  a4_multiple:
    "Mehrere rechteckige Objekte erkannt. Entferne alles außer einem A4-Blatt.",
  too_dark: "Foto zu dunkel. Mehr Licht oder einen helleren Raum wählen.",
  too_blurry: "Foto unscharf. Handy ruhig halten und nochmal.",
  foot_not_detected: "Fuß nicht erkannt. Fuß komplett ins Bild bringen.",
  foot_cut_off:
    "Fuß ist am Bildrand abgeschnitten. Etwas weiter weg halten.",
  too_small: "Fuß zu klein im Bild. Näher rangehen.",
};

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL as string | undefined;

type PhotoSlot = {
  file: File | null;
  previewUrl: string | null;
  validation: ValidationState;
  issues: string[];
};

const emptyPhoto: PhotoSlot = {
  file: null,
  previewUrl: null,
  validation: "idle",
  issues: [],
};

// sessionStorage persistence — iOS Safari / Android Chrome reload the
// webview when the camera opens via `<input capture>`, wiping in-memory
// React state. We persist the capture step (not the files themselves —
// File objects are not serializable) so the user lands back on the
// correct page after the camera roundtrip.
const STORAGE_PREFIX = "fitly-scan-";
const PERSISTABLE_STEPS: Step[] = ["top", "side"];

function loadPersistedStep(sessionId: string | undefined): Step | null {
  if (!sessionId || typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_PREFIX + sessionId);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { step?: string };
    if (parsed.step === "top" || parsed.step === "side") return parsed.step;
  } catch {
    /* ignore */
  }
  return null;
}

function persistStep(sessionId: string | undefined, step: Step) {
  if (!sessionId || typeof window === "undefined") return;
  try {
    if (PERSISTABLE_STEPS.includes(step)) {
      sessionStorage.setItem(STORAGE_PREFIX + sessionId, JSON.stringify({ step }));
    } else {
      sessionStorage.removeItem(STORAGE_PREFIX + sessionId);
    }
  } catch {
    /* ignore */
  }
}

export default function MobileScan() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get("returnTo");
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>(() => loadPersistedStep(sessionId) ?? "intro");
  const [mode, setMode] = useState<ScanMode | null>(null);
  const [topPhoto, setTopPhoto] = useState<PhotoSlot>(emptyPhoto);
  const [sidePhoto, setSidePhoto] = useState<PhotoSlot>(emptyPhoto);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [demoSending, setDemoSending] = useState(false);

  // Persist every step change so a camera-roundtrip reload lands on the right page.
  useEffect(() => {
    persistStep(sessionId, step);
  }, [sessionId, step]);

  const topInputRef = useRef<HTMLInputElement>(null);
  const sideInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const id = "google-fonts-inter";
    if (!document.getElementById(id)) {
      const link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      link.href =
        "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap";
      document.head.appendChild(link);
    }
  }, []);

  // Cleanup blob URLs
  useEffect(() => {
    return () => {
      if (topPhoto.previewUrl) URL.revokeObjectURL(topPhoto.previewUrl);
      if (sidePhoto.previewUrl) URL.revokeObjectURL(sidePhoto.previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const validatePhoto = async (
    file: File,
    view: "top" | "side"
  ): Promise<ValidateResponse> => {
    if (!BACKEND_URL) {
      // Backend not configured — accept the photo so the demo flow still works.
      return { ok: true, issues: [] };
    }
    const fd = new FormData();
    fd.append("photo", file);
    fd.append("view", view);
    const res = await fetch(`${BACKEND_URL}/validate-photo`, {
      method: "POST",
      body: fd,
    });
    if (!res.ok) {
      throw new Error(`validate-photo HTTP ${res.status}`);
    }
    return (await res.json()) as ValidateResponse;
  };

  const handleCapture = async (
    view: "top" | "side",
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting same file
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    const setSlot = view === "top" ? setTopPhoto : setSidePhoto;
    const prev = view === "top" ? topPhoto : sidePhoto;
    if (prev.previewUrl) URL.revokeObjectURL(prev.previewUrl);

    setSlot({ file, previewUrl, validation: "validating", issues: [] });

    try {
      const result = await validatePhoto(file, view);
      setSlot({
        file,
        previewUrl,
        validation: result.ok ? "ok" : "issues",
        issues: result.issues ?? [],
      });
    } catch (err) {
      console.error("validate-photo failed", err);
      toast.error("Foto-Prüfung nicht erreichbar");
      setSlot({
        file,
        previewUrl,
        validation: "issues",
        issues: [],
      });
    }
  };

  const retake = (view: "top" | "side") => {
    const setSlot = view === "top" ? setTopPhoto : setSidePhoto;
    const prev = view === "top" ? topPhoto : sidePhoto;
    if (prev.previewUrl) URL.revokeObjectURL(prev.previewUrl);
    setSlot(emptyPhoto);
    setTimeout(
      () => (view === "top" ? topInputRef : sideInputRef).current?.click(),
      0
    );
  };

  const submitMeasure = async () => {
    if (!sessionId || !topPhoto.file || !sidePhoto.file) return;
    setStep("submitting");
    setSubmitError(null);

    if (!BACKEND_URL) {
      // Fallback to demo data via direct Supabase update
      try {
        await submitScan({ session_id: sessionId, ...DEMO_FOOT_MM });
        finishSuccess();
      } catch (err) {
        console.error(err);
        setSubmitError("Scan konnte nicht gespeichert werden.");
        setStep("side");
      }
      return;
    }

    try {
      const fd = new FormData();
      fd.append("session_id", sessionId);
      fd.append("photo_top", topPhoto.file);
      fd.append("photo_side", sidePhoto.file);
      const res = await fetch(`${BACKEND_URL}/measure`, {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        let detail = `HTTP ${res.status}`;
        try {
          const j = await res.json();
          if (typeof j.detail === "string") detail = j.detail;
        } catch {
          /* ignore */
        }
        throw new Error(detail);
      }
      const data = await res.json();
      if (data.warnings?.length) {
        for (const w of data.warnings) toast(w);
      }
      finishSuccess();
    } catch (err) {
      console.error("/measure failed", err);
      const msg = err instanceof Error ? err.message : "Unbekannter Fehler";
      setSubmitError(`Messung fehlgeschlagen: ${msg}`);
      setStep("side");
    }
  };

  const finishSuccess = () => {
    if (returnTo) {
      navigate(buildReturnUrl({ returnTo, sessionId: sessionId!, clientToken: readClientToken(searchParams.toString()) }));
    } else {
      setStep("success");
    }
  };

  const submitDemo = async () => {
    if (!sessionId) return;
    setDemoSending(true);
    try {
      await submitScan({ session_id: sessionId, ...DEMO_FOOT_MM });
      finishSuccess();
    } catch (err) {
      console.error(err);
      toast.error("Demo-Scan konnte nicht gespeichert werden");
    } finally {
      setDemoSending(false);
    }
  };

  // ---------- SUCCESS ----------
  if (step === "success") {
    return (
      <div
        className="min-h-screen bg-white text-neutral-900 flex items-center justify-center px-6"
        style={{ fontFamily: "Inter, system-ui, sans-serif" }}
      >
        <div className="max-w-md mx-auto text-center flex flex-col items-center gap-4">
          <div className="h-20 w-20 rounded-full bg-green-100 flex items-center justify-center">
            <CheckCircle2 className="h-12 w-12 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold">✓ Scan erfolgreich</h1>
          <p className="text-neutral-600">
            Geh zurück zum Laptop — das Ergebnis erscheint dort.
          </p>
          <p className="text-xs text-neutral-400 mt-4">Session: {sessionId}</p>
        </div>
      </div>
    );
  }

  // ---------- MODE-SELECTOR ----------
  if (step === "intro" && !mode) {
    return <ScanModeSelector onSelect={setMode} />;
  }

  // ---------- INTRO ----------
  if (step === "intro") {
    return (
      <Shell>
        <h1 className="text-2xl font-bold">
          {mode === "premium" ? "Premium-Scan" : "Quick-Scan-Lite"}
        </h1>
        {mode === "premium" && (
          <div className="mt-3 p-3 rounded-md bg-amber-50 border border-amber-200 text-xs text-amber-900">
            <strong>Beta:</strong> Premium-Pro-Backend (Zhang-Calibration +
            3D-Mesh) wird gerade deployed. Aktuell läuft 2-Foto-Flow auch
            hier. Genauigkeit ±5 mm wie Quick-Scan-Lite.
          </div>
        )}
        <p className="text-sm text-neutral-600 mt-2">
          Wir brauchen <strong>zwei Fotos</strong> deines Fußes. Beide werden
          direkt geprüft, bevor wir messen.
        </p>

        <div className="bg-neutral-50 rounded-2xl p-5 mt-5 text-sm text-neutral-700 leading-relaxed space-y-3">
          <div>
            <div className="font-semibold">📐 Was du brauchst</div>
            <div>1× A4-Blatt (oder 2× wenn möglich), guter Lichtraum.</div>
          </div>
          <div>
            <div className="font-semibold">📸 Schritt 1 — Top-Foto</div>
            <div>Senkrecht von oben: A4-Blatt + ganzer Fuß im Bild.</div>
          </div>
          <div>
            <div className="font-semibold">📸 Schritt 2 — Seiten-Foto</div>
            <div>Aus der Hocke seitlich auf Knöchelhöhe.</div>
          </div>
        </div>

        <button
          onClick={() => setStep("top")}
          className="w-full mt-6 h-14 rounded-full bg-neutral-900 text-white font-semibold inline-flex items-center justify-center gap-2 hover:bg-neutral-800 transition"
        >
          Los geht's <ArrowRight className="h-5 w-5" />
        </button>

        <div className="mt-6 pt-6 border-t border-dashed border-neutral-200">
          <button
            onClick={submitDemo}
            disabled={demoSending}
            className="w-full h-12 rounded-full font-bold text-neutral-900 border-2 border-neutral-900 inline-flex items-center justify-center gap-2 disabled:opacity-70"
            style={{ backgroundColor: "#f59e0b" }}
          >
            {demoSending ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" /> Wird gesendet…
              </>
            ) : (
              <>🚀 Demo-Daten verwenden</>
            )}
          </button>
          <p className="text-xs text-neutral-500 text-center mt-2">
            Für die Live-Präsentation — überspringt die Foto-Aufnahme.
          </p>
        </div>
      </Shell>
    );
  }

  // ---------- SUBMITTING ----------
  if (step === "submitting") {
    return (
      <Shell>
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-neutral-900" />
          <h1 className="text-xl font-bold">Messung läuft…</h1>
          <p className="text-sm text-neutral-600 text-center">
            Wir analysieren beide Fotos. Bleib kurz dran.
          </p>
        </div>
      </Shell>
    );
  }

  // ---------- TOP / SIDE CAPTURE ----------
  const view: "top" | "side" = step === "top" ? "top" : "side";
  const slot = view === "top" ? topPhoto : sidePhoto;
  const inputRef = view === "top" ? topInputRef : sideInputRef;

  const stepNumber = view === "top" ? 1 : 2;
  const title =
    view === "top" ? "Schritt 1 — Top-Foto" : "Schritt 2 — Seiten-Foto";
  const instruction =
    view === "top"
      ? "Leg ein A4-Blatt flach auf den Boden. Stell deinen nackten Fuß direkt daneben. Halte dein Handy senkrecht von oben — A4-Blatt und ganzer Fuß im Bild."
      : "Leg jetzt ein A4-Blatt flach neben deinen Fuß. Geh in die Hocke und mache das Foto von der Seite — Kamera ungefähr auf Knöchelhöhe.";

  const canContinue = slot.validation === "ok";

  return (
    <Shell>
      <div className="text-xs uppercase tracking-wider text-neutral-500">
        Schritt {stepNumber} / 2
      </div>
      <h1 className="text-2xl font-bold mt-1">{title}</h1>
      <p className="text-sm text-neutral-700 mt-2 leading-relaxed">
        {instruction}
      </p>

      {submitError && (
        <div className="mt-4 p-3 rounded-md bg-red-50 border border-red-200 text-sm text-red-800 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{submitError}</span>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleCapture(view, e)}
      />

      {/* Preview area */}
      <div className="aspect-square rounded-2xl bg-neutral-100 border-2 border-dashed border-neutral-300 mt-5 overflow-hidden flex items-center justify-center">
        {slot.previewUrl ? (
          <img
            src={slot.previewUrl}
            alt={`${view} preview`}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="text-neutral-400 text-sm text-center px-4">
            Noch kein Foto.<br />Tippe unten zum Aufnehmen.
          </div>
        )}
      </div>

      {/* Validation feedback */}
      {slot.validation === "validating" && (
        <div className="mt-3 flex items-center gap-2 text-sm text-neutral-600">
          <Loader2 className="h-4 w-4 animate-spin" /> Foto wird geprüft…
        </div>
      )}
      {slot.validation === "ok" && (
        <div className="mt-3 flex items-center gap-2 text-sm text-green-700 font-medium">
          <Check className="h-4 w-4" /> Foto sieht gut aus.
        </div>
      )}
      {slot.validation === "issues" && (
        <div className="mt-3 p-3 rounded-md bg-amber-50 border border-amber-200">
          <div className="flex items-center gap-2 text-sm font-semibold text-amber-900">
            <AlertCircle className="h-4 w-4" /> Bitte nochmal:
          </div>
          <ul className="mt-2 text-sm text-amber-900 list-disc pl-5 space-y-1">
            {slot.issues.length === 0 ? (
              <li>Foto konnte nicht geprüft werden.</li>
            ) : (
              slot.issues.map((code) => (
                <li key={code}>{ISSUE_MESSAGES[code] ?? code}</li>
              ))
            )}
          </ul>
        </div>
      )}

      {/* Action buttons */}
      {!slot.file ? (
        <button
          onClick={() => inputRef.current?.click()}
          className="w-full mt-5 h-14 rounded-full bg-neutral-900 text-white font-semibold inline-flex items-center justify-center gap-2 hover:bg-neutral-800 transition"
        >
          <Camera className="h-5 w-5" /> Foto aufnehmen
        </button>
      ) : (
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            onClick={() => retake(view)}
            className="h-12 rounded-full border-2 border-neutral-900 font-semibold inline-flex items-center justify-center gap-2 hover:bg-neutral-50"
          >
            <RotateCcw className="h-4 w-4" /> Neu
          </button>
          <button
            onClick={() => {
              if (view === "top") setStep("side");
              else submitMeasure();
            }}
            disabled={!canContinue}
            className="h-12 rounded-full bg-neutral-900 text-white font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-neutral-800"
          >
            {view === "top" ? (
              <>
                Weiter <ArrowRight className="h-4 w-4" />
              </>
            ) : (
              <>Messen</>
            )}
          </button>
        </div>
      )}

      {view === "side" && (
        <button
          onClick={() => setStep("top")}
          className="mt-4 text-sm text-neutral-500 hover:text-neutral-900 underline w-full text-center"
        >
          ← Zurück zum Top-Foto
        </button>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen w-full bg-white text-neutral-900"
      style={{ fontFamily: "Inter, system-ui, sans-serif" }}
    >
      <div className="w-full max-w-md mx-auto px-6 py-8 sm:px-6">
        <div className="text-center mb-6">
          <div className="text-2xl font-extrabold tracking-tight">Fitly</div>
          <div className="text-xs text-neutral-500 mt-1">Passform-Check</div>
        </div>
        {children}
      </div>
    </div>
  );
}
