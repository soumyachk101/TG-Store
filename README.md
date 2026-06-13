<div align="center">

<!-- ===================== HERO ===================== -->

<br/>

<img src="https://capsule-render.vercel.app/api?type=waving&height=230&color=0:0b0d10,40:1d4ed8,100:3b82f6&text=TGStore&fontSize=78&fontColor=ffffff&fontAlignY=38&desc=Personal%20cloud.%20Backed%20by%20Telegram.%20Built%20for%20self-hosters.&descSize=20&descColor=9ca3af&descAlignY=58" alt="TGStore"/>

<br/>

<p align="center">
  <a href="https://github.com/Soumya-Chakraborty/TGStore/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-22c55e?style=for-the-badge&logo=opensourceinitiative&logoColor=white" alt="License"/></a>
  <a href="https://github.com/Soumya-Chakraborty/TGStore/stargazers"><img src="https://img.shields.io/github/stars/Soumya-Chakraborty/TGStore?style=for-the-badge&logo=github&color=3b82f6" alt="Stars"/></a>
  <a href="https://github.com/Soumya-Chakraborty/TGStore/issues"><img src="https://img.shields.io/github/issues/Soumya-Chakraborty/TGStore?style=for-the-badge&logo=gitbook&color=f59e0b" alt="Issues"/></a>
  <a href="https://github.com/Soumya-Chakraborty/TGStore/pulls"><img src="https://img.shields.io/badge/PRs-welcome-ef4444?style=for-the-badge&logo=git&logoColor=white" alt="PRs Welcome"/></a>
  <br/>
  <a href="#-architecture"><img src="https://img.shields.io/badge/architecture-mermaid-3b82f6?style=for-the-badge&logo=diagramsdotnet&logoColor=white" alt="Mermaid"/></a>
  <a href="https://nextjs.org"><img src="https://img.shields.io/badge/Next.js-14-000?style=for-the-badge&logo=nextdotjs&logoColor=white" alt="Next.js 14"/></a>
  <a href="https://fastapi.tiangolo.com"><img src="https://img.shields.io/badge/FastAPI-0.115-009688?style=for-the-badge&logo=fastapi&logoColor=white" alt="FastAPI"/></a>
  <a href="https://www.postgresql.org"><img src="https://img.shields.io/badge/Postgres-16-336791?style=for-the-badge&logo=postgresql&logoColor=white" alt="Postgres"/></a>
  <a href="https://core.telegram.org/bots/api"><img src="https://img.shields.io/badge/Telegram-Bot%20API-26A5E4?style=for-the-badge&logo=telegram&logoColor=white" alt="Telegram"/></a>
</p>

<br/>

> **TGStore** turns a private Telegram channel into an *unlimited*, free, end-to-end-self-hosted
> personal cloud. No S3 bills. No vendor lock-in. Just a bot token, a channel, and code you can
> read in one sitting.

<br/>

<p align="center">
  <a href="#-quick-start"><img src="https://img.shields.io/badge/⚡_Quick_Start-1d4ed8?style=for-the-badge" alt="Quick Start"/></a>
  &nbsp;
  <a href="#-architecture"><img src="https://img.shields.io/badge/🧠_Architecture-3b82f6?style=for-the-badge" alt="Architecture"/></a>
  &nbsp;
  <a href="#-user-journey"><img src="https://img.shields.io/badge/🚀_User_Journey-22c55e?style=for-the-badge" alt="User Journey"/></a>
  &nbsp;
  <a href="#-api-reference"><img src="https://img.shields.io/badge/📡_API-0ea5e9?style=for-the-badge" alt="API"/></a>
</p>

</div>

<br/>

<!-- ===================== THE PITCH ===================== -->

## 💡 The pitch

Telegram gives every bot a *free* CDN with multi-GB file support and a global edge. TGStore is
the thin, opinionated layer that turns it into a Dropbox-class experience for a single user —
with a polished Next.js dashboard, a FastAPI backend, and a Postgres index of what you have.

```text
  ┌──────────────┐    multipart     ┌────────────┐  sendDocument   ┌──────────────────┐
  │  Your laptop │ ───────────────▶ │  FastAPI   │ ──────────────▶ │  Telegram CDN    │
  │  (Next.js)   │  Bearer JWT      │  + SQLAlch │  getFile (1h)   │  private channel │
  └──────────────┘ ◀─── stream ──── └────────────┘ ◀──── bytes ─── └──────────────────┘
                                            │
                                            ▼
                                    ┌──────────────┐
                                    │  PostgreSQL  │
                                    │  (metadata)  │
                                    └──────────────┘
```

- **Zero storage cost** — Telegram's CDN is the bucket; you only pay for metadata in Postgres.
- **Bot token never leaks** — the raw `https://api.telegram.org/file/bot<TOKEN>/…` URL is regenerated
  server-side on every request and *always* proxied through `/stream`.
- **Single-user, self-host** — no teams, no sharing ACLs, no surprise bills. One admin, one channel.
- **Boring tech on purpose** — Next.js 14, FastAPI, Postgres 16. No microservices, no message bus,
  no Kubernetes. `docker compose up` and you're done.

<br/>

<!-- ===================== ANIMATED ARCHITECTURE ===================== -->

## 🧠 Architecture

The system is three layers, all under your control. The animation below traces a real upload
end-to-end — request hops, JWT, sendDocument, persistence, response — with the data packet
glowing as it moves.

```mermaid
%%{ init: { 'theme': 'dark', 'themeVariables': { 'primaryColor': '#1d4ed8', 'primaryTextColor': '#fff', 'primaryBorderColor': '#3b82f6', 'lineColor': '#60a5fa', 'secondaryColor': '#0b0d10', 'tertiaryColor': '#12151a', 'fontFamily': 'Inter, system-ui' }, 'flowchart': { 'curve': 'basis' } } }%%
flowchart LR
    classDef edge fill:#0b0d10,stroke:#3b82f6,color:#e5e7eb,stroke-width:1px;
    classDef api fill:#12151a,stroke:#3b82f6,color:#e5e7eb,stroke-width:1.5px;
    classDef store fill:#1e3a8a,stroke:#60a5fa,color:#fff,stroke-width:1.5px;
    classDef ext fill:#0b0d10,stroke:#26A5E4,color:#fff,stroke-width:2px;
    classDef pkt stroke:#22c55e,stroke-width:3px,fill:none,stroke-dasharray:8 4;

    User(["👤 You"]):::edge
    subgraph Browser["Next.js 14 · App Router"]
        MW["middleware.ts<br/>session gate"]:::api
        Dash["Dashboard<br/>TopBar · Dropzone · FileList · Stats"]:::api
    end
    subgraph Backend["FastAPI · Python 3.12"]
        Auth["routers/auth.py<br/>POST /auth/login"]:::api
        Files["routers/files.py<br/>upload · list · stream · patch · delete"]:::api
        TG["services/telegram.py<br/>3× exp-backoff retry"]:::api
    end
    DB[("PostgreSQL 16<br/>folders · files · soft-delete")]:::store
    TG_API(("Telegram Bot API<br/>+ private channel")):::ext

    User -->|HTTPS| MW
    MW -->|unauth| Dash
    MW -->|authed| Dash
    Dash -->|POST /auth/login| Auth
    Auth -->|HS256 JWT| Dash
    Dash ==>|"① multipart upload<br/>② Authorization: Bearer JWT"| Files
    Files -.->|"③ size cap &lt; 2 GB"| Files
    Files ==>|"④ sendDocument<br/>caption = filename"| TG
    TG ==>|"⑤ file_id · message_id"| TG_API
    TG_API -.->|"⑥ bytes stored"| TG_API
    Files <==|"⑦ file_id"| TG
    Files <-->|"⑧ INSERT files row"| DB
    Files ==>|"⑨ 201 FileResponse"| Dash
    Dash -->|"⑩ invalidate<br/>['files','stats']"| User

    linkStyle 0,1,2,3,4,5,6,7,8,9,10,11,12 stroke:#60a5fa,stroke-width:1.5px;
    linkStyle 5,6,7,8,9 stroke:#22c55e,stroke-width:2.5px,stroke-dasharray:10 4,animation:fast;
```

> 🔵 = control plane (auth, navigation) &nbsp;·&nbsp; 🟢 = data plane (the actual bytes)

<br/>

### Component map

```mermaid
%%{ init: { 'theme': 'dark' } }%%
graph TB
    subgraph FE["frontend/"]
        direction LR
        L["app/(auth)/login"]:::fe
        P["app/page → Dashboard"]:::fe
        D["components/Dropzone"]:::fe
        L1["components/FileList"]:::fe
        S["components/StorageStats"]:::fe
        API["lib/api.ts (axios)"]:::fe
        AUTH["auth.ts (NextAuth v5)"]:::fe
    end
    subgraph BE["backend/app/"]
        direction LR
        RA["routers/auth.py"]:::be
        RF["routers/files.py"]:::be
        RFO["routers/folders.py"]:::be
        MW["middleware/auth.py<br/>require_auth"]:::be
        ST["services/telegram.py"]:::be
        DB["models/db.py<br/>Folder · File"]:::be
    end
    DB1[("PostgreSQL")]:::db
    TG(("Telegram CDN")):::ext

    L --> AUTH
    AUTH -->|"POST /auth/login"| RA
    P --> D
    P --> L1
    P --> S
    D --> API
    L1 --> API
    S --> API
    API -->|"Bearer JWT"| MW
    MW --> RA
    MW --> RF
    MW --> RFO
    RF --> ST
    RFO --> ST
    RF --> DB
    RFO --> DB
    ST --> TG
    DB --> DB1

    classDef fe fill:#0b0d10,stroke:#3b82f6,color:#e5e7eb;
    classDef be fill:#12151a,stroke:#22c55e,color:#e5e7eb;
    classDef db fill:#1e3a8a,stroke:#60a5fa,color:#fff;
    classDef ext fill:#0b0d10,stroke:#26A5E4,color:#fff,stroke-width:2px;
```

<br/>

<!-- ===================== DATA MODEL ===================== -->

### Data model

Two tables, no joins across hidden boundaries, soft-delete by convention. The
`tg_file_id` column is *sacred* — it is the only durable handle back to your bytes.

```mermaid
%%{ init: { 'theme': 'dark' } }%%
erDiagram
    folders ||--o{ folders : "parent_id"
    folders ||--o{ files : "folder_id"
    folders {
        uuid id PK
        text name
        uuid parent_id FK
        text path "materialized"
        timestamp created_at
        timestamp updated_at
    }
    files {
        uuid id PK
        text name "mutable"
        text original_name
        text mime_type
        bigint size_bytes
        uuid folder_id FK
        text tg_file_id UK "⚠️ sacred"
        int  tg_message_id
        timestamp created_at
        timestamp updated_at
        timestamp deleted_at "soft-delete"
    }
```

<br/>

<!-- ===================== USER JOURNEY ===================== -->

## 🚀 User journey

The four interactions that make up 99% of what TGStore does — animated so you can
*feel* the state changes.

<details>
<summary><b>① Sign in</b> — first-time setup is a single login</summary>

```mermaid
%%{ init: { 'theme': 'dark', 'sequence': { 'actorMargin': 60, 'messageMargin': 40 } } }%%
sequenceDiagram
    autonumber
    actor U as 👤 You
    participant N as Next.js (middleware.ts)
    participant L as /login
    participant A as NextAuth v5
    participant B as FastAPI /auth/login
    participant DB as Postgres

    U->>N: GET /
    N-->>U: 307 → /login?next=/
    U->>L: open login form
    L->>A: signIn("credentials", user, pass)
    A->>B: POST /auth/login
    B->>B: bcrypt.compare(ADMIN_PASSWORD)
    B->>A: {access_token, expires_in}
    A->>A: encrypt → httpOnly cookie<br/>session.apiToken = JWT
    A-->>L: session
    L-->>U: redirect → /
    U->>N: GET / (with cookie)
    N-->>U: 200 Dashboard
    Note over B,DB: user row is the env file,<br/>Postgres holds files/folders
```

</details>

<details>
<summary><b>② Upload a file</b> — drag, drop, done</summary>

```mermaid
%%{ init: { 'theme': 'dark' } }%%
flowchart LR
    classDef step fill:#0b0d10,stroke:#3b82f6,color:#e5e7eb,stroke-width:1.5px;
    classDef ok fill:#22c55e,stroke:#22c55e,color:#0b0d10,stroke-width:2px;
    classDef bad fill:#ef4444,stroke:#ef4444,color:#0b0d10,stroke-width:2px;

    S1["1. drop file on Dropzone"]:::step
    S2["2. client-side size check<br/>≤ 2 GB"]:::step
    S3["3. axios POST /files/upload<br/>multipart + Bearer JWT"]:::step
    S4["4. require_auth → 401?"]:::step
    S5["5. server size check (both<br/>Content-Length & body)"]:::step
    S6["6. telegram.send_document<br/>caption = filename"]:::step
    S7["7. extract file_id, message_id"]:::step
    S8["8. INSERT files row"]:::step
    S9["9. 201 FileResponse"]:::step
    S10["10. invalidate<br/>['files','stats']"]:::step
    R1["❌ 413 File too large"]:::bad
    R2["❌ 502 Storage unavailable"]:::bad

    S1 --> S2 --> S3 --> S4
    S4 -->|"no"| R1
    S4 -->|"yes"| S5 --> S6 --> S7 --> S8 --> S9 --> S10
    S6 -.->|"3× retry on 5xx"| R2
```

</details>

<details>
<summary><b>③ Download a file</b> — proxy never leaks the bot token</summary>

```mermaid
%%{ init: { 'theme': 'dark' } }%%
sequenceDiagram
    autonumber
    actor U as 👤 You
    participant FE as FileRow (browser)
    participant BE as FastAPI /stream
    participant TG as Telegram getFile
    participant CDN as Telegram CDN

    U->>FE: click ⬇ Download
    FE->>BE: GET /files/{id}/stream<br/>Authorization: Bearer JWT
    BE->>BE: require_auth → claims
    BE->>TG: getFile(file_id)
    TG-->>BE: {file_path} (1h URL)
    BE->>CDN: GET file_path (follow_redirects)
    CDN-->>BE: 64 KB chunks
    BE-->>FE: StreamingResponse<br/>Content-Disposition: attachment
    FE->>FE: blob → URL.createObjectURL<br/>invisible <a download> click
    FE-->>U: 💾 file saved
    Note over BE,CDN: the bot token never leaves the backend
```

</details>

<details>
<summary><b>④ Browse &amp; manage</b> — search, rename, delete, stats</summary>

```mermaid
%%{ init: { 'theme': 'dark' } }%%
stateDiagram-v2
    [*] --> Idle
    Idle --> Searching: type in TopBar (300 ms debounce)
    Searching --> Idle: GET /files?search=…
    Idle --> Uploading: drop / pick / press U
    Uploading --> Progress: progress card
    Progress --> Idle: invalidate ['files','stats']
    Progress --> Error: network / 502
    Error --> Idle: retry toast
    Idle --> Renaming: click ✎ on row
    Renaming --> Idle: PATCH /files/{id}
    Idle --> Confirming: click 🗑 on row
    Confirming --> Idle: DELETE /files/{id} (soft)
    Idle --> Previewing: click 👁 (Phase 3)
    Previewing --> Idle: open in /stream
```

</details>

<br/>

<!-- ===================== ANIMATED FEATURE GRID ===================== -->

## ✨ Feature tour

| | | |
|---|---|---|
| 🎯 **Drag-and-drop upload**<br/>Multi-file, progress cards, 2 GB guard client-side. | 🔐 **JWT auth via NextAuth v5**<br/>Encrypted httpOnly cookies, edge middleware. | 🗂 **Folders (3 levels)**<br/>Materialized path, server-enforced depth. |
| 🔍 **Live search**<br/>300 ms debounce, case-insensitive, trigram-indexed. | 📊 **Storage stats**<br/>Stacked bar across Images / Videos / Audio / Docs / Other. | ⬇ **Proxied download**<br/>Bot token never reaches the browser. |
| 🛡 **Soft-delete**<br/>`deleted_at` only — Telegram message kept for recovery. | ⚡ **Streaming, not buffering**<br/>64 KB chunks, 5-min timeout, follow_redirects. | 🧪 **Tested**<br/>6 async integration tests, all Telegram calls mocked. |

<br/>

<!-- ===================== QUICK START ===================== -->

## ⚡ Quick start

Three terminals, one bot, zero vendor accounts. The diagram below shows what each
command touches so you can keep mental model intact.

```mermaid
%%{ init: { 'theme': 'dark' } }%%
flowchart LR
    classDef t fill:#0b0d10,stroke:#3b82f6,color:#e5e7eb;
    classDef c fill:#12151a,stroke:#22c55e,color:#0b0d10,font-weight:bold;
    classDef a fill:#1e3a8a,stroke:#60a5fa,color:#fff;

    T1["terminal 1<br/>🗄 Postgres"]:::t
    T2["terminal 2<br/>🐍 FastAPI :8000"]:::t
    T3["terminal 3<br/>⚛ Next.js :3000"]:::t

    A1["docker compose up -d db"]:::c --> P1[("pgdata :5433")]:::a
    A2["uvicorn app.main:app --reload"]:::c --> P2[/"GET /health = 200"/]:::a
    A3["npm run dev"]:::c --> P3[/"http://localhost:3000"/]:::a
    P1 -.feeds.-> P2
    P2 -.http.-> P3
```

### 1. Provision Postgres

```bash
docker compose up -d db
# healthcheck gates the rest of the system
```

### 2. Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -e .
cp .env.example .env          # fill in BOT_TOKEN, CHAT_ID, JWT_SECRET
alembic upgrade head
uvicorn app.main:app --reload
```

Backend lives at **<http://localhost:8000>** — OpenAPI docs at **`/docs`**.

### 3. Frontend

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

Dashboard lives at **<http://localhost:3000>**.

<br/>

<!-- ===================== TELEGRAM SETUP ===================== -->

## 🤖 One-time Telegram setup

```mermaid
%%{ init: { 'theme': 'dark' } }%%
sequenceDiagram
    autonumber
    actor U as 👤 You
    participant BF as @BotFather
    participant TG as Telegram
    participant JD as @JsonDumpBot
    participant ENV as backend/.env

    U->>BF: /newbot
    BF-->>U: BOT_TOKEN
    U->>TG: create private channel
    U->>TG: add bot as admin
    U->>TG: post any message
    U->>JD: forward that message
    JD-->>U: chat.id = -100xxxxxxxxxx
    U->>ENV: BOT_TOKEN=…<br/>CHAT_ID=-100…<br/>JWT_SECRET=$(openssl rand -base64 32)
    Note over U,ENV: that's the whole bootstrap
```

<br/>

<!-- ===================== ENV VARS ===================== -->

## 🔐 Environment variables

### Backend — `backend/.env`

| Var | Required | Default | Purpose |
|---|---|---|---|
| `BOT_TOKEN` | ✅ | — | From [@BotFather](https://t.me/BotFather). **Never sent to the browser.** |
| `CHAT_ID` | ✅ | — | Private channel id, negative, e.g. `-100xxxxxxxxxx`. |
| `DATABASE_URL` | ✅ | `postgresql+asyncpg://tgstore:tgstore@localhost:5433/tgstore` | Async SQLAlchemy URL. |
| `DATABASE_URL_SYNC` | ✅ | `postgresql+psycopg2://…` | Used by Alembic. |
| `JWT_SECRET` | ✅ | — | `openssl rand -base64 32`. |
| `JWT_EXPIRE_HOURS` | — | `24` | Token lifetime. |
| `ADMIN_USERNAME` | — | `admin` | Single-user login. |
| `ADMIN_PASSWORD` | — | `changeme` | **Set this in prod.** |
| `ALLOWED_ORIGINS` | — | `http://localhost:3000` | Comma-separated CORS allowlist. |
| `MAX_UPLOAD_BYTES` | — | `2147483648` | 2 GB — Telegram's Bot API cap. |

### Frontend — `frontend/.env.local`

| Var | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | ✅ | `http://localhost:8000` in dev, your Railway URL in prod. |
| `AUTH_SECRET` | ✅ | `openssl rand -base64 32` — NextAuth cookie encryption. |
| `AUTH_URL` | — | `http://localhost:3000` in dev. |

<br/>

<!-- ===================== API REFERENCE ===================== -->

## 📡 API reference

All routes below (except `/auth/login` and `/health`) require `Authorization: Bearer <jwt>`.
Full OpenAPI lives at `/docs` when the backend is running.

```mermaid
%%{ init: { 'theme': 'dark' } }%%
flowchart LR
    classDef pub fill:#0b0d10,stroke:#3b82f6,color:#e5e7eb;
    classDef priv fill:#12151a,stroke:#22c55e,color:#e5e7eb;
    classDef unsafe fill:#3f1d1d,stroke:#ef4444,color:#fecaca;

    H["GET /health"]:::pub
    L["POST /auth/login"]:::pub
    M["GET /auth/me"]:::priv
    U["POST /files/upload"]:::priv
    LI["GET /files"]:::priv
    ST["GET /files/stats"]:::priv
    G["GET /files/{id}"]:::priv
    S["GET /files/{id}/stream"]:::priv
    D["GET /files/{id}/download-url"]:::unsafe
    P["PATCH /files/{id}"]:::priv
    DE["DELETE /files/{id}"]:::priv
    FC["POST /folders"]:::priv
    FL["GET /folders"]:::priv
    FP["PATCH /folders/{id}"]:::priv
    FD["DELETE /folders/{id}"]:::priv
```

| Method | Path | Auth | Notes |
|---|---|---|---|
| `GET` | `/health` | — | Liveness probe. |
| `POST` | `/auth/login` | — | `{username, password}` → `{access_token, expires_in}`. |
| `GET` | `/auth/me` | 🔒 | Current user info. |
| `POST` | `/files/upload` | 🔒 | Multipart, `folder_id?`, 2 GB cap. |
| `GET` | `/files` | 🔒 | `page, limit≤100, search, folder_id, mime_type, include_deleted`. |
| `GET` | `/files/stats` | 🔒 | `StorageStats` grouped by MIME. |
| `GET` | `/files/{id}` | 🔒 | Single file metadata. |
| `GET` | `/files/{id}/stream` | 🔒 | **Use this for browser downloads** — proxied bytes. |
| `GET` | `/files/{id}/download-url` | 🔒 ⚠️ | **Backend-only.** Embeds the bot token — never expose to the client. |
| `PATCH` | `/files/{id}` | 🔒 | Rename and/or move. `tg_file_id` is preserved. |
| `DELETE` | `/files/{id}` | 🔒 | Soft-delete. |
| `POST` | `/folders` | 🔒 | Body `{name, parent_id?}`. 3-level depth cap. |
| `GET` | `/folders` | 🔒 | `?parent_id=…` to list children. |
| `PATCH` | `/folders/{id}` | 🔒 | Rename. |
| `DELETE` | `/folders/{id}` | 🔒 | Refuses if non-empty. |

<br/>

<!-- ===================== DEPLOY ===================== -->

## 🚢 Deploy

The minimal, no-surprises path:

| Service | Why |
|---|---|
| **Vercel** (frontend) | Edge middleware runs on the edge, NextAuth cookies just work. |
| **Railway** (backend) | One Dockerfile, healthcheck on `/health`, persistent env. |
| **Neon** (Postgres) | Free tier, branching for previews. |
| **Telegram** (storage) | The only "CDN" you need. |

**Pre-flight checklist** (from `Docs/Ai Instruction.md`):

- [ ] `BOT_TOKEN` and `CHAT_ID` are in **Railway env**, not in code.
- [ ] `DATABASE_URL` points to **Neon**, not localhost.
- [ ] `ALLOWED_ORIGINS` includes the **Vercel frontend URL**.
- [ ] `JWT_SECRET` is `openssl rand -base64 32` — not `secret` / `dev`.
- [ ] `NEXT_PUBLIC_API_URL` in **Vercel** points at the **Railway backend URL**.
- [ ] `alembic upgrade head` runs on every backend deploy.

<br/>

<!-- ===================== ROADMAP ===================== -->

## 🗺 Roadmap

```mermaid
%%{ init: { 'theme': 'dark' } }%%
gantt
    title TGStore milestones
    dateFormat  YYYY-MM-DD
    axisFormat  %b
    section Phase 1 (shipped)
    Scaffold + Docker compose     :done, p1a, 2025-11-01, 7d
    FastAPI foundation + auth    :done, p1b, after p1a, 7d
    Telegram service + retry     :done, p1c, after p1b, 5d
    Files router (CRUD + stream) :done, p1d, after p1c, 7d
    Next.js dashboard + upload   :done, p1e, after p1d, 7d
    E2E verification             :done, p1f, after p1e, 3d
    section Phase 2 (next)
    Folder polish + breadcrumbs  :active, p2a, 2026-06-15, 7d
    Move-to-folder UX            :         p2b, after p2a, 5d
    Search v2 (filters, trigram) :         p2c, after p2b, 5d
    Hard-delete + Telegram purge :         p2d, after p2c, 3d
    section Phase 3
    Inline image preview         :         p3a, after p2d, 5d
    Video / audio / PDF preview  :         p3b, after p3a, 7d
    Share-link (signed URL)      :         p3c, after p3b, 5d
```

<br/>

<!-- ===================== NON-NEGOTIABLES ===================== -->

## 📐 Non-negotiables

These rules are baked into the repo. If you fork it, keep them.

```mermaid
%%{ init: { 'theme': 'dark' } }%%
mindmap
  root((TGStore<br/>rules))
    Security
      Bot token never in browser
      JWT in httpOnly cookie only
      Telegram download URLs never cached
      4xx errors never retried
    Storage
      Single object per file (no chunking)
      tg_file_id is sacred and unique
      Soft-delete only at this phase
      2 GB cap enforced pre-Telegram
    Code
      async def everywhere
      Pydantic v2 only
      Alembic for all schema changes
      Server Components by default
    What we don't do
      No S3 / local disk
      No multi-user
      No payment logic
      No requests library
```

<br/>

<!-- ===================== REPO LAYOUT ===================== -->

## 🗂 Repo layout

```
TGStore/
├── backend/                    # FastAPI · Python 3.12+
│   ├── app/
│   │   ├── main.py             # app factory, CORS, router mount
│   │   ├── core/               # config (pydantic-settings) + async DB
│   │   ├── middleware/         # JWT: create_access_token, require_auth
│   │   ├── routers/            # auth · files · folders
│   │   ├── models/             # SQLAlchemy ORM + Pydantic schemas
│   │   ├── services/           # telegram.py (the only place that hits api.telegram.org)
│   │   └── utils/              # helpers, MIME grouping
│   ├── alembic/                # 0001_initial.py
│   ├── tests/                  # 6 async integration tests, Telegram mocked
│   ├── pyproject.toml
│   └── .env.example
├── frontend/                   # Next.js 14 · App Router · TypeScript strict
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx            # → Dashboard
│   │   ├── providers.tsx       # QueryClient + SessionProvider
│   │   ├── globals.css
│   │   ├── (auth)/login/       # /login
│   │   └── api/auth/[…]        # NextAuth route handlers
│   ├── components/             # Dashboard · TopBar · Dropzone · FileList · FileRow · StorageStats · ApiAuthBridge
│   ├── lib/                    # api.ts (axios) · format.ts
│   ├── types/                  # mirrors backend Pydantic
│   ├── auth.ts                 # NextAuth v5 config
│   ├── middleware.ts           # edge session gate
│   └── tailwind.config.ts
├── Docs/
│   ├── PRD.md                  # product spec
│   ├── TRD.md                  # technical spec
│   ├── APP FLOW.md             # user journey
│   └── Ai Instruction.md       # the rules
├── docker-compose.yml          # Postgres 16 on host 5433
└── README.md                   # you are here
```

<br/>

<!-- ===================== TESTING ===================== -->

## 🧪 Testing

```bash
# backend (Telegram calls mocked, in-memory SQLite for speed)
cd backend
pytest -v

# 6 tests, ~1.5s:
#   ✓ test_health_is_unauthenticated
#   ✓ test_login_success_returns_jwt
#   ✓ test_login_failure_returns_401
#   ✓ test_protected_endpoint_requires_auth
#   ✓ test_upload_2gb_cap_is_enforced_before_telegram
#   ✓ test_upload_happy_path_persists_metadata
```

<br/>

<!-- ===================== LINKS ===================== -->

## 📚 Further reading

- [`Docs/PRD.md`](Docs/PRD.md) — product spec, scope, success criteria
- [`Docs/TRD.md`](Docs/TRD.md) — technical spec, data model, endpoint contracts
- [`Docs/APP FLOW.md`](Docs/APP FLOW.md) — every user journey, every error state
- [`Docs/Ai Instruction.md`](Docs/Ai Instruction.md) — the non-negotiables

<br/>

<!-- ===================== FOOTER ===================== -->

<div align="center">

<br/>

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:3b82f6,100:0b0d10&height=120&section=footer" alt="footer"/>

<br/>

<sub>Built with care · Backed by Telegram · Owned by you.</sub>

<br/>

</div>
