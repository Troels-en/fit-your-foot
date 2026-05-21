import { supabase } from "@/integrations/supabase/client";
import type { FrameMeta } from "@/lib/scan/kiriContract";

/**
 * Frontend-Wrapper für die kiri-submit + kiri-status Edge-Functions.
 *
 * Polling ist abortable via AbortSignal — wichtig damit Component-Unmount /
 * Page-Navigate keine zombie-Polls mit weiteren KIRI-Credit-Calls triggert.
 */

export type KiriStatusText =
  | "uploading"
  | "processing"
  | "failed"
  | "successful"
  | "queuing"
  | "expired"
  | "unknown";

export type KiriSubmitResult = {
  ok: true;
  session_id: string;
  client_token: string;
  kiri_serialize: string;
  frame_count: number;
};

export type KiriStatusResult = {
  ok: true;
  session_id: string;
  kiri_serialize: string;
  kiri_status: number;
  kiri_status_text: KiriStatusText;
  kiri_model_url: string | null;
  kiri_error: string | null;
  kiri_frame_count: number | null;
  status: "pending" | "scanning" | "complete" | "error" | string;
  from_cache: boolean;
};

const TERMINAL_STATUSES = new Set([1, 2, 4]);

function extractError(error: unknown): string {
  if (error && typeof error === "object") {
    const ctx = (error as { context?: { error?: string } }).context;
    if (ctx?.error) return ctx.error;
    const msg = (error as { message?: string }).message;
    if (msg) return msg;
  }
  return "Unbekannter Fehler";
}

export async function submitKiriFrames(
  frames: FrameMeta[],
  options?: {
    sessionId?: string;
    clientToken?: string;
    shoeSlug?: string;
    /** Sock-Dicke in mm (0=barfuß, 1=dünn, 3=mittel, 6=dick). Server subtrahiert
     *  2× von Width-Maßen + 1× von Height bei der Mesh-Extraktion. */
    sockThicknessMm?: number;
    /** Capture-Mode für Telemetry/Analytics — "stand" oder "handheld". */
    captureMode?: "stand" | "handheld";
  }
): Promise<KiriSubmitResult> {
  if (frames.length === 0) throw new Error("Keine Frames zum Senden");

  const fd = new FormData();
  frames.forEach((f, i) => {
    fd.append(`frame_${i}`, f.blob, `frame_${i}.jpg`);
  });
  if (options?.sessionId) fd.append("session_id", options.sessionId);
  if (options?.clientToken) fd.append("client_token", options.clientToken);
  if (options?.shoeSlug) fd.append("shoe_slug", options.shoeSlug);
  if (typeof options?.sockThicknessMm === "number") {
    fd.append("sock_thickness_mm", String(options.sockThicknessMm));
  }
  if (options?.captureMode) {
    fd.append("capture_mode", options.captureMode);
  }

  const { data, error } = await supabase.functions.invoke("kiri-submit", { body: fd });
  if (error) throw new Error(extractError(error));
  if (!data?.ok) throw new Error(data?.error ?? "kiri-submit returnte kein ok");
  return data as KiriSubmitResult;
}

/**
 * Phase 3: Trigger Modal-Mesh-Extraction nachdem KIRI fertig ist.
 *
 * Nach KIRI-status=2 (Successful) ist der modelUrl da. Aber das ist nur ein
 * ZIP mit dem rohen OBJ-Mesh — die Maße müssen erst extrahiert werden.
 *
 * Modal-Endpoint /run-extract-kiri-mesh fetched via session_id den modelUrl
 * aus der DB, downloaded den ZIP, extrahiert via mesh_extract.py die Maße
 * und schreibt foot_length_mm + ball_width_mm + heel_width_mm in scans-Row.
 *
 * Vorerst: nicht über web-API exposed (run_extract_kiri_mesh ist intern).
 * Ein neuer Web-Endpoint /extract-mesh muss noch in modal/app.py gebaut
 * werden — passiert in nächstem Sub-Phase.
 *
 * Bis dahin: Stub-Funktion die das Endpoint später aufruft.
 */
export async function triggerMeshExtraction(sessionId: string): Promise<{
  ok: boolean;
  measurements?: Record<string, number>;
  error?: string;
}> {
  const backendUrl = import.meta.env.VITE_BACKEND_URL as string | undefined;
  if (!backendUrl) {
    return { ok: false, error: "Modal-Backend nicht konfiguriert" };
  }
  try {
    const res = await fetch(`${backendUrl}/extract-mesh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionId }),
    });
    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}` };
    }
    return res.json();
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function pollKiriStatus(
  sessionId: string,
  clientToken: string
): Promise<KiriStatusResult> {
  const { data, error } = await supabase.functions.invoke("kiri-status", {
    body: { session_id: sessionId, client_token: clientToken },
  });
  if (error) throw new Error(extractError(error));
  if (!data?.ok) throw new Error(data?.error ?? "kiri-status returnte kein ok");
  return data as KiriStatusResult;
}

/**
 * Wait für `ms` ODER abbrechen falls signal triggert. Promise rejected mit
 * "polling aborted" bei Abort. Verhindert dass setTimeout-handles weiterlaufen
 * wenn Component unmounted.
 */
function waitOrAbort(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return Promise.reject(new Error("polling aborted"));
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      window.clearTimeout(timer);
      reject(new Error("polling aborted"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/**
 * Polled bis Terminal-State oder maxPolls erreicht. AbortSignal wird vor jedem
 * Poll UND während des Wait-Intervals geprüft → schneller Stop bei Unmount.
 *
 * Default: 12s Interval, max 25 Polls = 5min Cap. KIRI braucht typisch 2-5min,
 * Cap deckt p99 ab. Worst-case ~26 KIRI-Credits (25 Status + 1 getModelZip).
 */
export async function pollKiriUntilDone(
  sessionId: string,
  clientToken: string,
  onUpdate: (s: KiriStatusResult) => void,
  options?: { intervalMs?: number; maxPolls?: number; signal?: AbortSignal }
): Promise<KiriStatusResult> {
  const interval = options?.intervalMs ?? 12_000;
  const max = options?.maxPolls ?? 25;
  for (let i = 0; i < max; i++) {
    if (options?.signal?.aborted) throw new Error("polling aborted");
    const result = await pollKiriStatus(sessionId, clientToken);
    if (options?.signal?.aborted) throw new Error("polling aborted");
    onUpdate(result);
    if (TERMINAL_STATUSES.has(result.kiri_status)) return result;
    await waitOrAbort(interval, options?.signal);
  }
  throw new Error(`KIRI-Job nicht in ${(interval * max) / 1000}s terminal — Polling abgebrochen`);
}
