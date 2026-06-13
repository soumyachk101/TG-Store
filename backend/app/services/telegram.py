"""Telegram Bot API service layer.

All Telegram HTTP calls live here — no router should call api.telegram.org
directly. We use httpx.AsyncClient (never `requests`) and retry network
errors with exponential backoff (per AI instructions).

NEVER expose tg_file_id or the raw download URL to the frontend.
The /file/bot<TOKEN>/ path leaks the bot token in the URL.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any

import httpx

from app.core.config import get_settings

logger = logging.getLogger(__name__)

settings = get_settings()

TG_API_BASE = "https://api.telegram.org"


def _bot_base() -> str:
    """Build the bot API base URL. Raises if token is missing."""
    if not settings.bot_token:
        raise RuntimeError(
            "BOT_TOKEN is not set. Configure backend/.env before calling Telegram."
        )
    return f"{TG_API_BASE}/bot{settings.bot_token}"


def _chat_id() -> str:
    if not settings.chat_id:
        raise RuntimeError(
            "CHAT_ID is not set. Configure backend/.env before calling Telegram."
        )
    return settings.chat_id


async def _retry(
    func, *args, attempts: int = 3, base_delay: float = 0.5, **kwargs
) -> Any:
    """Call an async function with exponential backoff on network/HTTP errors.

    Retries on:
      - httpx.TransportError (network errors, timeouts)
      - httpx.HTTPStatusError for 5xx responses
    Does NOT retry on 4xx — those are programming/data errors, not transient.
    """
    last_exc: Exception | None = None
    for attempt in range(attempts):
        try:
            return await func(*args, **kwargs)
        except httpx.TransportError as exc:
            last_exc = exc
            delay = base_delay * (2**attempt)
            logger.warning(
                "Telegram call failed (attempt %d/%d): %s — retrying in %.2fs",
                attempt + 1,
                attempts,
                exc,
                delay,
            )
            await asyncio.sleep(delay)
        except httpx.HTTPStatusError as exc:
            if 500 <= exc.response.status_code < 600:
                last_exc = exc
                delay = base_delay * (2**attempt)
                logger.warning(
                    "Telegram 5xx (attempt %d/%d): %s — retrying in %.2fs",
                    attempt + 1,
                    attempts,
                    exc,
                    delay,
                )
                await asyncio.sleep(delay)
            else:
                # 4xx — caller error, do not retry
                raise
    assert last_exc is not None
    raise last_exc


async def send_document(filename: str, content: bytes, mime: str) -> dict[str, Any]:
    """Upload a file to the configured storage channel.

    Returns the full `result` object from Telegram's sendDocument response.
    The caller is responsible for persisting `file_id` and `message_id`.
    """

    async def _do() -> dict[str, Any]:
        # Telegram requires a real filename (with extension) and detects MIME
        # from the file tuple's content-type parameter.
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(
                f"{_bot_base()}/sendDocument",
                data={"chat_id": _chat_id(), "caption": filename[:1024]},
                files={
                    "document": (filename, content, mime or "application/octet-stream")
                },
            )
        resp.raise_for_status()
        body = resp.json()
        if not body.get("ok"):
            raise RuntimeError(f"Telegram sendDocument failed: {body}")
        return body["result"]

    return await _retry(_do)


async def get_download_url(file_id: str) -> str:
    """Return a fresh (1-hour) Telegram download URL for a file_id.

    Per AI instructions: NEVER cache the result. The URL embeds the bot token
    in the path, so it must be proxied through FastAPI, not sent to the
    browser directly.
    """

    async def _do() -> str:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(
                f"{_bot_base()}/getFile", params={"file_id": file_id}
            )
        resp.raise_for_status()
        body = resp.json()
        if not body.get("ok"):
            raise RuntimeError(f"Telegram getFile failed: {body}")
        file_path: str = body["result"]["file_path"]
        return f"{TG_API_BASE}/file/bot{settings.bot_token}/{file_path}"

    return await _retry(_do)


async def download_bytes(file_id: str) -> tuple[bytes, str | None]:
    """Stream the file bytes from Telegram. Returns (bytes, mime)."""
    url = await get_download_url(file_id)
    async with httpx.AsyncClient(timeout=300.0, follow_redirects=True) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        return resp.content, resp.headers.get("content-type")


async def delete_message(message_id: int) -> None:
    """Hard-delete a message from the storage channel. Best-effort."""

    async def _do() -> None:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{_bot_base()}/deleteMessage",
                data={"chat_id": _chat_id(), "message_id": message_id},
            )
        # deleteMessage returns ok=true even if message was already gone;
        # we don't want that to raise. Log and move on for any non-2xx.
        if resp.status_code >= 400:
            logger.warning("deleteMessage returned %d: %s", resp.status_code, resp.text)

    try:
        await _retry(_do)
    except Exception as exc:
        # Soft-fail: storage cleanup should never block a delete response.
        logger.warning("deleteMessage failed permanently: %s", exc)
