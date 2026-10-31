from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.core.database import get_db
from app.main import app
from app.models import Base, Child, EndedConversation, Family, ImpulseScore, PurchaseAssessmentJob, PurchaseNotification, Transaction
from app.schemas.purchase_assessment import ConversationSummary, FinalAssessment, Quote
from app.services import purchase_assessment as service


@pytest.fixture
def setup(tmp_path, monkeypatch):
    # Worker tests must never invoke the real LangChain model.
    monkeypatch.setattr(service, "assess_purchase", AsyncMock(
        return_value=(final(), {"purchase", "baseline"})))
    monkeypatch.setattr(settings, "DEMO_PURCHASES_ENABLED", True)
    monkeypatch.setattr(settings, "PURCHASE_ASSESSMENT_WORKER_ENABLED", False)
    engine = create_engine(f"sqlite:///{tmp_path / 'purchase.db'}", connect_args={"check_same_thread": False})
    @event.listens_for(engine, "connect")
    def enable_foreign_keys(connection, record):
        connection.execute("PRAGMA foreign_keys=ON")
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine)
    with factory() as db:
        db.add_all([Family(id="family", name="Family"), Family(id="other", name="Other")])
        db.flush()
        db.add(Child(id="child", family_id="family", name="Child", age=10))
        db.commit()
    def sessions():
        with factory() as db:
            yield db
    app.dependency_overrides[get_db] = sessions
    with TestClient(app) as client:
        yield client, factory
    app.dependency_overrides.clear()
    engine.dispose()


def buy(client):
    response = client.post("/api/demo/purchases", json={"transaction_id": str(uuid4()), "child_id": "child",
        "product": "Game", "merchant": "Steam", "category": "Gaming & In-App", "amount": "10.00", "currency": "USD"})
    assert response.status_code == 201, response.text
    assert response.json()["assessment"]["status"] == "pending"
    return response.json()["transaction_id"]


def final(decision="potentially_impulsive", **overrides):
    return FinalAssessment(decision=decision, explanation="This purchase may warrant a check-in.",
        evidence_refs=["purchase", "baseline"], conversation_effect="no_relevant_context",
        conversation_explanation="No relevant conversation evidence.", **overrides)


def baseline(score=80):
    return {"score": score, "risk_level": "HIGH" if score >= 70 else "LOW", "model_version": "test",
        "features": {"merchant_category": "Gaming & In-App"}, "defaults": {}, "factors": []}


@pytest.mark.asyncio
@pytest.mark.parametrize("decision,score,expected,used_history", [
    ("potentially_impulsive", 20, 1, True),
    ("potentially_impulsive", 80, 1, False),
    ("not_flagged", 95, 0, True),
    ("insufficient_context", 90, 0, False),
])
async def test_gemini_controls_alert_not_baseline(setup, monkeypatch, decision, score, expected, used_history):
    client, factory = setup
    transaction = buy(client)
    monkeypatch.setattr(service, "predict", lambda inputs: baseline(score))
    result = final(decision, historical_assessment_used=used_history)
    if not used_history:
        result.conversation_effect = "baseline_not_requested"
        result.evidence_refs = ["purchase"]
    agent = AsyncMock(return_value=(result, {"purchase", "baseline"} if used_history else {"purchase"}))
    monkeypatch.setattr(service, "assess_purchase", agent)
    provider = type("Provider", (), {"generate": AsyncMock()})()
    assert await service.run_one(factory, provider)
    assert not await service.run_one(factory, provider)
    response = client.get(f"/api/demo/purchases/{transaction}").json()
    assert response["assessment"]["score"] == score
    assert response["assessment"]["final_assessment"]["decision"] == decision
    assert agent.await_count == 1
    assert agent.call_args.kwargs["context"]["baseline"]["score"] == score
    provider.generate.assert_not_called()
    with factory() as db:
        assert db.query(ImpulseScore).count() == 1
        assert db.query(PurchaseNotification).count() == expected
        assert db.get(Transaction, transaction).is_impulsive is False
    notifications = client.get("/api/family/family/notifications").json()
    assert notifications["unread_count"] == expected
    if expected:
        notification = notifications["notifications"][0]
        assert "messages" not in notification
        assert notification["historical_assessment_used"] is used_history
        url = f"/api/family/family/notifications/{notification['id']}/read"
        assert client.patch(url).status_code == client.patch(url).status_code == 200
        assert client.get("/api/family/family/notifications").json()["unread_count"] == 0
        assert client.patch(f"/api/family/other/notifications/{notification['id']}/read").status_code == 404


@pytest.mark.asyncio
async def test_snapshot_recent_chats_and_retry_preserves_inputs(setup, monkeypatch):
    client, factory = setup
    now = datetime.now(timezone.utc)
    with factory() as db:
        for index in range(5):
            db.add(EndedConversation(id=f"c{index}", child_id="child", created_at=now - timedelta(days=5-index),
                transcript=[{"id": "m", "role": "user", "content": "I planned this game."}],
                facts={}, transcript_hash="x" * 64, status="pending"))
        db.add(Transaction(id="future", child_id="child", amount=999, merchant_name="Future", merchant_category="Other",
            timestamp=now + timedelta(days=1), is_deposit=True))
        db.commit()
    transaction = buy(client)
    with factory() as db:
        job = db.query(PurchaseAssessmentJob).one()
        original = job.snapshot
        assert [c["id"] for c in original["conversations"]] == ["c2", "c3", "c4"]
        assert original["ml_inputs"]["defaults"]["deposit"] is True
    predictor = lambda inputs: baseline()
    monkeypatch.setattr(service, "predict", predictor)
    agent = AsyncMock(side_effect=HTTPException(502, "invalid output"))
    monkeypatch.setattr(service, "assess_purchase", agent)
    provider = type("Provider", (), {"generate": AsyncMock()})()
    await service.run_one(factory, provider)
    with factory() as db:
        job = db.query(PurchaseAssessmentJob).one()
        assert job.status == "failed" and job.baseline["score"] == 80
    response = client.post(f"/api/demo/purchases/{transaction}/retry-assessment")
    assert response.status_code == 200
    monkeypatch.setattr(service, "predict", lambda inputs: pytest.fail("Baseline must not be recomputed"))
    agent.side_effect = None
    agent.return_value = (final("not_flagged"), {"purchase", "baseline"})
    await service.run_one(factory, provider)
    with factory() as db:
        job = db.query(PurchaseAssessmentJob).one()
        assert job.snapshot == original
        assert job.status == "completed"


def test_exact_quote_validation():
    conversations = [{"id": "c", "messages": [{"id": "m", "role": "user", "content": "I planned this."},
        {"id": "a", "role": "assistant", "content": "Buy now!"}]}]
    service.validate_quotes([Quote(conversation_id="c", message_id="m", quote="planned this")], conversations)
    for message, quote in [("m", "I want it now"), ("a", "Buy now!"), ("missing", "planned")]:
        with pytest.raises(HTTPException):
            service.validate_quotes([Quote(conversation_id="c", message_id=message, quote=quote)], conversations)


def test_chunk_limits_and_identity():
    conversation = {"id": "c", "messages": [{"id": "m", "role": "user", "content": "x" * 16000}]}
    chunks = list(service.chunks(conversation))
    assert "".join(m["content"] for chunk in chunks for m in chunk) == "x" * 16000
    assert all(m["id"] == "m" for chunk in chunks for m in chunk)
    assert all(service.estimate(chunk) < 1900 for chunk in chunks)


def test_actual_artifacts_load_and_predict():
    service.validate_model()


@pytest.mark.asyncio
async def test_no_fabricated_score_when_model_missing(setup, monkeypatch):
    from app.services import impulse_service
    client, factory = setup
    buy(client)
    monkeypatch.setattr(impulse_service, "get_production_model", lambda: (None, None))
    provider = type("Provider", (), {"generate": AsyncMock()})()
    await service.run_one(factory, provider)
    provider.generate.assert_not_called()
    service.assess_purchase.assert_not_called()
    with factory() as db:
        job = db.query(PurchaseAssessmentJob).one()
        assert job.status == "failed" and job.baseline is None
        assert db.query(PurchaseNotification).count() == 0


@pytest.mark.asyncio
async def test_summary_cache_survives_gemini_failure(setup, monkeypatch):
    client, factory = setup
    with factory() as db:
        db.add(EndedConversation(id="long", child_id="child", created_at=datetime.now(timezone.utc) - timedelta(days=1),
            transcript=[{"id": "m", "role": "user", "content": "I planned this game. " * 1800}],
            facts={}, transcript_hash="x" * 64, status="failed"))
        db.commit()
    transaction = buy(client)
    monkeypatch.setattr(service, "predict", lambda inputs: baseline())
    agent = AsyncMock(side_effect=HTTPException(502, "invalid final output"))
    monkeypatch.setattr(service, "assess_purchase", agent)
    calls = []
    async def generate(task, snapshot, refs, request, schema):
        calls.append(task)
        if task == "purchase_summary":
            return ConversationSummary(summary="The child says this game was planned.", quotes=[
                Quote(conversation_id="long", message_id="m", quote="planned this game")])
        pytest.fail(f"Unexpected direct provider task: {task}")
    provider = type("Provider", (), {})()
    provider.generate = generate
    await service.run_one(factory, provider)
    summary_calls = calls.count("purchase_summary")
    assert summary_calls > 1
    with factory() as db:
        job = db.query(PurchaseAssessmentJob).one()
        assert job.status == "failed" and job.summaries["long"]
        assert db.query(ImpulseScore).count() == 1
    client.post(f"/api/demo/purchases/{transaction}/retry-assessment")
    await service.run_one(factory, provider)
    assert calls.count("purchase_summary") == summary_calls
    assert agent.await_count == 2


@pytest.mark.asyncio
async def test_transient_retries_stop_after_three_and_preserve_baseline(setup, monkeypatch):
    client, factory = setup
    buy(client)
    monkeypatch.setattr(service, "predict", lambda inputs: baseline())
    agent = AsyncMock(side_effect=HTTPException(429, "quota"))
    monkeypatch.setattr(service, "assess_purchase", agent)
    provider = type("Provider", (), {"generate": AsyncMock()})()
    for attempt in range(3):
        assert await service.run_one(factory, provider)
        with factory() as db:
            job = db.query(PurchaseAssessmentJob).one()
            assert job.attempts["gemini"] == attempt + 1
            assert job.status == ("failed" if attempt == 2 else "pending")
            assert job.baseline is not None
            if attempt < 2:
                assert service.utc(job.next_attempt_at) > datetime.now(timezone.utc)
                job.next_attempt_at = datetime.now(timezone.utc) - timedelta(seconds=1)
                db.commit()
    assert agent.await_count == 3
    provider.generate.assert_not_called()
    with factory() as db:
        assert db.query(PurchaseNotification).count() == 0
        assert db.query(ImpulseScore).count() == 1


@pytest.mark.asyncio
async def test_stale_claim_recovers_once(setup, monkeypatch):
    client, factory = setup
    buy(client)
    with factory() as db:
        job = db.query(PurchaseAssessmentJob).one()
        job.status = "processing"
        job.processing_started_at = datetime.now(timezone.utc) - timedelta(minutes=6)
        db.commit()
    monkeypatch.setattr(service, "predict", lambda inputs: baseline())
    provider = type("Provider", (), {"generate": AsyncMock()})()
    assert await service.run_one(factory, provider)
    assert not await service.run_one(factory, provider)
    with factory() as db:
        assert db.query(PurchaseNotification).count() == 1


@pytest.mark.asyncio
async def test_reclaimed_worker_cannot_commit_old_result(setup, monkeypatch):
    import asyncio
    client, factory = setup
    buy(client)
    monkeypatch.setattr(service, "predict", lambda inputs: baseline())
    entered, release = asyncio.Event(), asyncio.Event()
    invocation = 0
    async def assess(*, context, model_name):
        nonlocal invocation
        invocation += 1
        if invocation == 1:
            entered.set()
            await release.wait()
            return final("not_flagged"), {"purchase", "baseline"}
        return final(), {"purchase", "baseline"}
    monkeypatch.setattr(service, "assess_purchase", assess)
    first_provider = type("Provider", (), {"generate": AsyncMock()})()
    first = asyncio.create_task(service.run_one(factory, first_provider))
    await asyncio.wait_for(entered.wait(), timeout=5)
    # A second worker cannot claim a live lease.
    second_provider = type("Provider", (), {"generate": AsyncMock()})()
    assert not await service.run_one(factory, second_provider)
    with factory() as db:
        job = db.query(PurchaseAssessmentJob).one()
        job.processing_started_at = datetime.now(timezone.utc) - timedelta(minutes=6)
        db.commit()
    assert await service.run_one(factory, second_provider)
    release.set()
    await first
    with factory() as db:
        assert db.query(PurchaseAssessmentJob).one().final_assessment["decision"] == "potentially_impulsive"
        assert db.query(PurchaseNotification).count() == db.query(ImpulseScore).count() == 1


def test_unavailable_and_unquoted_conversation_refs_rejected():
    snapshot = {"facts": {"goals": {}, "recent_purchases": {}}, "conversations": [
        {"id": "c", "messages": [{"id": "m", "role": "user", "content": "I planned this."}]}]}
    for ref in ("conversations.c", "conversations.other", "missing"):
        result = final()
        result.evidence_refs = [ref]
        with pytest.raises(HTTPException):
            service.validate_final(result, snapshot)


def test_migration_sqlite_roundtrip_and_postgres_ddl():
    import importlib.util
    import io
    from pathlib import Path
    from alembic.migration import MigrationContext
    from alembic.operations import Operations
    from sqlalchemy import inspect, text
    path = Path(__file__).resolve().parents[2] / "alembic/versions/f93e5cd02431_purchase_assessments.py"
    spec = importlib.util.spec_from_file_location("purchase_migration", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    engine = create_engine("sqlite://")
    with engine.begin() as connection:
        for table in ("families", "transactions", "impulse_scores"):
            connection.execute(text(f"CREATE TABLE {table} (id VARCHAR PRIMARY KEY)"))
        connection.execute(text("INSERT INTO impulse_scores (id) VALUES ('existing')"))
        with Operations.context(MigrationContext.configure(connection)):
            module.upgrade()
            assert "purchase_assessments" in inspect(connection).get_table_names()
            assert connection.execute(text("SELECT id FROM impulse_scores")).scalar_one() == "existing"
            module.downgrade()
            assert "purchase_assessments" not in inspect(connection).get_table_names()
            assert connection.execute(text("SELECT id FROM impulse_scores")).scalar_one() == "existing"
    output = io.StringIO()
    with Operations.context(MigrationContext.configure(dialect_name="postgresql", opts={"as_sql": True, "output_buffer": output})):
        module.upgrade()
    assert "uq_impulse_transaction" in output.getvalue()
    assert "CREATE TABLE purchase_notifications" in output.getvalue()


@pytest.mark.asyncio
@pytest.mark.parametrize("detail,expected", [
    ("Invalid purchase assessment response", "Invalid purchase assessment response"),
    ("private-transcript-canary", "Assessment could not finish"),
])
async def test_failed_assessment_diagnostics_are_specific_and_sanitized(setup, monkeypatch, caplog, detail, expected):
    client, factory = setup
    buy(client)
    monkeypatch.setattr(service, "predict", lambda inputs: baseline())
    monkeypatch.setattr(service, "assess_purchase", AsyncMock(side_effect=HTTPException(502, detail)))
    provider = type("Provider", (), {"generate": AsyncMock()})()
    await service.run_one(factory, provider)
    with factory() as db:
        job = db.query(PurchaseAssessmentJob).one()
        assert job.status == "failed"
        assert expected in job.error
        assert "private-transcript-canary" not in job.error
    assert "status=502" in caplog.text
    assert expected in caplog.text
    assert "private-transcript-canary" not in caplog.text
