from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.goals import (
    AddMoneyRequest,
    ApiSavingsGoal,
    GoalCreateRequest,
    GoalsListResponse,
    GoalUpdateRequest,
)
from app.services.goal_service import GoalService

router = APIRouter()


@router.get("/child/{child_id}/goals", response_model=GoalsListResponse)
def get_child_goals(
    child_id: str, db: Session = Depends(get_db)
) -> GoalsListResponse:
    """Fetch active savings goals for a child from cloud database."""
    service = GoalService(db)
    goals = service.get_child_goals(child_id)
    return GoalsListResponse(goals=goals)


@router.post("/child/{child_id}/goals", response_model=ApiSavingsGoal)
def create_goal(
    child_id: str, payload: GoalCreateRequest, db: Session = Depends(get_db)
) -> ApiSavingsGoal:
    """Create a new savings goal in cloud database."""
    service = GoalService(db)
    return service.create_goal(child_id, payload)


@router.post("/child/{child_id}/goals/{goal_id}", response_model=ApiSavingsGoal)
def update_goal(
    child_id: str,
    goal_id: str,
    payload: GoalUpdateRequest,
    db: Session = Depends(get_db),
) -> ApiSavingsGoal:
    """Update goal fields in database."""
    service = GoalService(db)
    return service.update_goal(child_id, goal_id, payload)


@router.post("/child/{child_id}/goals/{goal_id}/add-money", response_model=ApiSavingsGoal)
def add_money_to_goal(
    child_id: str,
    goal_id: str,
    payload: AddMoneyRequest,
    db: Session = Depends(get_db),
) -> ApiSavingsGoal:
    """Increment goal balance and evaluate completion status."""
    service = GoalService(db)
    return service.add_money(child_id, goal_id, payload.amount)
