from pydantic import BaseModel, Field
from typing import Any


class ApiRiskFactor(BaseModel):
    factor: str
    contribution: float
    description: str


class ApiRiskScore(BaseModel):
    status: str = "assessed"
    risk_score: float | None = Field(default=None, ge=0, le=100)
    risk_level: str
    explanation: str | None = None
    factors: list[ApiRiskFactor] = Field(default_factory=list)
    timestamp: str | None = None


class ApiPrediction(BaseModel):
    type: str
    risk_level: str
    confidence: float
    message: str
    action_suggestion: str
    risk_window_start: str | None = None
    risk_window_end: str | None = None
    pattern_data: dict[str, Any] | None = None


class ApiActiveAlert(BaseModel):
    alert_id: str
    type: str
    risk_level: str
    confidence: float
    message: str
    action_suggestion: str | None = None


class ApiCheckRiskResponse(BaseModel):
    current_risk_score: ApiRiskScore
    predictions: list[ApiPrediction] = Field(default_factory=list)
    active_alerts: list[ApiActiveAlert] = Field(default_factory=list)


class DismissAlertResponse(BaseModel):
    status: str
    dismissed: bool


class DetectProductRequest(BaseModel):
    url: str | None = None
    product_name: str
    price: float
    currency: str = "USD"
    merchant: str
    child_id: str
    timestamp: str | None = None


class DetectProductResponse(BaseModel):
    alert_id: str | None = None
    should_alert: bool
    alert_type: str
    impulse_score: float
    risk_level: str
    factors: dict[str, float] = Field(default_factory=dict)
    message: str | None = None

