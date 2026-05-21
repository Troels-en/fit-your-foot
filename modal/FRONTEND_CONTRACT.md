# Frontend ↔ Modal Backend Contract

This document specifies how the frontend (Lovable) should talk to the Modal
backend for the foot-measurement flow. Forward this to Lovable when asking
them to wire the `MobileScan.tsx` upload UX.

## Endpoints

Base URL: `${VITE_BACKEND_URL}`. When empty, the frontend should fall back
to direct Supabase writes (existing behavior in `src/lib/api.ts`).

### `GET /healthz`
Liveness check. Returns `{ok: true, service: "fitly-backend"}`.

### `POST /session`
**Unchanged from current `src/lib/api.ts`.** Creates a pending `scans` row.

```
Request  (application/json):
  { shoe_slug: string, brand_id?: string | null }
Response:
  { session_id: string }
```

### `GET /session/{id}`
**Unchanged.** Fetches a `scans` row.

### `POST /scan`
**Unchanged.** Submits demo/manual measurements (used by the demo button on
`MobileScan.tsx`). No photos required.

```
Request  (application/json):
  { session_id, foot_length_mm, foot_width_mm, ball_width_mm,
    heel_width_mm, arch_type, eu_size }
Response:
  { ok: true }
```

### `POST /measure` *(new — the real photo flow)*
Accepts two photos + session id, returns measurements. The backend also
updates the `scans` row to `status='complete'`, so the laptop-side
`useSessionRealtime` subscription fires automatically.

```
Request  (multipart/form-data):
  session_id: string
  photo_top:  File (JPEG/PNG, top-down view of foot next to A4 sheet)
  photo_side: File (JPEG/PNG, side view of foot next to A4 sheet)

Response (application/json):
  {
    ok: true,
    measurements: {
      foot_length_mm: number,
      foot_width_mm: number,
      ball_width_mm: number,
      heel_width_mm: number,
      arch_type: "low" | "medium" | "high",
      arch_height_mm: number | null,
      instep_height_mm: number | null,
      eu_size: number,
      confidence: "low" | "medium" | "high"
    },
    warnings: string[]   // human-readable, e.g. ["Seiten-Foto unscharf"]
  }

Error shape (HTTP 422 or 400):
  { detail: string | ValidationError[] }  // FastAPI's default
```

### `GET /mesh/{session_id}` *(new — personalized 3D foot mesh)*

After `/measure` has completed successfully for a session, call this to
get a glTF-binary (.glb) file of a foot mesh scaled to the measured
dimensions. Use it to replace or supplement the generic `public/models/foot.glb`
in `FitVisualization3D.tsx`.

```
Request:
  GET ${VITE_BACKEND_URL}/mesh/<session_id>

Response (success):
  HTTP 200
  Content-Type: model/gltf-binary
  <binary .glb data>

Errors:
  404  session not found
  409  measurement not complete yet (call /measure first)
```

Frontend usage (three.js / react-three-fiber):
```ts
import { useGLTF } from "@react-three/drei";

const backendUrl = import.meta.env.VITE_BACKEND_URL;
const meshUrl = backendUrl
  ? `${backendUrl}/mesh/${sessionId}`
  : "/models/foot.glb"; // fallback to generic

const { scene } = useGLTF(meshUrl);
```

The mesh is a parametrically-scaled version of the base `foot.glb` with
axis-wise scaling applied: length = `foot_length_mm`, width =
`foot_width_mm`, height = `instep_height_mm` (or 65mm fallback if the
side measurement is missing). Not a photogrammetric reconstruction —
it's a deformed template, which is intentional for the prototype.

### `POST /validate-photo` *(new — pre-upload sanity check, single photo)*
Lightweight endpoint that checks whether a photo is usable BEFORE the user
commits to the full upload. Lovable can call this for each photo as the
user takes it, to show a "retake" prompt inline.

```
Request  (multipart/form-data):
  photo: File
  view:  "top" | "side"

Response:
  {
    ok: boolean,
    issues: string[]    // machine-readable codes (see below)
  }

Issue codes (machine-readable):
  "a4_not_detected"    — no A4 paper found in the photo
  "a4_multiple"        — more than one A4-like rectangle (ambiguous)
  "too_dark"           — average brightness below threshold
  "too_blurry"         — Laplacian variance below threshold
  "foot_not_detected"  — no plausible foot-shape region detected
  "foot_cut_off"       — foot mask touches image border
  "too_small"          — foot region smaller than minimum pixel count
```

## UX requirements for Lovable in `MobileScan.tsx`

The current `MobileScan.tsx` has a stub "Demo-Daten verwenden" button.
Please extend it with:

1. **Two capture steps** — top photo, then side photo.
   - Use `<input type="file" accept="image/*" capture="environment">` twice.
   - Show a preview after capture with a "Retake" / "Continue" pair of buttons.
2. **Per-photo validation call** — after each capture, `POST /validate-photo`
   with that single photo. If `ok: false`, show the `issues` list as
   German strings (mapping below) and block the "Continue" button.
3. **Final submission** — when both photos have `ok: true`, `POST /measure`
   with both files + `session_id`. Show a spinner ("Messung läuft…").
4. **On success** — show the existing "Scan erfolgreich" screen. The
   laptop widget will update via Supabase Realtime.
5. **On failure** — show the error message; keep the user on the capture
   page with both photos still available to retake.

### Issue-code → German label map

```ts
const ISSUE_MESSAGES: Record<string, string> = {
  a4_not_detected:   "Kein A4-Blatt im Bild erkannt. Leg ein A4-Blatt neben den Fuß.",
  a4_multiple:       "Mehrere rechteckige Objekte erkannt. Entferne alles außer einem A4-Blatt.",
  too_dark:          "Foto zu dunkel. Mehr Licht oder einen helleren Raum wählen.",
  too_blurry:        "Foto unscharf. Handy ruhig halten und nochmal.",
  foot_not_detected: "Fuß nicht erkannt. Fuß komplett ins Bild bringen.",
  foot_cut_off:      "Fuß ist am Bildrand abgeschnitten. Etwas weiter weg halten.",
  too_small:         "Fuß zu klein im Bild. Näher rangehen.",
};
```

### UX copy for the two photo steps

**Schritt 1 — Top-Foto:**
> Leg ein A4-Blatt flach auf den Boden. Stell deinen **nackten Fuß** direkt
> neben das Blatt. Halte dein Handy **senkrecht von oben** und mach das
> Foto so, dass **beides** im Bild ist: das ganze A4-Blatt und dein
> kompletter Fuß.

**Schritt 2 — Seiten-Foto:**
> Leg jetzt ein **zweites A4-Blatt** flach neben deinen Fuß. Geh in die
> Hocke und mache das Foto von der **Seite** — Kamera ungefähr auf
> Knöchelhöhe. A4-Blatt und Fuß beide im Bild.

## CORS

The Modal backend currently has `allow_origins=["*"]`. For production,
Simon will narrow this to `https://fit-your-foot.lovable.app` (or
whatever the public URL ends up being). No action needed from Lovable
during development.

## Auth

Currently: no auth. The session_id is a UUID and acts as a capability
token (unguessable). For production we will add Supabase-JWT verification
on `Authorization: Bearer …`. Will be specified in a follow-up contract
version.

## Polling vs. Realtime

The Laptop (retailer page) already has `useSessionRealtime` that watches
`scans` via Supabase Realtime. The mobile flow does NOT need to poll —
it just `POST /measure`, waits for HTTP response, shows success. The
Laptop side reacts to the DB update.

---

**Questions for Lovable?** Drop them in the repo's `ISSUES.md` or ping
Simon. Simon is the single coordinator between this Modal backend and
the Lovable frontend.
