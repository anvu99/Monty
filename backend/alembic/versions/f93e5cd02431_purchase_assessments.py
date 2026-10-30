"""Durable completed-purchase assessments and family notifications."""
from alembic import op
import sqlalchemy as sa

revision = "f93e5cd02431"
down_revision = "e82d4bc91320"
branch_labels = None
depends_on = None


def upgrade():
    common = lambda: [sa.Column("id", sa.String(), primary_key=True),
                      sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
                      sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False)]
    op.create_table("purchase_assessments", *common(),
        sa.Column("transaction_id", sa.String(), sa.ForeignKey("transactions.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("status", sa.String(20), nullable=False), sa.Column("snapshot", sa.JSON(), nullable=False),
        sa.Column("baseline", sa.JSON()), sa.Column("final_assessment", sa.JSON()),
        sa.Column("summaries", sa.JSON(), nullable=False), sa.Column("attempts", sa.JSON(), nullable=False),
        sa.Column("stage", sa.String(30), nullable=False), sa.Column("processing_started_at", sa.DateTime(timezone=True)),
        sa.Column("next_attempt_at", sa.DateTime(timezone=True)), sa.Column("error", sa.Text()),
        sa.Column("model_version", sa.String(100), nullable=False), sa.Column("prompt_version", sa.String(100), nullable=False))
    op.create_index("ix_purchase_assessments_status", "purchase_assessments", ["status"])
    op.create_table("purchase_notifications", *common(),
        sa.Column("transaction_id", sa.String(), sa.ForeignKey("transactions.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("assessment_id", sa.String(), sa.ForeignKey("purchase_assessments.id", ondelete="CASCADE"), nullable=False),
        sa.Column("family_id", sa.String(), sa.ForeignKey("families.id", ondelete="CASCADE"), nullable=False),
        sa.Column("details", sa.JSON(), nullable=False), sa.Column("read_at", sa.DateTime(timezone=True)))
    op.create_index("ix_purchase_notifications_family_id", "purchase_notifications", ["family_id"])
    with op.batch_alter_table("impulse_scores") as batch:
        batch.add_column(sa.Column("transaction_id", sa.String(), nullable=True))
        batch.create_foreign_key("fk_impulse_transaction", "transactions", ["transaction_id"], ["id"], ondelete="CASCADE")
        batch.create_unique_constraint("uq_impulse_transaction", ["transaction_id"])


def downgrade():
    with op.batch_alter_table("impulse_scores") as batch:
        batch.drop_constraint("uq_impulse_transaction", type_="unique")
        batch.drop_constraint("fk_impulse_transaction", type_="foreignkey")
        batch.drop_column("transaction_id")
    op.drop_table("purchase_notifications")
    op.drop_table("purchase_assessments")
