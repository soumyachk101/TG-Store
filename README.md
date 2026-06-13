# TGStore

Self-hosted personal cloud storage that uses **Telegram's Bot API as a free CDN backend**.

- **Frontend:** Next.js 14 (App Router) + Tailwind + TanStack Query v5 + NextAuth v5
- **Backend:** FastAPI + SQLAlchemy 2.0 (async) + Alembic + python-jose
- **Database:** PostgreSQL 16
- **Storage:** Telegram Bot API (private channel acts as the bucket)

> Single-user, self-use. See `Docs/PRD.md` for the full product spec and `Docs/Ai Instruction.md` for coding rules.

---

## Repo layout

```
.
├── backend/          # FastAPI app
├── frontend/         # Next.js app
├── Docs/             # PRD, TRD, App Flow, AI Instructions
└── docker-compose.yml
```

---

## Quick start (local dev)

### 1. Start Postgres

```bash
docker compose up -d db
```

### 2. Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -e .
cp .env.example .env             # fill in BOT_TOKEN, CHAT_ID, JWT_SECRET
alembic upgrade head
uvicorn app.main:app --reload
```

Backend runs at <http://localhost:8000>. OpenAPI docs at `/docs`.

### 3. Frontend

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

Frontend runs at <http://localhost:3000>.

---

## Required environment variables

See `backend/.env.example` and `frontend/.env.example`. The full list is also in `Docs/Ai Instruction.md` → "Deployment Checklist".

Critical ones for local dev:

- `BOT_TOKEN` — from [@BotFather](https://t.me/BotFather)
- `CHAT_ID` — the **private channel ID** the bot is an admin of (negative, e.g. `-100xxxxxxxxxx`)
- `DATABASE_URL` — defaults to `postgresql+asyncpg://tgstore:tgstore@localhost:5432/tgstore`
- `JWT_SECRET` — random 32+ byte string

---

## Phase 1 scope (this milestone)

Per `Docs/PRD.md` §7 — **Core upload/download, flat file list, basic auth**.

- [x] Project scaffold + docker-compose
- [x] FastAPI foundation + SQLAlchemy models + Alembic
- [x] Telegram service layer (with retry, no token leakage)
- [x] JWT auth (login/me) + `require_auth` dependency
- [x] Files router: upload, list, download-url, stream, patch, delete
- [x] Stats endpoint
- [x] Next.js 14 App Router init
- [x] Auth flow + middleware
- [x] Dashboard + file list + upload UI
- [x] File actions (download, rename, delete)
- [x] Storage stats widget
- [x] End-to-end verification

Phase 2 (folders, search) and Phase 3 (inline preview) come next.

---

## Telegram setup (one-time)

1. Create a bot with [@BotFather](https://t.me/BotFather), copy the token.
2. Create a **private channel**, add your bot as an **administrator**.
3. Get the channel ID: forward any message from the channel to [@JsonDumpBot](https://t.me/JsonDumpBot) or use `https://api.telegram.org/bot<TOKEN>/getUpdates` after posting in the channel. Channel IDs look like `-100xxxxxxxxxx`.
4. Put both into `backend/.env`.
