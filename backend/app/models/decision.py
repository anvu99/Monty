from sqlalchemy import Column, DateTime, Float, ForeignKey, JSON, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship

from app.models.base import BaseModel


class DecisionLog(BaseModel):
    """
    Audit log of AI decision events.
    Stores the full visual flowchart graph (nodes and edges) for frontend rendering.
    """
    __tablename__ = "decision_logs"

    child_id = Column(
        String,
        ForeignKey("children.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    trigger = Column(String(255), nullable=False)
    impulse_score = Column(Float, nullable=True)
    decision = Column(String(50), nullable=False)  # NUDGE_PAUSE, ALLOW, BLOCK
    coaching_message = Column(String(500), nullable=True)
    ai_justification = Column(String(1000), nullable=True)
    child_response = Column(String(50), nullable=True)

    # Dynamic JSON data for model factors and visual decision tree
    factors = Column(
        JSONB().with_variant(JSON, "sqlite"),
        default=dict,
        nullable=False,
    )
    pipeline_nodes = Column(
        JSONB().with_variant(JSON, "sqlite"),
        default=list,
        nullable=True,
    )
    pipeline_edges = Column(
        JSONB().with_variant(JSON, "sqlite"),
        default=list,
        nullable=True,
    )

    timestamp = Column(DateTime(timezone=True), nullable=False, index=True)

    # Relationships
    child = relationship("Child", back_populates="decision_logs")
