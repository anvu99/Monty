from datetime import datetime, timezone
from sqlalchemy.orm import Session
from app.models.impulse import ImpulseScore
from app.models.decision import DecisionLog
from app.repositories.base import BaseRepository


class ImpulseRepository(BaseRepository[ImpulseScore]):
    """Repository handling impulse risk scores and visual decision logs."""

    def __init__(self, db: Session):
        super().__init__(ImpulseScore, db)

    def get_scores(self, child_id: str, limit: int = 20) -> list[ImpulseScore]:
        """Fetch historical impulse risk scores for a child."""
        return (
            self.db.query(ImpulseScore)
            .filter_by(child_id=child_id)
            .order_by(ImpulseScore.timestamp.desc())
            .limit(limit)
            .all()
        )

    def get_latest_decision(self, child_id: str) -> DecisionLog | None:
        """Fetch the most recent AI intervention decision."""
        return (
            self.db.query(DecisionLog)
            .filter_by(child_id=child_id)
            .order_by(DecisionLog.timestamp.desc())
            .first()
        )

    def get_decision_history(self, child_id: str, limit: int = 20) -> list[DecisionLog]:
        """Fetch full chronological history of AI decision nodes."""
        return (
            self.db.query(DecisionLog)
            .filter_by(child_id=child_id)
            .order_by(DecisionLog.timestamp.desc())
            .limit(limit)
            .all()
        )
