from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Index, JSON, Numeric, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship

from app.models.base import BaseModel


class ImpulseScore(BaseModel):
    """
    Records an impulse risk evaluation event.
    Stores the composite score and arbitrary feature breakdowns in JSONB.
    """
    __tablename__ = "impulse_scores"

    child_id = Column(
        String,
        ForeignKey("children.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    transaction_id = Column(String, ForeignKey("transactions.id", ondelete="CASCADE"), nullable=True, unique=True)
    product_name = Column(String(100), nullable=False)
    amount = Column(Numeric(10, 2), nullable=False)
    merchant_name = Column(String(100), nullable=False)
    merchant_category = Column(String(50), nullable=False)
    impulse_score = Column(Float, nullable=False)  # 0.0 to 100.0

    # JSONB for PostgreSQL (efficient indexed JSON), falling back to JSON for SQLite
    # Stores dynamic feature weights without requiring schema changes
    factors = Column(
        JSONB().with_variant(JSON, "sqlite"),
        default=dict,
        nullable=False,
    )

    alert_triggered = Column(Boolean, default=False, nullable=False)
    alert_type = Column(String(50), default="none", nullable=False)
    child_response = Column(String(50), nullable=True)  # paused, bought_anyway, dismissed
    timestamp = Column(DateTime(timezone=True), nullable=False, index=True)

    # Relationships
    child = relationship("Child", back_populates="impulse_scores")

    __table_args__ = (
        Index("ix_impulse_scores_child_id_timestamp", "child_id", "timestamp"),
    )
