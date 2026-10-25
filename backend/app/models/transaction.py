from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Index, Numeric, String
from sqlalchemy.orm import relationship

from app.models.base import BaseModel


class Transaction(BaseModel):
    """
    Represents financial debits and credits for a child.
    Includes temporal indexing optimized for LSTM sequence modeling.
    """
    __tablename__ = "transactions"

    child_id = Column(
        String,
        ForeignKey("children.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    nessie_purchase_id = Column(String(100), nullable=True)
    amount = Column(Numeric(10, 2), nullable=False)
    merchant_name = Column(String(100), nullable=False)
    merchant_category = Column(String(50), nullable=False, index=True)
    description = Column(String(255), nullable=True)
    source = Column(String(20), nullable=False, default="legacy", server_default="legacy")
    currency = Column(String(3), nullable=True)
    
    # Exact transaction timestamp with timezone
    timestamp = Column(DateTime(timezone=True), nullable=False, index=True)
    
    is_deposit = Column(Boolean, default=False, nullable=False)
    is_impulsive = Column(Boolean, default=False, nullable=False)

    # Relationships
    child = relationship("Child", back_populates="transactions")

    # Composite Index: critical for LSTM sequence queries
    # SELECT * FROM transactions WHERE child_id = X ORDER BY timestamp ASC
    __table_args__ = (
        Index("ix_transactions_child_id_timestamp", "child_id", "timestamp"),
    )
