from sqlalchemy import Column, ForeignKey, Index, Integer, JSON, String, UniqueConstraint
from app.models.base import BaseModel


class SemanticMemory(BaseModel):
    __tablename__ = "semantic_memories"
    child_id = Column(String, ForeignKey("children.id", ondelete="CASCADE"), nullable=False)
    memory_key = Column(String(80), nullable=False)
    name = Column(String(100), nullable=False)
    topic = Column(String(80), nullable=False)
    summary = Column(String(300), nullable=False)
    details = Column(String(600), nullable=True)
    status = Column(String(20), nullable=False, default="active")
    revision = Column(Integer, nullable=False)
    supersedes_id = Column(String, ForeignKey("semantic_memories.id", ondelete="SET NULL"), nullable=True)
    source_conversation_id = Column(String, ForeignKey("ended_conversations.id", ondelete="CASCADE"), nullable=False)
    evidence = Column(JSON, nullable=False)
    origin = Column(String(20), nullable=False, default="explicit")
    extractor_version = Column(String(100), nullable=False)
    __table_args__ = (
        UniqueConstraint("child_id", "memory_key", "revision", name="uq_semantic_memory_revision"),
        Index("ix_semantic_memories_child_status", "child_id", "status"),
    )
