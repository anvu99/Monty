"""Persist ended conversations and extracted decision events."""
from alembic import op
import sqlalchemy as sa

revision = "a91c4d02b671"
down_revision = "7d5839715881"
branch_labels = None
depends_on = None


def base_columns():
    return [sa.Column("id", sa.String(), primary_key=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False)]


def upgrade():
    op.create_table("ended_conversations", *base_columns(),
        sa.Column("child_id", sa.String(), sa.ForeignKey("children.id", ondelete="CASCADE"), nullable=False),
        sa.Column("transcript", sa.JSON(), nullable=False), sa.Column("facts", sa.JSON(), nullable=False),
        sa.Column("transcript_hash", sa.String(64), nullable=False),
        sa.Column("status", sa.String(20), nullable=False), sa.Column("attempts", sa.Integer(), nullable=False),
        sa.Column("processing_started_at", sa.DateTime(timezone=True)), sa.Column("error", sa.Text()))
    op.create_index("ix_ended_conversations_child_id", "ended_conversations", ["child_id"])
    op.create_index("ix_ended_conversations_status", "ended_conversations", ["status"])
    op.create_table("decision_events", *base_columns(),
        sa.Column("child_id", sa.String(), sa.ForeignKey("children.id", ondelete="CASCADE"), nullable=False),
        sa.Column("conversation_id", sa.String(), sa.ForeignKey("ended_conversations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("action", sa.String(40), nullable=False), sa.Column("outcome_status", sa.String(20), nullable=False),
        sa.Column("source", sa.String(30), nullable=False), sa.Column("situation", sa.String(400), nullable=False),
        sa.Column("goal_relationship", sa.String(30), nullable=False), sa.Column("evidence", sa.JSON(), nullable=False),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False), sa.Column("status", sa.String(20), nullable=False),
        sa.Column("supersedes_event_id", sa.String(), sa.ForeignKey("decision_events.id", ondelete="SET NULL")),
        sa.Column("fingerprint", sa.String(64), nullable=False), sa.Column("extractor_version", sa.String(100), nullable=False),
        sa.UniqueConstraint("conversation_id", "fingerprint"))
    op.create_index("ix_decision_events_child_id", "decision_events", ["child_id"])


def downgrade():
    op.drop_table("decision_events")
    op.drop_table("ended_conversations")
