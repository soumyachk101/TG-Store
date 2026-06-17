# TGStore — Security Audit & Bug Report

**Scope:** Full static review of `backend/` (FastAPI) and `frontend/` (Next.js + Auth.js v5), plus config and git state.
**Method:** Manual source review — auth flow, secrets handling, input validation, session handling, concurrency, and functional correctness.
**Date:** 2026-06-17

Each finding has a **severity**, **location** (`file:line`), **why it matters**, and a **fix**. Criticals and highs are reproducible; mediums/lows are hardening recommendations.

---

## Summary

| Severity | Count | Notable |
|----------|-------|--------|
| 🔴 Critical | 2 | Broken file download/preview (token rejected); dev secrets ship as defaults |
| 🟠 High | 4 | JWT/refresh missing; local-fallback weakens Firebase; `verify_credentials` blocks dev login; mock-auth silent skip |
| 🟡 Medium | 6 | Missing upload MIME validation; DoS via RAM buffering; folder depth off-by-one; tabular-nums; etc. |
| 🟢 Low | 5 | Stale `FileRow`/`UploadDropzone`, console token logs, info leak in errors, `.swp` in tree, etc. |

The most urgent: **file downloads and previews are broken in production** because the frontend sends the bearer token as a query string (`?token=…`) while the backend explicitly rejects query-string tokens. This is a user-facing functional outage, not just a security gap.

---

## 🔴 Critical

### C1 — File download & preview are broken (token sent via query string is rejected)
**Location:** `frontend/components/Dashboard.tsx:240`, `frontend/components/PreviewModal.tsx:66`, `frontend/components/FileRow.tsx:60` (sends `?token=`) vs. `backend/app/middleware/auth.py:25,121` (only reads `Authorization` header).

**What's wrong.** Every preview/download builds a URL like:
```ts
const url = `${streamUrl(file.id)}?token=${encodeURIComponent(token)}`;
```
and then loads it as `<img src>` / `<video src>` / `<a href>`. But the backend's `require_auth` only pulls the token from the `Authorization` header via `OAuth2PasswordBearer` (`auto_error=False`):
```python
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)
...
if not token: raise HTTPException(401, ...)
```
Starlette's `OAuth2PasswordBearer.__call__` **never reads query params** — it only checks the `Authorization` header. So `/files/{id}/stream?token=…` returns **401 for every request**.

**Impact.** Images, videos, audio, PDF previews, and downloads all fail with 401 unless the user happens to also have a valid `Authorization` header (which `<img src>` / `<a download>` cannot attach). This is a core-feature outage. The query-string pattern was chosen specifically to work around the "can't set headers on `<img>`" problem — but the backend was hardened to forbid query tokens, leaving the two halves incompatible.

**Why the backend forbids it.** The comment is correct: query tokens leak into server logs, browser history, and `Referer`. So the fix is **not** to re-enable `?token=` on the backend.

**Fix — proxy the stream through a Next.js route handler that injects the header.** Replace the direct `streamUrl()` references in `<img>/<video>/<a>` with a same-origin Next route that takes a path param, adds `Authorization: Bearer` server-side, and pipes the bytes back:

```ts
// frontend/app/files/[id]/stream/route.ts
import { auth } from "@/auth";
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  const token = session?.apiToken;
  if (!token) return new Response("Unauthorized", { status: 401 });
  const upstream = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/files/${params.id}/stream`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return new Response(upstream.body, {
    headers: { "Content-Type": upstream.headers.get("content-type") ?? "application/octet-stream",
               "Content-Disposition": upstream.headers.get("content-disposition") ?? "" },
  });
}
```
Then `streamUrl(id)` returns `/files/{id}/stream` (relative, same-origin). The browser attaches the NextAuth cookie automatically, the token never appears in the URL, and the backend's header-only check passes. Download via `<a href="/files/{id}/stream" download>` works the same way.

**If a quick unblock is needed first**, the local-fallback path at least needs the header; but the route-handler approach is the correct durable fix.

---

### C2 — Application boots with weak/dev secrets by default (`environment` defaults to `development`)
**Location:** `backend/app/core/config.py:125-129, 131-168`; default `jwt_secret="dev-secret-change-me"` (line 102), `admin_password="changeme"` (line 107).

**What's wrong.** `environment` defaults to `"development"`, and the fail-closed `production_safety_checks` validator **only runs when `environment == "production"`**. A deploy that forgets to set `ENVIRONMENT=production` (e.g. `railway.json`/`railpack.json` missing the var, or a Docker run without the env) boots silently with:
- `jwt_secret = "dev-secret-change-me"` — anyone who reads the public repo can forge valid admin JWTs.
- `admin_password = "changeme"` — trivial login.
- `firebase_mock_auth` allowed → returns `uid=mock-admin` for **any** token (`auth.py:138-143`).

**Impact.** If the deploy doesn't set `ENVIRONMENT=production`, the whole auth system is bypassable. This is exactly the "silent fallback to insecure defaults" class the validator was written to prevent — but the validator's own trigger (the env var) is the thing most likely to be forgotten.

**Fix.** Invert the default — fail closed unless explicitly opened:
```python
environment: str = Field(default="production", ...)  # was "development"

# In production_safety_checks, swap the guard:
if self.environment == "development":
    # dev mode: warn but allow
    return self
# production is now the default path → checks always run unless dev is explicit
```
Also add `ENVIRONMENT` to `railway.json`/`railpack.json`/deploy docs as a **required** var, and assert it in a startup log: `logger.warning` (not print) when dev defaults are in use.

---

## 🟠 High

### H1 — No JWT refresh / session-extension; users get logged out mid-session
**Location:** `frontend/auth.ts:22-23` (NextAuth `maxAge: 1h`), `backend/app/core/config.py:105` (`jwt_expire_hours=24`).

**What's wrong.** The NextAuth session JWT expires in **1 hour** (to match Firebase ID token TTL), but there is no refresh flow anywhere:
- `auth.ts` callbacks never call `user.getIdToken(true)` or refresh the Firebase token.
- The backend has no `/auth/refresh`.
- When the 1-hour window lapses, `session.apiToken` still holds the **stale, expired** Firebase token; every API call returns 401; the UI shows empty lists / errors until the user manually signs out and back in.

**Impact.** Any session longer than 1 hour degrades silently. Combined with C1 (which already 401s on media), this makes long sessions feel broken.

**Fix.** Implement refresh in the `jwt` callback:
```ts
async jwt({ token, user, session, trigger }) {
  if (user) { token.apiToken = user.apiToken; token.expiresAt = Date.now() + 55 * 60 * 1000; }
  // Refresh ~5 min before expiry
  if (token.expiresAt && Date.now() > token.expiresAt) {
    const refreshed = await refreshFirebaseToken(); // via firebase/auth on server
    token.apiToken = refreshed;
  }
  return token;
}
```
Refreshing Firebase ID tokens server-side in NextAuth is non-trivial (the client SDK won't run in Edge); the pragmatic option is to set NextAuth `maxAge` to something comfortable (e.g. 23h) and accept re-login daily, **and** show a clear "Session expired" toast + redirect to `/login?expired=1` on the first 401 instead of silently failing.

---

### H2 — Local-credentials fallback weakens the Firebase-only auth model
**Location:** `frontend/auth.ts:67-90` (fallback to `POST /auth/login`), `backend/app/middleware/auth.py:169-180` (HS256 path).

**What's wrong.** The app is advertised as Firebase-isolated ("Strict Isolation" on the landing page), but the auth flow silently falls back to the single shared `ADMIN_USERNAME`/`ADMIN_PASSWORD` HS256 path whenever Firebase sign-in throws. Two problems:
1. **All local-fallback users share one identity** (`admin`), so multi-user isolation collapses — any fallback user sees `admin`'s files (`user_id == "admin"` default in `db.py:82,126`).
2. The fallback is **silent**: `console.log("Firebase auth failed, trying local fallback")` — a user who types the wrong password into Firebase still logs in if the local admin creds match.

**Impact.** Breaks the per-user data isolation guarantee; can let a Firebase-authenticated user accidentally access the shared admin namespace.

**Fix.** Make the fallback explicit, not automatic:
- In `authorize()`, only run the local fallback when Firebase is **not configured** (`firebaseAuth === null`), not on every Firebase error.
- Or remove the local path entirely in production (gate it behind `NODE_ENV === "development"`).
- At minimum, never let a local login succeed with `sub="admin"` for a user whose Firebase UID is different — the backend's `user_id` should be the Firebase `uid`, never the shared `admin` literal.

---

### H3 — `verify_credentials` returns `False` in dev when creds aren't set, but the comment says "allow a fallback so the app boots"
**Location:** `backend/app/middleware/auth.py:44-53`.

**What's wrong.** The docstring claims the dev path "allow[s] a fallback so the app boots," but the code does the opposite:
```python
if not settings.admin_username or not settings.admin_password:
    return False  # ← comment above says this is a fallback; it's actually a hard block
```
Since `admin_username`/`admin_password` **always** have defaults (`"admin"`/`"changeme"` in config.py), this branch is dead in practice — but if a user clears them in `.env`, they can never log in via the local path and there's no error message explaining why. Misleading code + foot-gun.

**Impact.** Confusing; a developer who blanks the creds gets an unexplained 401 with no log.

**Fix.** Either delete the dead/misleading branch, or make it do what the comment says:
```python
if not settings.admin_username or not settings.admin_password:
    if settings.environment == "development":
        logger.warning("ADMIN creds unset in dev; allowing any login")
        return True
    return False
```
And replace `print` with `logger` throughout the auth module (see L2).

---

### H4 — Firebase `mock-auth` silently skips SDK init; mock flag is checked but Firebase is never wired
**Location:** `backend/app/core/firebase.py:22-24`, `backend/app/middleware/auth.py:129-143`.

**What's wrong.** When `firebase_mock_auth=True`, `initialize_firebase()` returns immediately and never calls `firebase_admin.initialize_app()`. Then in `require_auth`, the mock branch returns a fake `sub="mock-admin"` **before** checking whether the token is even well-formed — any string, including `garbage`, authenticates as `mock-admin`. In development this is intentional, but:
- The mock branch is gated only on `settings.environment != "production"`. If a staging/preview deploy sets `ENVIRONMENT=staging` (or anything other than the exact string `"production"`), mock auth stays **on and wide open** (related to C2).
- Mocked `user_id` is `mock-admin`, which again collapses multi-user isolation.

**Impact.** Any non-`production` environment value enables universal auth bypass.

**Fix.** Change the gate from "not production" to an explicit allowlist:
```python
if settings.firebase_mock_auth:
    if settings.environment not in {"development", "test"}:
        raise HTTPException(401, "Mock auth is disabled outside development/test")
    ...
```
This composes with the C2 fix (default to production).

---

## 🟡 Medium

### M1 — Upload endpoint reads entire file into RAM before enforcing the size cap
**Location:** `backend/app/routers/files.py:81-86`.
```python
content = await file.read()              # ← buffers up to 2 GB in memory
if len(content) > settings.max_upload_bytes: raise HTTPException(413)
```
**Impact.** The `Content-Length` check at line 75 catches honest clients, but a malicious/large upload without `Content-Length` is fully buffered into the process before the second check rejects it. Two concurrent 2 GB uploads = ~4 GB RSS → OOM kill on small Railway containers.
**Fix.** Stream-and-accumulate with a rolling cap:
```python
chunks, total = [], 0
while chunk := await file.read(1024 * 1024):
    total += len(chunk)
    if total > settings.max_upload_bytes:
        raise HTTPException(413, "File exceeds limit")
    chunks.append(chunk)
content = b"".join(chunks)
```
Or hand the `UploadFile` stream directly to `httpx`'s streaming `files=` (Telegram accepts chunked).

### M2 — No MIME-type / extension allowlist on upload
**Location:** `backend/app/routers/files.py:88-101`.
The MIME type comes straight from the client (`file.content_type`) and is stored and later sent back as `Content-Type` on `/stream` with `X-Content-Type-Options: nosniff`. The `nosniff` header mitigates browser sniffing, but the stored MIME is fully attacker-controlled. A user can upload `evil.html` as `text/html`; if `nosniff` is ever stripped (proxy misconfig, future change), it renders.
**Fix.** Validate/normalize MIME against an allowlist before persisting, or force `Content-Type: application/octet-stream` for anything not in a known-safe set (image/video/audio/pdf).

### M3 — Folder depth check is off-by-one and the path is reconstructed from user input
**Location:** `backend/app/routers/folders.py:48-63`.
```python
depth = parent.path.strip("/").count("/") + 1
if depth >= 3: raise HTTPException(400, "Maximum folder depth (3) reached")
```
`path` is materialized as `parent.path.rstrip('/') + '/' + folder.name`. `folder.name` is validated by `_SAFE_NAME_RE` (no `/`), so traversal is blocked — good. But the depth math counts slashes: a top-level folder `path="/A"` → 0 slashes → `depth=1`, allowed; child `"/A/B"` → depth 2; grandchild `"/A/B/C"` → depth 3 → **blocked**. So the actual max depth is **2 levels of nesting under root**, not 3 as the message claims. Either the message or the bound is wrong.
**Fix.** Decide the intended depth and align: if you want root + 3 levels, change `if depth >= 3` to `if depth > 3`.

### M4 — `delete_folder` only checks direct children, but `ondelete=SET NULL` on files means deletion silently orphans files
**Location:** `backend/app/routers/folders.py:127-147`, `backend/app/models/db.py:119-123`.
The router rejects folders that contain subfolders or **non-deleted** files, but the FK on `files.folder_id` is `ondelete="SET NULL"` — so if a row is ever deleted at the SQL level outside this handler (Alembic migration, manual query), its files silently move to root. The app-level guard is the only thing keeping this invariant, and it doesn't check soft-deleted files (correct) but also doesn't check whether a future code path bypasses it.
**Fix.** Document the invariant in the model, or switch to `ondelete="RESTRICT"` so the DB enforces it too.

### M5 — `/files` count query doesn't apply `search` consistently for total pagination
**Location:** `backend/app/routers/files.py:174-185`.
The `filters` list is shared between `base` and `count_base`, which is correct — but `ilike` with `escape="\\"` relies on Postgres's default `standard_conforming_strings`. It works, but is brittle if the DB ever moves off Postgres. Low risk; noting for completeness.
**Fix.** None required if Postgres-only; add a comment.

### M6 — `auth.py` returns raw exception strings to the client
**Location:** `backend/app/middleware/auth.py:166-167, 177-178`.
```python
detail=f"Invalid or expired Firebase token. SDK error: {firebase_exc} (Manual check: {manual_exc})"
```
These leak the underlying verification error (e.g. "Token expired" vs "Invalid signature" vs "kid not found"), which is a small user-enumeration / fingerprinting vector. The login handler correctly returns a generic message; these don't.
**Fix.** Return a generic `"Invalid or expired token"` and log the detail server-side with `logger.warning`.

---

## 🟢 Low

### L1 — `FileRow.tsx` and `UploadDropzone.tsx` appear to be dead code
**Location:** `frontend/components/FileRow.tsx`, `frontend/components/FileList.tsx`, `frontend/components/UploadDropzone.tsx`.
`Dashboard.tsx` renders its own table/grid inline and never imports these. `FileRow.onDownload` has the same C1 bug, so if anyone re-wires these in, downloads break again.
**Fix.** Delete the unused components, or port them to the route-handler fix and use them.

### L2 — `print()` used for logging in Firebase init and auth
**Location:** `backend/app/core/firebase.py:23,33,36,46,49,57,60,69,72-74,76-77`, `backend/app/middleware/auth.py:64`.
`print()` bypasses the structured logger configured in `main.py:19-22` and won't be captured by Railway/production log drains.
**Fix.** `import logging; logger = logging.getLogger(__name__)` and use `logger.info/warning`.

### L3 — `console.log` may print the Firebase token in the browser
**Location:** `frontend/auth.ts:64`.
```ts
console.log("Firebase auth failed, trying local fallback:", firebaseErr);
```
The error object from `signInWithEmailAndPassword` can contain the request context. Not the token itself, but it's noise in production and can confuse users inspecting devtools.
**Fix.** Gate behind `process.env.NODE_ENV === "development"` or use `console.debug`.

### L4 — Vim swap file checked into the working tree
**Location:** `.CLAUDE.md.swp` (root, 12 KB, June 16).
`.gitignore` has `*.swp` but this file predates that line or was added with `git add -f`. It's currently untracked (good) but sits in the tree and gets picked up by some tooling.
**Fix.** `rm .CLAUDE.md.swp`. Already gitignored, so no history scrub needed.

### L5 — `crypto.randomUUID()` for upload IDs without a `crypto` availability check
**Location:** `frontend/components/Dashboard.tsx:199`.
`crypto.randomUUID` requires a secure context (HTTPS or localhost). On an unusual non-secure deploy it would throw and break the upload list. Minor since the app is always served over HTTPS.
**Fix.** Fallback: `const id = crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)`.

---

## Things that are **correct** (worth keeping)

These were checked and found solid — don't "fix" them:

- **SQLi:** all queries use SQLAlchemy ORM with bound params; the `ilike` search escapes `%`/`_` correctly (`files.py:177-181`). ✅
- **Path traversal:** folder/file names validated by `_SAFE_NAME_RE`; `.` and `..` rejected; `Content-Disposition` is `quote()`-encoded (`files.py:306`). ✅
- **Open redirect:** both `middleware.ts` and `login/page.tsx` have `safeNext()` that rejects `//evil.com`. ✅
- **CORS:** `allow_credentials=False`, Vercel regex scoped to the project's own subdomain. ✅
- **CSP / security headers:** both origins ship strict headers; CSP `default-src 'none'` on API, locked-down policy on frontend. ✅
- **Secrets in repo:** `firebase-sa.json` is **not** tracked by git (confirmed: `git log --all -- backend/firebase-sa.json` returns nothing), and `.gitignore` covers `*firebase-sa.json` / `*-sa.json`. `.env.example` has no real secrets. ✅
- **Token-in-URL leak avoidance on backend:** the `/files/{id}/download-url` endpoint was correctly removed and `/stream` proxies bytes. The **only** problem is that the frontend then re-introduces a query-string token — see C1. ✅ backend, ❌ frontend.

---

## Recommended fix order

1. **C1** — unblock downloads/previews (route-handler proxy). Restores core functionality.
2. **C2 + H4** — flip `environment` default to `production` and tighten the mock-auth gate. Closes the silent-bypass class.
3. **H2** — restrict local-credential fallback so multi-user isolation holds.
4. **H1** — add session-expiry UX (toast + redirect) even if full refresh is deferred.
5. **M1, M2** — streaming upload + MIME allowlist (DoS + defense-in-depth).
6. Everything else as cleanup.
