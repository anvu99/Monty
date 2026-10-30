from sqlalchemy import Column, DateTime, ForeignKey, JSON, String, Text
from app.models.base import BaseModel


class PurchaseAssessmentJob(BaseModel):
    __tablename__ = "purchase_assessments"
    transaction_id = Column(String, ForeignKey("transactions.id", ondelete="CASCADE"), nullable=False, unique=True)
    status = Column(String(20), nullable=False, default="pending", index=True)
    snapshot = Column(JSON, nullable=False)
    baseline = Column(JSON, nullable=True)
    final_assessment = Column(JSON, nullable=True)
    summaries = Column(JSON, nullable=False, default=dict)
    attempts = Column(JSON, nullable=False, default=dict)
    stage = Column(String(30), nullable=False, default="baseline")
    processing_started_at = Column(DateTime(timezone=True), nullable=True)
    next_attempt_at = Column(DateTime(timezone=True), nullable=True)
    error = Column(Text, nullable=True)
    model_version = Column(String(100), nullable=False)
    prompt_version = Column(String(100), nullable=False)


class PurchaseNotification(BaseModel):
    __tablename__ = "purchase_notifications"
    transaction_id = Column(String, ForeignKey("transactions.id", ondelete="CASCADE"), nullable=False, unique=True)
    assessment_id = Column(String, ForeignKey("purchase_assessments.id", ondelete="CASCADE"), nullable=False)
    family_id = Column(String, ForeignKey("families.id", ondelete="CASCADE"), nullable=False, index=True)
    details = Column(JSON, nullable=False)
    read_at = Column(DateTime(timezone=True), nullable=True)
