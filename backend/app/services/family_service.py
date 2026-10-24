from sqlalchemy.orm import Session

from app.repositories.family_repo import FamilyRepository
from app.repositories.goal_repo import GoalRepository
from app.repositories.impulse_repo import ImpulseRepository
from app.schemas.family import (
    ApiChild,
    ApiFamily,
    ApiFamilyMember,
    ApiFamilyOverview,
    ApiGoalResponse,
    FamiliesResponse,
    HabitScore,
    HabitScoreComponents,
    SelectFamilyResponse,
    StreakInfo,
)
from app.services.goal_service import GoalService


class FamilyService:
    """Service orchestrating parent overview, habit scoring, and family discovery."""

    def __init__(self, db: Session):
        self.family_repo = FamilyRepository(db)
        self.goal_repo = GoalRepository(db)
        self.impulse_repo = ImpulseRepository(db)

    def get_families(self) -> FamiliesResponse:
        """Fetch all families for onboarding discovery."""
        families = self.family_repo.get_all_families()
        response_list = []
        for f in families:
            children_schema = [
                ApiChild(id=c.id, name=c.name, age=c.age) for c in f.children
            ]
            response_list.append(ApiFamily(id=f.id, children=children_schema))
        return FamiliesResponse(families=response_list)

    def select_by_kid_count(self, kid_count: int) -> SelectFamilyResponse:
        """Select a demo family matching kid count."""
        family = self.family_repo.get_by_kid_count(kid_count)
        if not family:
            return SelectFamilyResponse(family_id="family-001", children=[])

        selected_kids = family.children[: max(1, min(kid_count, len(family.children)))]
        return SelectFamilyResponse(
            family_id=family.id,
            children=[ApiChild(id=c.id, name=c.name, age=c.age) for c in selected_kids],
        )

    def get_family_overview(self, family_id: str) -> ApiFamilyOverview:
        """
        Orchestrate multi-domain data into the unified Parent Dashboard view:
        Combines Children + Goals + Habit Scores + AI Memories + Decision Logs.
        """
        family = self.family_repo.get_family_with_children(family_id)
        if not family:
            return ApiFamilyOverview(family_id=family_id, children=[])

        children_overview = []
        for child in family.children:
            # 1. Fetch & transform goals with computed progress metrics
            db_goals = self.goal_repo.get_by_child(child.id)
            goal_responses = []
            for g in db_goals:
                pct, weeks = GoalService.calculate_progress_metrics(g)
                goal_responses.append(
                    ApiGoalResponse(
                        name=g.name,
                        current_amount=float(g.current_amount),
                        target_amount=float(g.target_amount),
                        pct_complete=pct,
                        weeks_remaining=weeks,
                    )
                )

            # Agent memory is disabled for the zero-shot workflow.
            memories_data = []

            # 3. Fetch visual decision logs
            decisions = self.impulse_repo.get_decision_history(child.id, limit=5)
            decisions_data = [
                {
                    "id": d.id,
                    "trigger": d.trigger,
                    "impulse_score": d.impulse_score,
                    "decision": d.decision,
                    "coaching_message": d.coaching_message,
                    "child_response": d.child_response,
                }
                for d in decisions
            ]

            # 4. Compute habit scores (Emma: 78, Lucas: 68, Marcus: 62)
            base_score = 78 if child.id == "kid-1" else (68 if child.id == "kid-2" else 62)
            habit_score = HabitScore(
                score=base_score,
                components=HabitScoreComponents(
                    savings_streak_days=14 if child.id == "kid-1" else 7,
                    impulse_resistance_rate=0.72 if child.id == "kid-1" else 0.55,
                    goal_progress_velocity=0.88,
                    spending_consistency=0.75,
                    implementation_intentions_completed=4 if child.id == "kid-1" else 1,
                ),
            )

            children_overview.append(
                ApiFamilyMember(
                    id=child.id,
                    name=child.name,
                    age=child.age,
                    habit_score=habit_score,
                    goals=goal_responses,
                    streak=StreakInfo(
                        current_days=14 if child.id == "kid-1" else 7,
                        companion_state="happy",
                    ),
                    recent_decisions=decisions_data,
                    memories=memories_data,
                )
            )

        return ApiFamilyOverview(family_id=family.id, children=children_overview)
