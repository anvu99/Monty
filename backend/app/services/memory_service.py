from datetime import datetime, timezone

from fastapi import HTTPException
from app.core.config import settings
from app.models import Child, SemanticMemory
from app.repositories.semantic_memory_repo import SemanticMemoryRepository
from app.schemas.memory import CoreEntry, CoreState


def core_state(child):
    return CoreState.model_validate(child.core_memory or {})


def memory_context(db, child, retrieval_text="", semantic_limit=5, as_of=None):
    state = core_state(child)
    records = SemanticMemoryRepository(db).retrieve(child.id, retrieval_text, semantic_limit, before=as_of)
    return {
        "core_memory": {"schema_version": state.schema_version, "revision": state.revision,
            "entries": {key: {"value": item.value, "updated_at": item.updated_at,
                                         "conversation_id": item.conversation_id, "evidence": [e.model_dump() for e in item.evidence]}
                        for key, item in state.entries.items() if as_of is None or datetime.fromisoformat(item.updated_at).astimezone(timezone.utc) <= as_of}},
        "semantic_memories": {item.id: {"id": item.id, "memory_key": item.memory_key,
            "name": item.name, "topic": item.topic, "summary": item.summary, "details": item.details,
            "origin": item.origin, "revision": item.revision,
            "source_conversation_id": item.source_conversation_id, "evidence": item.evidence,
            "evidence_quotes": [entry["quote"] for entry in item.evidence],
            **({"supporting_conversation_count": len({entry["conversation_id"] for entry in
                    (item.pattern_evidence or {}).get("supporting", [])}),
                "first_observed_at": item.first_observed_at.isoformat() if item.first_observed_at else None,
                "last_observed_at": item.last_observed_at.isoformat() if item.last_observed_at else None,
                "last_evaluated_at": item.last_evaluated_at.isoformat() if item.last_evaluated_at else None,
                "notice": "Tentative pattern from child self-reports, not a verified trait or outcome."}
               if item.origin == "inferred" else {})} for item in records},
    }


def validate_memory_updates(output, transcript):
    messages = {item["id"]: item for item in transcript}
    for updates, key in ((output.core_updates, "key"), (output.semantic_updates, "memory_key")):
        keys = [getattr(item, key) for item in updates]
        if len(set(keys)) != len(keys):
            raise HTTPException(502, "Memory extraction returned conflicting operations for one key")
        for item in updates:
            for evidence in item.evidence:
                message = messages.get(evidence.message_id)
                if not message or message["role"] != "user" or evidence.quote not in message["content"]:
                    raise HTTPException(502, "Memory evidence does not match a child message")


def _content(record):
    # Exact textual deduplication only; no attempt to infer conceptual equivalence.
    return tuple(" ".join((getattr(record, name) or "").casefold().split())
                 for name in ("name", "topic", "summary", "details"))


def apply_memory_updates(db, job, output):
    """Caller owns the transaction. Child lock serializes all memory writers."""
    if not output.core_updates and not output.semantic_updates:
        return
    child = db.query(Child).filter_by(id=job.child_id).populate_existing().with_for_update().one()
    state = core_state(child)
    expected = job.facts.get("core_memory", {}).get("revision", 0)
    if state.revision != expected:
        raise HTTPException(409, "Memory changed since extraction. Retry extraction to refresh context.")
    changed = False
    now = datetime.now(timezone.utc).isoformat()
    for item in output.core_updates:
        previous = state.entries.get(item.key)
        if item.operation == "remove":
            if previous:
                del state.entries[item.key]
                changed = True
        elif not previous or previous.value != item.value:
            state.entries[item.key] = CoreEntry(value=item.value, conversation_id=job.id,
                evidence=item.evidence, updated_at=now)
            changed = True

    repo = SemanticMemoryRepository(db)
    visible = job.facts.get("semantic_memories", {})
    for item in output.semantic_updates:
        latest = repo.latest(job.child_id, item.memory_key)
        if item.memory_key.startswith("pattern_") or (latest and latest.origin != "explicit"):
            raise HTTPException(502, "Explicit extraction cannot modify inferred patterns")
        active = latest if latest and latest.status == "active" else None
        if active and item.operation == "upsert" and _content(active) == _content(item):
            continue
        if active and (active.id not in visible or visible[active.id]["memory_key"] != item.memory_key):
            raise HTTPException(409, "Memory update targets a record outside the extraction context. Retry extraction.")
        if item.operation == "retract":
            if not active:
                raise HTTPException(502, "Cannot retract an unavailable semantic memory")
            # A retraction is a new audited revision, preserving the old provenance.
            name, topic, summary, details = active.name, active.topic, active.summary, active.details
            new_status = "retracted"
        else:
            if not active and any(_content(record) == _content(item) for record in repo.active(job.child_id).all()):
                continue
            name, topic, summary, details = item.name, item.topic, item.summary, item.details
            new_status = "active"
        if active:
            active.status = "superseded"
        db.add(SemanticMemory(child_id=job.child_id, memory_key=item.memory_key,
            name=name, topic=topic, summary=summary, details=details, status=new_status,
            revision=latest.revision + 1 if latest else 1, supersedes_id=latest.id if latest else None,
            source_conversation_id=job.id, evidence=[e.model_dump() for e in item.evidence], origin="explicit",
            extractor_version=f"{settings.AI_PROMPT_VERSION}:{settings.GEMINI_MODEL}"))
        db.flush()
        changed = True
    if changed:
        state.revision += 1
        # Assign the entire new object so SQLAlchemy tracks nested JSON changes.
        child.core_memory = state.model_dump(mode="json")
