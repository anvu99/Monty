"""Exercise the real tool exchange with mocked model responses; no network calls."""
import asyncio
import copy
import json
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

import pytest
from fastapi import HTTPException
from langchain.messages import AIMessage, ToolMessage

from app.core.config import settings
from app.schemas.purchase_assessment import FinalAssessment
from app.services import purchase_agent as agent
from app.services.purchase_assessment import validate_final


def assessment(*, used=False, **overrides):
    values = dict(
        decision="not_flagged",
        explanation="The supplied evidence does not establish an impulsive purchase.",
        evidence_refs=["purchase"],
        conversation_effect="no_relevant_context" if used else "baseline_not_requested",
        conversation_explanation="No relevant conversation evidence for a baseline comparison."
        if used else "The historical assessment was not requested; no baseline comparison was made.",
        historical_assessment_used=used,
    )
    values.update(overrides)
    return FinalAssessment(**values)


def tool_call(name="assess_historical_factors", args=None, identifier="history-1"):
    return {"name": name, "args": {} if args is None else args, "id": identifier, "type": "tool_call"}


@pytest.fixture
def context():
    return {
        "profile": {"age": 10},
        "purchase": {"id": "purchase", "product": "Game", "amount": "10.00"},
        "core_memory": {"entries": {"interests": {"value": "Games"}}},
        "semantic_memories": {"memory": {"summary": "The child discussed planning purchases."}},
        "decision_events": {"decision": {"action": "wait"}},
        "conversations": [{"id": "conversation", "messages": [
            {"id": "message", "role": "user", "content": "I planned this game."}]}],
        "baseline": {"score": 85, "risk_level": "HIGH"},
        "coverage": {"currency": "USD"},
        "spending": {"count": 3, "total": "40.00"},
        "goals": {"goal": {"saved": "30.00"}},
        "recent_purchases": {"previous": {"amount": "5.00"}},
        "impulse_summary": {"assessment_count": 2},
        "historical_assessments": {"score": {"score": 60}},
        "positive_decisions": {"pause": {"child_response": "paused"}},
    }


@pytest.fixture
def models(monkeypatch):
    # Snapshot arguments at invocation: the agent appends to its message list later.
    routed_messages, final_messages = [], []
    response = AIMessage(content="", tool_calls=[tool_call(
        name="submit_assessment", args=assessment().model_dump())])
    output = assessment()

    async def route(messages):
        routed_messages.append(copy.deepcopy(messages))
        return state.response

    async def finish(messages):
        final_messages.append(copy.deepcopy(messages))
        return state.output

    router = SimpleNamespace(ainvoke=AsyncMock(side_effect=route))
    final_model = SimpleNamespace(ainvoke=AsyncMock(side_effect=finish))
    model = Mock()
    model.bind_tools.return_value = router
    model.with_structured_output.return_value = final_model
    constructor = Mock(return_value=model)
    monkeypatch.setattr(agent, "ChatGoogleGenerativeAI", constructor)
    state = SimpleNamespace(response=response, output=output, router=router,
        final_model=final_model, model=model, constructor=constructor,
        routed_messages=routed_messages, final_messages=final_messages)
    return state


@pytest.mark.asyncio
async def test_without_tool_history_is_hidden_and_cannot_be_cited(context, models):
    original = copy.deepcopy(context)
    result, refs = await agent.assess_purchase(context, "frozen-model")
    initial = json.loads(models.routed_messages[0][1].content)
    assert initial["context"]["conversations"] == context["conversations"]
    assert all(key not in initial["context"] for key in agent.HISTORY_KEYS)
    assert "baseline" not in refs and "goals.goal" not in refs
    assert "conversations.conversation" in refs
    assert not models.final_messages
    models.router.ainvoke.assert_awaited_once()
    models.final_model.ainvoke.assert_not_awaited()
    models.model.with_structured_output.assert_not_called()
    tools = models.model.bind_tools.call_args.args[0]
    assert tools[0].name == "assess_historical_factors"
    assert tools[1]["name"] == "submit_assessment"
    assert models.model.bind_tools.call_args.kwargs["tool_choice"] == "any"
    assert result.historical_assessment_used is False
    assert result.conversation_effect == "baseline_not_requested"
    assert context == original
    assert models.constructor.call_args.kwargs["model"] == "frozen-model"
    assert models.constructor.call_args.kwargs["max_retries"] == 0

    # The worker must reject hidden history even when it exists in its snapshot.
    result.evidence_refs = ["baseline"]
    with pytest.raises(HTTPException, match="unavailable evidence"):
        validate_final(result, {"conversations": context["conversations"]}, refs)


@pytest.mark.asyncio
async def test_tool_returns_frozen_history_and_preserves_call_identity(context, models):
    models.response = AIMessage(content="", tool_calls=[tool_call()],
        additional_kwargs={"signature_marker": "preserve-this-message"})
    models.output = assessment(used=True, historical_assessment_used=False,
        evidence_refs=["purchase", "baseline"])
    result, refs = await agent.assess_purchase(context, "frozen-model")
    messages = models.final_messages[0]
    replies = [m for m in messages if isinstance(m, ToolMessage)]
    assert len(replies) == 1 and replies[0].tool_call_id == "history-1"
    body = json.loads(replies[0].content)
    assert body["evidence"] == {key: context[key] for key in agent.HISTORY_KEYS}
    assert "baseline" in body["allowed_evidence_refs"]
    assert {"baseline", "goals.goal", "historical_assessments.score"}.issubset(refs)
    assert messages[2].additional_kwargs["signature_marker"] == "preserve-this-message"
    assert result.historical_assessment_used is True  # Backend overrides the model.
    models.router.ainvoke.assert_awaited_once()
    models.final_model.ainvoke.assert_awaited_once()


@pytest.mark.asyncio
async def test_model_cannot_claim_tool_execution_without_calling_it(context, models):
    models.response = AIMessage(content="", tool_calls=[tool_call(
        name="submit_assessment", args=assessment(historical_assessment_used=True).model_dump())])
    result, _ = await agent.assess_purchase(context, "model")
    assert result.historical_assessment_used is False


@pytest.mark.asyncio
@pytest.mark.parametrize("calls", [
    [tool_call(name="read_another_child")],
    [tool_call(args={"child_id": "another-child"})],
    [tool_call(), tool_call(identifier="history-2")],
    [tool_call(), tool_call(name="submit_assessment", args=assessment().model_dump())],
    [tool_call(name="submit_assessment", args=assessment().model_dump()),
     tool_call(name="submit_assessment", args=assessment().model_dump(), identifier="submit-2")],
])
async def test_invalid_tool_requests_do_not_execute_or_finalize(context, models, calls):
    models.response = AIMessage(content="", tool_calls=calls)
    with pytest.raises(HTTPException) as error:
        await agent.assess_purchase(context, "model")
    assert error.value.status_code == 502
    models.final_model.ainvoke.assert_not_awaited()


@pytest.mark.asyncio
async def test_malformed_tool_call_rejected(context, models):
    models.response = AIMessage(content="", invalid_tool_calls=[{
        "name": "assess_historical_factors", "args": "{bad-json", "id": "bad", "error": "Invalid JSON"}])
    with pytest.raises(HTTPException) as error:
        await agent.assess_purchase(context, "model")
    assert error.value.status_code == 502
    models.final_model.ainvoke.assert_not_awaited()


@pytest.mark.asyncio
@pytest.mark.parametrize("used", [False, True])
async def test_baseline_comparison_must_agree_with_execution(context, models, used):
    if used:
        models.response = AIMessage(content="", tool_calls=[tool_call()])
    models.output = assessment(used=not used)
    if not used:
        models.response = AIMessage(content="", tool_calls=[tool_call(
            name="submit_assessment", args=models.output.model_dump())])
    with pytest.raises(HTTPException) as error:
        await agent.assess_purchase(context, "model")
    assert error.value.status_code == 502


@pytest.mark.asyncio
@pytest.mark.parametrize("phase", ["router", "final_model"])
async def test_deadline_covers_either_model_request(context, models, monkeypatch, phase):
    monkeypatch.setattr(settings, "AI_TIMEOUT_SECONDS", 0.01)
    if phase == "final_model":
        models.response = AIMessage(content="", tool_calls=[tool_call()])
    async def slow(messages):
        await asyncio.sleep(60)
    getattr(models, phase).ainvoke.side_effect = slow
    with pytest.raises(HTTPException) as error:
        await agent.assess_purchase(context, "model")
    assert error.value.status_code == 504


@pytest.mark.asyncio
@pytest.mark.parametrize("history_requested", [False, True])
async def test_budget_checked_before_each_request(context, models, history_requested):
    if history_requested:
        # Historical inputs are hidden from routing, but must fit before finalization.
        models.response = AIMessage(content="", tool_calls=[tool_call()])
        context["baseline"]["oversized"] = "x" * 40000
    else:
        context["purchase"]["oversized"] = "x" * 40000
    with pytest.raises(HTTPException) as error:
        await agent.assess_purchase(context, "model")
    assert error.value.status_code == 422
    assert models.router.ainvoke.await_count == int(history_requested)
    models.final_model.ainvoke.assert_not_awaited()


@pytest.mark.asyncio
@pytest.mark.parametrize("code,expected", [(429, 429), (400, 502), (401, 502), (403, 502), (503, 503)])
async def test_wrapped_provider_errors_are_sanitized(context, models, code, expected):
    class ProviderError(Exception):
        pass
    original = ProviderError("private provider payload")
    original.code = code
    wrapped = RuntimeError("private wrapper")
    wrapped.__cause__ = original
    models.router.ainvoke.side_effect = wrapped
    with pytest.raises(HTTPException) as error:
        await agent.assess_purchase(context, "model")
    assert error.value.status_code == expected
    assert "private" not in error.value.detail


@pytest.mark.asyncio
async def test_invalid_structured_response_is_not_retryable_provider_failure(context, models):
    models.response = AIMessage(content="", tool_calls=[tool_call()])
    models.final_model.ainvoke.side_effect = ValueError("malformed structured response")
    with pytest.raises(HTTPException) as error:
        await agent.assess_purchase(context, "model")
    assert error.value.status_code == 502


def test_references_only_include_supplied_records(context):
    refs = agent.references_for({"purchase": context["purchase"],
        "core_memory": context["core_memory"], "semantic_memories": context["semantic_memories"]})
    assert refs == {"purchase", "core_memory.entries.interests", "semantic_memories.memory"}
    assert agent.references_for({}) == set()


def test_provider_schema_inlines_quotes_without_unsupported_keywords():
    from app.schemas.purchase_assessment import assessment_provider_schema
    schema = assessment_provider_schema()
    encoded = json.dumps(schema)
    for key in ("$defs", "$ref", "additionalProperties", "maxLength", "maxItems", "default"):
        assert f'"{key}"' not in encoded
    quotes = schema["properties"]["quotes"]["items"]
    assert quotes["type"] == "object"
    assert set(quotes["required"]) == {"conversation_id", "message_id", "quote"}
    assert "baseline_not_requested" in schema["properties"]["conversation_effect"]["enum"]
    assert agent.routing_tool_schemas()[1]["parameters"] == schema


@pytest.mark.asyncio
@pytest.mark.parametrize("invalid_fields", [
    {"explanation": "x" * 1001},
    {"quotes": [{"quote": "Missing source identifiers"}]},
    {"unexpected": "Not allowed"},
])
async def test_native_dict_output_still_has_strict_local_validation(context, models, invalid_fields):
    models.response = AIMessage(content="", tool_calls=[tool_call()])
    # Provider constraints are simplified, but application constraints remain strict.
    models.output = assessment(used=True).model_dump()
    models.output.update(invalid_fields)
    with pytest.raises(HTTPException) as error:
        await agent.assess_purchase(context, "model")
    assert error.value.status_code == 502


@pytest.mark.asyncio
@pytest.mark.parametrize("used_history", [False, True])
async def test_real_google_sdk_wire_schema_with_synthetic_responses(context, monkeypatch, caplog, used_history):
    """Exercise real LangChain/SDK conversion via HTTP MockTransport, not Gemini."""
    import warnings
    import httpx
    from google import genai
    from google.genai import types
    from langchain_google_genai import ChatGoogleGenerativeAI as RealModel
    import langchain_google_genai.chat_models as google_chat

    sent = []
    output = assessment(used=used_history, quotes=[{
        "conversation_id": "conversation", "message_id": "message", "quote": "I planned this game."
    }])

    def respond(request):
        sent.append(json.loads(request.content))
        if used_history and len(sent) == 1:
            part = {"functionCall": {"name": "assess_historical_factors", "args": {}}}
        elif used_history:
            part = {"text": output.model_dump_json()}
        else:
            part = {"functionCall": {"name": "submit_assessment", "args": output.model_dump()}}
        return httpx.Response(200, json={"candidates": [{
            "content": {"role": "model", "parts": [part]}, "finishReason": "STOP"}]})

    async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as http_client:
        sdk = genai.Client(api_key="test-key", http_options=types.HttpOptions(
            httpx_async_client=http_client, retry_options=types.HttpRetryOptions(attempts=1)))
        # The integration constructs its own Client in a model validator; passing
        # client= is overwritten. Replace that constructor at the transport edge.
        monkeypatch.setattr(google_chat, "Client", lambda **kwargs: sdk)
        monkeypatch.setattr(agent, "ChatGoogleGenerativeAI", RealModel)
        try:
            with warnings.catch_warnings():
                warnings.filterwarnings("error", message=".*uses fixed sampling defaults.*")
                try:
                    result, refs = await agent.assess_purchase(context, "gemini-3.5-flash-lite")
                except HTTPException as exc:
                    raise AssertionError(f"Synthetic transport failure: {type(exc.__context__).__name__}: {exc.__context__}; requests={len(sent)}") from exc
            assert result == output
            assert isinstance(result, FinalAssessment)
            assert result.historical_assessment_used is used_history
            assert ("baseline" in refs) is used_history
            assert len(sent) == (2 if used_history else 1)
            assert "is not supported in schema" not in caplog.text
            declarations = sent[0]["tools"][0]["functionDeclarations"]
            submit = next(item for item in declarations if item["name"] == "submit_assessment")
            quote_schema = submit["parameters"]["properties"]["quotes"]["items"]
            assert set(quote_schema["properties"]) == {"conversation_id", "message_id", "quote"}
            assert set(quote_schema["required"]) == {"conversation_id", "message_id", "quote"}
            for request in sent:
                assert "temperature" not in request.get("generationConfig", {})
            if used_history:
                native_schema = sent[1]["generationConfig"]["responseJsonSchema"]
                assert native_schema == agent.routing_tool_schemas()[1]["parameters"]
                assert any("functionResponse" in part for item in sent[1]["contents"] for part in item["parts"])
        finally:
            await sdk.aio.aclose()
            sdk.close()


@pytest.mark.asyncio
@pytest.mark.parametrize("args", [{}, {"decision": "not_flagged"},
    {**assessment().model_dump(), "decision": "invalid"},
    {**assessment().model_dump(), "unexpected": "field"}])
async def test_invalid_submission_fails_without_repair(context, models, args):
    models.response = AIMessage(content="", tool_calls=[tool_call(name="submit_assessment", args=args)])
    with pytest.raises(HTTPException) as error:
        await agent.assess_purchase(context, "model")
    assert error.value.status_code == 502
    models.router.ainvoke.assert_awaited_once()
    models.final_model.ainvoke.assert_not_awaited()


@pytest.mark.asyncio
async def test_plain_text_response_is_not_repaired(context, models):
    models.response = AIMessage(content="The purchase does not appear impulsive.")
    with pytest.raises(HTTPException) as error:
        await agent.assess_purchase(context, "model")
    assert error.value.status_code == 502
    models.final_model.ainvoke.assert_not_awaited()


@pytest.mark.asyncio
async def test_submission_cannot_cite_hidden_history(context, models):
    models.response = AIMessage(content="", tool_calls=[tool_call(name="submit_assessment",
        args=assessment(evidence_refs=["baseline"]).model_dump())])
    with pytest.raises(HTTPException) as error:
        await agent.assess_purchase(context, "model")
    assert error.value.status_code == 502
    models.final_model.ainvoke.assert_not_awaited()


@pytest.mark.asyncio
async def test_can_submit_insufficient_context_immediately(context, models):
    models.response = AIMessage(content="", tool_calls=[tool_call(name="submit_assessment",
        args=assessment(decision="insufficient_context").model_dump())])
    result, _ = await agent.assess_purchase(context, "model")
    assert isinstance(result, FinalAssessment)
    assert result.decision == "insufficient_context"
    assert result.historical_assessment_used is False
    models.final_model.ainvoke.assert_not_awaited()


@pytest.mark.asyncio
@pytest.mark.parametrize("used,requests", [(False, 1), (True, 2)])
async def test_logs_request_count_without_context(context, models, caplog, used, requests):
    if used:
        models.response = AIMessage(content="", tool_calls=[tool_call()])
        models.output = assessment(used=True)
    with caplog.at_level("INFO", logger=agent.__name__):
        result, _ = await agent.assess_purchase(context, "model")
    assert isinstance(result, FinalAssessment)
    assert f"model_requests={requests}" in caplog.text
    assert f"historical_assessment_used={used}" in caplog.text
    assert "I planned this game" not in caplog.text
    assert "succeeded=True" in caplog.text
