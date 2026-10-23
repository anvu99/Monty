from pydantic import BaseModel, Field
from typing import Any
from app.schemas.analytics import ApiImpulseScore


class ApiMemory(BaseModel):
    id: str
    child_id: str
    created_at: str
    memory_type: str
    content: str
    category: str | None = None
    merchant_name: str | None = None
    suppress_alerts: bool = False
    suppress_until: str | None = None
    confidence: float | None = None


class MemoriesResponse(BaseModel):
    memories: list[ApiMemory]


class ApiDecisionLog(BaseModel):
    id: str
    timestamp: str
    trigger: str
    impulse_score: float | None = None
    decision: str
    coaching_message: str | None = None
    ai_justification: str | None = None
    child_response: str | None = None
    factors: dict[str, Any] = Field(default_factory=dict)
    pipeline_nodes: Any = None
    pipeline_edges: Any = None


class DecisionLogResponse(BaseModel):
    latest: ApiDecisionLog | None = None
    history: list[ApiDecisionLog] = Field(default_factory=list)


class ChatRequest(BaseModel):
    child_id: str
    message: str
    context: str | None = None


class SuggestedIntention(BaseModel):
    trigger_situation: str
    planned_action: str


class ApiChatResponse(BaseModel):
    message: str
    suggested_intention: SuggestedIntention | None = None
    memory_updated: bool = False


class ProactivePredictionItem(BaseModel):
    item: str
    merchant: str
    amount: float
    confidence: float


class ApiProactiveNudge(BaseModel):
    has_nudge: bool
    message: str | None = None
    saving_tip: str | None = None
    prediction: ProactivePredictionItem | None = None


class CreateIntentionRequest(BaseModel):
    trigger_situation: str
    planned_action: str


class ApiIntention(BaseModel):
    id: str
    child_id: str
    trigger_situation: str
    planned_action: str
    status: str = "active"
    success_count: int = 0
    total_triggered: int = 0


class ApiIntentionSuggestion(BaseModel):
    trigger_situation: str
    planned_action: str


class IntentionsResponse(BaseModel):
    intentions: list[ApiIntention]
    suggestions: list[ApiIntentionSuggestion] = Field(default_factory=list)


class ApiLiveFeed(BaseModel):
    new_impulse_scores: list[ApiImpulseScore] = Field(default_factory=list)
    proactive_predictions: list[dict[str, Any]] = Field(default_factory=list)
    should_wait: bool = False
    wait_message: str | None = None
    wait_duration_seconds: int | None = None
