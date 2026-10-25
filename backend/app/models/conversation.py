from sqlalchemy import Column, DateTime, ForeignKey, Integer, JSON, String, Text, UniqueConstraint
from app.models.base import BaseModel


class EndedConversation(BaseModel):
    __tablename__ = "ended_conversations"
    child_id = Column(String, ForeignKey("children.id", ondelete="CASCADE"), nullable=False, index=True)
    transcript = Column(JSON, nullable=False)
    facts = Column(JSON, nullable=False)
    transcript_hash = Column(String(64), nullable=False)
    status = Column(String(20), nullable=False, default="pending", index=True)
    attempts = Column(Integer, nullable=False, default=0)
    processing_started_at = Column(DateTime(timezone=True), nullable=True)
    error = Column(Text, nullable=True)


class DecisionEvent(BaseModel):
    __tablename__ = "decision_events"
    child_id = Column(String, ForeignKey("children.id", ondelete="CASCADE"), nullable=False, index=True)
    conversation_id = Column(String, ForeignKey("ended_conversations.id", ondelete="CASCADE"), nullable=False)
    action = Column(String(40), nullable=False)
    outcome_status = Column(String(20), nullable=False)
    source = Column(String(30), nullable=False, default="child_self_report")
    situation = Column(String(400), nullable=False)
    goal_relationship = Column(String(30), nullable=False)
    evidence = Column(JSON, nullable=False)
    occurred_at = Column(DateTime(timezone=True), nullable=False)
    status = Column(String(20), nullable=False, default="active")
    supersedes_event_id = Column(String, ForeignKey("decision_events.id", ondelete="SET NULL"), nullable=True)
    fingerprint = Column(String(64), nullable=False)
    extractor_version = Column(String(100), nullable=False)
    __table_args__ = (UniqueConstraint("conversation_id", "fingerprint"),)
