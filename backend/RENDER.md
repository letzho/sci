# Render deployment (backend Web Service)

## Render dashboard settings (important)

| Field | Value |
|-------|--------|
| **Environment** | Node (not Python) |
| **Root Directory** | `backend` |
| **Build Command** | `npm install` — or `bash render-build.sh` |
| **Start Command** | `bash start.sh` — **required** for premium ML predictor |

> **If Start Command is `node server.js`**, the API runs but the ML sidecar never starts — the UI will show "ML service offline".

### Do NOT put Python in the build command

If Build Command includes `pip install -r ml/requirements.txt` or `bash start.sh`, the deploy can fail with:

```
BackendUnavailable: Cannot import 'setuptools.build_meta'
```

That happens because Render uses a very new Python (e.g. 3.14) and old `scikit-learn` has no prebuilt wheels, so pip tries to compile from source and breaks.

**The main API does not need Python to build.** Schema migrations run automatically on boot (`initSchema()` in `server.js`).

### Optional ML premium predictor (Python)

Only if you need `/api/tools/predict-premium`:

| Field | Value |
|-------|--------|
| **Start Command** | `bash start.sh` |

`start.sh` installs Flask/sklearn at **runtime** (best-effort) and starts the sidecar on `127.0.0.1:5001`. If pip fails, **the Node API still runs** — check deploy logs for `[start] pip install failed`.

**Recommended if native Node runtime has no Python or pip fails:** switch the service to **Docker**, set Root Directory to `backend`, leave Dockerfile path as `Dockerfile`. The image bundles Node 20 + Python 3.11 and pre-installs ML deps at build time.

ML is optional for the hackathon demo — chat, game survey, and policy tools work without it.

### ML still offline with `bash start.sh`?

**Do not rely on Render Shell `pip install`** — it only affects the current instance and does not survive redeploys or restarts. `start.sh` already runs pip on every boot.

1. Open **Logs** on Render and search for `[start]`. Common messages:
   - `Python not found` → Node runtime has no Python. **Switch to Docker** (below).
   - `pip install failed` → Python version incompatible (often 3.14 on Node). **Switch to Docker**.
   - `ML health: Missing model files` → `.pkl` files not deployed; ensure they are committed in `backend/ml/models/`.

2. **Render Shell** (Root Directory = `backend`) — run once to see the exact error:
   ```bash
   bash scripts/ml-diagnose.sh
   ```

3. **Recommended fix — Docker deploy** (Node + Python in one image):

   | Field | Value |
   |-------|--------|
   | **Environment** | Docker |
   | **Root Directory** | `backend` |
   | **Dockerfile Path** | `Dockerfile` |
   | **Start Command** | *(leave empty — Dockerfile CMD runs `bash start.sh`)* |
   | **Build Command** | *(leave empty)* |

   Redeploy. Logs should show `[start] ML dependencies already installed` and `[start] ML sidecar ready`.

4. Verify: `GET /api/tools/premium-predictor/status` → `{"available":true,"ok":true}`.

## Required environment variables

```
NODE_ENV=production
DATABASE_URL=postgresql://postgres:PASSWORD@db.PROJECT_REF.supabase.co:5432/postgres
DATABASE_SSL=true
JWT_SECRET=long-random-string
CLIENT_ORIGIN=https://your-app.vercel.app
ML_SERVICE_URL=http://127.0.0.1:5001
```

If the password contains `@`, `#`, or `%`, URL-encode it in DATABASE_URL.

## ENETUNREACH / IPv6 errors on Render

If logs show `connect ENETUNREACH` with an IPv6 address (`2406:...`), Render cannot reach Supabase's direct IPv6 endpoint.

**Fix (recommended): use Supabase Session pooler instead of direct connection**

1. Supabase → **Project Settings → Database → Connection string**
2. Choose **Session pooler** (port **6543**)
3. Copy the URI — it looks like:

```
postgresql://postgres.ihujtiseiliabnprvxyj:PASSWORD@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres
```

Note the username is `postgres.PROJECT_REF`, not just `postgres`.

Set that as `DATABASE_URL` on Render with `DATABASE_SSL=true`, then redeploy.

The codebase also forces IPv4 DNS for `*.supabase.co` hosts when using the direct URL.

## After first successful deploy

Render Shell (Root Directory = `backend`):

```bash
npm run seed
```

Run once for demo agents/customers. Safe to re-run but it resets demo data.

## Health check

`https://YOUR-SERVICE.onrender.com/api/health`

## Virtual call + chat (production)

### Vercel (frontend) — required env vars

Redeploy after saving (Vite bakes env vars at **build** time):

```
VITE_API_URL=https://YOUR-SERVICE.onrender.com/api
VITE_SOCKET_URL=https://YOUR-SERVICE.onrender.com
```

Without these, the browser tries to call the Vercel hostname on port 4000 — sockets and API will fail.

### Render (backend) — required env vars

```
CLIENT_ORIGIN=https://your-app.vercel.app
OPENAI_API_KEY=sk-...   # required for Whisper transcription on virtual calls
```

`CLIENT_ORIGIN` can be a comma-separated list. `*.vercel.app` preview URLs are also allowed automatically.

### Why video only worked on the same WiFi

WebRTC video is **peer-to-peer**. The app uses Socket.io on Render only to **signal** (offer/answer). Actual camera/audio needs either:

- **Same WiFi / LAN** — often works with STUN only (local demo), or
- **Different networks** — needs **TURN** to relay media.

The frontend now adds a public demo TURN server when not on localhost/LAN. For a serious deployment, use your own TURN service via `VITE_ICE_SERVERS`.

### Transcription not working

Virtual call speech goes: mic → `POST /api/guidance/transcribe` (Whisper) → text → guidance.

| Symptom | Fix |
|--------|-----|
| Always fails | Set `OPENAI_API_KEY` on Render and redeploy |
| Works locally, not on Vercel | Set `VITE_API_URL` on Vercel and **redeploy frontend** |
| Browser fallback only | Whisper unavailable — key missing or `/guidance/transcribe/status` returns `whisper: false` |

Test: open `https://YOUR-SERVICE.onrender.com/api/guidance/transcribe/status` — should return `{"whisper":true}` when the key is set.

### Text chat (no video)

Uses the same `VITE_SOCKET_URL`. If chat works but video does not, the issue is WebRTC/TURN, not the backend.
