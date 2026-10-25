"""Identify demo purchases and preserve their known currency."""
from alembic import op
import sqlalchemy as sa

revision = "e82d4bc91320"
down_revision = "d71b3fa80219"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("transactions", sa.Column("source", sa.String(20), nullable=False, server_default="legacy"))
    op.add_column("transactions", sa.Column("currency", sa.String(3), nullable=True))


def downgrade():
    op.drop_column("transactions", "currency")
    op.drop_column("transactions", "source")
