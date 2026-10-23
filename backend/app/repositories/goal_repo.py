from sqlalchemy.orm import Session
from app.models.goal import SavingsGoal
from app.repositories.base import BaseRepository


class GoalRepository(BaseRepository[SavingsGoal]):
    """Repository handling savings goals queries and mutations."""

    def __init__(self, db: Session):
        super().__init__(SavingsGoal, db)

    def get_by_child(self, child_id: str) -> list[SavingsGoal]:
        """Fetch all savings goals for a specific child."""
        return self.db.query(SavingsGoal).filter_by(child_id=child_id).all()

    def add_money(self, goal_id: str, amount: float) -> SavingsGoal | None:
        """Increment a goal's current saved balance."""
        goal = self.get(goal_id)
        if not goal:
            return None
        goal.current_amount = float(goal.current_amount) + amount
        self.db.commit()
        self.db.refresh(goal)
        return goal
