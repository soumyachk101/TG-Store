"""initial schema: folders + files

Revision ID: 0001_initial
Revises:
Create Date: 2026-06-13

Creates folders + files tables per Docs/TRD.md §3.1.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Required for gen_random_uuid()
    op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")

    op.create_table(
        "folders",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column(
            "parent_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("folders.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column("path", sa.Text(), nullable=False, server_default="/"),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
    )

    op.create_table(
        "files",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("original_name", sa.Text(), nullable=False),
        sa.Column("mime_type", sa.Text(), nullable=True),
        sa.Column("size_bytes", sa.BigInteger(), nullable=True),
        sa.Column(
            "folder_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("folders.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("tg_file_id", sa.Text(), nullable=False, unique=True),
        sa.Column("tg_message_id", sa.Integer(), nullable=True),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.Column("deleted_at", sa.TIMESTAMP(), nullable=True),
    )

    # Partial indexes for the common active-files queries
    op.create_index(
        "idx_files_folder_active",
        "files",
        ["folder_id"],
        postgresql_where=sa.text("deleted_at IS NULL"),
    )
    op.create_index(
        "idx_files_mime_active",
        "files",
        ["mime_type"],
        postgresql_where=sa.text("deleted_at IS NULL"),
    )
    op.create_index("idx_files_name_trgm", "files", ["name"])


def downgrade() -> None:
    op.drop_index("idx_files_name_trgm", table_name="files")
    op.drop_index("idx_files_mime_active", table_name="files")
    op.drop_index("idx_files_folder_active", table_name="files")
    op.drop_table("files")
    op.drop_table("folders")
