from sqlalchemy import Column, ForeignKey, Numeric, String
from sqlalchemy.orm import relationship

from app.models.base import BaseModel


class SavingsGoal(BaseModel):
    """
    Represents a child's savings target (e.g., Lego set, Skateboard).
    Tracks current balance against target and links to Nessie accounts.
    """
    __tablename__ = "savings_goals"

    child_id = Column(
        String,
        ForeignKey("children.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    nessie_account_id = Column(String(100), nullable=True)
    name = Column(String(100), nullable=False)
    
    # Numeric(10, 2) stores exact decimal currency without floating point drift
    target_amount = Column(Numeric(10, 2), nullable=False)
    current_amount = Column(Numeric(10, 2), default=0.0, nullable=False)
    weekly_contribution = Column(Numeric(10, 2), default=0.0, nullable=False)
    status = Column(String(20), default="active", nullable=False)  # active, completed, paused

    # Relationships
    child = relationship("Child", back_populates="goals")
