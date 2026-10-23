from pydantic import BaseModel, Field
from typing import Any


class ApiChild(BaseModel):
    id: str
    name: str
    age: int


class ApiFamily(BaseModel):
    id: str
    children: list[ApiChild]


class FamiliesResponse(BaseModel):
    families: list[ApiFamily]


class SelectFamilyResponse(BaseModel):
    family_id: str
    children: list[ApiChild]


class ApiGoalResponse(BaseModel):
    name: str
    current_amount: float
    target_amount: float
    pct_complete: float | None = None
    weeks_remaining: int | None = None


class HabitScoreComponents(BaseModel):
    savings_streak_days: int = 0
    impulse_resistance_rate: float = 0.0
    goal_progress_velocity: float = 0.0
    spending_consistency: float = 0.0
    implementation_intentions_completed: int = 0


class HabitScore(BaseModel):
    score: int
    components: HabitScoreComponents


class StreakInfo(BaseModel):
    current_days: int
    companion_state: str = "happy"


class ApiFamilyMember(BaseModel):
    id: str
    name: str
    age: int
    habit_score: HabitScore
    goals: list[ApiGoalResponse] = Field(default_factory=list)
    streak: StreakInfo
    recent_decisions: list[dict[str, Any]] = Field(default_factory=list)
    memories: list[dict[str, Any]] = Field(default_factory=list)


class ApiFamilyOverview(BaseModel):
    family_id: str
    children: list[ApiFamilyMember]
