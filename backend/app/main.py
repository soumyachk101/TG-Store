"""FastAPI app entrypoint — TGStore backend.

Wires routers, CORS, and health endpoint.
"""

from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

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
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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

