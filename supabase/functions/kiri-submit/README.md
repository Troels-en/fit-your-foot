# Edge Function: kiri-submit

Empfängt 20-300 JPEG-Frames aus dem Photogrammetry-Capture-UX, uploaded sie an
KIRI Engine API, persistiert die Job-ID in `scans.kiri_serialize`.

## Setup

1. **KIRI_API_KEY** als Supabase-Secret setzen (Dashboard → Project Settings →
   Edge Functions → Secrets).
2. **Migration** `20260502151500_kiri_columns.sql` anwenden (Lovable macht das
   automatisch beim nächsten Migration-Run, oder Dashboard → Database → SQL
   Editor).
3. **Function deployen:** Dashboard → Edge Functions → "kiri-submit" → Code
   ersetzen → Deploy. Oder: `supabase functions deploy kiri-submit` lokal.
4. SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY werden automatisch injected.

## Request

```
POST /functions/v1/kiri-submit
Content-Type: multipart/form-data

frame_0=<File>
frame_1=<File>
...
frame_N=<File>           // 20-300 JPEGs, je ≤1.5MB, total ≤50MB
session_id?=<uuid>       // Optional — bestehende Row updaten
client_token?=<uuid>     // Pflicht wenn session_id gesetzt
shoe_slug?=<string>      // Default "fitly-profile"
```

## Response

```json
{
  "ok": true,
  "session_id": "uuid",
  "client_token": "uuid",
  "kiri_serialize": "32-char-hex",
  "frame_count": 47
}
```

Bei Fehler: `{ error: "..." }` mit HTTP 400/404/500/502.

## Frontend-Aufruf

```ts
const fd = new FormData();
frames.forEach((f, i) => fd.append(`frame_${i}`, f.blob, `frame_${i}.jpg`));

const res = await fetch(`${SUPABASE_URL}/functions/v1/kiri-submit`, {
  method: "POST",
  body: fd,
});
const { session_id, client_token, kiri_serialize } = await res.json();
```

## KIRI-Spec

- **Endpoint:** `POST https://api.kiriengine.app/api/v1/open/photo/image`
- **Auth:** `Authorization: Bearer ${KIRI_API_KEY}`
- **Form-Felder:** `imagesFiles` (Array), `modelQuality=0` (High),
  `textureQuality=1` (2K), `isMask=1`, `fileFormat=obj`
- **Response:** `{ ok: true, data: { serialize, calculateType: 1 } }`
- **Pricing:** 1 KIRI-Credit pro Call (Photo Scan).
