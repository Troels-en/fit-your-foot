// Supabase Edge Function: send-contact
// Empfängt POST { name, email, message }, schickt via Resend an die Ziel-Mail.
//
// Schutzschichten:
//   1. Honeypot-Feld im Frontend (versteckt; Bots füllen es aus)
//   2. Server-side Validierung (Email-Format, Pflichtfelder, Längen-Limit)
//   3. HTML-Escape gegen Injection
//   4. IP-basiertes Rate-Limit (Postgres-Tabelle contact_submissions)
//   5. Resend-API hat eigenes Account-Limit als letzte Verteidigungslinie
//
// Setup:
//   1. RESEND_API_KEY als Supabase-Secret setzen
//   2. Migration 20260501201808_contact_submissions.sql ausführen
//   3. Function deployen
//   4. SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY werden automatisch injected.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const TO_EMAIL = "troelsenigk@mail.de";
const FROM_EMAIL = "Fit-Your-Foot <onboarding@resend.dev>"; // Sandbox; später eigene Domain
const RATE_LIMIT_PER_HOUR = 5;

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

const isEmail = (s: unknown): s is string =>
  typeof s === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

const isNonEmptyString = (s: unknown, max = 5000): s is string =>
  typeof s === "string" && s.trim().length > 0 && s.length <= max;

const escapeHtml = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

// Liest die echte Client-IP aus den Proxy-Headern.
const getClientIp = (req: Request): string | null => {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return (
    req.headers.get("cf-connecting-ip") ?? req.headers.get("x-real-ip") ?? null
  );
};

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const supabase =
  supabaseUrl && serviceKey
    ? createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
    : null;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) {
    console.error("RESEND_API_KEY missing");
    return json({ error: "Mail-Service nicht konfiguriert" }, 500);
  }

  let payload: { name?: unknown; email?: unknown; message?: unknown };
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Ungültiger Request-Body" }, 400);
  }

  const { name, email, message } = payload;
  if (!isNonEmptyString(name, 200)) return json({ error: "Name fehlt" }, 400);
  if (!isEmail(email)) return json({ error: "E-Mail ungültig" }, 400);
  if (!isNonEmptyString(message)) return json({ error: "Nachricht fehlt" }, 400);

  const ip = getClientIp(req);

  // Rate-Limit-Check: höchstens RATE_LIMIT_PER_HOUR Submissions pro IP/Stunde.
  if (supabase && ip) {
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count, error: countErr } = await supabase
      .from("contact_submissions")
      .select("*", { count: "exact", head: true })
      .eq("ip", ip)
      .gte("created_at", since);

    if (countErr) {
      console.error("rate-limit query failed", countErr);
      // Fail-open: bei DB-Fehler durchlassen statt User auszusperren.
    } else if ((count ?? 0) >= RATE_LIMIT_PER_HOUR) {
      console.warn(`rate-limit hit for ip=${ip}, count=${count}`);
      return json(
        { error: "Zu viele Anfragen — bitte später nochmal versuchen." },
        429
      );
    }
  } else if (!supabase) {
    console.warn("supabase client not initialized — rate-limit disabled");
  }

  const safeName = escapeHtml(name);
  const safeMessage = escapeHtml(message).replace(/\n/g, "<br>");

  const resendResp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [TO_EMAIL],
      reply_to: email,
      subject: `Kontaktformular: ${name}`,
      html: `
        <h2>Neue Kontaktanfrage</h2>
        <p><strong>Name:</strong> ${safeName}</p>
        <p><strong>E-Mail:</strong> ${escapeHtml(email)}</p>
        <p><strong>Nachricht:</strong></p>
        <p>${safeMessage}</p>
      `,
      text: `Neue Kontaktanfrage\n\nName: ${name}\nE-Mail: ${email}\n\nNachricht:\n${message}`,
    }),
  });

  if (!resendResp.ok) {
    const errText = await resendResp.text();
    console.error("Resend error", resendResp.status, errText);
    return json({ error: "Mail konnte nicht gesendet werden" }, 502);
  }

  // Erfolgreich → für Rate-Limit-Counter loggen. Best-effort, kein blocker.
  if (supabase) {
    const { error: insertErr } = await supabase
      .from("contact_submissions")
      .insert({ ip, email });
    if (insertErr) console.error("audit-log insert failed", insertErr);
  }

  return json({ ok: true });
});
