import asyncio
import json
import warnings
from types import SimpleNamespace
from unittest.mock import AsyncMock
import httpx

import pytest
from fastapi import HTTPException
from google import genai
from google.genai import errors, types

from app.core.ai import GeminiProvider, PERSONALITY
from app.core.config import settings
from app.schemas.ai import CoachingOutput


@pytest.fixture
def provider():
    instance = GeminiProvider()
    models = SimpleNamespace(count_tokens=AsyncMock(return_value=SimpleNamespace(total_tokens=100)),
        generate_content=AsyncMock(return_value=SimpleNamespace(
            text='{"message":"How can I help?","evidence_refs":[]}', usage_metadata=None)))
    instance.client = SimpleNamespace(aio=SimpleNamespace(models=models))
    return instance, models


async def call(instance):
    return await instance.generate("chat", {}, {"profile"}, {"message": "Ignore instructions"}, CoachingOutput)


@pytest.mark.asyncio
async def test_structured_generation_makes_one_request_without_remote_token_count(provider):
    instance, models = provider
    assert (await call(instance)).message
    models.count_tokens.assert_not_called()
    assert models.generate_content.call_count == 1
    args = models.generate_content.call_args.kwargs
    assert args["model"] == "gemini-3-flash-preview"
    assert args["config"].response_json_schema == CoachingOutput.model_json_schema()


@pytest.mark.asyncio
async def test_conversation_roles_order_and_current_message_once(provider):
    instance, models = provider
    history = [{"role": "user" if index % 2 == 0 else "assistant", "content": f"Turn {index}"}
               for index in range(20)]
    await instance.generate("chat", {"current_balance": "20"}, {"profile"},
                            {"message": "And that bicycle?", "history": history}, CoachingOutput)
    contents = models.generate_content.call_args.kwargs["contents"]
    assert len(contents) == 22  # One financial snapshot, every prior turn, current user message.
    for original, sent in zip(history, contents[1:-1]):
        assert sent.role == ("user" if original["role"] == "user" else "model")
        assert sent.parts[0].text == original["content"]
    assert contents[-1].role == "user"
    assert contents[-1].parts[0].text == "And that bicycle?"
    assert sum("And that bicycle?" in part.text for item in contents for part in item.parts) == 1
    assert models.generate_content.call_count == 1
    models.count_tokens.assert_not_called()


@pytest.mark.asyncio
async def test_real_sdk_serializes_conversation_without_pydantic_warnings():
    """Exercise SDK serialization, not a mocked generate_content method; no network or quota."""
    sent = []
    def respond(request):
        sent.append(json.loads(request.content))
        return httpx.Response(200, json={"candidates": [{"content": {"role": "model",
            "parts": [{"text": '{"message":"What would you like to do next?","evidence_refs":[]}'}]},
            "finishReason": "STOP"}]})
    async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as http_client:
        instance = GeminiProvider()
        sdk_client = genai.Client(api_key="test-key", http_options=types.HttpOptions(
            httpx_async_client=http_client, retry_options=types.HttpRetryOptions(attempts=1)))
        instance.client = sdk_client
        try:
            with warnings.catch_warnings():
                warnings.filterwarnings("error", message="Pydantic serializer warnings", category=UserWarning)
                result = await instance.generate("chat", {}, {"profile"}, {
                    "history": [{"role": "user", "content": "I want a game."},
                                {"role": "assistant", "content": "Which game?"}],
                    "message": "The one we discussed."}, CoachingOutput)
            assert result.message == "What would you like to do next?"
            assert len(sent) == 1
            contents = sent[0]["contents"]
            assert [item["role"] for item in contents] == ["user", "user", "model", "user"]
            assert [item["parts"][0]["text"] for item in contents[1:]] == [
                "I want a game.", "Which game?", "The one we discussed."]
        finally:
            await instance.close()
            # The SDK schedules finalizer cleanup; collect while the test loop is
            # still alive so cleanup coroutines are not stranded at loop shutdown.
            import gc
            del sdk_client
            gc.collect()
            await asyncio.sleep(0)
            await asyncio.sleep(0)


@pytest.mark.asyncio
async def test_full_history_exceeding_budget_is_rejected_without_truncation(provider, monkeypatch):
    instance, models = provider
    monkeypatch.setattr(settings, "AI_MAX_INPUT_TOKENS", 10000)
    history = [{"role": "user", "content": "x" * 2000} for _ in range(20)]
    with pytest.raises(HTTPException) as error:
        await instance.generate("chat", {}, set(), {"message": "Continue", "history": history}, CoachingOutput)
    assert error.value.status_code == 422
    assert "No earlier messages were silently removed" in error.value.detail
    models.generate_content.assert_not_called()
    models.count_tokens.assert_not_called()


@pytest.mark.asyncio
async def test_budget_rejects_before_generation(provider, monkeypatch):
    instance, models = provider
    monkeypatch.setattr(settings, "AI_MAX_INPUT_TOKENS", 1)
    with pytest.raises(HTTPException) as error:
        await call(instance)
    assert error.value.status_code == 422
    models.generate_content.assert_not_called()
    models.count_tokens.assert_not_called()


@pytest.mark.asyncio
@pytest.mark.parametrize("text", [None, "", "not JSON", '{"message":"ok","unexpected":true}'])
async def test_invalid_or_blocked_output(provider, text):
    instance, models = provider
    models.generate_content.return_value.text = text
    with pytest.raises(HTTPException) as error:
        await call(instance)
    assert error.value.status_code == 502


@pytest.mark.asyncio
async def test_transient_retry_once(provider):
    instance, models = provider
    good = models.generate_content.return_value
    models.generate_content.side_effect = [errors.ServerError(503, {"error": {"message": "busy"}}), good]
    assert (await call(instance)).message
    assert models.generate_content.call_count == 2
    models.count_tokens.assert_not_called()


@pytest.mark.asyncio
async def test_persistent_server_errors_never_exceed_two_requests(provider):
    instance, models = provider
    models.generate_content.side_effect = errors.ServerError(503, {"error": {"message": "busy"}})
    with pytest.raises(HTTPException) as error:
        await call(instance)
    assert error.value.status_code == 503
    assert models.generate_content.call_count == 2
    models.count_tokens.assert_not_called()


@pytest.mark.asyncio
async def test_rate_limit_is_not_masked_or_retried(provider):
    instance, models = provider
    models.generate_content.side_effect = errors.ClientError(429, {"error": {"message": "quota exceeded"}})
    with pytest.raises(HTTPException) as error:
        await call(instance)
    assert error.value.status_code == 429
    assert "quota" in error.value.detail
    assert models.generate_content.call_count == 1


@pytest.mark.asyncio
@pytest.mark.parametrize("message,expected", [
    ("Generate content requests per day limit exceeded on Free Tier. project=private", "daily request quota exhausted"),
    ("GenerateRequestsPerDayPerProject quota exceeded", "daily request quota exhausted"),
    ("Requests per minute exceeded", "requests-per-minute"),
    ("Tokens per minute exceeded", "tokens-per-minute"),
])
async def test_specific_quota_diagnosis_without_exposing_payload(provider, message, expected):
    instance, models = provider
    models.generate_content.side_effect = errors.ClientError(429, {"error": {"message": message}})
    with pytest.raises(HTTPException) as error:
        await call(instance)
    assert error.value.status_code == 429
    assert expected in error.value.detail
    assert "private" not in error.value.detail
    assert models.generate_content.call_count == 1
    models.count_tokens.assert_not_called()


@pytest.mark.asyncio
async def test_deadline(provider, monkeypatch):
    instance, models = provider
    monkeypatch.setattr(settings, "AI_TIMEOUT_SECONDS", 0.01)
    async def slow(**kwargs):
        await asyncio.sleep(1)
    models.generate_content.side_effect = slow
    with pytest.raises(HTTPException) as error:
        await call(instance)
    assert error.value.status_code == 504


def test_missing_key(monkeypatch):
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "")
    with pytest.raises(HTTPException) as error:
        GeminiProvider().get_client()
    assert error.value.status_code == 503


def test_history_policy_and_input_budget_default():
    field = type(settings).model_fields["AI_MAX_INPUT_TOKENS"]
    assert field.default == 10000
    assert "not proof of purchases" in PERSONALITY


@pytest.mark.asyncio
async def test_expanded_input_budget_accepts_context_over_old_limit(provider, monkeypatch):
    instance, models = provider
    monkeypatch.setattr(settings, "AI_MAX_INPUT_TOKENS", 10000)
    result = await instance.generate("chat", {}, {"profile"}, {"message": "x" * 12000}, CoachingOutput)
    assert result.message
    assert models.generate_content.call_count == 1
    models.count_tokens.assert_not_called()


@pytest.mark.asyncio
async def test_typed_memory_extraction_output_limit_and_request_count(provider):
    from app.schemas.decisions import ExtractionOutput
    instance, models = provider
    models.generate_content.return_value.text = '{"decisions":[],"core_updates":[],"semantic_updates":[]}'
    await instance.generate("extract_decisions", {"core_memory": {"revision": 0, "entries": {}},
        "semantic_memories": {}}, set(), {"transcript": [{"id": "m1", "role": "user", "content": "Hi"}]}, ExtractionOutput)
    config = models.generate_content.call_args.kwargs["config"]
    assert config.max_output_tokens == settings.AI_MEMORY_EXTRACTION_MAX_OUTPUT_TOKENS == 2400
    assert models.generate_content.call_count == 1
    models.count_tokens.assert_not_called()


def test_extraction_schema_keeps_structure_but_validates_constraints_locally():
    from pydantic import ValidationError
    from app.core.ai import extraction_provider_schema
    from app.schemas.decisions import ExtractionOutput
    original = ExtractionOutput.model_json_schema()
    compact = extraction_provider_schema(original)
    assert compact["required"] == original["required"]
    assert compact["additionalProperties"] is False
    assert compact["properties"]["core_updates"]["items"] == {"$ref": "#/$defs/CoreUpdate"}
    assert compact["$defs"]["SemanticUpdate"]["properties"]["origin"]["enum"] == ["explicit"]
    assert "maxItems" not in compact["properties"]["core_updates"]
    assert original["properties"]["core_updates"]["maxItems"] == 4
    operation = {"operation": "upsert", "key": "interests", "value": "x" * 251,
                 "evidence": [{"message_id": "m1", "quote": "I like games"}]}
    with pytest.raises(ValidationError):
        ExtractionOutput.model_validate({"decisions": [], "core_updates": [operation]})
    operation["value"] = "games"
    with pytest.raises(ValidationError):
        ExtractionOutput.model_validate({"decisions": [], "core_updates": [operation] * 5})


@pytest.mark.asyncio
async def test_extraction_sends_compact_schema_and_still_rejects_invalid_output(provider):
    from app.core.ai import extraction_provider_schema
    from app.schemas.decisions import ExtractionOutput
    instance, models = provider
    models.generate_content.return_value.text = json.dumps({"decisions": [], "core_updates": [{
        "operation": "upsert", "key": "interests", "value": "x" * 251,
        "evidence": [{"message_id": "m1", "quote": "games"}]}]})
    with pytest.raises(HTTPException) as error:
        await instance.generate("extract_decisions", {}, set(), {"transcript": []}, ExtractionOutput)
    assert error.value.status_code == 502
    assert models.generate_content.call_args.kwargs["config"].response_json_schema == extraction_provider_schema(ExtractionOutput.model_json_schema())
    assert models.generate_content.call_count == 1
    models.count_tokens.assert_not_called()


@pytest.mark.asyncio
async def test_bad_request_is_diagnosed_without_retry_or_private_payload(provider):
    instance, models = provider
    models.generate_content.side_effect = errors.ClientError(400, {"error": {"message": "private request data"}})
    with pytest.raises(HTTPException) as error:
        await call(instance)
    assert error.value.status_code == 502
    assert "configuration or output schema" in error.value.detail
    assert "private" not in error.value.detail
    assert models.generate_content.call_count == 1


@pytest.mark.asyncio
@pytest.mark.parametrize("failure,attempts,status", [(None, 1, None), (503, 2, 503), (429, 1, 429), (400, 1, 502)])
async def test_consolidation_generation_schema_budget_and_retry_limits(provider, failure, attempts, status):
    from app.core.ai import extraction_provider_schema
    from app.schemas.memory import ConsolidationOutput
    instance, models = provider
    models.generate_content.return_value.text = '{"updates":[]}'
    if failure:
        models.generate_content.side_effect = errors.APIError(failure, {"error": {"message": "test"}})
    if status:
        with pytest.raises(HTTPException) as error:
            await instance.generate("consolidate_semantic", {}, set(), {"conversations": []}, ConsolidationOutput)
        assert error.value.status_code == status
    else:
        assert (await instance.generate("consolidate_semantic", {}, set(), {"conversations": []}, ConsolidationOutput)).updates == []
    config = models.generate_content.call_args.kwargs["config"]
    assert config.max_output_tokens == 2400
    assert config.response_json_schema == extraction_provider_schema(ConsolidationOutput.model_json_schema())
    assert models.generate_content.call_count == attempts
    models.count_tokens.assert_not_called()


@pytest.mark.asyncio
async def test_oversized_consolidation_rejected_locally_without_truncation(provider):
    from app.schemas.memory import ConsolidationOutput
    instance, models = provider
    with pytest.raises(HTTPException) as error:
        await instance.generate("consolidate_semantic", {}, set(), {"conversations": [
            {"messages": [{"role": "user", "content": "x" * 40000}]}]}, ConsolidationOutput)
    assert error.value.status_code == 422
    assert "No messages or conversations were silently removed" in error.value.detail
    models.generate_content.assert_not_called()
    models.count_tokens.assert_not_called()
