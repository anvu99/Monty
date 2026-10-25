from datetime import datetime, timedelta, timezone
import importlib.util
from pathlib import Path

from fastapi import HTTPException
import pytest
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.models import Base, Child, Family, EndedConversation, SemanticMemory
from app.schemas.memory import ConsolidationOutput
from app.services import semantic_consolidation as service
from app.services.ai_context_service import build_context, evidence_refs
from app.repositories.semantic_memory_repo import SemanticMemoryRepository

NOW = datetime.now(timezone.utc) - timedelta(days=1)
QUOTE = "Finding a free alternative helped me feel less tempted."


@pytest.fixture
def setup():
    engine = create_engine("sqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine)
    with factory() as db:
        db.add(Family(id="family", name="Family"))
        db.add_all([Child(id="one", family_id="family", name="One", age=10),
                    Child(id="two", family_id="family", name="Two", age=9)])
        db.commit()
    yield factory
    engine.dispose()


def add_chats(factory, count=3, child="one", start=0, same_day=False):
    with factory() as db:
        for index in range(start, start + count):
            date = NOW - timedelta(days=10 - index) if not same_day else NOW
            db.add(EndedConversation(id=f"{child}-{index}", child_id=child, created_at=date,
                transcript=[{"id": "m1", "role": "user", "content": QUOTE},
                            {"id": "a1", "role": "assistant", "content": "An assistant suggestion"}],
                facts={}, transcript_hash=str(index), status="completed"))
        db.commit()


def proposal(ids=("one-0", "one-1"), operation="upsert"):
    evidence = [{"conversation_id": id, "message_id": "m1", "quote": QUOTE} for id in ids]
    return {"operation": operation, "memory_key": "pattern_free_alternatives", "name": "Free alternatives",
        "topic": "temptation", "summary": "Reports less temptation after identifying free alternatives",
        "supporting": evidence if operation == "upsert" else [],
        "contradicting": evidence if operation == "retract" else []}


class Provider:
    def __init__(self, updates=None, callback=None, error=None):
        self.output = ConsolidationOutput(updates=updates or [])
        self.calls = []
        self.callback = callback
        self.error = error

    async def generate(self, task, facts, refs, request, schema):
        self.calls.append((task, facts, refs, request))
        if self.callback:
            self.callback()
        if self.error:
            raise self.error
        return self.output


def progress(factory):
    with factory() as db:
        return db.get(Child, "one").semantic_consolidation


@pytest.mark.asyncio
async def test_initial_history_threshold_and_successful_noop_advances_watermark(setup):
    add_chats(setup, 2)
    provider = Provider()
    assert not await service.run_one(setup, provider)
    add_chats(setup, 1, start=2)
    assert await service.run_one(setup, provider)
    assert progress(setup)["status"] == "completed"
    assert progress(setup)["watermark"]["id"] == "one-2"
    assert not await service.run_one(setup, provider)
    add_chats(setup, 2, start=3)
    assert not await service.run_one(setup, provider)
    add_chats(setup, 1, start=5)
    assert await service.run_one(setup, provider)
    assert len(provider.calls) == 2
    assert [row["id"] for row in provider.calls[-1][3]["conversations"]] == [f"one-{i}" for i in range(1, 6)]


@pytest.mark.asyncio
async def test_pattern_saved_and_injected_with_evidence_and_unchanged_core_entries(setup):
    add_chats(setup)
    provider = Provider([proposal()])
    assert await service.run_one(setup, provider)
    with setup() as db:
        memory = db.query(SemanticMemory).one()
        assert memory.origin == "inferred" and memory.revision == 1
        assert memory.source_conversation_id == "one-2"
        assert memory.pattern_evidence["contradicting"] == []
        assert db.get(Child, "one").core_memory == {"schema_version": 1, "revision": 1, "entries": {}}
        snapshot = build_context(db, "one", retrieval_text="free alternatives")
        record = snapshot["semantic_memories"][memory.id]
        assert record["origin"] == "inferred" and record["supporting_conversation_count"] == 2
        assert record["first_observed_at"] and record["last_observed_at"]
        assert f"semantic_memories.{memory.id}" in evidence_refs(snapshot)
        assert build_context(db, "two", retrieval_text="free alternatives")["semantic_memories"] == {}


@pytest.mark.asyncio
@pytest.mark.parametrize("bad", ["same_day", "single", "assistant", "foreign", "bad_quote", "conflict"])
async def test_invalid_evidence_rolls_back_and_does_not_automatically_retry(setup, bad):
    add_chats(setup, same_day=bad == "same_day")
    item = proposal()
    if bad == "single": item["supporting"] = item["supporting"][:1]
    if bad == "assistant": item["supporting"][0].update(message_id="a1", quote="An assistant suggestion")
    if bad == "foreign": item["supporting"][0]["conversation_id"] = "two-0"
    if bad == "bad_quote": item["supporting"][0]["quote"] = "fabricated"
    if bad == "conflict": item["contradicting"] = item["supporting"][:1]
    provider = Provider([item])
    await service.run_one(setup, provider)
    assert progress(setup)["status"] == "failed"
    assert "watermark" not in progress(setup)
    with setup() as db:
        assert db.query(SemanticMemory).count() == 0
    assert not await service.run_one(setup, provider)


@pytest.mark.asyncio
async def test_retry_refreshes_after_stale_revision_and_failure_is_sanitized(setup):
    add_chats(setup)
    def concurrent_update():
        with setup() as db:
            db.get(Child, "one").core_memory = {"schema_version": 1, "revision": 1, "entries": {}}
            db.commit()
    await service.run_one(setup, Provider([proposal()], callback=concurrent_update))
    assert progress(setup)["status"] == "failed"
    assert "Memory changed" in progress(setup)["error"]
    with setup() as db: service.retry(db, "one")
    await service.run_one(setup, Provider([proposal()]))
    assert progress(setup)["status"] == "completed"
    add_chats(setup, 3, start=3)
    await service.run_one(setup, Provider(error=RuntimeError("private model output")))
    assert "private" not in progress(setup)["error"]
    assert progress(setup)["watermark"]["id"] == "one-2"


@pytest.mark.asyncio
async def test_lease_exclusion_reclaim_and_old_worker_cannot_commit(setup):
    add_chats(setup)
    with setup() as db: first = service.claim(db, datetime.now(timezone.utc))
    with setup() as db: assert service.claim(db, datetime.now(timezone.utc)) is None
    with setup() as db:
        child = db.get(Child, "one")
        state = dict(child.semantic_consolidation)
        state["lease_at"] = (datetime.now(timezone.utc) - timedelta(minutes=6)).isoformat()
        child.semantic_consolidation = state
        db.commit()
    with setup() as db: second = service.claim(db, datetime.now(timezone.utc))
    assert first["lease"] != second["lease"]
    assert progress(setup)["attempts"] == 2


@pytest.mark.asyncio
async def test_new_chats_during_generation_remain_pending_for_next_batch(setup):
    add_chats(setup)
    await service.run_one(setup, Provider(callback=lambda: add_chats(setup, 3, start=3)))
    assert progress(setup)["watermark"]["id"] == "one-2"
    assert await service.run_one(setup, Provider())
    assert progress(setup)["watermark"]["id"] == "one-5"


@pytest.mark.asyncio
async def test_replaced_lease_prevents_old_worker_from_saving_or_marking_failed(setup):
    add_chats(setup)
    def replace_lease():
        with setup() as db:
            child = db.get(Child, "one")
            state = dict(child.semantic_consolidation)
            state["lease_token"] = "replacement-worker"
            child.semantic_consolidation = state
            db.commit()
    await service.run_one(setup, Provider([proposal()], callback=replace_lease))
    assert progress(setup)["lease_token"] == "replacement-worker"
    assert progress(setup)["status"] == "processing"
    with setup() as db:
        assert db.query(SemanticMemory).count() == 0


@pytest.mark.asyncio
async def test_explicit_records_are_protected_and_partial_patterns_roll_back(setup):
    add_chats(setup)
    with setup() as db:
        db.add(SemanticMemory(child_id="one", memory_key="pattern_existing", name="Free alternatives",
            topic="temptation", summary="Explicit record", origin="explicit", revision=1,
            source_conversation_id="one-0", evidence=[], extractor_version="test"))
        db.commit()
    second = proposal()
    second["memory_key"] = "pattern_existing"
    await service.run_one(setup, Provider([proposal(), second]))
    assert progress(setup)["status"] == "failed"
    with setup() as db:
        assert db.query(SemanticMemory).count() == 1
        assert db.query(SemanticMemory).one().summary == "Explicit record"
        assert db.get(Child, "one").core_memory["revision"] == 0


def test_deterministic_ties_and_future_exclusion(setup):
    add_chats(setup, 6, same_day=True)
    with setup() as db:
        db.add(EndedConversation(id="future", child_id="one", created_at=datetime.now(timezone.utc) + timedelta(days=1),
            transcript=[], transcript_hash="future", facts={}))
        db.commit()
        snapshot = service.claim(db, datetime.now(timezone.utc))
    assert [row["id"] for row in snapshot["conversations"]] == [f"one-{i}" for i in range(1, 6)]


@pytest.mark.asyncio
async def test_dedup_revisions_and_single_correction_retraction(setup):
    add_chats(setup)
    await service.run_one(setup, Provider([proposal()]))
    # Apply to the same immutable evidence batch to verify exact deduplication.
    with setup() as db:
        memory = db.query(SemanticMemory).one()
        conversations = [{"id": r.id, "created_at": service.utc(r.created_at).isoformat(), "messages": r.transcript}
                         for r in db.query(EndedConversation).all()]
        snapshot = {"revision": 1, "conversations": conversations,
            "semantic_memories": {memory.id: {}}, "watermark": {"id": "one-2"}}
        service.apply(db, db.get(Child, "one"), snapshot, ConsolidationOutput(updates=[proposal()]), NOW)
        db.commit()
        assert db.query(SemanticMemory).count() == 1
        changed = proposal()
        changed["summary"] = "Sometimes reports free alternatives help reduce temptation"
        service.apply(db, db.get(Child, "one"), snapshot, ConsolidationOutput(updates=[changed]), NOW)
        db.commit()
        latest = db.query(SemanticMemory).filter_by(status="active").one()
        assert latest.revision == 2
        snapshot.update(revision=2, semantic_memories={latest.id: {}})
        retract = proposal(("one-0",), operation="retract")
        service.validate(ConsolidationOutput(updates=[retract]), conversations)
        service.apply(db, db.get(Child, "one"), snapshot, ConsolidationOutput(updates=[retract]), NOW)
        db.commit()
        assert db.query(SemanticMemory).filter_by(status="active").count() == 0
        assert db.query(SemanticMemory).filter_by(status="retracted").one().revision == 3


def test_retrieval_explicit_priority_inferred_cap_and_origin_filter(setup):
    add_chats(setup)
    with setup() as db:
        for i in range(8):
            db.add(SemanticMemory(child_id="one", memory_key=f"key_{i}", name="Free alternatives",
                topic="temptation", summary="Reports free alternatives", origin="explicit" if i < 2 else "inferred",
                revision=1, source_conversation_id="one-0", evidence=[], extractor_version="test"))
        db.commit()
        repo = SemanticMemoryRepository(db)
        result = repo.retrieve("one", "free alternatives")
        assert [r.origin for r in result] == ["explicit", "explicit", "inferred", "inferred"]
        assert len(repo.retrieve("one", "free alternatives", 20, origin="inferred")) == 6
        assert repo.retrieve("one", "unrelated") == []


def test_migration_preserves_explicit_rows_upgrade_and_downgrade():
    from alembic.migration import MigrationContext
    from alembic.operations import Operations
    path = Path(__file__).resolve().parents[2] / "alembic/versions/d71b3fa80219_semantic_consolidation.py"
    spec = importlib.util.spec_from_file_location("consolidation_migration", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    engine = create_engine("sqlite://")
    with engine.begin() as connection:
        connection.execute(text("CREATE TABLE children (id VARCHAR PRIMARY KEY)"))
        connection.execute(text("CREATE TABLE semantic_memories (id VARCHAR PRIMARY KEY, origin VARCHAR)"))
        connection.execute(text("INSERT INTO children VALUES ('one')"))
        connection.execute(text("INSERT INTO semantic_memories VALUES ('explicit','explicit')"))
        with Operations.context(MigrationContext.configure(connection)):
            module.upgrade()
            assert connection.execute(text("SELECT semantic_consolidation FROM children")).scalar_one() == '{}'
            assert "pattern_evidence" in {c["name"] for c in inspect(connection).get_columns("semantic_memories")}
            connection.execute(text("INSERT INTO semantic_memories (id, origin) VALUES ('inferred','inferred')"))
            module.downgrade()
            assert connection.execute(text("SELECT id FROM semantic_memories")).scalars().all() == ["explicit"]
            assert "semantic_consolidation" not in {c["name"] for c in inspect(connection).get_columns("children")}
    engine.dispose()
