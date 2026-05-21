// Supabase Edge Function: signup-notify
//
// POST mit Bearer (User-JWT). Wird vom Frontend nach erfolgreichem Signup
// und Email-Confirm aufgerufen. Schreibt AGB/Newsletter/Waitlist-Flags
// und schickt Admin-Mail mit Approve/Reject-Link.
//
// Sicherheits-Checks (post adversarial review):
// 1. User-JWT validiert
// 2. user.email_confirmed_at MUSS gesetzt sein → kein Pre-Confirm-Replay
// 3. Idempotenz: agbs_accepted_at darf NICHT schon gesetzt sein
//    → kein Spam an Admin durch Double-Submit
// 4. approval_token wird aus profile_approvals (User-unzugänglich) geholt
// 5. signup-decide-URLs zeigen auf eine Confirm-Page (kein GET-Side-Effect)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ADMIN_EMAIL = "troelsenigk@mail.de";
const FROM_EMAIL = "Fit-Your-Foot <onboarding@resend.dev>";

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

const escapeHtml = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const isEmail = (s: unknown): s is string =>
  typeof s === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const apiKey = Deno.env.get("RESEND_API_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

  if (!apiKey || !supabaseUrl || !serviceKey) {
    console.error("Missing env: RESEND_API_KEY / SUPABASE_URL / SERVICE_ROLE_KEY");
    return json({ error: "Service nicht konfiguriert" }, 500);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
  const userToken = authHeader.slice(7);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${userToken}` } },
    auth: { persistSession: false },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);
  const user = userData.user;

  // Reject if email not confirmed yet — prevents replay before confirm
  if (!user.email_confirmed_at) {
    return json({ error: "E-Mail nicht bestätigt" }, 403);
  }

  let payload: {
    agbs_accepted?: boolean;
    newsletter_consent?: boolean;
    waitlist?: boolean;
  };
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Ungültiger Request-Body" }, 400);
  }

  if (!payload.agbs_accepted) {
    return json({ error: "AGBs müssen akzeptiert werden" }, 400);
  }

  const adminClient = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  // Idempotenz: agbs_accepted_at gesetzt? → User hat das schon mal gemacht.
  const { data: existing, error: existingErr } = await adminClient
    .from("profiles")
    .select("agbs_accepted_at, approval_status")
    .eq("id", user.id)
    .maybeSingle();

  if (existingErr) {
    console.error("profile lookup failed", existingErr);
    return json({ error: "Profil-Lookup fehlgeschlagen" }, 500);
  }
  if (!existing) {
    return json({ error: "Profil nicht gefunden — Trigger gehängt?" }, 500);
  }
  if (existing.agbs_accepted_at) {
    return json({ ok: true, status: existing.approval_status, idempotent: true });
  }

  const wantsWaitlist = payload.waitlist === true;

  const updates: Record<string, unknown> = {
    agbs_accepted_at: new Date().toISOString(),
    newsletter_consent: payload.newsletter_consent === true,
  };
  if (wantsWaitlist) updates.approval_status = "waitlist";

  const { error: updateErr } = await adminClient
    .from("profiles")
    .update(updates)
    .eq("id", user.id);

  if (updateErr) {
    console.error("profile update failed", updateErr);
    return json({ error: "Profil-Update fehlgeschlagen" }, 500);
  }

  // Self-Waitlist → kein Admin-Mail
  if (wantsWaitlist) {
    return json({ ok: true, status: "waitlist" });
  }

  // Token aus separater Tabelle holen (User darf die nicht lesen)
  const { data: approvalRow, error: tokenErr } = await adminClient
    .from("profile_approvals")
    .select("approval_token")
    .eq("user_id", user.id)
    .maybeSingle();

  if (tokenErr || !approvalRow) {
    console.error("approval-token lookup failed", tokenErr);
    return json({ error: "Token nicht gefunden" }, 500);
  }

  const userEmail = user.email ?? "";
  if (!isEmail(userEmail)) {
    return json({ error: "User hat keine gültige Email" }, 400);
  }

  const token = approvalRow.approval_token as string;
  const decisionUrl = `${supabaseUrl}/functions/v1/signup-decide?token=${token}`;

  const html = `
    <h2>Neue Anmeldung auf Fit-Your-Foot</h2>
    <p><strong>E-Mail:</strong> ${escapeHtml(userEmail)}</p>
    <p><strong>Newsletter:</strong> ${updates.newsletter_consent ? "Ja" : "Nein"}</p>
    <p><strong>Angefragt:</strong> ${new Date().toLocaleString("de-DE")}</p>
    <p style="margin-top:24px">
      <a href="${decisionUrl}" style="display:inline-block;background:#1f2937;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold">Zur Entscheidung</a>
    </p>
    <p style="font-size:12px;color:#888;margin-top:24px">
      Klick öffnet eine Seite mit Approve / Reject Buttons. Nicht direkt
      hier im Mail-Client klicken — Email-Scanner können den Link sonst
      vorzeitig ausführen.
    </p>
  `;
  const text = `Neue Anmeldung\n\nE-Mail: ${userEmail}\nNewsletter: ${updates.newsletter_consent ? "Ja" : "Nein"}\n\nEntscheiden: ${decisionUrl}`;

  const resendResp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [ADMIN_EMAIL],
      subject: `Neue Anmeldung: ${userEmail}`,
      html,
      text,
    }),
  });

  if (!resendResp.ok) {
    const errText = await resendResp.text();
    console.error("Resend failed", resendResp.status, errText);
    return json({
      ok: true,
      status: "pending",
      warning: "admin_email_failed_check_dashboard",
    });
  }

  return json({ ok: true, status: "pending" });
});
