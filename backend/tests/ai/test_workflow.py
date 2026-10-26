from datetime import datetime, timedelta, timezone
from decimal import Decimal

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.ai import get_ai_provider
from app.core.database import get_db
from app.main import app
from app.models import Base, Child, DecisionLog, Family, ImpulseScore, SavingsGoal, Transaction
from app.models import EndedConversation, DecisionEvent
from app.schemas.decisions import ExtractionOutput
from app.services.decision_extraction import run_one
from app.schemas.ai import CoachingOutput, RiskOutput
from app.services.ai_context_service import build_context, evidence_refs
from app.services import ai_context_service
from app.services.coaching_service import generate, risk_level


class FakeProvider:
    def __init__(self):
        self.calls = []
        self.allowed_refs = []
        self.error = None

    async def generate(self, task, snapshot, refs, request, schema):
        self.calls.append((task, snapshot, request))
        self.allowed_refs.append(refs)
        if self.error:
            raise self.error
        if task == "chat":
            return schema(message=f"Hello {snapshot['profile']['name']}", evidence_refs=["profile"])
        if task == "risk":
            return schema(status="assessed", risk_score=70, explanation="Consider a pause.", factors=[{
                "factor": "Purchase", "contribution": 0.6, "description": "Review the purchase.",
                "evidence_refs": ["proposed_purchase" if "proposed_purchase" in snapshot else "spending"]}])
        if task == "nudge":
            return schema(has_nudge=False)
        if task == "insights":
            return schema(insights=[])
        return schema(suggestions=[])


@pytest.fixture
def setup():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    with sessionmaker(bind=engine)() as db:
        db.add(Family(id="f", name="Test family"))
        db.add_all([Child(id="a", family_id="f", name="Alex", age=11),
                    Child(id="b", family_id="f", name="Bo", age=8)])
        db.add(SavingsGoal(id="g", child_id="a", name="Bicycle", target_amount=Decimal("100"),
                          current_amount=Decimal("25"), weekly_contribution=Decimal("5")))
        for i in range(12):
            db.add(Transaction(id=f"t{i}", child_id="a", amount=Decimal("2"), merchant_name="Shop",
                merchant_category="Books", timestamp=datetime.now(timezone.utc) - timedelta(days=i)))
        db.commit()
        ai = FakeProvider()
        app.dependency_overrides[get_db] = lambda: db
        app.dependency_overrides[get_ai_provider] = lambda: ai
        with TestClient(app) as client:
            yield client, db, ai
        app.dependency_overrides.clear()
    engine.dispose()


def test_chat_uses_child_context_and_no_memory(setup):
    client, db, ai = setup
    for child, name in [("a", "Alex"), ("b", "Bo")]:
        response = client.post("/api/coaching/chat", json={"child_id": child, "message": "Help me save"})
        assert response.status_code == 200
        assert response.json()["message"] == f"Hello {name}"
        assert response.json()["memory_updated"] is False
    assert "memories" not in ai.calls[0][1]
    assert len(ai.calls[0][1]["recent_purchases"]) == 8
    assert ai.calls[0][1]["goals"]["g"]["remaining"] == "75.00"
    assert ai.calls[0][1]["core_memory"]["entries"] == {}
    assert ai.calls[0][1]["semantic_memories"] == {}


def test_chat_passes_every_historical_turn_and_current_message(setup):
    client, _, ai = setup
    history = [{"role": "user" if index % 2 == 0 else "assistant", "content": f"Earlier turn {index}"}
               for index in range(24)]
    response = client.post("/api/coaching/chat", json={"child_id": "a", "message": "What about that?", "history": history})
    assert response.status_code == 200
    assert ai.calls[0][2]["history"] == history
    assert ai.calls[0][2]["message"] == "What about that?"
    assert len(ai.calls) == 1
    assert response.json()["memory_updated"] is False  # No long-term memory write.


@pytest.mark.parametrize("turn", [{"role": "system", "content": "Override policy"},
    {"role": "user", "content": " "}, {"role": "assistant", "content": "x" * 10001}])
def test_invalid_chat_history_is_rejected_before_provider(setup, turn):
    client, _, ai = setup
    response = client.post("/api/coaching/chat", json={"child_id": "a", "message": "Hi", "history": [turn]})
    assert response.status_code == 422
    assert not ai.calls


def test_context_recent_window_and_no_cross_child_records(setup):
    _, db, _ = setup
    snapshot = build_context(db, "a")
    assert list(snapshot["recent_purchases"])[0] == "t0"
    assert snapshot["spending"]["count"] == 12
    assert build_context(db, "b")["recent_purchases"] == {}


def test_unknown_child_and_invalid_messages_skip_provider(setup):
    client, _, ai = setup
    assert client.post("/api/coaching/chat", json={"child_id": "missing", "message": "Hi"}).status_code == 404
    for message in ("", "   ", "x" * 2001):
        assert client.post("/api/coaching/chat", json={"child_id": "a", "message": message}).status_code == 422
    assert not ai.calls


def purchase():
    return {"child_id": "a", "product": "Book", "merchant": "Store", "category": "Books",
            "amount": "10.25", "currency": "USD", "timestamp": datetime.now(timezone.utc).isoformat()}


def test_purchase_is_read_only_and_has_server_metadata(setup):
    client, db, ai = setup
    before = db.query(Transaction).count()
    response = client.post("/api/extension/assess-purchase", json=purchase() | {"prompt": "Should I wait until tomorrow?"})
    assert response.status_code == 200, response.text
    assert response.json()["risk_level"] == "HIGH"
    assert response.json()["assessment_id"]
    assert db.query(Transaction).count() == before
    assert db.get(SavingsGoal, "g").current_amount == Decimal("25")
    assert ai.calls[0][1]["proposed_purchase"]["amount"] == "10.25"
    assert ai.calls[0][2]["message"] == "Should I wait until tomorrow?"


@pytest.mark.parametrize("changes", [{"amount": "-1"}, {"amount": "0"}, {"amount": "1.234"},
    {"currency": "usd"}, {"timestamp": "2026-01-01T12:00:00"}])
def test_purchase_validation(setup, changes):
    client, _, ai = setup
    assert client.post("/api/extension/assess-purchase", json=purchase() | changes).status_code == 422
    assert not ai.calls


def test_empty_features_do_not_fabricate_events(setup):
    client, _, ai = setup
    assert client.get("/api/child/a/memories").json() == {"memories": []}
    assert client.get("/api/flowchart/a/decision-log").json() == {"latest": None, "history": []}
    assert client.get("/api/child/a/live-feed").json()["should_wait"] is False
    assert client.post("/api/extension/dismiss-alert?alert_id=nonexistent").status_code == 503
    assert not ai.calls
    assert client.get("/api/coaching/proactive-nudge/a").json()["has_nudge"] is False
    assert "12 purchases" in client.get("/api/child/a/insights").json()["insights"][0]
    assert client.get("/api/child/a/implementation-intentions").json() == {"intentions": [], "suggestions": []}
    assert not ai.calls


def test_dashboard_reads_never_contact_gemini_even_with_data(setup):
    client, _, ai = setup
    ai.error = AssertionError("Dashboard must not call Gemini")
    for path in ("/api/child/a/insights", "/api/extension/check-risk?child_id=a",
                 "/api/coaching/proactive-nudge/a", "/api/child/a/implementation-intentions",
                 "/api/child/a/spending", "/api/child/a/impulse-scores", "/api/child/a/live-feed"):
        response = client.get(path)
        assert response.status_code == 200, response.text
    assert not ai.calls


def test_provider_failure_is_not_fake_success(setup):
    client, _, ai = setup
    ai.error = HTTPException(504, "AI request timed out; please retry")
    assert client.post("/api/coaching/chat", json={"child_id": "a", "message": "Hi"}).status_code == 504


def test_no_data_returns_honest_empty_states_without_provider(setup):
    client, _, ai = setup
    response = client.get("/api/extension/check-risk?child_id=b")
    assert response.status_code == 200
    risk = response.json()["current_risk_score"]
    assert risk["status"] == "insufficient_data"
    assert risk["risk_score"] is None
    assert risk["risk_level"] == "UNKNOWN"
    assert client.get("/api/child/b/insights").json() == {"insights": []}
    assert client.get("/api/coaching/proactive-nudge/b").json()["has_nudge"] is False
    assert client.get("/api/child/b/implementation-intentions").json()["suggestions"] == []
    assert not ai.calls


@pytest.mark.asyncio
async def test_invalid_evidence_rejected(setup):
    _, db, _ = setup
    class BadProvider:
        async def generate(self, *args):
            return CoachingOutput(message="Claim", evidence_refs=["another-child"])
    with pytest.raises(HTTPException) as error:
        await generate("chat", build_context(db, "a"), BadProvider())
    assert error.value.status_code == 502


@pytest.mark.parametrize("score,level", [(None, "UNKNOWN"), (0, "LOW"), (39, "LOW"), (40, "MEDIUM"), (70, "HIGH")])
def test_risk_levels(score, level):
    assert risk_level(score) == level


def test_invalid_risk_output():
    with pytest.raises(ValueError):
        RiskOutput(status="insufficient_data", risk_score=50, explanation="Unknown")
    with pytest.raises(ValueError):
        RiskOutput(status="assessed", risk_score=101, explanation="High", factors=[])


def add_assessment(db, event_id, timestamp, score=75, child_id="a", factors=None, response=None):
    db.add(ImpulseScore(id=event_id, child_id=child_id, product_name="Book",
        amount=Decimal("5.00"), merchant_name="Shop", merchant_category="Books",
        impulse_score=score, timestamp=timestamp,
        factors=factors if factors is not None else {}, child_response=response))


def add_decision(db, event_id, timestamp, response, child_id="a"):
    db.add(DecisionLog(id=event_id, child_id=child_id, timestamp=timestamp,
        trigger="Considered a book", decision="NUDGE_PAUSE", child_response=response,
        coaching_message="Do not send old generated coaching", ai_justification="Do not send old explanation",
        pipeline_nodes=[{"id": "do-not-send"}], pipeline_edges=[], factors={"do-not-send": True}))


@pytest.fixture
def frozen_now(monkeypatch):
    now = datetime(2026, 10, 24, 12, tzinfo=timezone.utc)
    class FrozenDatetime(datetime):
        @classmethod
        def now(cls, tz=None):
            return now if tz else now.replace(tzinfo=None)
    monkeypatch.setattr(ai_context_service, "datetime", FrozenDatetime)
    return now


def test_history_full_window_summary_and_eight_latest(setup, frozen_now):
    _, db, _ = setup
    for index in range(12):
        add_assessment(db, f"s{index:02}", frozen_now - timedelta(hours=index), score=index * 8)
    db.commit()
    snapshot = build_context(db, "a")
    assert list(snapshot["historical_assessments"]) == [f"s{i:02}" for i in range(8)]
    summary = snapshot["impulse_summary"]
    assert summary["assessment_count"] == summary["valid_score_count"] == 12
    assert summary["average_score"] == 44
    assert summary["high_score_count"] == 3  # These three records are outside the eight-item sample.
    assert "not confirmed purchases" in summary["interpretation"]


def test_history_boundaries_isolation_and_tie_order(setup, frozen_now):
    _, db, _ = setup
    start = frozen_now - timedelta(days=30)
    for event_id, time, child in [("end-b", frozen_now, "a"), ("end-a", frozen_now, "a"),
        ("start", start, "a"), ("old", start - timedelta(microseconds=1), "a"),
        ("future", frozen_now + timedelta(microseconds=1), "a"), ("other", frozen_now, "b")]:
        add_assessment(db, event_id, time, child_id=child)
        add_decision(db, event_id, time, "waited", child_id=child)
    db.commit()
    snapshot = build_context(db, "a")
    assert list(snapshot["historical_assessments"]) == ["end-a", "end-b", "start"]
    assert snapshot["impulse_summary"]["assessment_count"] == 3
    assert list(snapshot["positive_decisions"]) == ["end-a", "end-b"]
    other = build_context(db, "b")
    assert list(other["historical_assessments"]) == ["other"]
    assert list(other["positive_decisions"]) == ["other"]


def test_invalid_scores_and_mixed_recorded_factors(setup, frozen_now):
    _, db, _ = setup
    factors = [{"time": {"value": "evening", "impulse_weight": 0.5}},
               {"time": "evening"}, ["legacy factor"], "legacy text", {}]
    for index, score in enumerate([0, 100, -1, 101, float("inf")]):
        add_assessment(db, f"s{index}", frozen_now, score=score, factors=factors[index])
    db.commit()
    snapshot = build_context(db, "a")
    assert snapshot["impulse_summary"]["assessment_count"] == 5
    assert snapshot["impulse_summary"]["valid_score_count"] == 2
    assert snapshot["impulse_summary"]["average_score"] == 50
    assert snapshot["impulse_summary"]["high_score_count"] == 1
    for index in range(5):
        item = snapshot["historical_assessments"][f"s{index}"]
        assert item["factors"] == factors[index]
        assert item["child_response"] is None
        assert item["score_valid"] == (index < 2)
        if index >= 2:
            assert item["score"] is None


def test_positive_outcomes_selection_and_minimal_payload(setup, frozen_now):
    _, db, _ = setup
    for index, response in enumerate(["agreed_to_wait", "waited", "paused", "delayed", "skipped",
                                      None, "dismissed", "proceeded", "unknown"]):
        add_decision(db, f"d{index}", frozen_now - timedelta(hours=index), response)
    db.commit()
    snapshot = build_context(db, "a")
    assert list(snapshot["positive_decisions"]) == ["d0", "d1"]
    commitment = snapshot["positive_decisions"]["d0"]
    assert commitment["child_response"] == "agreed_to_wait"
    assert set(commitment) == {"id", "timestamp", "trigger", "intervention", "child_response"}
    refs = evidence_refs(snapshot)
    assert {"positive_decisions.d0", "positive_decisions.d1", "impulse_summary"} <= refs
    assert "positive_decisions.d5" not in refs


@pytest.mark.parametrize("response", ["waited", "paused", "delayed", "skipped", "agreed_to_wait"])
def test_each_positive_response_qualifies(setup, frozen_now, response):
    _, db, _ = setup
    add_decision(db, "positive", frozen_now, response)
    db.commit()
    assert build_context(db, "a")["positive_decisions"]["positive"]["child_response"] == response


def test_empty_history_has_no_fabricated_scores_or_decisions(setup):
    _, db, _ = setup
    snapshot = build_context(db, "b")
    assert snapshot["historical_assessments"] == snapshot["positive_decisions"] == {}
    assert snapshot["impulse_summary"]["assessment_count"] == 0
    assert snapshot["impulse_summary"]["valid_score_count"] == 0
    assert snapshot["impulse_summary"]["average_score"] is None
    assert snapshot["impulse_summary"]["high_score_count"] == 0


def test_both_workflows_receive_history_and_evidence(setup):
    client, db, ai = setup
    now = datetime.now(timezone.utc) - timedelta(minutes=1)
    add_assessment(db, "history", now, child_id="b")
    add_decision(db, "success", now, "agreed_to_wait", child_id="b")
    db.commit()
    response = client.post("/api/coaching/chat", json={"child_id": "b", "message": "How have I done before?"})
    assert response.status_code == 200
    response = client.post("/api/extension/assess-purchase", json=purchase() | {"child_id": "b"})
    assert response.status_code == 200
    assert len(ai.calls) == 2
    for index, (_, snapshot, _) in enumerate(ai.calls):
        assert snapshot["spending"]["count"] == 0
        assert snapshot["historical_assessments"]["history"]["score"] == 75
        assert snapshot["positive_decisions"]["success"]["child_response"] == "agreed_to_wait"
        assert {"historical_assessments.history", "positive_decisions.success", "impulse_summary"} <= ai.allowed_refs[index]


@pytest.mark.asyncio
async def test_history_only_risk_does_not_short_circuit(setup):
    _, db, ai = setup
    add_assessment(db, "history", datetime.now(timezone.utc) - timedelta(minutes=1), child_id="b")
    db.commit()
    result = await generate("risk", build_context(db, "b"), ai)
    assert result.status == "assessed"
    assert len(ai.calls) == 1


def ended_payload(child_id="a"):
    import uuid
    return {"conversation_id": str(uuid.uuid4()), "child_id": child_id, "messages": [
        {"id": "m1", "role": "user", "content": "I will wait until tomorrow before buying the game."},
        {"id": "m2", "role": "assistant", "content": "A pause can help you decide."}]}


class ExtractionProvider:
    def __init__(self, decisions=None, error=None):
        self.decisions = decisions if decisions is not None else [{"action": "wait", "outcome_status": "commitment",
            "situation": "Considering a game", "goal_relationship": "potentially_supportive",
            "evidence": [{"message_id": "m1", "quote": "I will wait until tomorrow"}], "supersedes_event_id": None}]
        self.calls = []
        self.error = error

    async def generate(self, task, facts, refs, request, schema):
        self.calls.append((task, facts, request))
        if self.error:
            raise self.error
        return schema(decisions=self.decisions)


@pytest.mark.asyncio
async def test_end_extraction_persistence_and_future_context(setup):
    client, db, chat_ai = setup
    payload = ended_payload()
    response = client.post("/api/coaching/conversations/end", json=payload)
    assert response.status_code == 202, response.text
    assert response.json()["status"] == "pending"
    assert not chat_ai.calls  # Saving does not invoke the model.
    row = db.get(EndedConversation, payload["conversation_id"])
    assert row.transcript == payload["messages"]
    assert client.post("/api/coaching/conversations/end", json=payload).status_code == 202
    provider = ExtractionProvider()
    factory = sessionmaker(bind=db.get_bind())
    assert await run_one(factory, provider)
    assert not await run_one(factory, provider)
    db.expire_all()
    assert db.get(EndedConversation, payload["conversation_id"]).status == "completed"
    events = db.query(DecisionEvent).all()
    assert len(events) == 1
    event = events[0]
    assert event.outcome_status == "commitment"
    assert event.source == "child_self_report"
    assert provider.calls[0][2]["transcript"] == payload["messages"]
    snapshot = build_context(db, "a")
    assert snapshot["decision_events"][event.id]["outcome_status"] == "commitment"
    assert f"decision_events.{event.id}" in evidence_refs(snapshot)
    assert build_context(db, "b")["decision_events"] == {}
    assert len(provider.calls) == 1
    assert db.query(Transaction).count() == 12  # No financial mutations.


@pytest.mark.asyncio
@pytest.mark.parametrize("evidence", [
    [{"message_id": "missing", "quote": "I will wait"}],
    [{"message_id": "m2", "quote": "A pause can help"}],
    [{"message_id": "m1", "quote": "I already waited"}],
])
async def test_extraction_rejects_bad_evidence_atomically(setup, evidence):
    client, db, _ = setup
    payload = ended_payload()
    client.post("/api/coaching/conversations/end", json=payload)
    provider = ExtractionProvider()
    provider.decisions.append(provider.decisions[0] | {"evidence": evidence})
    await run_one(sessionmaker(bind=db.get_bind()), provider)
    db.expire_all()
    assert db.get(EndedConversation, payload["conversation_id"]).status == "failed"
    assert db.query(DecisionEvent).count() == 0


@pytest.mark.asyncio
async def test_empty_extraction_and_explicit_retry(setup):
    client, db, _ = setup
    payload = ended_payload()
    payload["messages"][0]["content"] = "What if I bought a game?"
    client.post("/api/coaching/conversations/end", json=payload)
    factory = sessionmaker(bind=db.get_bind())
    await run_one(factory, ExtractionProvider(error=HTTPException(429, "Daily quota exhausted")))
    db.expire_all()
    path = f"/api/child/a/conversations/{payload['conversation_id']}/extraction"
    assert client.get(path).json()["status"] == "failed"
    assert not await run_one(factory, ExtractionProvider())  # No automatic quota retries.
    assert client.post(path + "/retry").json()["status"] == "pending"
    await run_one(factory, ExtractionProvider(decisions=[]))
    db.expire_all()
    assert client.get(path).json()["status"] == "completed"
    assert db.query(DecisionEvent).count() == 0


def test_end_duplicate_conflict_and_child_isolation(setup):
    client, db, _ = setup
    payload = ended_payload()
    client.post("/api/coaching/conversations/end", json=payload)
    assert client.post("/api/coaching/conversations/end", json=payload | {"child_id": "b"}).status_code == 404
    changed = payload | {"messages": [{"id": "new", "role": "user", "content": "Different"}]}
    assert client.post("/api/coaching/conversations/end", json=changed).status_code == 409
    assert client.get(f"/api/child/b/conversations/{payload['conversation_id']}/extraction").status_code == 404
    assert db.query(EndedConversation).count() == 1


@pytest.mark.asyncio
async def test_explicit_correction_supersedes_old_event(setup):
    client, db, _ = setup
    factory = sessionmaker(bind=db.get_bind())
    client.post("/api/coaching/conversations/end", json=ended_payload())
    await run_one(factory, ExtractionProvider())
    db.expire_all()
    original = db.query(DecisionEvent).one().id
    payload = ended_payload()
    payload["messages"][0]["content"] = "Actually I bought the game instead of waiting."
    client.post("/api/coaching/conversations/end", json=payload)
    provider = ExtractionProvider(decisions=[{"action": "purchase", "outcome_status": "reported_completed",
        "situation": "Bought the game instead of waiting", "goal_relationship": "unclear",
        "evidence": [{"message_id": "m1", "quote": "Actually I bought the game instead of waiting."}],
        "supersedes_event_id": original}])
    await run_one(factory, provider)
    db.expire_all()
    assert db.get(DecisionEvent, original).status == "superseded"
    context = build_context(db, "a")
    assert original not in context["decision_events"]
    assert len(context["decision_events"]) == 1
    assert next(iter(context["decision_events"].values()))["action"] == "purchase"


@pytest.mark.asyncio
async def test_duplicate_candidates_deduplicated_and_stale_work_recovers(setup):
    client, db, _ = setup
    payload = ended_payload()
    client.post("/api/coaching/conversations/end", json=payload)
    row = db.get(EndedConversation, payload["conversation_id"])
    row.status = "processing"
    row.processing_started_at = datetime.now(timezone.utc) - timedelta(minutes=6)
    db.commit()
    provider = ExtractionProvider()
    provider.decisions.append(provider.decisions[0].copy())
    await run_one(sessionmaker(bind=db.get_bind()), provider)
    db.expire_all()
    assert db.query(DecisionEvent).count() == 1
    assert db.get(EndedConversation, payload["conversation_id"]).status == "completed"


def test_end_rejects_duplicate_message_ids_and_assistant_only_transcript(setup):
    client, _, ai = setup
    payload = ended_payload()
    payload["messages"][1]["id"] = "m1"
    assert client.post("/api/coaching/conversations/end", json=payload).status_code == 422
    payload = ended_payload()
    payload["messages"][0]["role"] = "assistant"
    assert client.post("/api/coaching/conversations/end", json=payload).status_code == 422
    assert not ai.calls


def test_conversation_migration_upgrade_and_downgrade():
    import importlib.util
    from pathlib import Path
    from alembic.migration import MigrationContext
    from alembic.operations import Operations
    from sqlalchemy import inspect
    path = Path(__file__).resolve().parents[2] / "alembic/versions/a91c4d02b671_conversation_decision_extraction.py"
    spec = importlib.util.spec_from_file_location("conversation_migration", path)
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)
    engine = create_engine("sqlite://")
    with engine.begin() as connection:
        # Only the pre-existing children table is needed by this additive migration.
        from sqlalchemy import Column, MetaData, String, Table
        Table("children", MetaData(), Column("id", String, primary_key=True)).create(connection)
        with Operations.context(MigrationContext.configure(connection)):
            migration.upgrade()
            assert {"children", "ended_conversations", "decision_events"} <= set(inspect(connection).get_table_names())
            migration.downgrade()
            assert inspect(connection).get_table_names() == ["children"]
    engine.dispose()


@pytest.mark.asyncio
async def test_retry_refreshes_facts_without_mutating_saved_transcript(setup):
    client, db, _ = setup
    factory = sessionmaker(bind=db.get_bind())
    first = ended_payload()
    client.post("/api/coaching/conversations/end", json=first)
    await run_one(factory, ExtractionProvider())
    db.expire_all()
    event = db.query(DecisionEvent).one()
    event_id = event.id
    second = ended_payload()
    client.post("/api/coaching/conversations/end", json=second)
    await run_one(factory, ExtractionProvider(error=HTTPException(429, "Quota reached")))
    db.expire_all()
    assert event_id in db.get(EndedConversation, second["conversation_id"]).facts["decision_events"]
    db.get(DecisionEvent, event_id).status = "superseded"
    db.commit()
    response = client.post(f"/api/child/a/conversations/{second['conversation_id']}/extraction/retry")
    assert response.status_code == 202
    row = db.get(EndedConversation, second["conversation_id"])
    assert event_id not in row.facts["decision_events"]
    assert row.transcript == second["messages"]


@pytest.mark.asyncio
async def test_only_one_worker_claims_the_same_pending_job(setup):
    import asyncio
    client, db, _ = setup
    client.post("/api/coaching/conversations/end", json=ended_payload())
    entered, release = asyncio.Event(), asyncio.Event()
    class PausedProvider(ExtractionProvider):
        async def generate(self, *args):
            entered.set()
            await release.wait()
            return await super().generate(*args)
    provider = PausedProvider()
    factory = sessionmaker(bind=db.get_bind())
    first = asyncio.create_task(run_one(factory, provider))
    await entered.wait()
    try:
        assert await run_one(factory, provider) is False
    finally:
        release.set()
    await first
    db.expire_all()
    assert len(provider.calls) == 1
    assert db.query(DecisionEvent).count() == 1
