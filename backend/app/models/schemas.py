"""Pydantic v2 request/response schemas.

All API responses use these models — never raw dicts (per AI instructions).
"""

from __future__ import annotations

import re
import uuid
from datetime import datetime
from typing import Generic, List, Optional, TypeVar

from pydantic import BaseModel, ConfigDict, Field, field_validator

T = TypeVar("T")


# --- Auth ---


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class UserInfo(BaseModel):
    username: str


# --- Files ---


class FileBase(BaseModel):
    name: str
    original_name: str
    mime_type: Optional[str] = None
    size_bytes: Optional[int] = None
    folder_id: Optional[uuid.UUID] = None


class FileResponse(FileBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    tg_file_id: str
    tg_message_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    deleted_at: Optional[datetime] = None


class FileUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=512)
    folder_id: Optional[uuid.UUID] = None

    # Reject path-traversal-style name mutations: no `/`, `\`, control
    # characters, or names that start or end with `.`. Mirror the
    # FolderCreate / FolderUpdate validation.
    @field_validator("name")
    @classmethod
    def _validate_name(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        if not _SAFE_NAME_RE.match(v):
            raise ValueError(
                "name must contain only letters, digits, spaces, '.', '-', '_'"
            )
        return v


class DeleteResponse(BaseModel):
    success: bool = True
    id: uuid.UUID


# --- Pagination ---


class PaginatedResponse(BaseModel, Generic[T]):
    items: List[T]
    total: int
    page: int
    limit: int
    has_next: bool


# --- Folders ---

# Folder names are embedded into a materialized `path` and surfaced in API
# responses / future zip-export filenames. Restrict the character set so a
# user cannot inject `/` (path traversal), control chars (header injection),
# or names like `.` / `..` (filesystem escape).
_SAFE_NAME_RE = re.compile(r"^[A-Za-z0-9 _.\-]+$")


class FolderCreate(BaseModel):
    name: str = Field(min_length=1, max_length=128)
    parent_id: Optional[uuid.UUID] = None

    @field_validator("name")
    @classmethod
    def _validate_name(cls, v: str) -> str:
        v = v.strip()
        if not _SAFE_NAME_RE.match(v) or v in {".", ".."}:
            raise ValueError(
                "name must contain only letters, digits, spaces, '.', '-', '_'"
            )
        return v


class FolderUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=128)

    @field_validator("name")
    @classmethod
    def _validate_name(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        v = v.strip()
        if not _SAFE_NAME_RE.match(v) or v in {".", ".."}:
            raise ValueError(
                "name must contain only letters, digits, spaces, '.', '-', '_'"
            )
        return v


class FolderResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    parent_id: Optional[uuid.UUID] = None
    path: str
    created_at: datetime


# --- Stats ---


class TypeStat(BaseModel):
    mime_group: str
    count: int
    size: int


class StorageStats(BaseModel):
    total_count: int
    total_size: int
    by_type: List[TypeStat]


# --- Errors ---


class ErrorResponse(BaseModel):
    detail: str
