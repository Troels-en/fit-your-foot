# Fitly Modal Backend

Python backend running on [Modal](https://modal.com) that mirrors the
frontend `src/lib/api.ts` contract. The frontend talks to this service
when `VITE_BACKEND_URL` is set, otherwise falls back to direct Supabase
writes (useful for local dev without the backend).

## Endpoints

| Method | Path                | Purpose                                                          |
|--------|---------------------|------------------------------------------------------------------|
| GET    | `/healthz`          | Liveness check.                                                  |
| POST   | `/session`          | Create a `scans` row with `status='pending'`. Returns `{session_id}`. |
| GET    | `/session/{id}`     | Fetch a `scans` row by id.                                       |
| POST   | `/scan`             | Update a `scans` row with measurements, flip to `status='complete'`. |
| POST   | `/measure`          | Accept a photo upload, run measurement (stub), submit scan.      |

`/measure` is a **stub** — it returns demo measurements regardless of the
uploaded image. The real A4-reference-detection + foot-segmentation
pipeline is future work; the scaffold already routes through a separate
container image so vision deps don't slow the web cold-start.

## One-time setup

### 1. Install Python 3.12 + Modal CLI

```bash
# Windows, if not already installed
winget install Python.Python.3.12

# Install Modal CLI (into a venv is cleaner, but global works for development)
python -m pip install --upgrade pip
python -m pip install modal

# First-time auth — opens the browser, follow the flow
modal token new
```

### 2. Grab the Supabase service-role key

It is **NOT** in `.env` and must not be committed. Get it from:
<https://supabase.com/dashboard/project/fanqhmtzalewwfppwupz/settings/api>
(section: "Project API keys" → "service_role").

### 3. Register the Modal secret

```bash
# Generiere ein 32-byte HMAC-Secret für Session-Token-Auth (Task 14):
SESSION_HMAC_SECRET=$(openssl rand -base64 32)
echo "Save this securely: $SESSION_HMAC_SECRET"

modal secret create fitly-supabase \
  SUPABASE_URL=https://fanqhmtzalewwfppwupz.supabase.co \
  SUPABASE_SERVICE_ROLE_KEY=<paste-secret-here> \
  SESSION_HMAC_SECRET=$SESSION_HMAC_SECRET
```

Wenn `SESSION_HMAC_SECRET` fehlt, läuft der Backend ohne Auth (Sprint-1
CORS-Allowlist bleibt aktiv) und logged eine WARN-Meldung. Für Production
zwingend setzen.

## Deploy

```bash
# From the repo root:
modal deploy modal/app.py
```

Modal prints the public URL after deploy. Paste it into the frontend
`.env` (root of repo) as:

```
VITE_BACKEND_URL=https://<account>--fitly-backend-web.modal.run
```

Then restart the Vite dev server (`bun run dev`) so it picks up the new
env var.

## Local iteration (no deploy)

```bash
modal serve modal/app.py
```

This starts a hot-reload dev server with a temporary public URL printed
on the console. Point the frontend at that URL for local end-to-end
testing without burning a deploy.

## Smoke test

Once deployed or running via `modal serve`, replace `BASE` below with the
URL Modal printed:

```bash
BASE=https://<account>--fitly-backend-web.modal.run

# liveness
curl "$BASE/healthz"

# create session
curl -X POST "$BASE/session" \
  -H 'content-type: application/json' \
  -d '{"shoe_slug": "nike-vaporfly-4"}'
# → {"session_id":"<uuid>", "session_token":"<base64url-hmac>"}

# submit demo measurements (mit Bearer-Auth wenn HMAC-Secret gesetzt)
curl -X POST "$BASE/scan" \
  -H 'content-type: application/json' \
  -H "Authorization: Bearer <session_token>" \
  -d '{"session_id":"<uuid>","foot_length_mm":238,"foot_width_mm":101,"ball_width_mm":101,"heel_width_mm":72,"arch_type":"medium","eu_size":39}'
# → {"ok":true}

# fetch session to see the update (mit Bearer)
curl -H "Authorization: Bearer <session_token>" "$BASE/session/<uuid>"
```

## Architecture notes

- The **web container** runs FastAPI with only the Supabase client loaded.
  Cold-starts stay fast (~1s).
- The **measure container** runs in a separate Modal image with numpy /
  Pillow / opencv-headless pre-installed. `measure_from_photo.remote(...)`
  dispatches to it; the web function never imports vision code.
- CORS-Origin-Allowlist statt `*` (Sprint-1-Mitigation, in `app.py` codiert).
- **HMAC-signed session-tokens** (Task 14): `/session` POST returns
  `{session_id, session_token}`. Token = base64url(HMAC-SHA256(session_id,
  SESSION_HMAC_SECRET)). Alle Per-Session-Endpoints prüfen `Authorization:
  Bearer <token>` + `session_id` form-field.

## What this backend does NOT do (yet)

- Real foot measurement from photo (stub only).
- Rate limiting / abuse protection.
- Auth verification.
- Webhook callbacks when long-running jobs finish (currently everything
  runs synchronously inside the request; switch to
  `measure_from_photo.spawn(...)` + a status poll when ML gets slow).

## Dependencies (pinned)

Declared inside `app.py` via `modal.Image.pip_install(...)`:

- `fastapi==0.115.4`
- `supabase==2.9.1`
- `pydantic==2.9.2`
- `numpy==2.1.2` (measure image)
- `pillow==10.4.0` (measure image)
- `opencv-python-headless==4.10.0.84` (measure image)

No local `requirements.txt` — the Modal CLI is the only thing a developer
needs installed locally.
