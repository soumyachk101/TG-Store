# TGStore Codebase Guidelines

## Command Reference

### Backend
- Run development server: `cd backend && .venv/bin/uvicorn app.main:app --reload`
- Run tests: `cd backend && .venv/bin/pytest`
- Run linting: `cd backend && .venv/bin/ruff check .` (or using installed python package)
- Apply database migrations: `cd backend && .venv/bin/alembic upgrade head`
- Create database migration: `cd backend && .venv/bin/alembic revision --autogenerate -m "description"`

### Frontend
- Install dependencies: `cd frontend && npm install`
- Run development server: `cd frontend && npm run dev`
- Build production bundle: `cd frontend && npm run build`
- Run linting: `cd frontend && npm run lint`

## Security Guidelines

- **No Direct Telegram Download URLs**: Do not expose `https://api.telegram.org/file/...` directly to the frontend because it embeds the bot token. Use the proxied stream endpoint: `/files/{id}/stream`.
- **CORS Allowlist**: Keep CORS origin patterns locked to safe domains (e.g. `^https://tgstore(-[a-z0-9-]+)?\.vercel\.app$`).
- **Post-login Redirects**: Always validate post-login redirection targets using `safeNext`. Redirects must only be same-origin paths (start with `/` and must not start with `//`).
- **Fail-Closed Production Boot**: In `production` environment, local HS256 tokens and Firebase mock auth are disabled. The app must refuse to boot if `JWT_SECRET`, `ADMIN_PASSWORD` are set to dev defaults, or if Firebase credentials are missing.
