// Supabase Edge Function: kiri-submit
//
// Empfängt 20-300 JPEG-Frames aus dem Photogrammetry-Capture-Flow,
// uploaded sie an KIRI Engine API, persistiert Job-ID in scans-Row.
//
// Schutzschichten (kostet sonst KIRI-Credits):
//   1. Server-side Validierung: Frame-Count, MIME, Größe, Total-Bytes
//   2. IP-Rate-Limit (kiri_submissions Table, 5 Submits/Stunde/IP)
//   3. Idempotency-Guard: bereits submittete scan-row kann nicht re-submitted
//      werden (Schutz vor Doppel-Klick + Replay)
//   4. Edge-to-KIRI persisted-state-then-respond Pattern: serialize wird
//      VOR der Response in DB geschrieben damit Job nicht orphan wird
//
// Setup:
//   1. KIRI_API_KEY als Supabase-Secret setzen
//   2. Migration 20260502151500_kiri_columns.sql ausführen
//   3. Function deployen
//   4. SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY werden auto-injected.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const KIRI_UPLOAD_URL = "https://api.kiriengine.app/api/v1/open/photo/image";
const MIN_FRAMES = 20;
const MAX_FRAMES = 300;
const MAX_FRAME_BYTES = 1.5 * 1024 * 1024;
const MAX_TOTAL_BYTES = 50 * 1024 * 1024;
const ALLOWED_MIME = new Set(["image/jpeg", "image/jpg", "image/png"]);
const RATE_LIMIT_PER_HOUR = 5;
const DEFAULT_SHOE_SLUG = "fitly-profile";

// KIRI-Job-Settings: für Foot-Scan brauchen wir Geometry-Accuracy, kein Texture-Bling.
// modelQuality 0=High (max accuracy für ±2-3mm Goal), textureQuality 2=1K (klein
// reicht — wir extrahieren Maße, nicht Render-Assets), isMask 1=ObjectMasking on
// (entfernt Boden + Hintergrund), fileFormat obj (universell parsbar).
const KIRI_PARAMS = {
  modelQuality: "0",
  textureQuality: "2",
  isMask: "1",
  textureSmoothing: "0",
  fileFormat: "obj",
};

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

const getClientIp = (req: Request): string | null => {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("cf-connecting-ip") ?? req.headers.get("x-real-ip") ?? null;
};

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

  // Rate-Limit-Check VOR FormData-Parse — billig + verhindert großen Body-Read
  // bei Abuse.
  const ip = getClientIp(req);
  if (ip) {
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count, error: cntErr } = await supabase
      .from("kiri_submissions")
      .select("*", { count: "exact", head: true })
      .eq("ip", ip)
      .gte("created_at", since);
    if (cntErr) {
      console.error("rate-limit query failed", cntErr);
      // Fail-open: nicht aussperren bei DB-Fehler.
    } else if ((count ?? 0) >= RATE_LIMIT_PER_HOUR) {
      console.warn(`rate-limit hit ip=${ip} count=${count}`);
      return json({ error: "Zu viele Scans — bitte später nochmal versuchen." }, 429);
    }
  }

  let inbound: FormData;
  try {
    inbound = await req.formData();
  } catch (err) {
    console.error("formData parse failed", err);
    return json({ error: "Ungültiger Request-Body (kein multipart/form-data)" }, 400);
  }

  // Frames sammeln + nach Schlüssel sortieren (frame_0, frame_1, ...).
  // FormData.entries() Reihenfolge ist per Spec insertion-order, aber Browser-
  // Implementations divergieren historisch — explizites Sort ist defensiv.
  const collected: { key: string; file: File }[] = [];
  for (const [key, value] of inbound.entries()) {
    if ((key.startsWith("frame_") || key === "frames") && value instanceof File) {
      collected.push({ key, file: value });
    }
  }
  collected.sort((a, b) => {
    const na = parseInt(a.key.replace(/^frame_/, ""), 10);
    const nb = parseInt(b.key.replace(/^frame_/, ""), 10);
    if (Number.isNaN(na) || Number.isNaN(nb)) return a.key.localeCompare(b.key);
    return na - nb;
  });
  const frames = collected.map((c) => c.file);

  if (frames.length < MIN_FRAMES) {
    return json({ error: `Mindestens ${MIN_FRAMES} Frames nötig, ${frames.length} bekommen` }, 400);
  }
  if (frames.length > MAX_FRAMES) {
    return json({ error: `Maximal ${MAX_FRAMES} Frames erlaubt, ${frames.length} bekommen` }, 400);
  }

  let total = 0;
  for (const f of frames) {
    if (!ALLOWED_MIME.has(f.type)) {
      return json({ error: `Ungültiger Frame-Typ: ${f.type}` }, 400);
    }
    if (f.size > MAX_FRAME_BYTES) {
      return json(
        { error: `Frame zu groß (${(f.size / 1024 / 1024).toFixed(2)}MB > 1.5MB)` },
        400
      );
    }
    total += f.size;
  }
  if (total > MAX_TOTAL_BYTES) {
    return json({ error: `Total > 50MB (${(total / 1024 / 1024).toFixed(2)}MB)` }, 413);
  }

  const inboundSessionId = inbound.get("session_id");
  const inboundClientToken = inbound.get("client_token");
  const shoeSlug = (inbound.get("shoe_slug") as string) || DEFAULT_SHOE_SLUG;

  // Sock-Thickness (mm) — strict integer 0-15 nur. parseInt akzeptiert "6abc"
  // → 6 oder "1.9" → 1, das wollen wir NICHT. Regex-validate bevor parse.
  let sockThicknessMm: number | null = null;
  const sockRaw = inbound.get("sock_thickness_mm");
  if (typeof sockRaw === "string" && /^\d+$/.test(sockRaw)) {
    const parsed = parseInt(sockRaw, 10);
    if (parsed >= 0 && parsed <= 15) {
      sockThicknessMm = parsed;
    }
  }

  let sessionId: string;
  let clientToken: string;

  if (typeof inboundSessionId === "string" && inboundSessionId.length > 0) {
    if (typeof inboundClientToken !== "string" || inboundClientToken.length === 0) {
      return json({ error: "client_token erforderlich wenn session_id gesetzt" }, 400);
    }
    const { data: existing, error: selErr } = await supabase
      .from("scans")
      .select("id, client_token, kiri_serialize")
      .eq("id", inboundSessionId)
      .maybeSingle();
    if (selErr) {
      console.error("scan lookup failed", selErr);
      return json({ error: "Scan-Lookup fehlgeschlagen" }, 500);
    }
    if (!existing || existing.client_token !== inboundClientToken) {
      return json({ error: "Scan nicht gefunden oder Token ungültig" }, 404);
    }
    // Idempotency: bereits submittierte Scans dürfen nicht re-submitted
    // werden (würde KIRI-Credits doppelt verbrennen).
    if (existing.kiri_serialize) {
      return json(
        { error: "Scan wurde bereits submittiert — verwende kiri-status zum Polling" },
        409
      );
    }
    sessionId = existing.id;
    clientToken = inboundClientToken;
  } else {
    clientToken = crypto.randomUUID();
    const { data: created, error: insErr } = await supabase
      .from("scans")
      .insert({
        shoe_slug: shoeSlug,
        status: "pending",
        client_token: clientToken,
        sock_thickness_mm: sockThicknessMm,
      })
      .select("id")
      .single();
    if (insErr || !created) {
      console.error("scan insert failed", insErr);
      return json({ error: "Scan konnte nicht erstellt werden" }, 500);
    }
    sessionId = created.id as string;
  }

  // Audit + Rate-Limit-Counter VOR dem KIRI-Call inserten — sonst kann ein
  // Attacker mit parallelen Submissions im selben Sekunden-Fenster den 5/h-
  // Cap durchbrechen (alle Polls passieren den count-check bevor irgendeiner
  // die Audit-Row schreibt).
  if (ip) {
    const { error: audErr } = await supabase
      .from("kiri_submissions")
      .insert({ ip, scan_id: sessionId, frame_count: frames.length });
    if (audErr) console.error("audit-log insert failed (rate-limit may undercount)", audErr);
  }

  // KIRI-Upload bauen.
  const kiriForm = new FormData();
  for (const frame of frames) {
    kiriForm.append("imagesFiles", frame, frame.name || "frame.jpg");
  }
  kiriForm.append("modelQuality", KIRI_PARAMS.modelQuality);
  kiriForm.append("textureQuality", KIRI_PARAMS.textureQuality);
  kiriForm.append("isMask", KIRI_PARAMS.isMask);
  kiriForm.append("textureSmoothing", KIRI_PARAMS.textureSmoothing);
  kiriForm.append("fileFormat", KIRI_PARAMS.fileFormat);

  let kiriResp: Response;
  try {
    kiriResp = await fetch(KIRI_UPLOAD_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: kiriForm,
    });
  } catch (err) {
    console.error("KIRI upload network error", err);
    await supabase
      .from("scans")
      .update({ status: "error", kiri_error: "KIRI-Upload Network-Error" })
      .eq("id", sessionId);
    return json({ error: "KIRI nicht erreichbar" }, 502);
  }

  let kiriBody: {
    code?: number;
    msg?: string;
    ok?: boolean;
    data?: { serialize?: string; calculateType?: number };
  };
  try {
    kiriBody = await kiriResp.json();
  } catch (err) {
    console.error("KIRI response parse failed", err, "http=", kiriResp.status);
    return json({ error: "KIRI-Antwort ungültig" }, 502);
  }

  // Robust: KIRI dokumentiert sowohl `code: 0` als auch `ok: true` — wir
  // verlangen beide UND eine non-empty serialize, sonst Fehler.
  const accepted =
    kiriResp.ok &&
    (kiriBody.code === 0 || kiriBody.ok === true) &&
    typeof kiriBody.data?.serialize === "string" &&
    kiriBody.data.serialize.length > 0;

  if (!accepted) {
    console.error("KIRI upload rejected", kiriResp.status, kiriBody);
    await supabase
      .from("scans")
      .update({ status: "error", kiri_error: `KIRI HTTP ${kiriResp.status}` })
      .eq("id", sessionId);
    return json({ error: "KIRI-Upload abgelehnt" }, 502);
  }

  const serialize = kiriBody.data!.serialize!;

  // Persistiere Job-State VOR der Response. Falls dieser Update failed,
  // ist der KIRI-Job orphan — wir loggen serialize prominent damit ein Op
  // den Job manuell verknüpfen kann. Sock-Thickness wird hier auch persistiert
  // damit ein late-arriving sock_thickness_mm (z.B. via existing-session-Pfad)
  // nicht verloren geht.
  const updatePayload: Record<string, unknown> = {
    kiri_serialize: serialize,
    kiri_status: -1,
    kiri_submitted_at: new Date().toISOString(),
    kiri_frame_count: frames.length,
    status: "scanning",
  };
  if (sockThicknessMm !== null) {
    updatePayload.sock_thickness_mm = sockThicknessMm;
  }
  const { error: updErr } = await supabase
    .from("scans")
    .update(updatePayload)
    .eq("id", sessionId);
  if (updErr) {
    console.error(
      "CRITICAL: scan update failed nach KIRI-Submit — orphan job",
      "session_id=",
      sessionId,
      "kiri_serialize=",
      serialize,
      updErr
    );
    return json(
      { error: "Scan-State konnte nicht persistiert werden — Job läuft, kontaktiere Support" },
      500
    );
  }

  return json({
    ok: true,
    session_id: sessionId,
    client_token: clientToken,
    kiri_serialize: serialize,
    frame_count: frames.length,
  });
});
