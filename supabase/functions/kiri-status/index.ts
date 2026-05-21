// Supabase Edge Function: kiri-status
//
// Polling-Endpoint für Photogrammetry-Jobs. Frontend ruft diese Function bis
// terminal-State erreicht (1=Failed, 2=Successful, 4=Expired).
//
// Robustness:
//   1. Cache: terminal-states werden NICHT re-polled — sofortiger Cache-Hit
//      ohne KIRI-Credit-Burn. Außer: kiri_model_url ist >55min alt (60min TTL
//      laut KIRI), dann re-fetch.
//   2. Atomic-Update-Guard: write nur wenn Row noch nicht-terminal ist
//      (concurrency safety bei multi-tab-polling).
//   3. POST-only — GET-branch entfällt um Attack-Surface zu minimieren.
//   4. Generic error responses — KIRI-Error-Strings landen nur in Logs.
//
// Setup: identisch zu kiri-submit.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const KIRI_STATUS_URL = "https://api.kiriengine.app/api/v1/open/model/getStatus";
const KIRI_DOWNLOAD_URL = "https://api.kiriengine.app/api/v1/open/model/getModelZip";

// 60min TTL laut KIRI-Doc; wir fetchen 5min vor Ablauf re-up um Frontend nicht
// im Cliff zu lassen.
const MODEL_URL_TTL_MS = 55 * 60 * 1000;

const KIRI_STATUS_TEXT: Record<number, string> = {
  [-1]: "uploading",
  0: "processing",
  1: "failed",
  2: "successful",
  3: "queuing",
  4: "expired",
};

const TERMINAL_STATUSES = new Set([1, 2, 4]);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const supabase =
  supabaseUrl && serviceKey
    ? createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
    : null;

type ScanRow = {
  id: string;
  client_token: string;
  status: string | null;
  kiri_serialize: string | null;
  kiri_status: number | null;
  kiri_model_url: string | null;
  kiri_model_url_fetched_at: string | null;
  kiri_error: string | null;
  kiri_frame_count: number | null;
  kiri_submitted_at: string | null;
  kiri_completed_at: string | null;
};

async function fetchKiriModelUrl(serialize: string, apiKey: string): Promise<string | null> {
  const url = `${KIRI_DOWNLOAD_URL}?serialize=${encodeURIComponent(serialize)}`;
  try {
    const resp = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } });
    const body: { ok?: boolean; code?: number; msg?: string; data?: { modelUrl?: string } } =
      await resp.json();
    const ok = resp.ok && (body.code === 0 || body.ok === true);
    if (!ok || !body.data?.modelUrl) {
      console.error("KIRI getModelZip rejected", resp.status, body);
      return null;
    }
    return body.data.modelUrl;
  } catch (err) {
    console.error("KIRI getModelZip network error", err);
    return null;
  }
}

function isModelUrlStale(scan: ScanRow): boolean {
  if (!scan.kiri_model_url || !scan.kiri_model_url_fetched_at) return true;
  const age = Date.now() - new Date(scan.kiri_model_url_fetched_at).getTime();
  return age > MODEL_URL_TTL_MS;
}

function buildResponse(scan: ScanRow, fromCache: boolean) {
  const statusNum = scan.kiri_status ?? 0;
  return {
    ok: true,
    session_id: scan.id,
    kiri_serialize: scan.kiri_serialize,
    kiri_status: statusNum,
    kiri_status_text: KIRI_STATUS_TEXT[statusNum] ?? "unknown",
    kiri_model_url: scan.kiri_model_url,
    kiri_error: scan.kiri_error,
    kiri_frame_count: scan.kiri_frame_count,
    status: scan.status,
    from_cache: fromCache,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const apiKey = Deno.env.get("KIRI_API_KEY");
  if (!apiKey) {
    console.error("KIRI_API_KEY missing");
    return json({ error: "Photogrammetry-Service nicht konfiguriert" }, 500);
  }
  if (!supabase) {
    console.error("supabase client not initialized");
    return json({ error: "Datenbank nicht erreichbar" }, 500);
  }

  let body: { session_id?: unknown; client_token?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Ungültiger Request-Body" }, 400);
  }

  const sessionId = typeof body.session_id === "string" ? body.session_id : null;
  const clientToken = typeof body.client_token === "string" ? body.client_token : null;
  if (!sessionId || !clientToken) {
    return json({ error: "session_id und client_token erforderlich" }, 400);
  }

  const { data: scanData, error: selErr } = await supabase
    .from("scans")
    .select(
      "id, client_token, status, kiri_serialize, kiri_status, kiri_model_url, kiri_model_url_fetched_at, kiri_error, kiri_frame_count, kiri_submitted_at, kiri_completed_at"
    )
    .eq("id", sessionId)
    .maybeSingle();
  if (selErr) {
    console.error("scan lookup failed", selErr);
    return json({ error: "Scan-Lookup fehlgeschlagen" }, 500);
  }
  const scan = scanData as ScanRow | null;
  if (!scan || scan.client_token !== clientToken) {
    return json({ error: "Scan nicht gefunden oder Token ungültig" }, 404);
  }
  if (!scan.kiri_serialize) {
    return json({ error: "Scan hat noch kein KIRI-Job" }, 400);
  }

  // Cache-Hit für terminal-states. Bei Successful + stale URL re-fetchen.
  if (scan.kiri_status !== null && TERMINAL_STATUSES.has(scan.kiri_status)) {
    if (scan.kiri_status === 2 && isModelUrlStale(scan)) {
      const fresh = await fetchKiriModelUrl(scan.kiri_serialize, apiKey);
      if (fresh) {
        const fetchedAt = new Date().toISOString();
        // Atomic guard: schreib URL nur wenn aktueller status weiterhin 2 ist.
        await supabase
          .from("scans")
          .update({ kiri_model_url: fresh, kiri_model_url_fetched_at: fetchedAt })
          .eq("id", sessionId)
          .eq("kiri_status", 2);
        scan.kiri_model_url = fresh;
        scan.kiri_model_url_fetched_at = fetchedAt;
      }
    }
    return json(buildResponse(scan, true));
  }

  // Non-terminal → KIRI getStatus pollen.
  const statusUrl = `${KIRI_STATUS_URL}?serialize=${encodeURIComponent(scan.kiri_serialize)}`;
  let kiriResp: Response;
  try {
    kiriResp = await fetch(statusUrl, { headers: { Authorization: `Bearer ${apiKey}` } });
  } catch (err) {
    console.error("KIRI status network error", err);
    return json({ error: "KIRI nicht erreichbar" }, 502);
  }

  let kiriBody: {
    code?: number;
    msg?: string;
    ok?: boolean;
    data?: { serialize?: string; status?: number };
  };
  try {
    kiriBody = await kiriResp.json();
  } catch (err) {
    console.error("KIRI status parse failed", err, "http=", kiriResp.status);
    return json({ error: "KIRI-Antwort ungültig" }, 502);
  }

  const accepted =
    kiriResp.ok &&
    (kiriBody.code === 0 || kiriBody.ok === true) &&
    typeof kiriBody.data?.status === "number";
  if (!accepted) {
    console.error("KIRI status rejected", kiriResp.status, kiriBody);
    return json({ error: "KIRI-Status nicht abrufbar" }, 502);
  }

  const newStatus = kiriBody.data!.status!;
  let modelUrl: string | null = scan.kiri_model_url;
  let modelUrlFetchedAt: string | null = scan.kiri_model_url_fetched_at;
  let kiriError: string | null = scan.kiri_error;
  let completedAt: string | null = scan.kiri_completed_at;
  let fitlyStatus: string | null = scan.status;

  if (newStatus === 2) {
    // Atomic-Claim für getModelZip: setze kiri_completed_at NUR wenn aktuell
    // null. Nur ein concurrent Poll wird die Claim gewinnen → nur einer
    // verbrennt den getModelZip-Credit. Der Loser re-selected die Row und
    // returnt den aktuellen DB-State (egal ob Winner schon URL geschrieben
    // hat oder noch nicht — beim nächsten Poll convergiert es).
    const claimAt = new Date().toISOString();
    const { data: claimed } = await supabase
      .from("scans")
      .update({ kiri_completed_at: claimAt })
      .eq("id", sessionId)
      .is("kiri_completed_at", null)
      .select("id");
    const wonClaim = claimed != null && claimed.length > 0;

    if (wonClaim) {
      const fresh = await fetchKiriModelUrl(scan.kiri_serialize, apiKey);
      if (fresh) {
        modelUrl = fresh;
        modelUrlFetchedAt = new Date().toISOString();
        fitlyStatus = "complete";
        completedAt = claimAt;
      } else {
        // getModelZip schlug fehl trotz status=2. Nicht fatal — nächster Poll
        // sieht stale-URL und re-fetched.
        completedAt = claimAt;
        kiriError = "modelUrl konnte nicht abgerufen werden — bitte erneut pollen";
      }
    } else {
      // Loser-Path: ein anderer Poll hat die Claim. Wir lesen den fresh-state
      // und EARLY-RETURNEN — wenn wir durch zum shared-update fallen würden,
      // könnten wir das modelUrl des Winners mit unserem stale-null-snapshot
      // überschreiben.
      const { data: latest } = await supabase
        .from("scans")
        .select(
          "id, client_token, status, kiri_serialize, kiri_status, kiri_model_url, kiri_model_url_fetched_at, kiri_error, kiri_frame_count, kiri_submitted_at, kiri_completed_at"
        )
        .eq("id", sessionId)
        .maybeSingle();
      if (latest) return json(buildResponse(latest as ScanRow, false));
      // Re-select selbst gefailt — return scan-snapshot mit "scanning"-status
      // damit Frontend nochmal pollt.
      return json({
        ok: true,
        session_id: sessionId,
        kiri_serialize: scan.kiri_serialize,
        kiri_status: scan.kiri_status ?? newStatus,
        kiri_status_text: KIRI_STATUS_TEXT[scan.kiri_status ?? newStatus] ?? "unknown",
        kiri_model_url: scan.kiri_model_url,
        kiri_error: scan.kiri_error,
        kiri_frame_count: scan.kiri_frame_count,
        status: "scanning",
        from_cache: false,
      });
    }
  } else if (newStatus === 1) {
    fitlyStatus = "error";
    kiriError = kiriError ?? "KIRI-Reconstruction fehlgeschlagen";
  } else if (newStatus === 4) {
    fitlyStatus = "error";
    kiriError = kiriError ?? "KIRI-Job expired";
  } else {
    fitlyStatus = "scanning";
  }

  // Atomic-Update mit Status-Guard: schreib nur wenn Row noch in dem Status
  // ist den wir initial gesehen haben. Bei concurrent polls verhindert das
  // Status-Regression UND wir detecten via .select() ob unser Update durchging.
  let updateQuery = supabase
    .from("scans")
    .update({
      kiri_status: newStatus,
      kiri_model_url: modelUrl,
      kiri_model_url_fetched_at: modelUrlFetchedAt,
      kiri_error: kiriError,
      kiri_completed_at: completedAt,
      status: fitlyStatus,
    })
    .eq("id", sessionId);
  if (scan.kiri_status !== null) {
    updateQuery = updateQuery.eq("kiri_status", scan.kiri_status);
  } else {
    updateQuery = updateQuery.is("kiri_status", null);
  }
  const { data: updatedRows, error: updErr } = await updateQuery.select("id");
  if (updErr) {
    console.error("scan update failed", updErr);
    // Nicht fatal — der nächste Poll sieht dann den DB-State.
  }

  // Wenn 0 rows updated wurden, hat ein concurrent Poll uns überholt.
  // Re-select und gib den "echten" State zurück, damit Client nicht auf
  // einer veralteten Sicht hängt.
  if (!updErr && (!updatedRows || updatedRows.length === 0)) {
    const { data: latest } = await supabase
      .from("scans")
      .select(
        "id, client_token, status, kiri_serialize, kiri_status, kiri_model_url, kiri_model_url_fetched_at, kiri_error, kiri_frame_count, kiri_submitted_at, kiri_completed_at"
      )
      .eq("id", sessionId)
      .maybeSingle();
    if (latest) {
      return json(buildResponse(latest as ScanRow, false));
    }
  }

  return json({
    ok: true,
    session_id: sessionId,
    kiri_serialize: scan.kiri_serialize,
    kiri_status: newStatus,
    kiri_status_text: KIRI_STATUS_TEXT[newStatus] ?? "unknown",
    kiri_model_url: modelUrl,
    kiri_error: kiriError,
    kiri_frame_count: scan.kiri_frame_count,
    status: fitlyStatus,
    from_cache: false,
  });
});
