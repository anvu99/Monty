from sqlalchemy import Column, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.models.base import BaseModel


class Child(BaseModel):
    """
    Represents a child within a family.
    A child sets savings goals, incurs transactions, and receives AI coaching from Monty.
    """
    __tablename__ = "children"

    family_id = Column(
        String,
        ForeignKey("families.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name = Column(String(50), nullable=False)
    age = Column(Integer, nullable=False)
    avatar = Column(String(50), default="fox", nullable=False)
    nessie_customer_id = Column(String(100), nullable=True)

    # Relationships
    family = relationship("Family", back_populates="children")
    
    # Financial & AI relationships (will link to models in Tasks 2.3 and 2.4)
    goals = relationship("SavingsGoal", back_populates="child", cascade="all, delete-orphan")
    transactions = relationship("Transaction", back_populates="child", cascade="all, delete-orphan")
    impulse_scores = relationship("ImpulseScore", back_populates="child", cascade="all, delete-orphan")
    memories = relationship("Memory", back_populates="child", cascade="all, delete-orphan")
    decision_logs = relationship("DecisionLog", back_populates="child", cascade="all, delete-orphan")
