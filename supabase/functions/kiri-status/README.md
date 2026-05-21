# Edge Function: kiri-status

Polled Frontend gegen diese Function um den KIRI-Job-Status zu erfahren.
Wenn KIRI fertig ist, fetcht sie zusätzlich die Mesh-Download-URL und
persistiert sie in `scans.kiri_model_url`.

## Setup

Identisch zu `kiri-submit`:
1. `KIRI_API_KEY` als Supabase-Secret
2. Migration `20260502151500_kiri_columns.sql`
3. Deploy (Dashboard oder `supabase functions deploy kiri-status`)

## Request

GET-Variante (für simples Polling):
```
GET /functions/v1/kiri-status?session_id=<uuid>&client_token=<uuid>
```

POST-Variante (für strukturierte Bodies):
```
POST /functions/v1/kiri-status
Content-Type: application/json

{ "session_id": "<uuid>", "client_token": "<uuid>" }
```

## Response

```json
{
  "ok": true,
  "session_id": "uuid",
  "kiri_serialize": "32-char-hex",
  "kiri_status": 2,
  "kiri_status_text": "successful",
  "kiri_model_url": "https://...zip",
  "kiri_error": null,
  "kiri_frame_count": 47,
  "status": "complete",
  "from_cache": false
}
```

`kiri_status` numeric values:
- `-1` Uploading
- `0` Processing
- `1` Failed
- `2` Successful
- `3` Queuing
- `4` Expired

`status` Fitly-Mapping (für Compat mit useSessionRealtime):
- `pending` (vor Submit)
- `scanning` (KIRI läuft)
- `complete` (KIRI fertig + modelUrl da)
- `error` (Failed/Expired/HTTP-Fehler)

## Polling-Empfehlung

12s Interval, max 25 Polls — KIRI braucht typisch 2-5 Minuten für 40-60 Frames
Photo Scan. Worst-case ~26 Credits pro Scan (25× getStatus + 1× getModelZip).

Function cached Terminal-States (1=Failed, 2=Successful, 4=Expired) — wiederholte
Polls returnen sofort `from_cache: true` ohne neuen KIRI-Hit. Bei Status 2 wird
`kiri_model_url` automatisch re-fetched wenn älter als 55min (TTL 60min).

`kiriClient.ts/pollKiriUntilDone` macht das Frontend-Pacing inkl. AbortSignal-
Support für sauberen Cleanup bei Component-Unmount.

## KIRI-Spec

- **getStatus:** `GET https://api.kiriengine.app/api/v1/open/model/getStatus?serialize=...`
- **getModelZip:** `GET https://api.kiriengine.app/api/v1/open/model/getModelZip?serialize=...`
- Beide: `Authorization: Bearer ${KIRI_API_KEY}`
- Download-URL TTL: **60 Minuten** ab Generation. Frontend MUSS die ZIP innerhalb
  dieser Zeit holen oder die Function nochmal triggern.
