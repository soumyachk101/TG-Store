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
        if v.startswith("."):
            raise ValueError("name must not start with '.'")
        if _NAME_FORBIDDEN_RE.search(v):
            raise ValueError(
                "name must not contain path separators or control characters"
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

# Folder / file names are embedded into a materialized `path`, returned
# in API responses, and (in future) used in zip-export filenames. We
# block the *dangerous* characters — `/` and `\` (path traversal),
# control characters (header injection), and leading/trailing dots and
# the special names `.` / `..` (filesystem escape). Everything else,
# including Unicode (é, ñ, 中, emoji, etc.) and apostrophes, is allowed.
#
# Reject: any character that is a control char (< 0x20) or is one of
# the path-separator / filesystem-special characters.
_NAME_FORBIDDEN_RE = re.compile(r"[\x00-\x1f\x7f/\\]")


class FolderCreate(BaseModel):
    name: str = Field(min_length=1, max_length=128)
    parent_id: Optional[uuid.UUID] = None

    @field_validator("name")
    @classmethod
    def _validate_name(cls, v: str) -> str:
        # Check forbidden chars on the *original* input so a control
        # character in the middle of a name is rejected, not silently
        # removed by strip().
        if _NAME_FORBIDDEN_RE.search(v):
            raise ValueError(
                "name must not contain path separators or control characters"
            )
        v = v.strip()
        if not v or v in {".", ".."} or v.startswith("."):
            raise ValueError(
                "name must not be empty, must not start with '.', and must not be '.' or '..'"
            )
        return v


class FolderUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=128)

    @field_validator("name")
    @classmethod
    def _validate_name(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        if _NAME_FORBIDDEN_RE.search(v):
            raise ValueError(
                "name must not contain path separators or control characters"
            )
        v = v.strip()
        if not v or v in {".", ".."} or v.startswith("."):
            raise ValueError(
                "name must not be empty, must not start with '.', and must not be '.' or '..'"
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
