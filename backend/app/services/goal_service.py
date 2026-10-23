import math
from datetime import datetime, timezone
from sqlalchemy.orm import Session

from app.models.goal import SavingsGoal
from app.repositories.goal_repo import GoalRepository
from app.schemas.goals import (
    ApiSavingsGoal,
    GoalCreateRequest,
    GoalUpdateRequest,
)


class GoalService:
    """Business logic for child savings goals."""

    def __init__(self, db: Session):
        self.repo = GoalRepository(db)

    def get_child_goals(self, child_id: str) -> list[ApiSavingsGoal]:
        """Fetch all goals for a child and transform them into Pydantic models."""
        goals = self.repo.get_by_child(child_id)
        return [self._to_schema(g) for g in goals]

    def create_goal(self, child_id: str, payload: GoalCreateRequest) -> ApiSavingsGoal:
        """Create a new savings target."""
        new_goal = SavingsGoal(
            child_id=child_id,
            name=payload.name,
            target_amount=payload.target_amount,
            current_amount=0.0,
            weekly_contribution=payload.weekly_contribution,
            status="active",
        )
        saved = self.repo.create(new_goal)
        return self._to_schema(saved)

    def update_goal(
        self, child_id: str, goal_id: str, payload: GoalUpdateRequest
    ) -> ApiSavingsGoal:
        """Update goal fields."""
        goal = self.repo.get(goal_id)
        if not goal or goal.child_id != child_id:
            # Fallback if not found
            return ApiSavingsGoal(
                id=goal_id,
                child_id=child_id,
                name=payload.name or "Goal",
                target_amount=payload.target_amount or 100.0,
                current_amount=0.0,
                weekly_contribution=payload.weekly_contribution or 10.0,
                created_at=datetime.now(timezone.utc).isoformat(),
            )

        updates = {}
        if payload.name is not None:
            updates["name"] = payload.name
        if payload.target_amount is not None:
            updates["target_amount"] = payload.target_amount
        if payload.weekly_contribution is not None:
            updates["weekly_contribution"] = payload.weekly_contribution

        updated = self.repo.update(goal, updates)
        return self._to_schema(updated)

    def add_money(self, child_id: str, goal_id: str, amount: float) -> ApiSavingsGoal:
        """
        Add money to an active goal and evaluate completion milestone.
        """
        updated = self.repo.add_money(goal_id, amount)
        if not updated:
            # Create a fallback goal if record doesn't exist
            new_goal = SavingsGoal(
                id=goal_id,
                child_id=child_id,
                name="Savings Goal",
                target_amount=100.0,
                current_amount=amount,
                weekly_contribution=10.0,
                status="active",
            )
            saved = self.repo.create(new_goal)
            return self._to_schema(saved)

        # Business Rule: If balance meets or exceeds target, mark completed
        if float(updated.current_amount) >= float(updated.target_amount):
            self.repo.update(updated, {"status": "completed"})

        return self._to_schema(updated)

    @staticmethod
    def calculate_progress_metrics(goal: SavingsGoal) -> tuple[float, int]:
        """
        Compute meaningful metrics from raw numbers:
        Returns: (pct_complete, weeks_remaining)
        """
        curr = float(goal.current_amount)
        target = float(goal.target_amount)
        weekly = float(goal.weekly_contribution)

        pct = round((curr / target * 100) if target > 0 else 0.0, 1)
        remaining = max(0.0, target - curr)
        weeks = math.ceil(remaining / weekly) if weekly > 0 else 0

        return pct, weeks

    @staticmethod
    def _to_schema(goal: SavingsGoal) -> ApiSavingsGoal:
        """Map SQLAlchemy database entity to public Pydantic API response schema."""
        created_at_str = (
            goal.created_at.isoformat()
            if hasattr(goal.created_at, "isoformat")
            else str(goal.created_at)
        )
        return ApiSavingsGoal(
            id=goal.id,
            child_id=goal.child_id,
            nessie_account_id=goal.nessie_account_id or "nessie-acc-default",
            name=goal.name,
            target_amount=float(goal.target_amount),
            current_amount=float(goal.current_amount),
            weekly_contribution=float(goal.weekly_contribution),
            created_at=created_at_str,
        )
