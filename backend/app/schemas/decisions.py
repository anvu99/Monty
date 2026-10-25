from typing import Literal
from uuid import UUID
from pydantic import BaseModel, Field, model_validator
from app.schemas.coaching import ConversationMessage
from app.schemas.ai import StrictOutput


class TranscriptMessage(ConversationMessage):
    id: str = Field(min_length=1, max_length=100)


class EndConversationRequest(BaseModel):
    conversation_id: UUID
    child_id: str = Field(min_length=1, max_length=100)
    messages: list[TranscriptMessage] = Field(min_length=1)

    @model_validator(mode="after")
    def unique_messages(self):
        if len({m.id for m in self.messages}) != len(self.messages):
            raise ValueError("Message IDs must be unique")
        if not any(m.role == "user" for m in self.messages):
            raise ValueError("Conversation must contain a child message")
        if sum(len(m.content.encode('utf-8')) for m in self.messages) > 250000:
            raise ValueError("Transcript exceeds storage limit")
        return self


class Evidence(StrictOutput):
    message_id: str = Field(min_length=1, max_length=100)
    quote: str = Field(min_length=1, max_length=500, pattern=r"\S")


class ExtractedDecision(StrictOutput):
    action: Literal["wait", "skip_purchase", "purchase", "save", "other"]
    outcome_status: Literal["commitment", "reported_completed"]
    situation: str = Field(min_length=1, max_length=400)
    goal_relationship: Literal["potentially_supportive", "potentially_conflicting", "unclear"]
    evidence: list[Evidence] = Field(min_length=1, max_length=5)
    supersedes_event_id: str | None = None


class ExtractionOutput(StrictOutput):
    decisions: list[ExtractedDecision] = Field(max_length=5)


class ExtractionStatus(BaseModel):
    conversation_id: str
    status: Literal["pending", "processing", "completed", "failed"]
    event_count: int
    error: str | None = None
