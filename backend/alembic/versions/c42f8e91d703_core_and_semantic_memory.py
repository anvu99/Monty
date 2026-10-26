"""Add per-child core state and explicit semantic memory revisions."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "c42f8e91d703"
down_revision = "a91c4d02b671"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("children", sa.Column("core_memory", JSONB().with_variant(sa.JSON(), "sqlite"),
        nullable=False, server_default='{"schema_version":1,"revision":0,"entries":{}}'))
    op.create_table("semantic_memories",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("child_id", sa.String(), sa.ForeignKey("children.id", ondelete="CASCADE"), nullable=False),
        sa.Column("memory_key", sa.String(80), nullable=False),
        sa.Column("name", sa.String(100), nullable=False), sa.Column("topic", sa.String(80), nullable=False),
        sa.Column("summary", sa.String(300), nullable=False), sa.Column("details", sa.String(600)),
        sa.Column("status", sa.String(20), nullable=False), sa.Column("revision", sa.Integer(), nullable=False),
        sa.Column("supersedes_id", sa.String(), sa.ForeignKey("semantic_memories.id", ondelete="SET NULL")),
        sa.Column("source_conversation_id", sa.String(), sa.ForeignKey("ended_conversations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("evidence", sa.JSON(), nullable=False), sa.Column("origin", sa.String(20), nullable=False),
        sa.Column("extractor_version", sa.String(100), nullable=False),
        sa.UniqueConstraint("child_id", "memory_key", "revision", name="uq_semantic_memory_revision"))
    op.create_index("ix_semantic_memories_child_status", "semantic_memories", ["child_id", "status"])


def downgrade():
    op.drop_table("semantic_memories")
    op.drop_column("children", "core_memory")
