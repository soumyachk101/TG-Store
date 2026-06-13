# AI Instructions — TGStore
## Cursor Rules / Coding Agent Instructions

> Drop this file as `.cursorrules` or `AGENTS.md` in the project root.  
> These instructions apply to all AI-assisted code generation for this project.

---

## Project Identity

You are working on **TGStore**, a self-hosted personal cloud storage system.

- **Purpose:** Use Telegram's Bot API as a free CDN. Store file metadata in PostgreSQL. Serve a web UI in Next.js.
- **Owner:** Single developer, self-use. No multi-tenant SaaS logic.
- **Stack:** TypeScript (frontend) · Python 3.12 (backend) · PostgreSQL 16 · Telegram Bot API

---

## Stack Rules

### Python / FastAPI Backend

- Use **Python 3.12+** syntax. Always use `async def` for route handlers.
- Use **FastAPI** for all endpoints. Never use Flask or Django.
- Use **SQLAlchemy 2.0** async ORM (`AsyncSession`, `select()` style). No raw SQL except for migrations.
- Use **Alembic** for all schema migrations. Never mutate DB schema in application code.
- Use **Pydantic v2** for all request/response schemas. Never return raw dicts from endpoints.
- Use **httpx.AsyncClient** for all HTTP calls (Telegram API). Never use `requests`.
- Use **python-jose** for JWT. Never use PyJWT unless specifically asked.
- Dependency injection for DB sessions: `Depends(get_db)` pattern.
- All secrets come from `os.getenv()`. Never hardcode credentials.

```python
# CORRECT: async session pattern
async def get_files(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(File).where(File.deleted_at.is_(None)))
    return result.scalars().all()

# WRONG: sync session, raw dict return
def get_files():
    return db.query(File).all()
```

### TypeScript / Next.js Frontend

- Use **Next.js 14+ App Router** only. Never use Pages Router.
- All components in `app/` are **Server Components by default**. Add `"use client"` only when the component needs interactivity (state, events, browser APIs).
- Use **TanStack Query v5** for all server state. Never use `useEffect` + `fetch` for data fetching.
- Use **Axios** for upload requests (needed for progress events). Use native `fetch` for all other API calls.
- Use **Tailwind CSS** for all styling. No CSS modules, no styled-components.
- Use **TypeScript strict mode** (`"strict": true` in tsconfig). No `any` types.
- API base URL always from `process.env.NEXT_PUBLIC_API_URL`. Never hardcode.
- Auth via **NextAuth.js v5 (Auth.js)**. Use JWT strategy with `httpOnly` cookie.

```typescript
// CORRECT: Server component with direct fetch
async function FilePage({ params }: { params: { id: string } }) {
  const file = await getFile(params.id);
  return <FileView file={file} />;
}

// WRONG: useEffect for data fetching
function FilePage({ id }: { id: string }) {
  const [file, setFile] = useState(null);
  useEffect(() => { fetch(...).then(r => r.json()).then(setFile); }, []);
}
```

### Database

- Always use **UUID** primary keys (`gen_random_uuid()`). Never integer IDs.
- Always include `created_at TIMESTAMP DEFAULT NOW()` and `updated_at`.
- Soft-delete pattern: `deleted_at TIMESTAMP DEFAULT NULL`. Active records have `deleted_at IS NULL`.
- Always add indexes for foreign keys and frequently filtered columns.
- `tg_file_id` is **sacred** — never delete or overwrite this column's value for any file.

---

## Architecture Rules

### Telegram Layer

- All Telegram API calls live in `backend/services/telegram.py`. No Telegram API calls in routers.
- Retry Telegram API calls up to **3 times** with exponential backoff on network errors.
- Never expose `tg_file_id` or the raw Telegram download URL to the frontend. Always proxy through FastAPI.
- When generating download URLs (`getFile`), treat the result as ephemeral (valid ~1 hour). Never cache it.
- Max file size enforcement: reject files > 2 GB in FastAPI **before** sending to Telegram.

```python
# CORRECT: size check before Telegram call
if file.size > 2 * 1024 * 1024 * 1024:
    raise HTTPException(status_code=413, detail="File exceeds 2 GB limit")

# WRONG: let Telegram error handle it
result = await telegram.send_document(file)  # will fail with cryptic error
```

### API Design

- All endpoints return **consistent response shapes** using Pydantic models.
- List endpoints always support: `page`, `limit` (default 20, max 100), `search`, `folder_id`, `mime_type`.
- Successful deletes return `{ "success": true, "id": "..." }`.
- Errors return `{ "detail": "human-readable message" }` (FastAPI default).
- All timestamps in responses are **ISO 8601 UTC** strings.

### Authentication

- Every FastAPI route (except `/auth/login` and `/health`) must use `Depends(require_auth)`.
- Frontend middleware must redirect unauthenticated users to `/login`.
- Never log JWT tokens or passwords, even partially.

---

## Code Style

### Python

- **Black** formatting, 88-char line length.
- **Ruff** for linting.
- Docstrings on all service functions (one-line is fine).
- Type hints on all function signatures — no untyped parameters.
- Imports order: stdlib → third-party → local. Separated by blank lines.

### TypeScript

- **Prettier** formatting, 2-space indent.
- **ESLint** with `next/core-web-vitals` config.
- `interface` for object shapes, `type` for unions/aliases.
- Named exports everywhere. Default export only for Next.js page/layout components.
- Component files: `PascalCase.tsx`. Utility files: `camelCase.ts`.

---

## File Naming Conventions

```
backend/
  routers/files.py          # not file_router.py or filesRouter.py
  services/telegram.py      # not tg_service.py
  models/schemas.py         # Pydantic schemas here
  models/db.py              # SQLAlchemy models here

frontend/
  components/FileGrid.tsx    # PascalCase components
  lib/api.ts                 # API call wrappers
  app/(dashboard)/page.tsx   # Next.js route groups in parentheses
```

---

## What NOT to Do

- ❌ Do not use `requests` library — use `httpx.AsyncClient`
- ❌ Do not use raw `<form>` submission in React — use controlled inputs + onClick handlers
- ❌ Do not store files locally (disk, S3, local storage) — Telegram CDN only
- ❌ Do not cache Telegram download URLs — always regenerate via `getFile`
- ❌ Do not add multi-user / team features — this is single-user personal storage
- ❌ Do not add payment/subscription logic
- ❌ Do not use `localStorage` or `sessionStorage` for auth tokens — use httpOnly cookies
- ❌ Do not use `console.log` in production code — use Python `logging` module / `console.error` only for errors in frontend
- ❌ Do not write migrations by hand — always use `alembic revision --autogenerate`
- ❌ Do not expose `BOT_TOKEN` to the browser under any circumstances

---

## Common Patterns to Reuse

### Paginated list response (Pydantic)

```python
class PaginatedResponse(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    limit: int
    has_next: bool
```

### TanStack Query file list hook

```typescript
export function useFiles(params: FileListParams) {
  return useQuery({
    queryKey: ['files', params],
    queryFn: () => api.get<PaginatedResponse<FileItem>>('/files', { params }),
    staleTime: 30_000,
  });
}
```

### Upload mutation with progress

```typescript
export function useUpload() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ file, onProgress }: UploadArgs) =>
      api.uploadFile(file, onProgress),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['files'] });
    },
  });
}
```

### FastAPI dependency: current user from JWT

```python
async def require_auth(
    token: str = Depends(oauth2_scheme),
) -> dict:
    try:
        payload = jose.jwt.decode(token, SECRET, algorithms=["HS256"])
        return payload
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
```

---

## Testing Expectations

- Backend: **pytest + httpx.AsyncClient** for integration tests on all routers.
- Frontend: **Vitest + React Testing Library** for component tests.
- Mock all Telegram API calls in tests — never hit real Telegram in CI.
- Test the upload flow, download URL generation, soft-delete, and auth guard.

---

## Deployment Checklist (do not skip)

Before generating deployment configs, verify:

- [ ] `BOT_TOKEN` and `CHAT_ID` are in Railway env, not in code
- [ ] `DATABASE_URL` points to Neon (not localhost)
- [ ] `ALLOWED_ORIGINS` includes the Vercel frontend URL
- [ ] `JWT_SECRET` is a random 32-byte string (not "secret" or "dev")
- [ ] `NEXT_PUBLIC_API_URL` in Vercel points to Railway backend URL
- [ ] Alembic migrations run on deploy (`alembic upgrade head` in start command)