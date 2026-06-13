"""FastAPI app entrypoint — TGStore backend.

Wires routers, CORS, and health endpoint.
"""

from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.routers import auth, files, folders

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)

settings = get_settings()

app = FastAPI(
    title="TGStore API",
    version="0.1.0",
    description="Personal cloud storage backed by Telegram. See Docs/PRD.md.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(auth.router)
app.include_router(files.router)
app.include_router(folders.router)


@app.get("/health", tags=["meta"])
async def health() -> dict:
    """Liveness probe. Unauthenticated by design."""
    return {"status": "ok"}
