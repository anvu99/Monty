from sqlalchemy.orm import Session
from app.models.memory import Memory
from app.repositories.base import BaseRepository


class MemoryRepository(BaseRepository[Memory]):
    """Repository handling long-term episodic memories for the AI companion."""

    def __init__(self, db: Session):
        super().__init__(Memory, db)

    def get_memories(self, child_id: str) -> list[Memory]:
        """Fetch all long-term memories for a child."""
        return (
            self.db.query(Memory)
            .filter_by(child_id=child_id)
            .order_by(Memory.created_at.desc(), Memory.id.asc())
            .all()
        )

    def create_memory(
        self,
        child_id: str,
        content: str,
        memory_type: str = "preference",
        category: str | None = None,
        confidence: float = 1.0,
    ) -> Memory:
        """Create and store a newly observed memory."""
        memory = Memory(
            child_id=child_id,
            content=content,
            memory_type=memory_type,
            category=category,
            confidence=confidence,
        )
        return self.create(memory)
