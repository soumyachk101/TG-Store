"""Folders router: CRUD for the folder hierarchy.

Phase 2 will lean on this. For Phase 1 we only need create + list so users
can pick a target folder on upload.
"""

from __future__ import annotations

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.middleware.auth import require_auth
from app.models.db import File, Folder
from app.models.schemas import (
    DeleteResponse,
    FolderCreate,
    FolderResponse,
    FolderUpdate,
)

router = APIRouter(prefix="/folders", tags=["folders"])


@router.post("", response_model=FolderResponse, status_code=201)
async def create_folder(
    payload: FolderCreate,
    db: AsyncSession = Depends(get_db),
    _claims: dict = Depends(require_auth),
) -> FolderResponse:
    """Create a folder (optionally nested)."""
    parent: Folder | None = None
    if payload.parent_id is not None:
        parent = (
            await db.execute(select(Folder).where(Folder.id == payload.parent_id))
        ).scalar_one_or_none()
        if parent is None:
            raise HTTPException(status_code=404, detail="Parent folder not found")
        # PRD §3.3: max 3 levels deep
        depth = parent.path.strip("/").count("/") + 1
        if depth >= 3:
            raise HTTPException(
                status_code=400, detail="Maximum folder depth (3) reached"
            )

    folder = Folder(name=payload.name, parent_id=payload.parent_id)
    db.add(folder)
    await db.flush()  # assign id
    # Materialize the path
    folder.path = (
        f"{parent.path.rstrip('/')}/{folder.name}" if parent else f"/{folder.name}"
    )
    await db.commit()
    await db.refresh(folder)
    return FolderResponse.model_validate(folder)


@router.get("", response_model=list[FolderResponse])
async def list_folders(
    parent_id: Optional[uuid.UUID] = Query(default=None),
    db: AsyncSession = Depends(get_db),
    _claims: dict = Depends(require_auth),
) -> list[FolderResponse]:
    """List folders. If parent_id is given, list children of that folder.
    Otherwise return top-level folders.
    """
    stmt = select(Folder).where(
        Folder.parent_id.is_(parent_id)
        if parent_id is None
        else Folder.parent_id == parent_id
    )
    rows = (await db.execute(stmt.order_by(Folder.name))).scalars().all()
    return [FolderResponse.model_validate(r) for r in rows]


@router.patch("/{folder_id}", response_model=FolderResponse)
async def update_folder(
    folder_id: uuid.UUID,
    payload: FolderUpdate,
    db: AsyncSession = Depends(get_db),
    _claims: dict = Depends(require_auth),
) -> FolderResponse:
    row = (
        await db.execute(select(Folder).where(Folder.id == folder_id))
    ).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Folder not found")
    if payload.name is not None:
        row.name = payload.name
    await db.commit()
    await db.refresh(row)
    return FolderResponse.model_validate(row)


@router.delete("/{folder_id}", response_model=DeleteResponse)
async def delete_folder(
    folder_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _claims: dict = Depends(require_auth),
) -> DeleteResponse:
    """Delete a folder. Must be empty (no files, no subfolders)."""
    row = (
        await db.execute(select(Folder).where(Folder.id == folder_id))
    ).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Folder not found")
    has_children = (
        await db.execute(
            select(Folder.id).where(Folder.parent_id == folder_id).limit(1)
        )
    ).scalar_one_or_none()
    if has_children:
        raise HTTPException(
            status_code=400, detail="Folder is not empty (has subfolders)"
        )
    has_files = (
        await db.execute(
            select(File.id)
            .where(File.folder_id == folder_id, File.deleted_at.is_(None))
            .limit(1)
        )
    ).scalar_one_or_none()
    if has_files:
        raise HTTPException(status_code=400, detail="Folder is not empty (has files)")
    await db.delete(row)
    await db.commit()
    return DeleteResponse(success=True, id=folder_id)
