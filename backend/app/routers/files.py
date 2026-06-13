"""Files router: upload, list, download, stream, patch, delete, stats.

Per Docs/TRD.md §2.3 and AI instructions:
- 2 GB cap enforced BEFORE the Telegram call (413 otherwise)
- Stream download through FastAPI; never expose raw Telegram URLs
- All endpoints return Pydantic models
- Soft-delete via deleted_at
- /files/stats returns storage breakdown
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, status
from fastapi import File as FastAPIFile
from fastapi import Form as FastAPIForm
from fastapi.responses import StreamingResponse
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.database import get_db
from app.middleware.auth import require_auth
from app.models.db import File
from app.models.schemas import (
    DeleteResponse,
    FileResponse,
    FileUpdate,
    PaginatedResponse,
    StorageStats,
    TypeStat,
)
from app.services import telegram
from app.utils.helpers import clamp, group_for_mime

router = APIRouter(prefix="/files", tags=["files"])
settings = get_settings()

# Reasonable streaming chunk size for the proxy endpoint
STREAM_CHUNK = 64 * 1024  # 64 KB


# --- Upload ---


@router.post(
    "/upload",
    response_model=FileResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_file(
    file: UploadFile = FastAPIFile(...),
    folder_id: Optional[str] = FastAPIForm(default=None),
    db: AsyncSession = Depends(get_db),
    _claims: dict = Depends(require_auth),
) -> FileResponse:
    """Upload a file to Telegram, persist metadata.

    Enforces 2 GB limit BEFORE reading the full body into memory
    (per AI instructions — fail fast, never let Telegram see an oversize file).
    """
    # --- Size cap (Telegram limit is 2 GB) ---
    # UploadFile.size is set by Starlette from Content-Length if available.
    declared = file.size
    if declared is not None and declared > settings.max_upload_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds {settings.max_upload_bytes} byte limit",
        )

    content = await file.read()
    if len(content) > settings.max_upload_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds {settings.max_upload_bytes} byte limit",
        )

    # --- Send to Telegram ---
    original_name = file.filename or "unnamed"
    try:
        result = await telegram.send_document(
            filename=original_name,
            content=content,
            mime=file.content_type or "application/octet-stream",
        )
    except Exception as exc:
        # Do not echo Telegram error details (may include token leakage)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Upload to storage service failed",
        ) from exc

    tg_file_id: str = result["document"]["file_id"]
    tg_message_id: Optional[int] = result.get("message_id")

    # --- Persist metadata ---
    parsed_folder_id: uuid.UUID | None = None
    if folder_id:
        try:
            parsed_folder_id = uuid.UUID(folder_id)
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="folder_id must be a UUID",
            ) from exc

    db_file = File(
        name=original_name,
        original_name=original_name,
        mime_type=file.content_type,
        size_bytes=len(content),
        folder_id=parsed_folder_id,
        tg_file_id=tg_file_id,
        tg_message_id=tg_message_id,
    )
    db.add(db_file)
    await db.commit()
    await db.refresh(db_file)
    return FileResponse.model_validate(db_file)


# --- List ---


@router.get("", response_model=PaginatedResponse[FileResponse])
async def list_files(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1),
    search: Optional[str] = Query(default=None, description="Filename contains"),
    folder_id: Optional[uuid.UUID] = Query(default=None),
    mime_type: Optional[str] = Query(default=None),
    include_deleted: bool = Query(default=False),
    db: AsyncSession = Depends(get_db),
    _claims: dict = Depends(require_auth),
) -> PaginatedResponse[FileResponse]:
    """Paginated file list with optional search/filter."""
    limit = clamp(limit, 1, 100)
    offset = (page - 1) * limit

    base = select(File)
    count_base = select(func.count(File.id))

    filters = []
    if not include_deleted:
        filters.append(File.deleted_at.is_(None))
    if folder_id is not None:
        filters.append(File.folder_id == folder_id)
    if mime_type:
        filters.append(File.mime_type == mime_type)
    if search:
        # Case-insensitive substring match
        pat = f"%{search}%"
        filters.append(File.name.ilike(pat))

    if filters:
        base = base.where(and_(*filters))
        count_base = count_base.where(and_(*filters))

    total = (await db.execute(count_base)).scalar_one()
    result = await db.execute(
        base.order_by(File.created_at.desc()).offset(offset).limit(limit)
    )
    items = [FileResponse.model_validate(row) for row in result.scalars().all()]

    return PaginatedResponse[FileResponse](
        items=items,
        total=total,
        page=page,
        limit=limit,
        has_next=(offset + len(items)) < total,
    )


# --- Single get ---


@router.get("/stats", response_model=StorageStats)
async def storage_stats(
    db: AsyncSession = Depends(get_db),
    _claims: dict = Depends(require_auth),
) -> StorageStats:
    """Aggregate counts and sizes by MIME group, for the dashboard widget."""
    # Only active files
    stmt = select(File.mime_type, File.size_bytes).where(File.deleted_at.is_(None))
    rows = (await db.execute(stmt)).all()

    by_group: dict[str, tuple[int, int]] = {}
    total_count = 0
    total_size = 0
    for mime, size in rows:
        group = group_for_mime(mime)
        cnt, sz = by_group.get(group, (0, 0))
        by_group[group] = (cnt + 1, sz + (size or 0))
        total_count += 1
        total_size += size or 0

    # Stable order matching the flow doc
    order = ["Images", "Videos", "Audio", "Documents", "Other"]
    by_type = [
        TypeStat(
            mime_group=g,
            count=by_group.get(g, (0, 0))[0],
            size=by_group.get(g, (0, 0))[1],
        )
        for g in order
    ]
    return StorageStats(total_count=total_count, total_size=total_size, by_type=by_type)


@router.get("/{file_id}", response_model=FileResponse)
async def get_file(
    file_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _claims: dict = Depends(require_auth),
) -> FileResponse:
    row = (
        await db.execute(select(File).where(File.id == file_id))
    ).scalar_one_or_none()
    if row is None or row.deleted_at is not None:
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse.model_validate(row)


# --- Download URL (fresh Telegram URL, never cached, never sent to browser raw) ---


@router.get("/{file_id}/download-url")
async def get_download_url(
    file_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _claims: dict = Depends(require_auth),
) -> dict:
    """Return a freshly-generated Telegram download URL.

    WARNING: This URL embeds the bot token in its path. The frontend MUST NOT
    use it directly — it should call /stream instead. This endpoint exists for
    server-to-server use and for the preview modal to test availability.
    """
    row = (
        await db.execute(select(File).where(File.id == file_id))
    ).scalar_one_or_none()
    if row is None or row.deleted_at is not None:
        raise HTTPException(status_code=404, detail="File not found")
    try:
        url = await telegram.get_download_url(row.tg_file_id)
    except Exception as exc:
        raise HTTPException(
            status_code=502, detail="Could not generate download URL"
        ) from exc
    return {"url": url, "expires_in": 3600}


# --- Stream (proxied download — safe to call from browser) ---


@router.get("/{file_id}/stream")
async def stream_file(
    file_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _claims: dict = Depends(require_auth),
):
    """Proxy the file bytes through FastAPI. The browser never sees the
    Telegram URL or bot token.
    """
    row = (
        await db.execute(select(File).where(File.id == file_id))
    ).scalar_one_or_none()
    if row is None or row.deleted_at is not None:
        raise HTTPException(status_code=404, detail="File not found")

    try:
        tg_url = await telegram.get_download_url(row.tg_file_id)
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Storage unavailable") from exc

    import httpx

    async def _iter():
        async with httpx.AsyncClient(timeout=300.0, follow_redirects=True) as client:
            async with client.stream("GET", tg_url) as resp:
                resp.raise_for_status()
                async for chunk in resp.aiter_bytes(STREAM_CHUNK):
                    yield chunk

    filename = row.name
    headers = {
        "Content-Disposition": f'attachment; filename="{filename}"',
        "Content-Type": row.mime_type or "application/octet-stream",
    }
    size = row.size_bytes
    if size:
        headers["Content-Length"] = str(size)
    return StreamingResponse(_iter(), headers=headers, media_type=row.mime_type)


# --- Patch (rename / move) ---


@router.patch("/{file_id}", response_model=FileResponse)
async def update_file(
    file_id: uuid.UUID,
    payload: FileUpdate,
    db: AsyncSession = Depends(get_db),
    _claims: dict = Depends(require_auth),
) -> FileResponse:
    """Metadata-only update. tg_file_id and bytes never change."""
    row = (
        await db.execute(select(File).where(File.id == file_id))
    ).scalar_one_or_none()
    if row is None or row.deleted_at is not None:
        raise HTTPException(status_code=404, detail="File not found")
    if payload.name is not None:
        row.name = payload.name
    if payload.folder_id is not None:
        row.folder_id = payload.folder_id
    await db.commit()
    await db.refresh(row)
    return FileResponse.model_validate(row)


# --- Delete (soft) ---


@router.delete("/{file_id}", response_model=DeleteResponse)
async def delete_file(
    file_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _claims: dict = Depends(require_auth),
) -> DeleteResponse:
    """Mark the file as deleted. The Telegram message is retained for
    recovery — set deleted_at, don't touch tg_file_id.
    """
    row = (
        await db.execute(select(File).where(File.id == file_id))
    ).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="File not found")
    if row.deleted_at is None:
        row.deleted_at = datetime.now(tz=timezone.utc)
        await db.commit()
    return DeleteResponse(success=True, id=row.id)
