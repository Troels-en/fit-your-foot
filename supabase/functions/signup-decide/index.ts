// Supabase Edge Function: signup-decide
//
// Sicherer 2-Stufen-Flow gegen Email-Link-Prefetching:
//
// GET ?token=<uuid>  → zeigt eine HTML-Bestätigungsseite mit User-Info und
//                      zwei <form method="POST"> Buttons (Approve/Reject).
//                      KEIN State-Change. Email-Scanner können also den Link
//                      sicher prefetchen ohne ungewollt zu approven.
//
// POST mit form-data { token, action } → führt das Update durch und zeigt
//                                        Bestätigungsseite.
//
// Token aus public.profile_approvals (User-unzugänglich, RLS blockt anon).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
};

const escapeHtml = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const isUuid = (s: unknown): s is string =>
  typeof s === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

const html = (title: string, body: string, status = 200): Response => {
  const doc = `<!doctype html>
<html lang="de">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(title)}</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      :root { --fg: #1f2937; --muted: #6b7280; --bg: #f9fafb; --card: #fff;
              --green: #10b981; --red: #ef4444; --amber: #f59e0b; }
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
             background: var(--bg); color: var(--fg); margin: 0;
             min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; }
      .card { background: var(--card); border-radius: 16px; padding: 40px 32px;
              max-width: 480px; box-shadow: 0 4px 12px rgba(0,0,0,0.05);
              text-align: center; box-sizing: border-box; width: 100%; }
      h1 { margin: 0 0 16px; font-size: 22px; font-weight: 700; }
      .lead { margin: 0 0 24px; color: var(--muted); line-height: 1.6; font-size: 15px; }
      .meta { background: var(--bg); border-radius: 8px; padding: 12px 16px;
              margin: 0 0 24px; font-size: 14px; text-align: left; }
      .meta strong { color: var(--fg); }
      .actions { display: flex; gap: 12px; flex-direction: column; }
      button { font: inherit; font-weight: 600; padding: 12px 20px; border-radius: 10px;
               border: none; cursor: pointer; font-size: 14px; }
      .btn-approve { background: var(--green); color: white; }
      .btn-reject { background: var(--amber); color: white; }
      .btn-approve:hover { filter: brightness(0.95); }
      .btn-reject:hover { filter: brightness(0.95); }
      .ok { color: var(--green); }
      .warn { color: var(--amber); }
      .err { color: var(--red); }
    </style>
  </head>
  <body>
    <div class="card">${body}</div>
  </body>
</html>`;
  return new Response(doc, {
    status,
    headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
  });
};

const errPage = (title: string, msg: string, status = 400) =>
  html(
    title,
    `<h1 class="err">${escapeHtml(title)}</h1><p class="lead">${escapeHtml(msg)}</p>`,
    status
  );

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceKey) {
    console.error("Missing env: SUPABASE_URL / SERVICE_ROLE_KEY");
    return errPage("Konfigurationsfehler", "Service nicht konfiguriert.", 500);
  }

  const adminClient = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  // ---- POST: tatsächliche Entscheidung ----
  if (req.method === "POST") {
    let token: string | null = null;
    let action: string | null = null;
    const ct = req.headers.get("content-type") ?? "";
    if (ct.includes("application/x-www-form-urlencoded")) {
      const form = await req.formData();
      token = form.get("token")?.toString() ?? null;
      action = form.get("action")?.toString() ?? null;
    } else if (ct.includes("application/json")) {
      const body = await req.json().catch(() => ({}));
      token = body?.token ?? null;
      action = body?.action ?? null;
    } else {
      return errPage("Ungültiger Request", "Content-Type fehlt.", 400);
    }

    if (!isUuid(token)) {
      return errPage("Ungültiger Token", "Token fehlt oder Format falsch.", 400);
    }
    if (action !== "approve" && action !== "reject") {
      return errPage("Ungültige Aktion", "approve oder reject erwartet.", 400);
    }

    const { data: appr, error: lookupErr } = await adminClient
      .from("profile_approvals")
      .select("user_id")
      .eq("approval_token", token)
      .maybeSingle();

    if (lookupErr) {
      console.error("approval lookup failed", lookupErr);
      return errPage("Fehler", "Datenbank-Fehler.", 500);
    }
    if (!appr) {
      return errPage("Nicht gefunden", "Token ungültig.", 404);
    }

    const { data: profile, error: profErr } = await adminClient
      .from("profiles")
      .select("approval_status, approval_decided_at")
      .eq("id", appr.user_id)
      .maybeSingle();

    if (profErr || !profile) {
      console.error("profile lookup failed", profErr);
      return errPage("Fehler", "Profil nicht gefunden.", 500);
    }

    if (profile.approval_decided_at) {
      return html(
        "Bereits entschieden",
        `<h1>Bereits entschieden</h1>
         <p class="lead">Aktueller Status: <strong>${escapeHtml(profile.approval_status)}</strong>.</p>`
      );
    }

    const newStatus = action === "approve" ? "approved" : "rejected";
    const { error: updErr } = await adminClient
      .from("profiles")
      .update({
        approval_status: newStatus,
        approval_decided_at: new Date().toISOString(),
      })
      .eq("id", appr.user_id);

    if (updErr) {
      console.error("update failed", updErr);
      return errPage("Fehler", "Update fehlgeschlagen.", 500);
    }

    if (action === "approve") {
      return html(
        "Freigeschaltet",
        `<h1 class="ok">Freigeschaltet</h1>
         <p class="lead">User hat jetzt vollen Zugriff.</p>`
      );
    }
    return html(
      "Auf Warteliste",
      `<h1 class="warn">Auf Warteliste</h1>
       <p class="lead">User landet auf der Warteliste. Du kannst später manuell freischalten.</p>`
    );
  }

  // ---- GET: Confirm-Page (kein Side-Effect → Email-Scanner-safe) ----
  if (req.method !== "GET") {
    return errPage("Method not allowed", "Nur GET / POST.", 405);
  }

  const url = new URL(req.url);
  const token = url.searchParams.get("token");

  if (!isUuid(token)) {
    return errPage("Ungültiger Link", "Token fehlt oder Format falsch.", 400);
  }

  const { data: appr, error: lookupErr } = await adminClient
    .from("profile_approvals")
    .select("user_id")
    .eq("approval_token", token)
    .maybeSingle();

  if (lookupErr) {
    console.error("approval lookup failed", lookupErr);
    return errPage("Fehler", "Datenbank-Fehler.", 500);
  }
  if (!appr) {
    return errPage("Nicht gefunden", "Token ungültig oder abgelaufen.", 404);
  }

  const { data: profile, error: profErr } = await adminClient
    .from("profiles")
    .select("approval_status, approval_decided_at, requested_at, newsletter_consent")
    .eq("id", appr.user_id)
    .maybeSingle();

  if (profErr || !profile) {
    return errPage("Fehler", "Profil nicht gefunden.", 500);
  }

  if (profile.approval_decided_at) {
    return html(
      "Bereits entschieden",
      `<h1>Bereits entschieden</h1>
       <p class="lead">Aktueller Status: <strong>${escapeHtml(profile.approval_status)}</strong>.<br>
       Entschieden am: ${new Date(profile.approval_decided_at as string).toLocaleString("de-DE")}.</p>`
    );
  }

  // User-Email aus auth.users — admin sieht WER da approved wird
  const { data: userRow } = await adminClient.auth.admin.getUserById(appr.user_id);
  const email = userRow?.user?.email ?? "(unbekannt)";

  return html(
    "Anmeldung entscheiden",
    `<h1>Anmeldung entscheiden</h1>
     <p class="lead">Bist du sicher dass du die folgende Anmeldung freischalten oder ablehnen willst?</p>
     <div class="meta">
       <strong>E-Mail:</strong> ${escapeHtml(email)}<br>
       <strong>Newsletter:</strong> ${profile.newsletter_consent ? "Ja" : "Nein"}<br>
       <strong>Angefragt:</strong> ${new Date(profile.requested_at as string).toLocaleString("de-DE")}
     </div>
     <div class="actions">
       <form method="POST" action="" style="margin:0">
         <input type="hidden" name="token" value="${escapeHtml(token)}" />
         <input type="hidden" name="action" value="approve" />
         <button type="submit" class="btn-approve">Freischalten</button>
       </form>
       <form method="POST" action="" style="margin:0">
         <input type="hidden" name="token" value="${escapeHtml(token)}" />
         <input type="hidden" name="action" value="reject" />
         <button type="submit" class="btn-reject">Auf Warteliste</button>
       </form>
     </div>`
  );
});
