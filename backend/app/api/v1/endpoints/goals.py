import uuid
from datetime import datetime, timezone
from fastapi import APIRouter
from app.schemas.goals import (
    GoalsListResponse,
    ApiSavingsGoal,
    GoalCreateRequest,
    GoalUpdateRequest,
    AddMoneyRequest,
)

router = APIRouter()

# In-memory stub database for dynamic testing during Phase 1
MOCK_GOALS_DB: dict[str, list[ApiSavingsGoal]] = {
    "kid-1": [
        ApiSavingsGoal(
            id="goal-1",
            child_id="kid-1",
            nessie_account_id="nessie-acc-emma",
            name="Skateboard",
            target_amount=120.0,
            current_amount=68.0,
            weekly_contribution=10.0,
            created_at=datetime.now(timezone.utc).isoformat(),
        ),
        ApiSavingsGoal(
            id="goal-2",
            child_id="kid-1",
            nessie_account_id="nessie-acc-emma",
            name="Science Camp",
            target_amount=200.0,
            current_amount=140.0,
            weekly_contribution=15.0,
            created_at=datetime.now(timezone.utc).isoformat(),
        ),
    ],
    "kid-2": [
        ApiSavingsGoal(
            id="goal-3",
            child_id="kid-2",
            nessie_account_id="nessie-acc-lucas",
            name="Lego Space Shuttle",
            target_amount=80.0,
            current_amount=35.0,
            weekly_contribution=8.0,
            created_at=datetime.now(timezone.utc).isoformat(),
        )
    ],
}


@router.get("/child/{child_id}/goals", response_model=GoalsListResponse)
def get_child_goals(child_id: str) -> GoalsListResponse:
    """Fetch savings goals for a specific child."""
    goals = MOCK_GOALS_DB.get(child_id, [])
    return GoalsListResponse(goals=goals)


@router.post("/child/{child_id}/goals", response_model=ApiSavingsGoal)
def create_goal(child_id: str, payload: GoalCreateRequest) -> ApiSavingsGoal:
    """Create a new savings goal for a child."""
    new_goal = ApiSavingsGoal(
        id=f"goal-{uuid.uuid4().hex[:6]}",
        child_id=child_id,
        nessie_account_id=f"nessie-acc-{child_id}",
        name=payload.name,
        target_amount=payload.target_amount,
        current_amount=0.0,
        weekly_contribution=payload.weekly_contribution,
        created_at=datetime.now(timezone.utc).isoformat(),
    )
    if child_id not in MOCK_GOALS_DB:
        MOCK_GOALS_DB[child_id] = []
    MOCK_GOALS_DB[child_id].append(new_goal)
    return new_goal


@router.post("/child/{child_id}/goals/{goal_id}", response_model=ApiSavingsGoal)
def update_goal(
    child_id: str, goal_id: str, payload: GoalUpdateRequest
) -> ApiSavingsGoal:
    """Update goal attributes (name, target, contribution)."""
    goals = MOCK_GOALS_DB.get(child_id, [])
    for goal in goals:
        if goal.id == goal_id:
            if payload.name is not None:
                goal.name = payload.name
            if payload.target_amount is not None:
                goal.target_amount = payload.target_amount
            if payload.weekly_contribution is not None:
                goal.weekly_contribution = payload.weekly_contribution
            return goal

    # Fallback if not found in stub
    return ApiSavingsGoal(
        id=goal_id,
        child_id=child_id,
        name=payload.name or "Updated Goal",
        target_amount=payload.target_amount or 100.0,
        current_amount=50.0,
        weekly_contribution=payload.weekly_contribution or 10.0,
        created_at=datetime.now(timezone.utc).isoformat(),
    )


@router.post("/child/{child_id}/goals/{goal_id}/add-money", response_model=ApiSavingsGoal)
def add_money_to_goal(
    child_id: str, goal_id: str, payload: AddMoneyRequest
) -> ApiSavingsGoal:
    """Add money to an active savings goal."""
    goals = MOCK_GOALS_DB.get(child_id, [])
    for goal in goals:
        if goal.id == goal_id:
            goal.current_amount += payload.amount
            return goal

    return ApiSavingsGoal(
        id=goal_id,
        child_id=child_id,
        name="Skateboard",
        target_amount=120.0,
        current_amount=payload.amount,
        weekly_contribution=10.0,
        created_at=datetime.now(timezone.utc).isoformat(),
    )
