from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class StrictOutput(BaseModel):
    model_config = ConfigDict(extra="forbid")


class IntentionSuggestion(StrictOutput):
    trigger_situation: str = Field(min_length=1, max_length=250)
    planned_action: str = Field(min_length=1, max_length=250)


class CoachingOutput(StrictOutput):
    message: str = Field(min_length=1, max_length=1500)
    suggested_intention: IntentionSuggestion | None = None
    evidence_refs: list[str] = Field(default_factory=list, max_length=10)


class InsightsOutput(StrictOutput):
    insights: list[str] = Field(max_length=5)
    evidence_refs: list[str] = Field(default_factory=list, max_length=10)


class SuggestionsOutput(StrictOutput):
    suggestions: list[IntentionSuggestion] = Field(max_length=3)
    evidence_refs: list[str] = Field(default_factory=list, max_length=10)


class NudgeOutput(StrictOutput):
    has_nudge: bool
    message: str | None = Field(default=None, max_length=600)
    saving_tip: str | None = Field(default=None, max_length=400)
    evidence_refs: list[str] = Field(default_factory=list, max_length=10)

    @model_validator(mode="after")
    def consistent(self):
        if self.has_nudge and (not self.message or not self.evidence_refs):
            raise ValueError("Nudges require a message and evidence")
        if not self.has_nudge and (self.message or self.saving_tip):
            raise ValueError("Absent nudges must have no message or tip")
        return self


class RiskFactor(StrictOutput):
    factor: str = Field(min_length=1, max_length=100)
    contribution: float = Field(ge=0, le=1)
    description: str = Field(min_length=1, max_length=400)
    evidence_refs: list[str] = Field(min_length=1, max_length=5)


class RiskOutput(StrictOutput):
    status: Literal["assessed", "insufficient_data"]
    risk_score: float | None = Field(default=None, ge=0, le=100)
    factors: list[RiskFactor] = Field(default_factory=list, max_length=5)
    explanation: str = Field(min_length=1, max_length=1000)
    pause_suggestion: str | None = Field(default=None, max_length=400)

    @model_validator(mode="after")
    def consistent(self):
        if self.status == "assessed" and (self.risk_score is None or not self.factors):
            raise ValueError("Assessment needs a score and evidence-backed factors")
        if self.status == "insufficient_data" and (self.risk_score is not None or self.factors):
            raise ValueError("Insufficient data must not have a score or factors")
        return self


class PurchaseRequest(BaseModel):
    prompt: str = Field(default="Help me decide whether to buy this item.", min_length=1, max_length=1000)
    child_id: str = Field(min_length=1, max_length=100)
    product: str = Field(min_length=1, max_length=150)
    merchant: str = Field(min_length=1, max_length=100)
    category: str = Field(min_length=1, max_length=80)
    amount: Decimal = Field(gt=0, max_digits=10, decimal_places=2)
    currency: str = Field(pattern=r"^[A-Z]{3}$")
    timestamp: datetime

    @field_validator("timestamp")
    @classmethod
    def timezone_required(cls, value):
        if value.tzinfo is None:
            raise ValueError("Timestamp must include a timezone")
        return value


class PurchaseAssessment(RiskOutput):
    assessment_id: str
    timestamp: str
    risk_level: Literal["LOW", "MEDIUM", "HIGH", "UNKNOWN"]
