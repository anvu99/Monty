"""Optional historical evidence for completed-purchase assessments."""

import asyncio
import json
import logging

from fastapi import HTTPException
from langchain.messages import HumanMessage, SystemMessage, ToolMessage
from langchain.tools import tool
from langchain_google_genai import ChatGoogleGenerativeAI
from pydantic import ValidationError

from app.core.ai import PERSONALITY, TASKS
from app.core.config import settings
from app.schemas.purchase_assessment import FinalAssessment, assessment_provider_schema


logger = logging.getLogger(__name__)

HISTORY_TOOL_DESCRIPTION = (
    "Get this purchase's ML baseline and historical financial evidence. "
    "Use when missing financial context or ambiguous/conflicting conversation "
    "evidence could change the assessment. This is supporting evidence, not a final decision."
)


def routing_tool_schemas():
    """Schemas shared by request binding and the worker's budget estimate."""
    return [
        {"name": "assess_historical_factors", "description": HISTORY_TOOL_DESCRIPTION,
         "parameters": {"type": "object", "properties": {}}},
        {"name": "submit_assessment",
         "description": "Submit the final assessment now when the supplied evidence is enough to decide, including insufficient_context when appropriate. Do not request hidden history in this submission.",
         "parameters": assessment_provider_schema()},
    ]


INITIAL_KEYS = (
    "profile",
    "core_memory",
    "semantic_memories",
    "decision_events",
    "purchase",
    "conversations",
)

HISTORY_KEYS = (
    "baseline",
    "coverage",
    "spending",
    "goals",
    "recent_purchases",
    "impulse_summary",
    "historical_assessments",
    "positive_decisions",
)


def references_for(context):
    """Return references only for evidence actually supplied."""
    refs = {
        key
        for key in (
            "profile", "purchase", "baseline",
            "coverage", "spending", "impulse_summary",
        )
        if key in context
    }

    for section in (
        "goals",
        "recent_purchases",
        "historical_assessments",
        "positive_decisions",
        "decision_events",
        "semantic_memories",
    ):
        refs.update(
            f"{section}.{key}"
            for key in context.get(section, {})
        )

    refs.update(
        f"core_memory.entries.{key}"
        for key in context.get("core_memory", {}).get("entries", {})
    )
    refs.update(
        f"conversations.{item['id']}"
        for item in context.get("conversations", [])
    )
    return refs


def check_budget(messages, extra):
    """Include prompts, messages, tool/schema overhead in a local estimate."""
    serialized = json.dumps(
        {
            "messages": [
                message.model_dump(mode="json")
                for message in messages
            ],
            "extra": extra,
        },
        ensure_ascii=False,
        default=str,
    )
    estimated_tokens = (len(serialized.encode("utf-8")) + 2) // 3 + 300

    if estimated_tokens > settings.AI_MAX_INPUT_TOKENS:
        raise HTTPException(
            422,
            "Purchase assessment exceeds the configured input budget",
        )


async def assess_purchase(context, model_name):
    initial = {
        key: context[key]
        for key in INITIAL_KEYS
        if key in context
    }
    history = {
        key: context[key]
        for key in HISTORY_KEYS
        if key in context
    }

    supplied_refs = references_for(initial)

    @tool("assess_historical_factors", description=HISTORY_TOOL_DESCRIPTION)
    def assess_historical_factors() -> dict:
        return {
            "evidence": history,
            "allowed_evidence_refs": sorted(references_for(history)),
        }

    model = ChatGoogleGenerativeAI(
        model=model_name,
        google_api_key=settings.GEMINI_API_KEY,
        # Use provider sampling defaults; fixed-sampling models ignore overrides.
        max_tokens=settings.AI_MAX_OUTPUT_TOKENS,
        max_retries=0,
    )

    instructions = (
        PERSONALITY
        + "\n"
        + TASKS["completed_purchase"]
    )

    messages = [
        SystemMessage(content=instructions),
        HumanMessage(content=json.dumps({
            "context": initial,
            "allowed_evidence_refs": sorted(supplied_refs),
        }, ensure_ascii=False)),
    ]

    used_history = False
    model_requests = 0
    succeeded = False

    try:
        # One deadline covers both Gemini requests.
        async with asyncio.timeout(settings.AI_TIMEOUT_SECONDS):
            tools = routing_tool_schemas()
            check_budget(messages, {"tools": tools})

            router = model.bind_tools(
                [assess_historical_factors, tools[1]], tool_choice="any"
            )
            model_requests += 1
            response = await router.ainvoke(messages)

            if response.invalid_tool_calls:
                raise HTTPException(502, "Invalid assessment tool request")
            if len(response.tool_calls) != 1:
                raise HTTPException(502, "Exactly one assessment tool choice is required")

            call = response.tool_calls[0]
            if call["name"] == "submit_assessment":
                result = FinalAssessment.model_validate(call["args"])
            elif call["name"] == assess_historical_factors.name and call["args"] == {}:
                # Preserve the complete model message, including tool metadata.
                messages.append(response)
                tool_result = await assess_historical_factors.ainvoke({})
                used_history = True
                supplied_refs.update(references_for(history))
                messages.append(ToolMessage(
                    content=json.dumps(tool_result, ensure_ascii=False),
                    tool_call_id=call["id"],
                ))
                messages.append(HumanMessage(content=json.dumps({
                    "instruction": (
                        "Historical evidence is now supplied. Return the final structured "
                        "assessment using only supplied evidence. Do not select another tool."
                    ),
                    "historical_assessment_used": True,
                    "allowed_evidence_refs": sorted(supplied_refs),
                })))
                check_budget(messages, assessment_provider_schema())
                final_model = model.with_structured_output(
                    assessment_provider_schema(), method="json_schema",
                )
                model_requests += 1
                result = FinalAssessment.model_validate(await final_model.ainvoke(messages))
            else:
                raise HTTPException(502, "Unexpected assessment tool request")

        # Backend execution determines this field.
        result.historical_assessment_used = used_history

        if not used_history:
            if result.conversation_effect != "baseline_not_requested":
                raise HTTPException(
                    502,
                    "Assessment compared against an unavailable baseline",
                )
        elif result.conversation_effect == "baseline_not_requested":
            raise HTTPException(
                502,
                "Assessment incorrectly reported historical evidence absent",
            )

        if not set(result.evidence_refs).issubset(supplied_refs):
            raise HTTPException(502, "Assessment referenced unavailable evidence")
        succeeded = True
        return result, supplied_refs

    except HTTPException:
        raise
    except TimeoutError:
        raise HTTPException(504, "Purchase assessment timed out") from None
    except ValidationError as exc:
        logger.warning("purchase_agent invalid_schema error_types=%s", sorted({item["type"] for item in exc.errors(include_input=False)}))
        raise HTTPException(502, "Invalid purchase assessment response") from None
    except ValueError:
        raise HTTPException(502, "Invalid purchase assessment response") from None
    except Exception as exc:
        # Preserve useful HTTP categories without exposing provider payloads.
        current = exc
        while current is not None:
            code = getattr(current, "code", None)
            if isinstance(code, int):
                if code == 429:
                    raise HTTPException(
                        429, "Purchase assessment provider quota reached"
                    ) from None
                if code in (400, 401, 403):
                    raise HTTPException(
                        502, "Purchase assessment provider configuration error"
                    ) from None
            current = current.__cause__

        raise HTTPException(
            503, "Purchase assessment provider unavailable"
        ) from None
    finally:
        logger.info(
            "purchase_agent model=%s model_requests=%s historical_assessment_used=%s succeeded=%s",
            model_name, model_requests, used_history, succeeded,
        )
