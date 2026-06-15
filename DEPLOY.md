# DEPLOY.md — TGStore Production Deployment Guide

> **Version:** 1.0
> **Audience:** Self-hosters deploying TGStore for personal use.
> **Scope:** End-to-end, from a clean machine to a live, monitored app.

TGStore is a personal cloud storage app that uses Telegram's Bot API as a free CDN. This guide walks you through a real production deploy: Vercel (frontend), Railway (backend), Neon (Postgres), Telegram (storage). It is written for a single operator deploying for themselves, with production-grade hygiene (secret rotation, CORS, TLS, monitoring, DR).

---

## 0. Pre-Deployment Audit (CRITICAL)

> **Do this first.** The repository currently has a `BOT_TOKEN` and `ADMIN_PASSWORD=changeme` checked in or visible in `.env.example`-style values. **Anything that has been pushed to a public repository, shared in a screenshot, or pasted into a chat is considered exposed.** Treat it as compromised.

### 0.1 Inventory of exposed secrets (rotate ALL of them)

| Secret | Where it may be exposed | Action |
|---|---|---|
| `BOT_TOKEN` | `backend/.env.example` placeholder, prior local `.env`, repo history, screenshots, chat | Revoke via @BotFather, re-issue |
| `CHAT_ID` | Same as above | New channel is not strictly required, but a new bot cannot see old messages |
| `JWT_SECRET` | `.env` files | Generate a fresh 32-byte random string |
| `AUTH_SECRET` | `frontend/.env.example`, prior `.env.local` | Generate a fresh 32-byte random string |
| `ADMIN_PASSWORD` | `backend/.env.example` default `changeme` | Pick a strong, unique password |
| Firebase API key | `frontend/.env.example` placeholder, prior `.env.local` | Regenerate in Firebase console |
| Firebase service account JSON | Repo, chat, CI logs | Re-issue in Firebase console |

### 0.2 Re-issue the Telegram bot (the current token is exposed)

```
You → @BotFather:    /mybots
@BotFather → You:    [list of your bots]
You → @BotFather:    [select TGStore bot] → "API Token" → "Revoke current token"
@BotFather → You:    Confirm revocation → new token issued (e.g., 7123456789:AA...)

You → @BotFather:    [select bot] → "Bot Settings" → "Allow Groups?" off (recommended)
```

Copy the new token into your password manager. **Do not commit it.**

### 0.3 Generate fresh signing secrets

```bash
# JWT_SECRET (backend) — HS256 signing key
openssl rand -base64 32
# Example output: 7v9GkQp2L3xM8nZs4bY1oC6dF0hJ5iA9wE2rT7uK1pX=
# Length will be 44 chars (32 random bytes → base64).

# AUTH_SECRET (NextAuth) — cookie encryption key
openssl rand -base64 32
```

If you have access to a previous commit, you can verify the prior secrets are not load-bearing:

```bash
cd /Users/soumyachakraborty/Documents/D/TGStore
# Make sure no real .env is tracked
git ls-files | grep -E '\.env($|\.)' || echo "OK: no .env files tracked"
```

### 0.4 Update the admin password

Pick a 16+ character password. Store it in 1Password/Bitwarden/`pass`. Do not reuse. You will set this as `ADMIN_PASSWORD` on Railway.

### 0.5 Security hardening checklist (do before step 1)

- [ ] Bot token rotated via @BotFather
- [ ] `JWT_SECRET` regenerated with `openssl rand -base64 32`
- [ ] `AUTH_SECRET` regenerated with `openssl rand -base64 32`
- [ ] `ADMIN_PASSWORD` is a fresh, strong value
- [ ] Firebase service account JSON re-issued (if using Firebase)
- [ ] Old secrets purged from local `.env` files and any cloud shells you used
- [ ] `.env` is in `.gitignore` (verify — see §15)
- [ ] You have a password manager entry for every secret above

---

## 1. Architecture Overview

### 1.1 High-level diagram

```
                   ┌─────────────────────────────────────┐
                   │         Browser (Vercel CDN)        │
                   │   https://tgstore.vercel.app        │
                   │   Next.js 14 · NextAuth cookie      │
                   └──────────┬──────────────────────────┘
                              │  HTTPS, httpOnly cookie
                              ▼
                   ┌─────────────────────────────────────┐
                   │      FastAPI backend (Railway)      │
                   │   https://tgstore.up.railway.app    │
                   │   /health · /auth/login · /files    │
                   └────┬─────────────────────────┬──────┘
                        │ asyncpg                  │ httpx
                        ▼                         ▼
              ┌──────────────────┐      ┌──────────────────┐
              │  Neon Postgres   │      │  Telegram API    │
              │  (pooled + SSL)  │      │  private channel │
              │  metadata only   │      │  sendDocument /  │
              │                  │      │  getFile         │
              └──────────────────┘      └────────┬─────────┘
                                                 │ 64 KB chunks
                                                 ▼
                                      ┌──────────────────────┐
                                      │  Telegram CDN        │
                                      │  (your bytes)        │
                                      └──────────────────────┘
```

### 1.2 Service-by-service responsibilities

| Service | Host | Responsibility |
|---|---|---|
| **Next.js 14 frontend** | Vercel | Auth session, dashboard UI, uploads via axios with progress, download proxy consumption |
| **FastAPI backend** | Railway | Auth, CORS, all Telegram API calls, JWT issuance, file metadata CRUD, streamed downloads |
| **PostgreSQL 16** | Neon (recommended) or Railway | Folder tree, file metadata, soft-delete state |
| **Telegram private channel** | Telegram | The actual file bytes; Telegram's CDN serves them |
| **Telegram bot** | Telegram | Admin in the channel; receives `sendDocument`, returns `file_id` |

### 1.3 Network flow (typical request)

1. Browser opens `https://tgstore.vercel.app/` → Vercel serves the Next.js bundle.
2. `middleware.ts` checks the NextAuth session cookie. If absent → 307 to `/login`.
3. User submits credentials → `frontend/auth.ts` calls `POST /auth/login` on Railway.
4. Railway returns a JWT. NextAuth wraps it in an encrypted httpOnly cookie.
5. Browser POSTs a multipart upload to Railway's `/files/upload`. FastAPI streams bytes to Telegram, persists metadata to Neon, returns 201.
6. On download, browser calls `/files/{id}/stream` (NOT `/download-url`). FastAPI calls `getFile`, gets a fresh 1h URL, and streams 64 KB chunks back to the browser. **The bot token never leaves the backend.**

---

## 2. Prerequisites

### 2.1 Accounts you need

| Service | Why | Sign-up URL |
|---|---|---|
| Telegram | The storage layer | (you already have it) |
| @BotFather | Issues your bot token | https://t.me/BotFather |
| @JsonDumpBot | Reveals the private channel's `chat_id` | https://t.me/JsonDumpBot |
| Neon | Managed Postgres, free tier | https://neon.tech |
| Railway | Backend host, $5/mo hobby plan recommended | https://railway.app |
| Vercel | Frontend host, free tier is fine | https://vercel.com |
| GitHub | Source of truth, also used by Vercel + Railway | https://github.com |
| 1Password / Bitwarden / `pass` | Secret store | your choice |

Optional: BetterStack, UptimeRobot, Sentry (see §13).

### 2.2 Tools required locally

| Tool | Why | Install |
|---|---|---|
| `git` | Code, deployments | `brew install git` / `apt install git` |
| `docker` | (Optional) local Postgres sanity check | `brew install --cask docker` |
| `psql` | Verifying Neon connection | `brew install libpq && echo 'export PATH="/opt/homebrew/opt/libpq/bin:$PATH"' >> ~/.zshrc` |
| `openssl` | Secret generation | Preinstalled on macOS/Linux |
| `gh` CLI | Optional, for GitHub operations | `brew install gh` |
| `vercel` CLI | Optional, for advanced frontend config | `npm i -g vercel` |
| `railway` CLI | Optional, for advanced backend config | `brew install railway` |
| `jq` | Pretty-printing JSON in the smoke test | `brew install jq` |

### 2.3 Local env file checklist

You will need to collect:

- [ ] `BOT_TOKEN` (from @BotFather — fresh, see §0.2)
- [ ] `CHAT_ID` (from @JsonDumpBot, see §3.3)
- [ ] `JWT_SECRET` (`openssl rand -base64 32`)
- [ ] `AUTH_SECRET` (`openssl rand -base64 32`)
- [ ] `ADMIN_USERNAME` (e.g., `admin`)
- [ ] `ADMIN_PASSWORD` (strong, unique)
- [ ] `DATABASE_URL` (Neon pooled, with `+asyncpg` and `?ssl=require`)
- [ ] `DATABASE_URL_SYNC` (Neon direct, with `+psycopg2` and `?ssl=require`)
- [ ] `ALLOWED_ORIGINS` (your future Vercel URL — fill in after §6)

Store these in your password manager. **Do not write them to disk in plain text.**

---

## 3. Telegram Setup (one-time, ~10 min)

### 3.1 Create the bot via @BotFather

Open https://t.me/BotFather in Telegram and run the following commands verbatim:

```
/start
/newbot
TGStore           ← name (display name; you can change later)
tgstore_bot       ← username (must end in `bot`, must be unique)
```

BotFather will reply with a token of the form `110201543:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw`. Copy it.

```
/setdescription
@tgstore_bot
Personal cloud storage powered by Telegram.

/setabouttext
@tgstore_bot
I store files. That's it. Talk to me via the TGStore web app.

/setuserpic
@tgstore_bot
[upload a 512x512 PNG]
```

Disable group privacy (recommended for personal use):

```
/setprivacy
@tgstore_bot
Disable
```

### 3.2 Create the private channel and add the bot

In the Telegram app:

1. Tap the pencil (compose) icon → **New Channel** → name it `TGStore Vault` (or anything you like).
2. Set type to **Private**. Telegram will assign a permanent invite link.
3. Open the channel → **⋯** → **Administrators** → **Add Administrator** → search for `@tgstore_bot` → add.
4. Grant the bot exactly these admin permissions:
   - ✅ Post messages
   - ✅ Delete messages
   - ❌ Everything else (no pinning, no adding members, no changing info)
5. Post a single test message in the channel ("hello") from your personal account. The bot does not need to post anything yet.

### 3.3 Get the channel's `chat_id`

The `chat_id` of a private channel is a negative integer starting with `-100`. To reveal it:

1. Open https://t.me/JsonDumpBot.
2. Forward the test message you just posted in the channel to @JsonDumpBot.
3. JsonDumpBot replies with a JSON payload. Look for `chat.id`. It will be something like:

   ```json
   "chat": {
     "id": -1001234567890,
     "title": "TGStore Vault",
     "type": "supergroup"
   }
   ```

Copy the `id` value — that is your `CHAT_ID`. Save it next to the bot token in your password manager.

> **Sanity check** the bot can post in the channel: from a private chat with `@tgstore_bot`, send `/start@tgstore_bot`. If the channel is wired correctly, you can also do `curl`:
>
> ```bash
> curl -s "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/sendMessage" \
>   -d "chat_id=<YOUR_CHAT_ID>" \
>   -d "text=hello from curl"
> ```
> Expect `"ok": true`.

---

## 4. Backend Deployment to Railway

### 4.1 Project setup

**Option A — Dashboard (recommended for first deploy):**

1. Sign in to https://railway.app with GitHub.
2. **New Project** → **Deploy from GitHub repo** → select `Soumya-Chakraborty/TGStore`.
3. Railway will detect a Node project because of the repo root. You need to point it at `backend/`.

**Pointing the build at `backend/`:**

In the Railway service → **Settings** → **Build**:

- **Root Directory:** `backend`
- **Builder:** `NIXPACKS` (Railway's default Python detector works once the root is set)

If Railway's Nixpacks does not pick up the right start command, add a `railway.json` and `Procfile` to the repo (see §16).

**Option B — CLI:**

```bash
brew install railway
railway login
cd /Users/soumyachakraborty/Documents/D/TGStore/backend
railway init    # create or link a project
railway up      # deploy
```

### 4.2 Database — Railway plugin vs. external Neon

You have two options.

| Option | Pros | Cons |
|---|---|---|
| **Railway Postgres plugin** (one click) | One bill, automatic `DATABASE_URL` injection, easy local CLI access | Coupled to Railway; harder to migrate later; $5/mo minimum plan on Railway |
| **Neon** (external, recommended) | Free tier, branching for previews, point-in-time recovery, decoupled from Railway | You copy two connection strings manually |

**Recommendation: Neon.** It is what the rest of this guide assumes.

### 4.3 Configure environment variables

In Railway → your service → **Variables**, add:

| Variable | Value | Notes |
|---|---|---|
| `BOT_TOKEN` | `<new token from §3.1>` | Required |
| `CHAT_ID` | `<from §3.3, e.g. -1001234567890>` | Required |
| `DATABASE_URL` | `postgresql+asyncpg://USER:PASS@ep-xxx-pooler.REGION.aws.neon.tech/neondb?ssl=require` | Pooled, asyncpg driver |
| `DATABASE_URL_SYNC` | `postgresql+psycopg2://USER:PASS@ep-xxx.REGION.aws.neon.tech/neondb?ssl=require` | Direct, psycopg2 driver (Alembic) |
| `JWT_SECRET` | `<openssl rand -base64 32 output>` | Required |
| `JWT_EXPIRE_HOURS` | `24` | Default is fine |
| `ADMIN_USERNAME` | `admin` | Pick whatever you like |
| `ADMIN_PASSWORD` | `<strong, unique>` | Required, do not use `changeme` |
| `ALLOWED_ORIGINS` | `https://<your-app>.vercel.app` | Update this after §6. For initial boot, `https://<placeholder>.vercel.app` is OK; CORS will reject mismatched origins, but the app will start. |
| `MAX_UPLOAD_BYTES` | `2147483648` | 2 GB, the Telegram cap |
| `PORT` | (auto) | Railway sets this automatically |

Optional, only if you enable Firebase auth (see §8):

| Variable | Value |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Paste the entire service account JSON as a single-line string |
| `FIREBASE_MOCK_AUTH` | `false` |

### 4.4 Generate `JWT_SECRET`

```bash
openssl rand -base64 32
# Example output: 7v9GkQp2L3xM8nZs4bY1oC6dF0hJ5iA9wE2rT7uK1pX=
# Length: 44 characters (32 random bytes encoded as base64)
```

Copy the output. **Paste into Railway, not into a file.**

### 4.5 Start command

In Railway → your service → **Settings** → **Deploy** → **Custom Start Command**:

```bash
alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT --workers 2
```

- `alembic upgrade head` runs every migration on each deploy. Safe to run repeatedly (Alembic is idempotent per migration).
- `uvicorn ... --workers 2` lets Railway handle a tiny bit of concurrency. For a personal app, 1 worker is also fine; bump only if you see latency.

If you prefer a config file, commit a `Procfile` and `railway.json` (templates in §16). With `railway.json` present, you do not need to set a custom start command in the UI.

### 4.6 Health check

In **Settings** → **Health Check**:

- **Path:** `/health`
- **Timeout:** 30 seconds
- **Interval:** 30 seconds

The endpoint is unauthenticated by design (see `backend/app/main.py`). Railway will mark the deploy failed if `/health` does not return 200.

### 4.7 Custom domain (optional)

Skip for now. See §9.

### 4.8 Verify the deploy

Once Railway shows **Deployed**, grab the public URL (it looks like `https://tgstore-production.up.railway.app`).

```bash
# 1. Liveness
curl -fsS https://tgstore-production.up.railway.app/health
# Expected: {"status":"ok"}

# 2. Auth
curl -fsS -X POST https://tgstore-production.up.railway.app/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"YOUR_ADMIN_PASSWORD"}'
# Expected: {"access_token":"eyJhbGciOiJIUzI1NiIs...","expires_in":86400}
```

Watch the **Deploy Logs** tab. Look for:

- `INFO [alembic.runtime.migration] Running upgrade ... → 0001_initial` (or similar) — migrations ran.
- `INFO:     Uvicorn running on http://0.0.0.0:8080` — app started.
- No tracebacks.

If the deploy fails on `alembic upgrade head`, see §16 troubleshooting.

---

## 5. Postgres (Neon) Setup

### 5.1 Create the project

1. Sign up at https://neon.tech (use GitHub SSO for speed).
2. **Create a project**:
   - Name: `tgstore`
   - Region: pick the one closest to your Railway region. (e.g., if Railway runs in `us-west-1`, pick AWS US West.)
   - Postgres version: 16
3. Click into the project → **Dashboard** → **Connection Details**.

You will see four flavors of connection strings. You need exactly two.

### 5.2 Copy the right connection strings

| Use case | Driver | Hostname ends with | Pooled? |
|---|---|---|---|
| `DATABASE_URL` (FastAPI runtime, async) | `postgresql+asyncpg` | `-pooler` (e.g., `ep-xxx-pooler.us-east-2.aws.neon.tech`) | Yes |
| `DATABASE_URL_SYNC` (Alembic migrations, sync) | `postgresql+psycopg2` | direct hostname (e.g., `ep-xxx.us-east-2.aws.neon.tech`) | No |

Append `?ssl=require` to both (Neon requires TLS).

Examples:

```bash
# DATABASE_URL (async, pooled)
DATABASE_URL=postgresql+asyncpg://tgstore_owner:AbC...@ep-cool-name-pooler.us-east-2.aws.neon.tech/neondb?ssl=require

# DATABASE_URL_SYNC (sync, direct — needed by Alembic)
DATABASE_URL_SYNC=postgresql+psycopg2://tgstore_owner:AbC...@ep-cool-name.us-east-2.aws.neon.tech/neondb?ssl=require
```

Paste both into Railway env (§4.3).

### 5.3 Verify Alembic ran cleanly

After the first deploy, in the Railway logs, look for:

```
INFO  [alembic.runtime.migration] Context impl PostgresqlImpl.
INFO  [alembic.runtime.migration] Will assume transactional DDL.
INFO  [alembic.runtime.migration] Running upgrade  -> 0001_initial
INFO  [alembic.runtime.migration] Running upgrade 0001_initial -> f19e8b80c013, add_user_id
```

If you see both, your schema is up to date. If you see `FAILED: Can't locate revision identified by '0001_initial'`, the alembic versions directory was not included in the build. See §16 troubleshooting.

You can also verify directly with `psql`:

```bash
PGPASSWORD='<your-password>' psql \
  'postgresql://tgstore_owner:<pw>@ep-cool-name.us-east-2.aws.neon.tech/neondb?sslmode=require' \
  -c '\dt'
# Expected: folders, files, alembic_version
```

---

## 6. Frontend Deployment to Vercel

### 6.1 Import the repo

1. Sign in to https://vercel.com with GitHub.
2. **Add New** → **Project** → **Import** `Soumya-Chakraborty/TGStore`.
3. **Configure Project**:
   - **Framework Preset:** Next.js (auto-detected)
   - **Root Directory:** `frontend` (click **Edit** and pick `frontend/`)
   - **Build Command:** `next build` (default — leave as is)
   - **Output Directory:** `.next` (default)
   - **Install Command:** `npm install` (default)

### 6.2 Environment variables

In **Environment Variables**, add (all three environments: Production, Preview, Development — though only Production matters for the live app):

| Variable | Production value | Preview value (optional) |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `https://tgstore-production.up.railway.app` (no trailing slash) | your Railway preview URL |
| `AUTH_SECRET` | `<openssl rand -base64 32 output>` | a different value for previews |
| `AUTH_URL` | `https://<your-app>.vercel.app` | `https://<preview-deployment>.vercel.app` |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | (only if using Firebase) | — |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | (only if using Firebase) | — |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | (only if using Firebase) | — |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | (only if using Firebase) | — |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | (only if using Firebase) | — |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | (only if using Firebase) | — |

Generate `AUTH_SECRET` the same way:

```bash
openssl rand -base64 32
```

### 6.3 Domain

For now, accept the auto-assigned domain (`https://tgstore-xyz.vercel.app`). You can attach a custom domain later (§9).

### 6.4 Deploy

Click **Deploy**. Vercel will:

1. Install dependencies.
2. Run `next build` (expect ~60 s for the first build).
3. Deploy to the edge.

### 6.5 Verify

1. Visit `https://<your-app>.vercel.app/` — you should be redirected to `/login`.
2. Sign in with the same `ADMIN_USERNAME` / `ADMIN_PASSWORD` you set on Railway.
3. You should land on the dashboard with an empty file list.
4. The network tab should show a successful `GET /auth/me` returning your username.

If the redirect works but login fails with a network error, jump to §7.

---

## 7. CORS Wiring

The backend's CORS allowlist is set by `ALLOWED_ORIGINS` on Railway. After you have your Vercel URL:

1. Go to Railway → service → **Variables** → `ALLOWED_ORIGINS`.
2. Set it to your exact Vercel origin(s), comma-separated. Example:

   ```
   ALLOWED_ORIGINS=https://tgstore-xyz.vercel.app,https://files.yourdomain.com
   ```

3. **Important:** No trailing slash, no path, no `*`. The origin is `scheme + host + port`. `*` does not work because the backend uses `allow_credentials=True`.
4. Save. Railway will redeploy automatically.

Re-verify:

```bash
# From your laptop
curl -i -X OPTIONS https://tgstore-production.up.railway.app/files \
  -H 'Origin: https://tgstore-xyz.vercel.app' \
  -H 'Access-Control-Request-Method: GET' \
  -H 'Access-Control-Request-Headers: authorization'
# Expect: 204 No Content, and Access-Control-Allow-Origin: https://tgstore-xyz.vercel.app
```

Now refresh the Vercel app. The dashboard should load.

---

## 8. Firebase Auth (Optional)

> **Recommendation: skip Firebase for personal single-user deploys.** TGStore was designed so that one admin user, defined by env vars, is enough. Firebase is only useful if you want email/password sign-up through Google's identity service, multi-device sessions, or MFA. The default flow uses your env-var admin password.

### 8.1 When to use Firebase

Use Firebase if you want:
- Self-service sign-up from the `/login` page (the UI already has a Sign Up tab wired to `createUserWithEmailAndPassword`).
- Email verification, password reset, MFA, OAuth providers.

Do **not** use Firebase if:
- You are the only user.
- You want the smallest possible attack surface.

### 8.2 Setup (only if you choose Firebase)

1. Go to https://console.firebase.google.com → **Add project** → name it `tgstore` → disable Google Analytics if you don't need it.
2. In the project → **Authentication** → **Get started** → enable **Email/Password** sign-in.
3. **Project settings** → **General** → **Your apps** → click the web icon (`</>`) to register a web app:
   - Nickname: `TGStore Web`
   - Skip Firebase Hosting.
4. Copy the config object. You will map it to Vercel env vars (see §6.2):

   ```
   NEXT_PUBLIC_FIREBASE_API_KEY       = apiKey
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN   = authDomain
   NEXT_PUBLIC_FIREBASE_PROJECT_ID    = projectId
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET= storageBucket
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID = messagingSenderId
   NEXT_PUBLIC_FIREBASE_APP_ID        = appId
   ```

5. **Backend service account** — Project settings → **Service accounts** → **Generate new private key**. This downloads a JSON file. Open it.
6. **On Railway**, set two env vars:
   - `FIREBASE_SERVICE_ACCOUNT_JSON`: paste the entire contents of the JSON as a single-line string (escape any newlines as `\n`).
   - `FIREBASE_MOCK_AUTH`: `false`.

   (Alternative: set `FIREBASE_SERVICE_ACCOUNT_PATH` to a path inside the container and mount the file via Railway's secret files. The JSON env var is simpler.)

7. Redeploy the backend. In logs you should see `INFO: Firebase initialized successfully using service account credentials JSON string.`

### 8.3 If you are NOT using Firebase

- Leave `FIREBASE_MOCK_AUTH=false`.
- Do **not** set `FIREBASE_SERVICE_ACCOUNT_*` env vars.
- The login page will fall through to the local FastAPI auth path (see `frontend/auth.ts`).

---

## 9. Custom Domains (Optional)

### 9.1 Vercel

1. Vercel project → **Settings** → **Domains**.
2. Type your domain (`storage.yourdomain.com`).
3. Vercel shows the DNS records to add. At your registrar, add:
   - `CNAME  storage  cname.vercel-dns.com.`  (for subdomains)
   - or `A      @       76.76.21.21`           (for apex)
4. Wait for DNS to propagate (usually under 5 min for `CNAME`).
5. Vercel auto-issues a Let's Encrypt cert.

### 9.2 Railway

1. Service → **Settings** → **Networking** → **Custom Domain**.
2. Type your API subdomain (`api.yourdomain.com`).
3. Add the CNAME Railway shows you at your registrar.
4. Railway provisions TLS automatically.

### 9.3 Update env vars

After both custom domains are live, update:

- **Vercel** → `AUTH_URL` = `https://storage.yourdomain.com`
- **Railway** → `ALLOWED_ORIGINS` = `https://storage.yourdomain.com`
- **Vercel** → `NEXT_PUBLIC_API_URL` = `https://api.yourdomain.com`

Redeploy both. Verify the same way as §7.

---

## 10. Post-Deploy Verification

### 10.1 Smoke test script (bash)

Save this as `scripts/smoke.sh` (not committed), make it executable, and run it after every deploy:

```bash
#!/usr/bin/env bash
# TGStore post-deploy smoke test.
# Usage:
#   ADMIN_USER=admin ADMIN_PASS='...' API=https://api.example.com \
#   WEB=https://storage.example.com ./smoke.sh
set -euo pipefail

: "${API:?Set API=https://<railway>.up.railway.app}"
: "${WEB:?Set WEB=https://<vercel>.vercel.app}"
: "${ADMIN_USER:=admin}"
: "${ADMIN_PASS:?Set ADMIN_PASS}"

echo "==> 1. health"
curl -fsS "$API/health" | jq .

echo "==> 2. login"
TOKEN=$(curl -fsS -X POST "$API/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"username\":\"$ADMIN_USER\",\"password\":\"$ADMIN_PASS\"}" | jq -r .access_token)
[ -n "$TOKEN" ] || { echo "no token"; exit 1; }
echo "got token (${#TOKEN} chars)"

echo "==> 3. /auth/me (auth-guarded)"
curl -fsS "$API/auth/me" -H "Authorization: Bearer $TOKEN" | jq .

echo "==> 4. /files (auth-guarded, list)"
curl -fsS "$API/files?limit=5" -H "Authorization: Bearer $TOKEN" | jq .

echo "==> 5. /folders (auth-guarded, list)"
curl -fsS "$API/folders" -H "Authorization: Bearer $TOKEN" | jq .

echo "==> 6. /files/stats (auth-guarded, stats)"
curl -fsS "$API/files/stats" -H "Authorization: Bearer $TOKEN" | jq .

echo "==> 7. unauthenticated /files should be 401"
HTTP=$(curl -s -o /dev/null -w "%{http_code}" "$API/files")
[ "$HTTP" = "401" ] || { echo "expected 401, got $HTTP"; exit 1; }
echo "401 OK"

echo "==> 8. web renders"
curl -fsSI "$WEB/" | head -1
curl -fsSI "$WEB/login" | head -1

echo
echo "ALL CHECKS PASSED"
```

Run it:

```bash
chmod +x scripts/smoke.sh
ADMIN_PASS='your-password' \
  API='https://tgstore-production.up.railway.app' \
  WEB='https://tgstore-xyz.vercel.app' \
  ./scripts/smoke.sh
```

### 10.2 Manual checks (do once after first deploy)

1. Open `https://<vercel>.vercel.app/` in your browser.
2. Sign in with `admin` / `<ADMIN_PASSWORD>`.
3. Drag a 1 KB text file onto the dropzone. Watch the progress bar. Expect a 201 and the file in the list.
4. Click the file's download icon. Expect the file to download via `/stream`.
5. Soft-delete the file. Refresh. It should be gone.
6. Create a folder. Create a sub-folder. The depth cap is 3.
7. Search for the file by name. Expect a 300 ms-debounced live filter.
8. Open the browser DevTools → Network tab. Verify there are **no** `https://api.telegram.org/...` calls in the browser. The bot token must never leave the backend.

---

## 11. Operational Runbook

### 11.1 Where logs are

| Service | Where to read logs |
|---|---|
| Backend (Railway) | Service → **Logs** tab. Real-time tail. |
| Frontend (Vercel) | Project → **Logs** tab. Real-time tail of edge and serverless. |
| Database (Neon) | Project → **Monitoring**. Slow query log + connection stats. |
| Telegram | No direct logs. Use `getUpdates` for the bot, but you do not need this for TGStore. |

### 11.2 Roll back a deploy

**Vercel:**

1. Project → **Deployments** tab.
2. Find the last green deployment before the regression.
3. Click ⋯ → **Promote to Production**.

**Railway:**

1. Service → **Deployments** tab.
2. Find the last successful deployment.
3. Click **Rollback**.

Both are non-destructive. The current code stays in the deployment list.

### 11.3 Rotate the bot token

```
You → @BotFather:    /mybots
You → @BotFather:    [select TGStore bot] → "API Token" → "Revoke current token"
@BotFather → You:    new token issued
```

Then in Railway → Variables → `BOT_TOKEN` → paste the new value → save (auto-redeploys).

No other secret needs to rotate. The channel stays the same, `CHAT_ID` is unchanged, JWTs in flight are unaffected.

### 11.4 Add a new env var without a full redeploy

**Railway:** Variables → add → save. Railway will redeploy automatically (it does not do in-place env swaps). For a "soft" restart without rebuilding, click **Restart** in the top right.

**Vercel:** Environment Variables → add → save. Vercel will redeploy on the next push. To apply immediately, redeploy from the **Deployments** tab (⋯ → **Redeploy**).

### 11.5 Database backup

Neon is the source of truth for metadata. The Telegram channel is the source of truth for bytes.

- **Neon:** All plans include **point-in-time recovery** (PITR) for at least 7 days. Project → **Restore** → pick a timestamp.
- **Telegram:** The channel is replicated by Telegram across their CDN. To export a copy, use the Telegram Desktop app → channel → **⋯** → **Export Chat History**. Output is an HTML file listing every message with its `file_id` and download link.

### 11.6 Reading common error logs

| Log line | Meaning | Action |
|---|---|---|
| `WARNING:  Invalid or expired token` on `/auth/me` | JWT bad, expired, or signed with a different `JWT_SECRET` | Refresh session; if persistent, check Railway `JWT_SECRET` |
| `413 File too large` | Upload > `MAX_UPLOAD_BYTES` (default 2 GB) | Lower the file size or raise the cap (do not exceed Telegram's 2 GB limit) |
| `502 Storage unavailable` | Telegram call failed 3× with backoff | Check `BOT_TOKEN`, `CHAT_ID`, and that the bot is still an admin in the channel |
| `WARNING: Could not initialize Firebase Admin SDK` | Firebase env vars missing or JSON invalid | Re-check §8 |
| `psycopg2.OperationalError: connection refused` | DATABASE_URL wrong, Neon project paused, or `?ssl=require` missing | Wake the Neon project (free tier auto-suspends after 5 min idle); verify the URL |
| `alembic.util.exc.CommandError: Can't locate revision` | Migrations directory not in build | See §16 |

---

## 12. Scaling & Cost

### 12.1 Telegram limits to watch

| Limit | Value | What it means for TGStore |
|---|---|---|
| Max file size | 2 GB (download) / 50 MB (upload via Bot API for some accounts, but `sendDocument` accepts up to 2 GB) | `MAX_UPLOAD_BYTES` defaults to 2 GB. Don't raise it. |
| Bot API rate | 30 messages/sec global, 1 msg/sec per chat for `sendMessage` | `sendDocument` is a per-chat limit of a few/sec. Don't parallelize uploads. |
| `getFile` URL TTL | ~1 hour | The app regenerates per request. Never cache. |
| Channel size | Effectively unlimited for personal use | No action. |

### 12.2 Railway

- **Hobby plan: $5/mo** includes $5 of usage. Plenty for one FastAPI service.
- **Free tier:** $1 of usage credit + the service sleeps after inactivity. The sleep causes the first request to take 5–10 s (cold start). Not recommended for a real personal app.
- **Trial:** $5 free for the first month. Use it to validate.

### 12.3 Vercel

- **Hobby (free):** 100 GB bandwidth/mo, 100 GB-hr serverless. TGStore is mostly static + edge middleware — bandwidth is the only meaningful cost. For personal use, free is plenty.

### 12.4 Neon

- **Free:** 0.5 GB storage, 190 compute-hours/mo, 1 project, branching. TGStore metadata is tiny (a few KB per file). 0.5 GB holds millions of rows.
- Free tier projects auto-suspend after 5 min of inactivity. The first query after suspend takes ~500 ms (cold start). For a personal app, this is fine.

### 12.5 When traffic grows (it won't, but if)

- Upgrade Railway to a higher plan (vertical scaling is enough until ~100 concurrent users).
- Move the backend behind Cloudflare to absorb spikes (you'd need to add `app.add_middleware(TrustedHostMiddleware, ...)` for hostname validation).
- Move the bot from one channel to a **supergroup** if Telegram ever imposes per-channel caps. `CHAT_ID` becomes a supergroup id; the rest of TGStore is unchanged.

---

## 13. Monitoring & Alerts (Optional but recommended)

### 13.1 Uptime monitoring

**UptimeRobot (free tier: 50 monitors, 5-min interval):**

1. Sign up at https://uptimerobot.com.
2. **Add New Monitor** → HTTP(s).
3. Friendly name: `TGStore API`.
4. URL: `https://<railway>.up.railway.app/health`.
5. Monitoring interval: 5 min.
6. Alert contacts: your email. Optionally add a Telegram contact for phone alerts.

**BetterStack** is a paid alternative with a generous free tier and a nicer UI. Either is fine.

### 13.2 Error tracking (Sentry)

For the **backend**, add `sentry-sdk[fastapi]` to `pyproject.toml`, then in `backend/app/main.py`:

```python
import sentry_sdk
sentry_sdk.init(
    dsn=os.getenv("SENTRY_DSN"),
    traces_sample_rate=0.1,  # 10% of requests for perf
    environment=os.getenv("RAILWAY_ENVIRONMENT", "production"),
)
```

Add `SENTRY_DSN` to Railway. Restart.

For the **frontend**, install `@sentry/nextjs` and run `npx @sentry/wizard@latest`. Add `SENTRY_DSN` (as a `NEXT_PUBLIC_` var if you want client-side errors too) to Vercel.

### 13.3 Telegram alerts

Create a **second** bot via @BotFather for monitoring alerts. Get its token, find your chat id with @JsonDumpBot, and add both to UptimeRobot / BetterStack. Don't conflate this with the storage bot — losing the storage bot token must not break your alerting.

---

## 14. Disaster Recovery

### 14.1 Snapshot Postgres

```bash
# Capture a logical dump from Neon. Use the direct (non-pooled) connection string.
pg_dump 'postgresql://tgstore_owner:PW@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require' \
  --no-owner --no-acl -F c -f tgstore-$(date +%F).dump
```

Store the `.dump` in a private S3 / Backblaze B2 / encrypted local disk. Schedule this weekly via cron on a small VPS or your laptop.

### 14.2 Backup the Telegram channel

1. Install **Telegram Desktop**.
2. Open your private channel.
3. **⋯** → **Export Chat History**:
   - Photos: off (you don't need thumbnails; you have the originals)
   - Video files: on
   - Other files: on
   - Format: HTML or JSON
4. Save to a safe location.

Note: this exports **copies** of your files. The source of truth is still Telegram. The export is for offline archival.

### 14.3 Restore procedure

**Scenario: Neon is wiped.**

1. Spin up a new Neon project (or use the old one's PITR).
2. Restore the dump:

   ```bash
   pg_restore -d 'postgresql://tgstore_owner:PW@ep-new.us-east-2.aws.neon.tech/neondb?sslmode=require' \
     --no-owner --no-acl tgstore-2026-06-15.dump
   ```

3. Update Railway `DATABASE_URL` and `DATABASE_URL_SYNC` to the new endpoints.
4. Restart Railway. Migrations are idempotent and safe to re-run.

**Scenario: Telegram channel is gone (bot was removed, channel was deleted, or Telegram banned you).**

This is catastrophic and TGStore cannot recover on its own — bytes only existed on Telegram.

- If you have the channel export, re-upload to a new channel. You'd need to write a recovery script (not provided here) that reads the export, calls `/files/upload` against a new channel, and updates `tg_file_id` in the DB.
- If you do not have the export, the metadata rows in Postgres become orphan pointers. They will return 404 on stream. The DB can be cleaned up with `UPDATE files SET deleted_at = NOW() WHERE tg_file_id IN (...);`.

**Scenario: bot token is leaked and abused.**

1. @BotFather → revoke token (this immediately invalidates the leaked one).
2. New token issued. Update `BOT_TOKEN` on Railway.
3. Restart Railway.
4. Audit your channel for spam messages from the old token. The bot is admin in a private channel only you can post in, so abuse is limited — but verify.

---

## 15. Pre-Deploy Security Checklist

Run this before each deploy that touches secrets.

- [ ] `JWT_SECRET` is a fresh 32-byte random string (`openssl rand -base64 32`)
- [ ] `AUTH_SECRET` is a fresh 32-byte random string
- [ ] `ADMIN_PASSWORD` is set to a strong, unique value
- [ ] `ALLOWED_ORIGINS` is the production frontend URL (no wildcards, no trailing slash)
- [ ] `BOT_TOKEN` and `CHAT_ID` are **not** in any tracked file
- [ ] `FIREBASE_MOCK_AUTH` is `false` (or you are intentionally in dev mode)
- [ ] `.env` files are in `.gitignore`:

      ```bash
      git ls-files | grep -E '\.env($|\.)' && echo "FAIL" || echo "OK"
      ```

- [ ] Database uses SSL (`?ssl=require` in both Neon URLs)
- [ ] No `console.log` of secrets in browser DevTools (open it, sign in, verify)
- [ ] CORS does not allow `*` with credentials (verify by trying from a different origin — should fail)
- [ ] `/health` is reachable without auth
- [ ] `/files` returns 401 without auth
- [ ] `git log` of the most recent commit shows no secrets:

      ```bash
      git log -p --since="3 days ago" | grep -E 'BOT_TOKEN|JWT_SECRET|AUTH_SECRET|ADMIN_PASSWORD' && echo "FAIL" || echo "OK"
      ```

---

## 16. Appendix

### 16.1 Useful CLI commands

```bash
# Generate a strong secret
openssl rand -base64 32

# Tail Railway logs
railway logs -s tgstore-backend

# Open a one-off psql against Neon
psql 'postgresql://tgstore_owner:PW@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require'

# Tail Vercel logs
vercel logs tgstore.vercel.app --prod

# Force a Railway restart
railway restart -s tgstore-backend

# Promote a previous Vercel deployment
vercel promote <deployment-url>
```

### 16.2 Troubleshooting common deploy errors

**"CORS error" in the browser console.**

`ALLOWED_ORIGINS` does not include the Vercel URL exactly. Check Railway. Remember: scheme + host + port, no trailing slash, no path, no `*`.

**"401 on first login"**

Most often a `JWT_SECRET` mismatch between dev (laptop) and prod (Railway). The token issued in one environment will be rejected by the other. Fix: confirm Railway has the production secret, then force a fresh login.

**"502 on upload"**

The backend could not reach Telegram. Check:
- `BOT_TOKEN` is correct (revoke + reissue, then update).
- `CHAT_ID` is correct and negative (e.g., `-1001234567890`).
- The bot is **still** an admin in the channel with "Post messages".
- Test directly:

  ```bash
  curl -s "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getMe"
  # Expect: {"ok":true,"result":{"id":...}}
  ```

**"alembic upgrade failed: Can't locate revision '0001_initial'"**

The Alembic `versions/` directory was not included in the build. Verify `backend/alembic/versions/` contains the two `.py` migration files. If you set a custom Root Directory on Railway, make sure it points to `backend/`, not `backend/app/`.

**"alembic upgrade failed: connection refused" / SSL error**

The DATABASE_URL is wrong. Check:
- The hostname ends with `-pooler` for `DATABASE_URL` and is the direct hostname for `DATABASE_URL_SYNC`.
- `?ssl=require` is present in both.
- The Neon project is **not** suspended (visit the Neon dashboard and click "Wake" if it is).

**"NextAuth `MissingSecret`" error on the frontend.**

`AUTH_SECRET` is not set on Vercel. Add it (Production environment), then redeploy.

**"Firebase `auth/invalid-api-key`"**

`NEXT_PUBLIC_FIREBASE_API_KEY` is wrong, or the Firebase project has API key restrictions that block the Vercel domain. In Firebase Console → **Authentication** → **Settings** → **Authorized domains**, add `<your-app>.vercel.app` and your custom domain.

**"Telegram sendDocument 400 / 404"**

Either the bot is not an admin, or `CHAT_ID` is wrong. To check `CHAT_ID` again, re-forward the test message to @JsonDumpBot.

**"Vercel build fails: `firebase` module not found"**

Run `npm install` locally and commit the lockfile. Vercel uses `npm install` by default; if you've been using `pnpm` or `yarn` locally, switch to `npm` for Vercel.

**"Railway build fails: `alembic: command not found`"**

The build context is wrong. The `Procfile` or `railway.json` should run from the `backend/` root, and `pyproject.toml` must list `alembic` as a dependency (it does — see `backend/pyproject.toml`).

### 16.3 `.env.production.example` (commit this)

```env
# --- Telegram ---
BOT_TOKEN=
CHAT_ID=

# --- Database (Neon) ---
DATABASE_URL=postgresql+asyncpg://USER:PASS@ep-xxx-pooler.REGION.aws.neon.tech/neondb?ssl=require
DATABASE_URL_SYNC=postgresql+psycopg2://USER:PASS@ep-xxx.REGION.aws.neon.tech/neondb?ssl=require

# --- Auth ---
JWT_SECRET=
JWT_EXPIRE_HOURS=24
ADMIN_USERNAME=admin
ADMIN_PASSWORD=

# --- CORS ---
ALLOWED_ORIGINS=https://your-app.vercel.app

# --- Upload limits ---
MAX_UPLOAD_BYTES=2147483648

# --- Firebase (optional) ---
FIREBASE_SERVICE_ACCOUNT_JSON=
FIREBASE_MOCK_AUTH=false
```

### 16.4 `railway.json` (commit at `backend/railway.json`)

This pins the build and start commands so Railway's UI does not need to be configured.

```json
{
  "$schema": "https://railway.com/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT --workers 2",
    "healthcheckPath": "/health",
    "healthcheckTimeout": 30,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 3
  }
}
```

### 16.5 `Procfile` (alternative to `railway.json`, commit at `backend/Procfile`)

```
web: alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT --workers 2
```

### 16.6 `vercel.json` (optional, commit at `frontend/vercel.json`)

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "nextjs",
  "buildCommand": "next build",
  "installCommand": "npm install"
}
```

In practice, Vercel auto-detects Next.js and a `vercel.json` is rarely needed. Add one only if you want to override the install command (e.g., to use `pnpm`).

### 16.7 `.gitignore` additions (verify these are present)

```gitignore
# Local env files
.env
.env.local
.env.*.local
backend/.env
frontend/.env.local

# Secrets that should never be committed
*.pem
firebase-sa.json
service-account.json

# Backups
*.dump
*.sql.gz
```

---

You are done. Sign in, upload a file, and enjoy a free personal cloud.
