from pydantic import BaseModel, Field
from typing import Any


class CategoryStats(BaseModel):
    sum: float
    count: int
    mean: float


class WeeklyTrendItem(BaseModel):
    week: str
    total: float


class ImpulseIndicators(BaseModel):
    evening_pct: float
    weekend_pct: float


class ApiSpending(BaseModel):
    child_id: str | None = None
    categories: dict[str, CategoryStats] = Field(default_factory=dict)
    weekly_trend: list[WeeklyTrendItem] = Field(default_factory=list)
    bursts: list[Any] = Field(default_factory=list)
    recurring: list[Any] = Field(default_factory=list)
    impulse_indicators: ImpulseIndicators | None = None


class InsightsResponse(BaseModel):
    insights: list[str]


class ApiTransaction(BaseModel):
    id: str
    child_id: str
    timestamp: str
    merchant_name: str
    merchant_category: str
    description: str | None = None
    amount: float


class TransactionsResponse(BaseModel):
    transactions: list[ApiTransaction]
    has_more: bool


class ApiFamilyPurchase(ApiTransaction):
    child_name: str


class FamilyPurchasesResponse(BaseModel):
    purchases: list[ApiFamilyPurchase]
    has_more: bool


class ApiStreak(BaseModel):
    id: str | None = None
    child_id: str | None = None
    current_days: int
    longest_days: int
    last_updated: str | None = None
    last_reset_date: str | None = None
    companion_state: str = "happy"


class ImpulseFactor(BaseModel):
    value: str
    impulse_weight: float


class ApiImpulseScore(BaseModel):
    id: str
    child_id: str
    timestamp: str
    product_name: str
    amount: float
    merchant_name: str
    merchant_category: str
    impulse_score: float
    factors: dict[str, ImpulseFactor] = Field(default_factory=dict)
    alert_triggered: bool = False
    alert_type: str = "none"
    child_response: str | None = None
