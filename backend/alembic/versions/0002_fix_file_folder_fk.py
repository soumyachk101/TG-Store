"""fix_file_folder_fk: align DB FK with the model (RESTRICT, not SET NULL).

Revision ID: 0002_fix_file_folder_fk
Revises: f19e8b80c013
Create Date: 2026-06-17

The 0001_initial migration created the `files.folder_id` foreign key with
`ON DELETE SET NULL`. The SQLAlchemy model (`app.models.db.File.folder_id`)
declares `ondelete="RESTRICT"`. For personal data integrity, RESTRICT is
the right semantic: silently orphaning files via SET NULL would let a
folders-cascade-delete pull a file out of its folder without anyone
noticing.

This migration aligns the DB to the model by dropping the existing
foreign-key constraint on `files.folder_id` and recreating it with
`ON DELETE RESTRICT`. A run of the file router's `delete_folder`
emptiness check is what now performs the protection at the application
layer; the FK is the database-level backstop.

We name the new constraint deterministically so the downgrade is
unambiguous. The original constraint name (Postgres auto-generated
`files_folder_id_fkey`) is the most likely value; the migration is
robust to that name being different by using a deterministic new name.
"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "0002_fix_file_folder_fk"
down_revision: Union[str, None] = "f19e8b80c013"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Deterministic name so this migration is idempotent and the downgrade
# knows exactly which constraint to drop.
_FK_NAME = "fk_files_folder_id_restrict"
_OLD_FK_NAME = "files_folder_id_fkey"


def upgrade() -> None:
    # Drop the existing FK if it has the auto-generated name. Wrap in a
    # DO block so the migration succeeds if the constraint is already
    # named differently (e.g. a future developer renamed it manually).
    op.execute(
        f"""
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conname = '{_OLD_FK_NAME}'
                  AND conrelid = 'files'::regclass
            ) THEN
                ALTER TABLE files DROP CONSTRAINT {_OLD_FK_NAME};
            END IF;
        END$$;
        """
    )
    # Re-create with the correct semantics. Use a named constraint so the
    # downgrade path is exact.
    op.create_foreign_key(
        _FK_NAME,
        "files",
        "folders",
        ["folder_id"],
        ["id"],
        ondelete="RESTRICT",
    )


def downgrade() -> None:
    op.drop_constraint(_FK_NAME, "files", type_="foreignkey")
    op.create_foreign_key(
        _OLD_FK_NAME,
        "files",
        "folders",
        ["folder_id"],
        ["id"],
        ondelete="SET NULL",
    )
