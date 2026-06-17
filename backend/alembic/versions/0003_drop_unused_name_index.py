"""drop_unused_name_index: remove the misleadingly-named trigram index.

Revision ID: 0003_drop_unused_name_index
Revises: 0002_fix_file_folder_fk
Create Date: 2026-06-17

The 0001_initial migration created `idx_files_name_trgm` on `files.name`.
The name implies a pg_trgm GIN index, but the migration actually created
a plain btree index — which is useless for the `ILIKE '%foo%'` substring
search used in the file list endpoint. For a personal-scale corpus, the
seq scan is fine; the index only added write amplification.

The SQLAlchemy model also declares the same index, so we remove the
model declaration in lockstep. If file count grows past ~100k, the
follow-up is a real GIN trigram index in a new migration:

    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")
    op.execute(
        "CREATE INDEX idx_files_name_trgm ON files "
        "USING GIN (name gin_trgm_ops)"
    )
"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "0003_drop_unused_name_index"
down_revision: Union[str, None] = "0002_fix_file_folder_fk"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Drop the btree index. The IF EXISTS guard makes this safe on fresh
    # databases that were never created by 0001_initial (e.g. CI fixtures).
    op.execute("DROP INDEX IF EXISTS idx_files_name_trgm")


def downgrade() -> None:
    # Re-create as a plain btree, matching the original (mis-named)
    # migration. The follow-up GIN trigram index is documented above; it
    # is intentionally not part of this downgrade.
    op.create_index(
        "idx_files_name_trgm",
        "files",
        ["name"],
    )
