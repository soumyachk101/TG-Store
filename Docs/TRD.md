# Technical Requirements Document (TRD)
## TGStore — Personal Cloud Storage on Telegram

**Version:** 1.0  
**Author:** Soumya Chakraborty  
**Date:** June 2026  
**Stack:** Next.js · FastAPI · PostgreSQL · Telegram Bot API

---

## 1. System Architecture

```
Browser (Next.js)
      │
      │  REST / JSON
      ▼
FastAPI Backend  ──────────────────────► Telegram Bot API
      │                                        │
      │  SQL                                   │ file stored on
      ▼                                        ▼
PostgreSQL (metadata)               Telegram CDN (actual bytes)
```

### 1.1 Component Responsibilities

| Component | Responsibility |
|-----------|----------------|
| Next.js frontend | UI, auth session, API calls to FastAPI |
| FastAPI backend | Business logic, Telegram API proxy, auth middleware, DB access |
| PostgreSQL | File metadata, folder structure, soft-delete state |
| Telegram Bot | Receives files sent by backend, stores on Telegram CDN |
| Private Telegram Channel | Acts as the "storage bucket" — all files forwarded here |

---

## 2. Backend — FastAPI

### 2.1 Environment Variables

```env
BOT_TOKEN=             # from @BotFather
CHAT_ID=               # private channel id (negative number, e.g. -100xxxxxxxxxx)
DATABASE_URL=          # postgres connection string
JWT_SECRET=            # for signing auth tokens
JWT_EXPIRE_HOURS=24
```

### 2.2 Project Structure

```
backend/
├── main.py
├── routers/
│   ├── auth.py
│   ├── files.py
│   └── folders.py
├── services/
│   ├── telegram.py    # all Telegram API calls
│   └── storage.py     # business logic (upload, fetch, delete)
├── models/
│   ├── db.py          # SQLAlchemy models
│   └── schemas.py     # Pydantic request/response schemas
├── middleware/
│   └── auth.py        # JWT verification dependency
└── utils/
    └── helpers.py
```

### 2.3 API Endpoints

#### Auth

| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/login` | Username + password → JWT token |
| GET | `/auth/me` | Verify token, return user info |

#### Files

| Method | Path | Description |
|--------|------|-------------|
| POST | `/files/upload` | Upload file → forward to Telegram → save metadata |
| GET | `/files` | List all files (supports query params: folder, type, search, page) |
| GET | `/files/{id}` | Get single file metadata |
| GET | `/files/{id}/download-url` | Generate fresh Telegram download URL |
| GET | `/files/{id}/stream` | Proxy-stream file content through FastAPI |
| PATCH | `/files/{id}` | Rename or move file (metadata only) |
| DELETE | `/files/{id}` | Soft-delete (sets deleted_at in DB) |

#### Folders

| Method | Path | Description |
|--------|------|-------------|
| POST | `/folders` | Create folder |
| GET | `/folders` | List all folders (tree structure) |
| PATCH | `/folders/{id}` | Rename folder |
| DELETE | `/folders/{id}` | Delete folder (must be empty) |

### 2.4 Telegram Service (`services/telegram.py`)

```python
import httpx, os

TG_BASE = f"https://api.telegram.org/bot{os.getenv('BOT_TOKEN')}"
CHAT_ID  = os.getenv("CHAT_ID")

async def send_document(filename: str, content: bytes, mime: str) -> dict:
    """Upload file to Telegram, return full message result."""
    async with httpx.AsyncClient(timeout=120) as client:
        r = await client.post(
            f"{TG_BASE}/sendDocument",
            data={"chat_id": CHAT_ID, "caption": filename},
            files={"document": (filename, content, mime)},
        )
    r.raise_for_status()
    return r.json()["result"]

async def get_download_url(file_id: str) -> str:
    """Get a fresh (1-hour) download URL for a file_id."""
    async with httpx.AsyncClient() as client:
        r = await client.get(f"{TG_BASE}/getFile", params={"file_id": file_id})
    r.raise_for_status()
    path = r.json()["result"]["file_path"]
    return f"https://api.telegram.org/file/bot{os.getenv('BOT_TOKEN')}/{path}"

async def delete_message(msg_id: int) -> None:
    """Delete a message from the storage channel (hard delete)."""
    async with httpx.AsyncClient() as client:
        await client.post(
            f"{TG_BASE}/deleteMessage",
            data={"chat_id": CHAT_ID, "message_id": msg_id},
        )
```

---

## 3. Database Schema (PostgreSQL)

### 3.1 Tables

```sql
-- Folders
CREATE TABLE folders (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    parent_id   UUID REFERENCES folders(id) ON DELETE CASCADE,
    path        TEXT NOT NULL DEFAULT '/',   -- materialized path e.g. "/work/docs"
    created_at  TIMESTAMP DEFAULT NOW()
);

-- Files
CREATE TABLE files (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL,
    original_name   TEXT NOT NULL,
    mime_type       TEXT,
    size_bytes      BIGINT,
    folder_id       UUID REFERENCES folders(id) ON DELETE SET NULL,

    -- Telegram references
    tg_file_id      TEXT NOT NULL UNIQUE,   -- stable, never changes
    tg_message_id   INTEGER,                -- for hard-delete via deleteMessage

    -- Lifecycle
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW(),
    deleted_at      TIMESTAMP DEFAULT NULL  -- NULL = active, set = soft-deleted
);

-- Indexes
CREATE INDEX idx_files_folder ON files(folder_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_files_name   ON files USING GIN (to_tsvector('english', name));
CREATE INDEX idx_files_mime   ON files(mime_type) WHERE deleted_at IS NULL;
```

### 3.2 Key Design Decisions

- `tg_file_id` is the single source of truth for file retrieval — must never be deleted
- Soft-delete via `deleted_at` — allows undelete, and `tg_file_id` is preserved for recovery
- `tg_message_id` stored optionally to enable `deleteMessage` (removes from Telegram channel too)
- `path` materialized on folder for fast breadcrumb queries without recursive CTE every time

---

## 4. Frontend — Next.js

### 4.1 Project Structure

```
frontend/
├── app/
│   ├── (auth)/
│   │   └── login/page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx         # sidebar + top nav
│   │   ├── page.tsx           # root folder view
│   │   └── folder/[id]/page.tsx
│   └── api/
│       └── auth/[...nextauth]/route.ts
├── components/
│   ├── FileGrid.tsx
│   ├── FileRow.tsx
│   ├── UploadDropzone.tsx
│   ├── PreviewModal.tsx
│   ├── FolderSidebar.tsx
│   └── StorageStats.tsx
├── lib/
│   ├── api.ts                 # typed fetch wrapper for FastAPI
│   └── auth.ts                # NextAuth config
└── types/
    └── index.ts
```

### 4.2 State Management

- Server state: **TanStack Query** (file lists, folder tree, stats) — cache + background refetch
- UI state: React `useState` / `useReducer` — modal open, selected files, drag state
- Auth state: NextAuth session

### 4.3 Upload Flow (client-side)

```
User drops file
      │
      ▼
UploadDropzone — reads File object
      │
      ▼
POST /files/upload  (FormData)
      │── show progress bar via XMLHttpRequest.upload.onprogress
      │
      ▼
On success → invalidate TanStack Query cache → file appears in list
```

### 4.4 Key Libraries

| Library | Purpose |
|---------|---------|
| `@tanstack/react-query` | Server state, caching, background sync |
| `react-dropzone` | Drag-and-drop upload UI |
| `next-auth` | Auth sessions |
| `axios` | Upload with progress events |
| `react-pdf` | Inline PDF preview |
| `date-fns` | Date formatting |

---

## 5. Authentication Flow

```
1. User visits /  →  middleware checks session  →  no session → redirect /login
2. POST /auth/login  →  FastAPI verifies credentials (env vars)  →  returns JWT
3. JWT stored in httpOnly cookie via Next.js API route
4. All /api/* calls include cookie  →  FastAPI validates JWT on each request
5. Token expiry (24h) → auto-logout, redirect to /login
```

---

## 6. Download / Preview Flow

```
User clicks file
      │
      ▼
GET /files/{id}/download-url
      │  FastAPI calls Telegram getFile API → gets fresh URL
      ▼
If preview (image/pdf/video):
      └── PreviewModal opens → fetches blob via /files/{id}/stream (proxied)
If download:
      └── window.open(download_url) or anchor[download] trigger
```

> Note: Never expose the raw Telegram download URL to the browser — it embeds the BOT_TOKEN in the path. Always proxy through FastAPI or use a signed redirect.

---

## 7. Error Handling

| Error | Handling |
|-------|---------|
| Telegram API timeout | Retry up to 3 times with exponential backoff |
| File > 2GB | Reject at FastAPI before sending to Telegram (413 response) |
| Invalid file_id | Return 404; log for investigation |
| DB connection failure | 503 with retry-after header |
| Unauthenticated request | 401 redirect to /login |
| Upload progress stall | Frontend timeout after 5 min, show error toast |

---

## 8. Deployment

| Service | Platform | Notes |
|---------|----------|-------|
| Frontend | Vercel | `NEXT_PUBLIC_API_URL` env pointing to backend |
| Backend | Railway / Render free tier | Uvicorn, single worker for free tier |
| Database | Neon (PostgreSQL, free tier) | Serverless Postgres, 0.5 GB free |
| File storage | Telegram CDN | Free, no infra needed |

### 8.1 Required Environment Variables Summary

**Backend (Railway):**
```
BOT_TOKEN, CHAT_ID, DATABASE_URL, JWT_SECRET, JWT_EXPIRE_HOURS, ALLOWED_ORIGINS
```

**Frontend (Vercel):**
```
NEXT_PUBLIC_API_URL, NEXTAUTH_SECRET, NEXTAUTH_URL
```