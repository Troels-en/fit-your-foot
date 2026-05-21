# `send-contact` Edge Function

Empfängt Kontaktformular-Submissions und versendet sie via Resend an `troelsenigk@mail.de`.

## Was hier passiert

- POST `/send-contact` mit Body `{ name, email, message }`
- Server-Side Validierung (Email-Format, Pflichtfelder, Längen-Limit)
- HTML-Escape gegen Injection
- **IP-basiertes Rate-Limit**: max 5 Submissions/IP/Stunde, gespeichert in
  `public.contact_submissions` (RLS-blockiert für anon, nur service-role schreibt/liest).
- Resend-API-Call mit `RESEND_API_KEY` aus Supabase-Secrets
- `reply_to` ist die User-Mail → du kannst aus deinem Mail-Client direkt antworten

## Deployment (eine von zwei Varianten)

### Variante A: Lovable / Supabase Dashboard (kein CLI nötig)

1. **Secret setzen**: Supabase Dashboard → Project `fanqhmtzalewwfppwupz` → Edge Functions → **Secrets** → „New secret":
   - Name: `RESEND_API_KEY`
   - Value: dein Resend-Key (`re_…`)
   - `SUPABASE_URL` und `SUPABASE_SERVICE_ROLE_KEY` werden automatisch gesetzt.
2. **Migration ausführen**: SQL Editor → Inhalt von
   `supabase/migrations/20260501201808_contact_submissions.sql` einfügen → Run.
3. **Function anlegen / aktualisieren**: Edge Functions → bestehende `send-contact`
   öffnen oder neu erstellen → Inhalt von `index.ts` reinkopieren → Deploy.

### Variante B: Lokal mit Supabase CLI

```bash
brew install supabase/tap/supabase            # falls noch nicht installiert
supabase login                                 # einmalig
supabase link --project-ref fanqhmtzalewwfppwupz
supabase secrets set RESEND_API_KEY=re_xxxxxxxx
supabase db push                               # migration anwenden
supabase functions deploy send-contact
```

## Vom Frontend aufrufen

```ts
import { supabase } from "@/integrations/supabase/client";

const { error } = await supabase.functions.invoke("send-contact", {
  body: { name, email, message },
});

if (error) {
  // user-feedback: "Konnte nicht gesendet werden, bitte später nochmal"
}
```

## Wichtig: Absender-Adresse

Aktuell: `onboarding@resend.dev` (Resend-Sandbox). Funktioniert sofort, sieht aber unprofessionell aus und limitiert dich auf den verifizierten Account-Owner als Empfänger. Sobald du eine Domain hast:

1. Resend Dashboard → Domains → Add Domain → DNS-Records bei deinem Hoster eintragen
2. In `index.ts`: `FROM_EMAIL` auf `"Fit-Your-Foot <kontakt@deine-domain.de>"` ändern
3. Function neu deployen

## Spam-Schutz (aktueller Stand)

- ✅ **Honeypot-Feld** `website` im Frontend (`Kontakt.tsx`).
- ✅ **IP-Rate-Limit**: 5/Stunde via `contact_submissions`-Tabelle, server-side.
- ⏳ **Captcha** (Cloudflare Turnstile / hCaptcha) — empfohlen wenn Bots durch das
  Rate-Limit kommen. Keine Zeile am Server ändern, nur Token validieren.

Schwellenwert anpassen: `RATE_LIMIT_PER_HOUR` in `index.ts`.
