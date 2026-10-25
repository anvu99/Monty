from datetime import datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import Field, model_validator
from app.schemas.ai import RiskFactor, StrictOutput


class DemoPurchaseRequest(StrictOutput):
    transaction_id: UUID
    child_id: str = Field(min_length=1, max_length=100, pattern=r"\S")
    product: str = Field(min_length=1, max_length=150, pattern=r"\S")
    merchant: str = Field(min_length=1, max_length=100, pattern=r"\S")
    category: str = Field(min_length=1, max_length=50, pattern=r"\S")
    amount: Decimal = Field(gt=0, max_digits=10, decimal_places=2)
    currency: Literal["USD"] = "USD"


class TransactionAssessment(StrictOutput):
    status: Literal["not_connected", "pending", "processing", "completed", "failed"]
    assessment_id: str | None = None
    outcome: Literal["assessed", "insufficient_data"] | None = None
    score: float | None = Field(default=None, ge=0, le=100)
    factors: list[RiskFactor] = Field(default_factory=list, max_length=5)
    explanation: str | None = Field(default=None, max_length=1000)
    error: str | None = Field(default=None, max_length=500)

    @model_validator(mode="after")
    def consistent(self):
        if self.status == "completed":
            if self.outcome is None:
                raise ValueError("Completed assessments require an outcome")
            if self.outcome == "assessed" and self.score is None:
                raise ValueError("Assessed outcomes require a score")
            if self.outcome == "insufficient_data" and (self.score is not None or self.factors):
                raise ValueError("Insufficient data cannot have a score or factors")
        elif self.outcome is not None or self.score is not None or self.factors:
            raise ValueError("Only completed assessments contain assessment results")
        return self


class DemoPurchaseResponse(StrictOutput):
    transaction_id: str
    child_id: str
    product: str
    merchant: str
    category: str
    amount: Decimal
    currency: Literal["USD"]
    timestamp: datetime
    source: Literal["demo"] = "demo"
    assessment: TransactionAssessment
