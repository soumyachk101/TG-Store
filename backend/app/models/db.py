"""SQLAlchemy ORM models — File, Folder.

Per Docs/TRD.md §3.1:
- UUID primary keys
- created_at / updated_at timestamps
- soft-delete via deleted_at TIMESTAMP NULL
- tg_file_id is UNIQUE and sacred (never delete/overwrite)
"""

from __future__ import annotations

import uuid
import uuid as _uuid_mod
from datetime import datetime

from sqlalchemy import (
    BigInteger,
    CHAR,
    ForeignKey,
    Index,
    Text,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, backref, mapped_column, relationship
from sqlalchemy.types import TypeDecorator

from app.core.database import Base


class GUID(TypeDecorator):
    """Cross-dialect UUID column. Stores as native UUID on Postgres, CHAR(36) elsewhere."""

    impl = CHAR
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            return dialect.type_descriptor(PG_UUID(as_uuid=True))
        return dialect.type_descriptor(CHAR(36))

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if dialect.name == "postgresql":
            return value if isinstance(value, uuid.UUID) else uuid.UUID(str(value))
        return (
            str(value) if isinstance(value, uuid.UUID) else str(uuid.UUID(str(value)))
        )

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        return value if isinstance(value, uuid.UUID) else uuid.UUID(str(value))


def _new_uuid() -> uuid.UUID:
    return _uuid_mod.uuid4()


class Folder(Base):
    """Folder hierarchy. `path` is materialized for fast breadcrumb queries."""

    __tablename__ = "folders"

    id: Mapped[uuid.UUID] = mapped_column(
        GUID(),
        primary_key=True,
        default=_new_uuid,
    )
    name: Mapped[str] = mapped_column(Text, nullable=False)
    parent_id: Mapped[uuid.UUID | None] = mapped_column(
        GUID(),
        ForeignKey("folders.id", ondelete="CASCADE"),
        nullable=True,
    )
    path: Mapped[str] = mapped_column(
        Text, nullable=False, default="/", server_default="/"
    )
    user_id: Mapped[str] = mapped_column(
        Text, nullable=False, server_default="admin", default="admin"
    )
    created_at: Mapped[datetime] = mapped_column(
        nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        nullable=False, server_default=func.now(), onupdate=func.now()
    )

    # Self-referential: a folder can have child folders and files.
    # `children` is the one-to-many side; cascade lives here, not on `parent`.
    children: Mapped[list["Folder"]] = relationship(
        "Folder",
        backref=backref("parent", remote_side="Folder.id"),
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    files: Mapped[list["File"]] = relationship(
        "File", back_populates="folder", passive_deletes=True
    )


class File(Base):
    """File metadata. The actual bytes live on Telegram's CDN."""

    __tablename__ = "files"

    id: Mapped[uuid.UUID] = mapped_column(
        GUID(),
        primary_key=True,
        default=_new_uuid,
    )
    name: Mapped[str] = mapped_column(Text, nullable=False)
    original_name: Mapped[str] = mapped_column(Text, nullable=False)
    mime_type: Mapped[str | None] = mapped_column(Text, nullable=True)
    size_bytes: Mapped[int | None] = mapped_column(BigInteger, nullable=True)

    folder_id: Mapped[uuid.UUID | None] = mapped_column(
        GUID(),
        ForeignKey("folders.id", ondelete="RESTRICT"),
        nullable=True,
    )

    user_id: Mapped[str] = mapped_column(
        Text, nullable=False, server_default="admin", default="admin"
    )

    # Telegram references — tg_file_id is sacred
    tg_file_id: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    tg_message_id: Mapped[int | None] = mapped_column(nullable=True)

    # Lifecycle
    created_at: Mapped[datetime] = mapped_column(
        nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        nullable=False, server_default=func.now(), onupdate=func.now()
    )
    deleted_at: Mapped[datetime | None] = mapped_column(nullable=True)

    folder: Mapped[Folder | None] = relationship("Folder", back_populates="files")

    __table_args__ = (
        # Active files only — partial index speeds up the common query
        Index(
            "idx_files_folder_active",
            "folder_id",
            postgresql_where=text("deleted_at IS NULL"),
        ),
        Index(
            "idx_files_user_active",
            "user_id",
            postgresql_where=text("deleted_at IS NULL"),
        ),
        Index(
            "idx_files_mime_active",
            "mime_type",
            postgresql_where=text("deleted_at IS NULL"),
        ),
        # No `idx_files_name_trgm` here on purpose. Filename search uses
        # ILIKE '%name%' and does not benefit from a plain btree index.
        # For a personal-scale corpus the seq scan is fine; if file count
        # grows past ~100k, add a GIN trigram (`pg_trgm`) index in a
        # follow-up migration.
    )

    @property
    def is_active(self) -> bool:
        return self.deleted_at is None
