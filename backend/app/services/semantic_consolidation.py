"""Leased, child-scoped consolidation of raw saved conversation transcripts."""
from datetime import datetime, timedelta, timezone
import logging
import uuid

from fastapi import HTTPException
from sqlalchemy import and_, or_

from app.core.config import settings
from app.models import Child, EndedConversation, SemanticMemory
from app.repositories.semantic_memory_repo import SemanticMemoryRepository
from app.schemas.memory import ConsolidationOutput
from app.services.memory_service import core_state, _content

logger = logging.getLogger(__name__)


def utc(value):
    if isinstance(value, str):
        value = datetime.fromisoformat(value)
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


def conversations_query(db, child_id, now):
    return db.query(EndedConversation).filter(EndedConversation.child_id == child_id,
        EndedConversation.created_at <= now)


def claim(db, now):
    # Lock one child only while selecting and persisting the generation snapshot.
    # SKIP LOCKED prevents parallel PostgreSQL workers from claiming the same child.
    child_ids = db.query(Child.id).order_by(Child.id).all()
    for (child_id,) in child_ids:
        child = db.query(Child).filter_by(id=child_id).with_for_update(skip_locked=True).first()
        if child is None:
            continue
        state = dict(child.semantic_consolidation or {})
        status = state.get("status")
        if status == "failed":
            db.rollback()
            continue
        if status == "processing" and state.get("lease_at") and utc(state["lease_at"]) > now - timedelta(minutes=5):
            db.rollback()
            continue
        query = conversations_query(db, child_id, now)
        mark = state.get("watermark")
        if mark:
            date = utc(mark["created_at"])
            query = query.filter(or_(EndedConversation.created_at > date,
                and_(EndedConversation.created_at == date, EndedConversation.id > mark["id"])))
        if query.count() < 3:
            db.rollback()
            continue
        batch = conversations_query(db, child_id, now).order_by(
            EndedConversation.created_at.desc(), EndedConversation.id.desc()).limit(5).all()
        conversations = [{"id": row.id, "created_at": utc(row.created_at).isoformat(),
                          "messages": row.transcript} for row in reversed(batch)]
        text = "\n".join(message["content"] for row in conversations for message in row["messages"]
                         if message["role"] == "user")
        candidates = SemanticMemoryRepository(db).retrieve(child_id, text, 20, origin="inferred")
        memories = {row.id: {"id": row.id, "memory_key": row.memory_key, "name": row.name,
            "topic": row.topic, "summary": row.summary, "details": row.details,
            "origin": row.origin, "revision": row.revision,
            "pattern_evidence": row.pattern_evidence} for row in candidates}
        lease = str(uuid.uuid4())
        state.update(status="processing", batch_ids=[row.id for row in batch],
            lease_at=now.isoformat(), lease_token=lease, attempts=state.get("attempts", 0) + 1,
            error=None)
        child.semantic_consolidation = state
        snapshot = {"child_id": child_id, "lease": lease, "revision": core_state(child).revision,
            "conversations": conversations, "semantic_memories": memories,
            "watermark": {"created_at": utc(batch[0].created_at).isoformat(), "id": batch[0].id}}
        db.commit()
        return snapshot
    return None


def validate(output, conversations):
    sources = {row["id"]: row for row in conversations}
    keys = [item.memory_key for item in output.updates]
    if len(keys) != len(set(keys)):
        raise HTTPException(502, "Consolidation returned conflicting updates for one key")
    for item in output.updates:
        if item.operation == "retract" and not item.contradicting:
            raise HTTPException(502, "Pattern retraction requires child correction evidence")
        for evidence in item.supporting + item.contradicting:
            row = sources.get(evidence.conversation_id)
            message = next((m for m in row["messages"] if m["id"] == evidence.message_id), None) if row else None
            if not message or message["role"] != "user" or evidence.quote not in message["content"]:
                raise HTTPException(502, "Pattern evidence does not match a child message in this batch")
        support_ids = {e.conversation_id for e in item.supporting}
        dates = {utc(sources[key]["created_at"]).date() for key in support_ids}
        if item.operation == "upsert" and (len(support_ids) < 2 or len(dates) < 2):
            raise HTTPException(502, "Inferred patterns require support from two conversations on different UTC days")
        supporting_refs = {(e.conversation_id, e.message_id, e.quote) for e in item.supporting}
        if supporting_refs.intersection((e.conversation_id, e.message_id, e.quote) for e in item.contradicting):
            raise HTTPException(502, "One quote cannot both support and contradict a pattern")


def evidence_data(item):
    return {kind: sorted([e.model_dump() for e in getattr(item, kind)],
        key=lambda e: (e["conversation_id"], e["message_id"], e["quote"]))
        for kind in ("supporting", "contradicting")}


def apply(db, child, snapshot, output, now):
    state = core_state(child)
    if state.revision != snapshot["revision"]:
        raise HTTPException(409, "Memory changed during consolidation; retry to refresh the batch")
    repo = SemanticMemoryRepository(db)
    changed = False
    sources = {row["id"]: row for row in snapshot["conversations"]}
    for item in output.updates:
        latest = repo.latest(child.id, item.memory_key)
        if latest and (latest.origin != "inferred" or latest.id not in snapshot["semantic_memories"]):
            raise HTTPException(409, "Pattern update targets a record outside the consolidation context")
        active = latest if latest and latest.status == "active" else None
        if item.operation == "retract" and not active:
            raise HTTPException(502, "Cannot retract an unavailable pattern")
        evidence = evidence_data(item)
        if active and item.operation == "upsert" and _content(active) == _content(item) and active.pattern_evidence == evidence:
            active.last_evaluated_at = now
            continue
        if active:
            active.status = "superseded"
        support_dates = [utc(sources[e.conversation_id]["created_at"]) for e in item.supporting]
        db.add(SemanticMemory(child_id=child.id, memory_key=item.memory_key,
            name=active.name if item.operation == "retract" else item.name,
            topic=active.topic if item.operation == "retract" else item.topic,
            summary=active.summary if item.operation == "retract" else item.summary,
            details=active.details if item.operation == "retract" else item.details,
            status="retracted" if item.operation == "retract" else "active",
            origin="inferred", revision=latest.revision + 1 if latest else 1,
            supersedes_id=latest.id if latest else None,
            source_conversation_id=snapshot["watermark"]["id"],
            evidence=[e.model_dump() for e in item.supporting], pattern_evidence=evidence,
            first_observed_at=min(support_dates) if support_dates else active.first_observed_at,
            last_observed_at=max(support_dates) if support_dates else active.last_observed_at,
            last_evaluated_at=now,
            extractor_version=f"{settings.AI_PROMPT_VERSION}:{settings.GEMINI_MODEL}:consolidation"))
        db.flush()
        changed = True
    if changed:
        state.revision += 1
        child.core_memory = state.model_dump(mode="json")


async def run_one(session_factory, provider):
    now = datetime.now(timezone.utc)
    with session_factory() as db:
        snapshot = claim(db, now)
    if not snapshot:
        return False
    try:
        memories = snapshot["semantic_memories"]
        output = await provider.generate("consolidate_semantic", {"semantic_memories": memories},
            {f"semantic_memories.{key}" for key in memories},
            {"conversations": snapshot["conversations"]}, ConsolidationOutput)
        validate(output, snapshot["conversations"])
        with session_factory() as db:
            child = db.query(Child).filter_by(id=snapshot["child_id"]).with_for_update().one()
            progress = dict(child.semantic_consolidation or {})
            if progress.get("lease_token") != snapshot["lease"] or progress.get("status") != "processing":
                return True
            apply(db, child, snapshot, output, datetime.now(timezone.utc))
            progress.update(status="completed", watermark=snapshot["watermark"], error=None,
                lease_at=None, lease_token=None)
            child.semantic_consolidation = progress
            db.commit()
        logger.info("semantic_consolidation status=completed updates=%s", len(output.updates))
    except Exception as exc:
        error = exc.detail if isinstance(exc, HTTPException) and isinstance(exc.detail, str) else "Consolidation failed; inspect backend logs and explicitly retry"
        with session_factory() as db:
            child = db.query(Child).filter_by(id=snapshot["child_id"]).with_for_update().first()
            progress = dict(child.semantic_consolidation or {}) if child else {}
            if child and progress.get("lease_token") == snapshot["lease"] and progress.get("status") == "processing":
                progress.update(status="failed", error=error, lease_at=None, lease_token=None)
                child.semantic_consolidation = progress
                db.commit()
        logger.warning("semantic_consolidation error_class=%s", type(exc).__name__)
    return True


def retry(db, child_id):
    child = db.query(Child).filter_by(id=child_id).with_for_update().first()
    if child is None:
        raise ValueError("Child not found")
    progress = dict(child.semantic_consolidation or {})
    if progress.get("status") == "failed":
        progress.update(status="pending", error=None, lease_at=None, lease_token=None)
        child.semantic_consolidation = progress
        db.commit()
    return progress


if __name__ == "__main__":
    import argparse
    import json
    from app.core.database import SessionLocal
    parser = argparse.ArgumentParser(description="Inspect or requeue a child's semantic consolidation")
    parser.add_argument("command", choices=("status", "retry"))
    parser.add_argument("child_id")
    args = parser.parse_args()
    with SessionLocal() as db:
        if args.command == "retry":
            progress = retry(db, args.child_id)
        else:
            child = db.get(Child, args.child_id)
            if child is None:
                parser.error("Child not found")
            progress = child.semantic_consolidation or {}
        print(json.dumps(progress, indent=2))
