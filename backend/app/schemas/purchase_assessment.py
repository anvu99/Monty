from typing import Literal
from pydantic import Field
from app.schemas.ai import StrictOutput


class Quote(StrictOutput):
    conversation_id: str
    message_id: str
    quote: str = Field(min_length=1, max_length=1000)


class FinalAssessment(StrictOutput):
    decision: Literal["potentially_impulsive", "not_flagged", "insufficient_context"]
    explanation: str = Field(min_length=1, max_length=1000)
    evidence_refs: list[str] = Field(min_length=1, max_length=12)
    conversation_effect: Literal["supports_baseline", "contradicts_baseline", "mixed", "no_relevant_context"]
    conversation_explanation: str = Field(min_length=1, max_length=600)
    quotes: list[Quote] = Field(default_factory=list, max_length=8)


class ConversationSummary(StrictOutput):
    summary: str = Field(min_length=1, max_length=1200)
    quotes: list[Quote] = Field(default_factory=list, max_length=5)
