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
    conversation_explanation: str = Field(min_length=1, max_length=600)
    quotes: list[Quote] = Field(default_factory=list, max_length=8)
    conversation_effect: Literal[
        "supports_baseline",
        "contradicts_baseline",
        "mixed",
        "no_relevant_context",
        "baseline_not_requested",
    ]
    historical_assessment_used: bool = False


class ConversationSummary(StrictOutput):
    summary: str = Field(min_length=1, max_length=1200)
    quotes: list[Quote] = Field(default_factory=list, max_length=5)


def assessment_provider_schema():
    """Portable Gemini schema; Pydantic remains authoritative for all limits.

    Function declarations use a smaller schema subset than native JSON output.
    Inline local references before removing definitions, and omit unsupported
    metadata/constraints rather than letting the integration silently drop them.
    """
    root = FinalAssessment.model_json_schema()
    supported = {"type", "properties", "items", "required", "enum", "description"}

    def convert(value, resolving=()):
        if isinstance(value, list):
            return [convert(item, resolving) for item in value]
        if not isinstance(value, dict):
            return value
        if "$ref" in value:
            reference = value["$ref"]
            if not reference.startswith("#/") or reference in resolving:
                raise ValueError("Unsupported recursive or external assessment schema reference")
            target = root
            for key in reference[2:].split("/"):
                target = target[key.replace("~1", "/").replace("~0", "~")]
            return convert(target, (*resolving, reference))
        result = {}
        for key, item in value.items():
            if key == "properties":
                result[key] = {name: convert(prop, resolving) for name, prop in item.items()}
            elif key in supported:
                result[key] = convert(item, resolving)
        return result

    return convert(root)
