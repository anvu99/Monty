from typing import Literal

from pydantic import Field, model_validator
from app.schemas.ai import StrictOutput

CoreKey = Literal["communication_style", "reminder_preference", "interests", "motivations"]


class Evidence(StrictOutput):
    message_id: str = Field(min_length=1, max_length=100)
    quote: str = Field(min_length=1, max_length=500, pattern=r"\S")


class CoreEntry(StrictOutput):
    value: str = Field(min_length=1, max_length=250, pattern=r"\S")
    conversation_id: str
    evidence: list[Evidence] = Field(min_length=1, max_length=5)
    updated_at: str


class CoreState(StrictOutput):
    schema_version: Literal[1] = 1
    revision: int = Field(default=0, ge=0)
    entries: dict[CoreKey, CoreEntry] = Field(default_factory=dict)


class CoreUpdate(StrictOutput):
    operation: Literal["upsert", "remove"]
    key: CoreKey
    value: str | None = Field(default=None, min_length=1, max_length=250, pattern=r"\S")
    evidence: list[Evidence] = Field(min_length=1, max_length=5)

    @model_validator(mode="after")
    def valid_value(self):
        if (self.operation == "upsert") != (self.value is not None):
            raise ValueError("Only an upsert must contain a value")
        return self


class SemanticUpdate(StrictOutput):
    operation: Literal["upsert", "retract"]
    memory_key: str = Field(min_length=1, max_length=80, pattern=r"^[a-z0-9]+(?:_[a-z0-9]+)*$")
    name: str | None = Field(default=None, min_length=1, max_length=100, pattern=r"\S")
    topic: str | None = Field(default=None, min_length=1, max_length=80, pattern=r"\S")
    summary: str | None = Field(default=None, min_length=1, max_length=300, pattern=r"\S")
    details: str | None = Field(default=None, max_length=600)
    origin: Literal["explicit"] = "explicit"
    evidence: list[Evidence] = Field(min_length=1, max_length=5)

    @model_validator(mode="after")
    def valid_fields(self):
        if self.operation == "upsert" and not all((self.name, self.topic, self.summary)):
            raise ValueError("Semantic upserts require name, topic, and summary")
        if self.operation == "retract" and any((self.name, self.topic, self.summary, self.details)):
            raise ValueError("Retractions identify an existing key without new content")
        return self


class PatternEvidence(Evidence):
    conversation_id: str = Field(min_length=1, max_length=100)


class PatternUpdate(StrictOutput):
    operation: Literal["upsert", "retract"]
    memory_key: str = Field(pattern=r"^pattern_[a-z0-9]+(?:_[a-z0-9]+)*$", max_length=80)
    name: str = Field(min_length=1, max_length=100)
    topic: str = Field(min_length=1, max_length=80)
    summary: str = Field(min_length=1, max_length=300)
    details: str | None = Field(default=None, max_length=600)
    supporting: list[PatternEvidence] = Field(default_factory=list, max_length=10)
    contradicting: list[PatternEvidence] = Field(default_factory=list, max_length=10)


class ConsolidationOutput(StrictOutput):
    updates: list[PatternUpdate] = Field(default_factory=list, max_length=5)
