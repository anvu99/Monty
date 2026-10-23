from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, String
from sqlalchemy.orm import relationship

from app.models.base import BaseModel


class Memory(BaseModel):
    """
    Episodic memory store for the Monty AI agent.
    Maintains long-term context about child preferences, past triggers, and habits.
    """
    __tablename__ = "memories"

    child_id = Column(
        String,
        ForeignKey("children.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    memory_type = Column(String(50), nullable=False)  # preference, impulse_trigger, context
    content = Column(String(500), nullable=False)
    category = Column(String(50), nullable=True)
    merchant_name = Column(String(100), nullable=True)
    
    # Allows AI or parent to temporarily suppress alerts for legitimate expected purchases
    suppress_alerts = Column(Boolean, default=False, nullable=False)
    suppress_until = Column(DateTime(timezone=True), nullable=True)
    
    # Confidence score from the LLM extraction
    confidence = Column(Float, default=1.0, nullable=False)

    # Relationships
    child = relationship("Child", back_populates="memories")
