from fastapi import APIRouter
from app.schemas.family import (
    FamiliesResponse,
    SelectFamilyResponse,
    ApiFamilyOverview,
    ApiFamily,
    ApiChild,
    ApiFamilyMember,
    HabitScore,
    HabitScoreComponents,
    StreakInfo,
    ApiGoalResponse,
)

router = APIRouter()

MOCK_CHILDREN = [
    ApiChild(id="kid-1", name="Emma", age=10),
    ApiChild(id="kid-2", name="Lucas", age=7),
]

MOCK_FAMILIES = [
    ApiFamily(id="family-001", children=MOCK_CHILDREN),
]


@router.get("/families", response_model=FamiliesResponse)
def get_families() -> FamiliesResponse:
    """Fetch list of available demo families."""
    return FamiliesResponse(families=MOCK_FAMILIES)


@router.get("/families/select-by-kid-count/{kid_count}", response_model=SelectFamilyResponse)
def select_family_by_kid_count(kid_count: int) -> SelectFamilyResponse:
    """Select a demo family matching the requested number of children."""
    selected_kids = MOCK_CHILDREN[:max(1, min(kid_count, len(MOCK_CHILDREN)))]
    return SelectFamilyResponse(family_id="family-001", children=selected_kids)


@router.get("/family/{family_id}/overview", response_model=ApiFamilyOverview)
def get_family_overview(family_id: str) -> ApiFamilyOverview:
    """Fetch parent dashboard summary overview for a family."""
    emma = ApiFamilyMember(
        id="kid-1",
        name="Emma",
        age=10,
        habit_score=HabitScore(
            score=78,
            components=HabitScoreComponents(
                savings_streak_days=14,
                impulse_resistance_rate=0.72,
                goal_progress_velocity=0.90,
                spending_consistency=0.75,
                implementation_intentions_completed=4,
            ),
        ),
        goals=[
            ApiGoalResponse(
                name="Skateboard",
                current_amount=68.0,
                target_amount=120.0,
                pct_complete=56.7,
                weeks_remaining=4,
            ),
            ApiGoalResponse(
                name="Science Camp",
                current_amount=140.0,
                target_amount=200.0,
                pct_complete=70.0,
                weeks_remaining=3,
            ),
        ],
        streak=StreakInfo(current_days=14, companion_state="happy"),
        recent_decisions=[],
        memories=[],
    )

    lucas = ApiFamilyMember(
        id="kid-2",
        name="Lucas",
        age=7,
        habit_score=HabitScore(
            score=68,
            components=HabitScoreComponents(
                savings_streak_days=7,
                impulse_resistance_rate=0.60,
                goal_progress_velocity=0.70,
                spending_consistency=0.65,
                implementation_intentions_completed=2,
            ),
        ),
        goals=[
            ApiGoalResponse(
                name="Lego Space Shuttle",
                current_amount=35.0,
                target_amount=80.0,
                pct_complete=43.8,
                weeks_remaining=5,
            )
        ],
        streak=StreakInfo(current_days=7, companion_state="curious"),
        recent_decisions=[],
        memories=[],
    )

    return ApiFamilyOverview(family_id=family_id, children=[emma, lucas])
