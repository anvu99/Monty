"""Add inferred semantic evidence and durable consolidation scheduling."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "d71b3fa80219"
down_revision = "c42f8e91d703"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("children", sa.Column("semantic_consolidation",
        JSONB().with_variant(sa.JSON(), "sqlite"), nullable=False, server_default='{}'))
    op.add_column("semantic_memories", sa.Column("pattern_evidence", sa.JSON(), nullable=True))
    for name in ("first_observed_at", "last_observed_at", "last_evaluated_at"):
        op.add_column("semantic_memories", sa.Column(name, sa.DateTime(timezone=True), nullable=True))


def downgrade():
    op.execute(sa.text("DELETE FROM semantic_memories WHERE origin = 'inferred'"))
    for name in ("last_evaluated_at", "last_observed_at", "first_observed_at", "pattern_evidence"):
        op.drop_column("semantic_memories", name)
    op.drop_column("children", "semantic_consolidation")
