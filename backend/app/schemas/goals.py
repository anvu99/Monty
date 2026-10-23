from pydantic import BaseModel, Field


class GoalCreateRequest(BaseModel):
    name: str
    target_amount: float
    weekly_contribution: float = 0.0


class GoalUpdateRequest(BaseModel):
    name: str | None = None
    target_amount: float | None = None
    weekly_contribution: float | None = None


class AddMoneyRequest(BaseModel):
    amount: float


class ApiSavingsGoal(BaseModel):
    id: str
    child_id: str
    nessie_account_id: str = "mock-nessie-acc"
    name: str
    target_amount: float
    current_amount: float
    weekly_contribution: float
    created_at: str


class GoalsListResponse(BaseModel):
    goals: list[ApiSavingsGoal]
