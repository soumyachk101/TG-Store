"""FastAPI app entrypoint — TGStore backend.

Wires routers, CORS, security headers, and health endpoint.
"""

from __future__ import annotations

import logging
from typing import Awaitable, Callable

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

from app.core.config import get_settings
from app.core.firebase import initialize_firebase
from app.routers import auth, files, folders

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)

settings = get_settings()
initialize_firebase()

app = FastAPI(
    title="TGStore API",
    version="0.1.0",
    description="Personal cloud storage backed by Telegram. See Docs/PRD.md.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    # Constrain vercel preview allowlist to the project's own URL space.
    # Wildcard `.*` would let any *.vercel.app issue cross-origin requests.
    allow_origin_regex=r"^https://tgstore(-[a-z0-9-]+)?\.vercel\.app$",
    # Auth uses the Authorization header (Bearer), not cookies — credentials
    # are not required. Setting this to False avoids accidental CSRF exposure
    # if cookies are ever introduced.
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Security response headers. CSP is intentionally strict; expand the
# img-src/media-src set only if a future preview feature needs it.
_SECURITY_HEADERS: dict[str, str] = {
    "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "X-Frame-Options": "DENY",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Content-Security-Policy": (
        "default-src 'none'; "
        "frame-ancestors 'none'; "
        "base-uri 'none'"
    ),
}


@app.middleware("http")
async def add_security_headers(
    request: Request,
    call_next: Callable[[Request], Awaitable[Response]],
) -> Response:
    """Attach baseline security headers to every response.

    CSP is `default-src 'none'` because the API returns JSON, never HTML;
    browsers and tooling that try to render the response as a page get
    nothing to load.
    """
    response = await call_next(request)
    for name, value in _SECURITY_HEADERS.items():
        response.headers.setdefault(name, value)
    return response


# Routers
app.include_router(auth.router)
app.include_router(files.router)
app.include_router(folders.router)


@app.get("/", tags=["meta"])
async def root() -> dict:
    """Root endpoint returning API status."""
    return {
        "status": "ok",
        "message": "TGStore API is running. See /docs for API documentation."
    }


@app.get("/health", tags=["meta"])
async def health() -> dict:
    """Liveness probe. Unauthenticated by design."""
    return {"status": "ok"}

