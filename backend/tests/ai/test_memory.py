from datetime import datetime, timezone
from pathlib import Path
import importlib.util
import uuid

import pytest
from sqlalchemy import create_engine, text, inspect
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

from app.core.ai import get_ai_provider
from app.core.database import get_db
from app.main import app
from app.models import Base, Child, Family, EndedConversation, DecisionEvent, SemanticMemory
from app.schemas.decisions import ExtractionOutput
from app.schemas.memory import CoreUpdate, SemanticUpdate
from app.services.ai_context_service import build_context, evidence_refs
from app.services.decision_extraction import run_one
from app.repositories.semantic_memory_repo import SemanticMemoryRepository, query_terms


@pytest.fixture
def memory_setup():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine)
    with factory() as db:
        db.add(Family(id="family", name="Family"))
        db.add_all([Child(id="one", family_id="family", name="One", age=10),
                    Child(id="two", family_id="family", name="Two", age=9)])
        db.commit()
        app.dependency_overrides[get_db] = lambda: db
        with TestClient(app) as client:
            yield client, db, factory
        app.dependency_overrides.clear()
    engine.dispose()


QUOTE = "I prefer brief explanations and gaming with friends makes buying skins tempting."
EV = [{"message_id": "m1", "quote": QUOTE}]


def payload(child="one", message=QUOTE):
    return {"conversation_id": str(uuid.uuid4()), "child_id": child,
            "messages": [{"id": "m1", "role": "user", "content": message}]}


def core(key="communication_style", value="Prefers brief explanations", operation="upsert"):
    return {"operation": operation, "key": key, "value": value, "evidence": EV}


def semantic(key="gaming_peer_pressure", summary="Reports pressure to buy gaming skins with friends", operation="upsert"):
    return {"operation": operation, "memory_key": key,
        "name": "Gaming peer pressure" if operation == "upsert" else None,
        "topic": "gaming" if operation == "upsert" else None,
        "summary": summary if operation == "upsert" else None, "details": None,
        "origin": "explicit", "evidence": EV}


class MemoryProvider:
    def __init__(self, cores=None, semantics=None, decisions=None):
        self.output = ExtractionOutput(decisions=decisions or [], core_updates=cores or [], semantic_updates=semantics or [])
        self.calls = []

    async def generate(self, task, facts, refs, request, schema):
        self.calls.append((task, facts, refs, request))
        if task == "extract_decisions":
            return self.output
        if task == "chat":
            return schema(message="What would help?", evidence_refs=sorted(refs)) if len(refs) <= 10 else schema(message="What would help?")
        return schema(status="insufficient_data", explanation="Need more financial context")


async def extract(setup, provider, body=None):
    client, db, factory = setup
    body = body or payload()
    response = client.post("/api/coaching/conversations/end", json=body)
    assert response.status_code == 202, response.text
    assert await run_one(factory, provider)
    db.expire_all()
    return db.get(EndedConversation, body["conversation_id"])


def test_empty_state_and_legacy_extraction_defaults(memory_setup):
    _, db, _ = memory_setup
    snapshot = build_context(db, "one")
    assert snapshot["core_memory"] == {"schema_version": 1, "revision": 0, "entries": {}}
    assert snapshot["semantic_memories"] == {}
    assert ExtractionOutput(decisions=[]).core_updates == []
    assert ExtractionOutput(decisions=[]).semantic_updates == []


@pytest.mark.asyncio
async def test_preferences_and_facts_saved_without_decision_events(memory_setup):
    client, db, _ = memory_setup
    provider = MemoryProvider([core()], [semantic()])
    job = await extract(memory_setup, provider)
    assert job.status == "completed", job.error
    assert db.query(DecisionEvent).count() == 0
    state = db.get(Child, "one").core_memory
    assert state["revision"] == 1
    assert state["entries"]["communication_style"]["conversation_id"] == job.id
    record = db.query(SemanticMemory).one()
    assert record.origin == "explicit" and record.revision == 1
    snapshot = build_context(db, "one", retrieval_text="gaming")
    assert snapshot["core_memory"]["entries"]["communication_style"]["value"] == "Prefers brief explanations"
    assert record.id in snapshot["semantic_memories"]
    assert {"core_memory.entries.communication_style", f"semantic_memories.{record.id}"} <= evidence_refs(snapshot)
    other = build_context(db, "two", retrieval_text="gaming")
    assert other["core_memory"]["entries"] == {} and other["semantic_memories"] == {}
    assert client.post("/api/coaching/conversations/end", json={
        "conversation_id": job.id, "child_id": "one", "messages": job.transcript}).json()["status"] == "completed"
    assert len(provider.calls) == 1


@pytest.mark.asyncio
async def test_recursive_merge_correction_removal_and_unchanged_values(memory_setup):
    _, db, _ = memory_setup
    await extract(memory_setup, MemoryProvider([core()]))
    await extract(memory_setup, MemoryProvider([core("interests", "Gaming")]))
    await extract(memory_setup, MemoryProvider([core(value="Prefers detailed explanations")]))
    state = db.get(Child, "one").core_memory
    assert state["revision"] == 3
    assert state["entries"]["interests"]["value"] == "Gaming"
    assert state["entries"]["communication_style"]["value"] == "Prefers detailed explanations"
    await extract(memory_setup, MemoryProvider([core(value="Prefers detailed explanations")]))
    assert db.get(Child, "one").core_memory["revision"] == 3
    await extract(memory_setup, MemoryProvider([core(value=None, operation="remove")]))
    state = db.get(Child, "one").core_memory
    assert state["revision"] == 4 and "communication_style" not in state["entries"]
    assert "interests" in state["entries"]


@pytest.mark.asyncio
async def test_semantic_revisions_retraction_and_exact_duplicates(memory_setup):
    _, db, _ = memory_setup
    await extract(memory_setup, MemoryProvider(semantics=[semantic()]))
    original = db.query(SemanticMemory).one().id
    await extract(memory_setup, MemoryProvider(semantics=[semantic()]))
    await extract(memory_setup, MemoryProvider(semantics=[semantic(key="duplicate_alias")]))
    assert db.query(SemanticMemory).count() == 1
    assert db.get(Child, "one").core_memory["revision"] == 1
    await extract(memory_setup, MemoryProvider(semantics=[semantic(summary="Reports gaming purchases are now planned")]))
    db.expire_all()
    assert db.get(SemanticMemory, original).status == "superseded"
    active = db.query(SemanticMemory).filter_by(status="active").one()
    assert active.revision == 2 and active.supersedes_id == original
    await extract(memory_setup, MemoryProvider(semantics=[semantic(operation="retract")]))
    assert SemanticMemoryRepository(db).retrieve("one", "gaming") == []
    assert db.query(SemanticMemory).filter_by(status="retracted").one().revision == 3


@pytest.mark.asyncio
@pytest.mark.parametrize("bad_evidence", [[{"message_id": "missing", "quote": QUOTE}],
    [{"message_id": "m1", "quote": "Not in transcript"}], [{"message_id": "assistant", "quote": QUOTE}]])
async def test_bad_evidence_rolls_back_all_memory_types(memory_setup, bad_evidence):
    _, db, _ = memory_setup
    body = payload()
    body["messages"].append({"id": "assistant", "role": "assistant", "content": QUOTE})
    job = await extract(memory_setup, MemoryProvider([core()], [semantic() | {"evidence": bad_evidence}]), body)
    assert job.status == "failed"
    assert db.get(Child, "one").core_memory["revision"] == 0
    assert db.query(SemanticMemory).count() == db.query(DecisionEvent).count() == 0


@pytest.mark.asyncio
async def test_stale_updates_reject_and_explicit_retry_refreshes_state(memory_setup):
    client, db, factory = memory_setup
    first, second = payload(), payload()
    client.post("/api/coaching/conversations/end", json=first)
    client.post("/api/coaching/conversations/end", json=second)
    provider = MemoryProvider([core()])
    await run_one(factory, provider)
    await run_one(factory, MemoryProvider([core("interests", "Gaming")]))
    db.expire_all()
    job = db.get(EndedConversation, second["conversation_id"])
    assert job.status == "failed" and "Memory changed" in job.error
    assert db.get(Child, "one").core_memory["revision"] == 1
    assert client.post(f"/api/child/one/conversations/{job.id}/extraction/retry").json()["status"] == "pending"
    await run_one(factory, MemoryProvider([core("interests", "Gaming")]))
    db.expire_all()
    assert db.get(EndedConversation, job.id).status == "completed"
    assert set(db.get(Child, "one").core_memory["entries"]) == {"interests", "communication_style"}


def add_memory(db, child, key, name, topic="other", summary="Other", status="active", time=None):
    job_id = str(uuid.uuid4())
    db.add(EndedConversation(id=job_id, child_id=child, transcript=[], facts={}, transcript_hash="test", status="completed"))
    db.add(SemanticMemory(id=key + child, child_id=child, memory_key=key, name=name, topic=topic, summary=summary,
        status=status, revision=1, source_conversation_id=job_id, evidence=EV, extractor_version="test",
        updated_at=time or datetime.now(timezone.utc)))
    db.commit()


def test_sql_retrieval_weights_limits_ties_and_no_unrelated_fallback(memory_setup):
    _, db, _ = memory_setup
    same_time = datetime(2026, 1, 1, tzinfo=timezone.utc)
    add_memory(db, "one", "low", "Other", summary="gaming", time=same_time)
    add_memory(db, "one", "mid", "Other", topic="gaming", time=same_time)
    for key in ["topb", "topa", "topc", "topd", "tope", "topf"]:
        add_memory(db, "one", key, "gaming", time=same_time)
    add_memory(db, "two", "foreign", "gaming")
    add_memory(db, "one", "inactive", "gaming", status="superseded")
    repo = SemanticMemoryRepository(db)
    assert [row.memory_key for row in repo.retrieve("one", "gaming")] == ["topa", "topb", "topc", "topd", "tope"]
    full = repo.retrieve("one", "gaming", 20)
    assert [row.memory_key for row in full][-2:] == ["mid", "low"]
    assert repo.retrieve("one", "please tell me") == []
    assert repo.retrieve("one", "zebras") == []
    assert repo.retrieve("one", "% _ '") == []
    assert len(query_terms(" ".join(f"term{i}" for i in range(50)))) == 20
    assert query_terms("GAME game Please") == ["game"]


@pytest.mark.asyncio
async def test_chat_and_purchase_context_query_semantics(memory_setup):
    client, db, _ = memory_setup
    await extract(memory_setup, MemoryProvider([core()], [semantic()]))
    db.add(SemanticMemory(child_id="one", memory_key="pattern_gaming_alternatives",
        name="Gaming alternatives", topic="gaming", summary="Tentative gaming pattern", origin="inferred",
        revision=1, source_conversation_id=db.query(EndedConversation).first().id,
        evidence=[], pattern_evidence={"supporting": [], "contradicting": []}, extractor_version="test"))
    db.commit()
    provider = MemoryProvider()
    app.dependency_overrides[get_ai_provider] = lambda: provider
    assert client.post("/api/coaching/chat", json={"child_id": "one", "message": "What about that?",
        "history": [{"role": "user", "content": "Gaming skins are tempting"}]}).status_code == 200
    assert client.post("/api/extension/assess-purchase", json={"child_id": "one", "product": "Gaming skin",
        "merchant": "Store", "category": "gaming", "amount": "5.00", "currency": "USD",
        "timestamp": datetime.now(timezone.utc).isoformat()}).status_code == 200
    for task, facts, refs, request in provider.calls:
        assert facts["core_memory"]["entries"]
        assert len(facts["semantic_memories"]) == 2
        assert {record["origin"] for record in facts["semantic_memories"].values()} == {"explicit", "inferred"}
        assert any(ref.startswith("semantic_memories.") for ref in refs)
    assert len(provider.calls) == 2
    assert provider.calls[0][3]["history"][0]["content"] == "Gaming skins are tempting"


@pytest.mark.parametrize("update", [core(key="name"), core(value="x" * 251)])
def test_core_schema_rejects_non_core_fields_and_oversized_values(update):
    with pytest.raises(ValueError):
        CoreUpdate.model_validate(update)


def test_semantic_schema_disallows_inferred_origin():
    with pytest.raises(ValueError):
        SemanticUpdate.model_validate(semantic() | {"origin": "inferred"})


@pytest.mark.asyncio
async def test_late_write_failure_rolls_back_prior_semantic_flush_and_core(memory_setup):
    _, db, _ = memory_setup
    provider = MemoryProvider([core()], [semantic(), semantic(key="missing_key", operation="retract")], decisions=[{
        "action": "other", "outcome_status": "commitment", "situation": "Discussed gaming",
        "goal_relationship": "unclear", "evidence": EV, "supersedes_event_id": None}])
    job = await extract(memory_setup, provider)
    assert job.status == "failed"
    assert db.query(SemanticMemory).count() == 0
    assert db.query(DecisionEvent).count() == 0
    assert db.get(Child, "one").core_memory["revision"] == 0


@pytest.mark.asyncio
async def test_conflicting_operations_and_cross_child_targets_rejected(memory_setup):
    _, db, _ = memory_setup
    await extract(memory_setup, MemoryProvider(semantics=[semantic()]), payload(child="two"))
    job = await extract(memory_setup, MemoryProvider([core(), core(value="Different")]))
    assert job.status == "failed"
    job = await extract(memory_setup, MemoryProvider(semantics=[semantic(operation="retract")]))
    assert job.status == "failed"
    assert db.query(SemanticMemory).filter_by(child_id="two", status="active").count() == 1


@pytest.mark.asyncio
async def test_extraction_retrieves_twenty_candidates_without_model_search(memory_setup):
    client, db, factory = memory_setup
    for index in range(22):
        add_memory(db, "one", f"gaming{index:02}", "Gaming")
    body = payload()
    response = client.post("/api/coaching/conversations/end", json=body)
    assert response.status_code == 202
    provider = MemoryProvider()
    await run_one(factory, provider)
    assert len(provider.calls) == 1
    assert len(provider.calls[0][1]["semantic_memories"]) == 20
    assert db.query(SemanticMemory).count() == 22


def test_additive_migration_initializes_and_preserves_existing_data():
    from alembic.migration import MigrationContext
    from alembic.operations import Operations
    path = Path(__file__).resolve().parents[2] / "alembic/versions/c42f8e91d703_core_and_semantic_memory.py"
    spec = importlib.util.spec_from_file_location("memory_migration", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    engine = create_engine("sqlite://")
    with engine.begin() as connection:
        connection.execute(text("CREATE TABLE children (id VARCHAR PRIMARY KEY, name VARCHAR)"))
        connection.execute(text("CREATE TABLE ended_conversations (id VARCHAR PRIMARY KEY)"))
        connection.execute(text("INSERT INTO children (id, name) VALUES ('existing', 'Child')"))
        with Operations.context(MigrationContext.configure(connection)):
            module.upgrade()
            import json
            state = json.loads(connection.execute(text("SELECT core_memory FROM children")).scalar_one())
            assert state == {"schema_version": 1, "revision": 0, "entries": {}}
            assert "semantic_memories" in inspect(connection).get_table_names()
            module.downgrade()
            assert connection.execute(text("SELECT name FROM children")).scalar_one() == "Child"
            assert "semantic_memories" not in inspect(connection).get_table_names()
    engine.dispose()
