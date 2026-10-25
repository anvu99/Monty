"""Database-backed extraction queue. No model calls while saving or reading job status."""
import asyncio
from datetime import datetime, timedelta, timezone
import hashlib
import json
import logging

from fastapi import HTTPException
from sqlalchemy import and_, or_
from sqlalchemy.exc import IntegrityError

from app.core.config import settings
from app.models import DecisionEvent, EndedConversation
from app.schemas.decisions import ExtractionOutput, ExtractionStatus
from app.services.ai_context_service import build_context, evidence_refs, require_child
from app.services.memory_service import apply_memory_updates, validate_memory_updates

logger = logging.getLogger(__name__)


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=False).encode()).hexdigest()


def job_for_child(db, child_id, conversation_id):
    require_child(db, child_id)
    row = db.query(EndedConversation).filter_by(id=str(conversation_id), child_id=child_id).first()
    if row is None:
        raise HTTPException(404, "Ended conversation not found")
    return row


def status(db, row):
    return ExtractionStatus(conversation_id=row.id, status=row.status, error=row.error,
        event_count=db.query(DecisionEvent).filter_by(conversation_id=row.id).count())


def enqueue(db, payload):
    require_child(db, payload.child_id)
    transcript = [item.model_dump() for item in payload.messages]
    fingerprint = digest(transcript)
    existing = db.get(EndedConversation, str(payload.conversation_id))
    if existing:
        if existing.child_id != payload.child_id:
            raise HTTPException(404, "Ended conversation not found")
        if existing.transcript_hash != fingerprint:
            raise HTTPException(409, "Ended conversation is immutable; use a new conversation ID")
        return status(db, existing)
    facts = build_context(db, payload.child_id, retrieval_text="\n".join(
        item["content"] for item in transcript if item["role"] == "user"), semantic_limit=20)
    row = EndedConversation(id=str(payload.conversation_id), child_id=payload.child_id,
        transcript=transcript, facts=facts, transcript_hash=fingerprint, status="pending")
    db.add(row)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        # A duplicate submission may race with this one. Reuse it, never queue twice.
        existing = db.get(EndedConversation, str(payload.conversation_id))
        if existing and existing.child_id == payload.child_id and existing.transcript_hash == fingerprint:
            return status(db, existing)
        raise HTTPException(409, "Conversation could not be queued; retry with the same ID") from None
    return status(db, row)


def retry(db, row):
    if row.status != "failed":
        return status(db, row)
    # Keep the saved transcript immutable, but refresh facts for corrections that
    # may have changed while the previous attempt was waiting or failing.
    job_id, child_id = row.id, row.child_id
    facts = build_context(db, child_id, retrieval_text="\n".join(
        item["content"] for item in row.transcript if item["role"] == "user"), semantic_limit=20)
    db.query(EndedConversation).filter_by(id=job_id, status="failed").update(
        {"status": "pending", "error": None, "facts": facts}, synchronize_session=False)
    db.commit()
    db.refresh(row)
    return status(db, row)


def validate_candidates(output, transcript, allowed_events):
    messages = {item["id"]: item for item in transcript}
    superseded = set()
    for item in output.decisions:
        for evidence in item.evidence:
            message = messages.get(evidence.message_id)
            if not message or message["role"] != "user" or evidence.quote not in message["content"]:
                raise HTTPException(502, "Extraction evidence does not match a child message")
        if item.supersedes_event_id:
            if item.supersedes_event_id not in allowed_events or item.supersedes_event_id in superseded:
                raise HTTPException(502, "Invalid or repeated decision correction")
            superseded.add(item.supersedes_event_id)


async def run_one(session_factory, provider):
    """Claim atomically; release DB connections while awaiting the provider; save all or none."""
    now = datetime.now(timezone.utc)
    stale = now - timedelta(minutes=5)
    eligible = or_(EndedConversation.status == "pending", and_(
        EndedConversation.status == "processing", EndedConversation.processing_started_at < stale))
    with session_factory() as db:
        job_id = db.query(EndedConversation.id).filter(eligible).order_by(
            EndedConversation.created_at, EndedConversation.id).limit(1).scalar()
        if not job_id:
            return False
        claimed = db.query(EndedConversation).filter(EndedConversation.id == job_id, eligible).update({
            "status": "processing", "processing_started_at": now,
            "attempts": EndedConversation.attempts + 1, "error": None}, synchronize_session=False)
        db.commit()
        if not claimed:
            return False
        job = db.get(EndedConversation, job_id)
        facts, transcript, child_id = job.facts, job.transcript, job.child_id
    try:
        output = await provider.generate("extract_decisions", facts, evidence_refs(facts),
            {"transcript": transcript}, ExtractionOutput)
        allowed = set(facts.get("decision_events", {}))
        validate_candidates(output, transcript, allowed)
        validate_memory_updates(output, transcript)
        with session_factory() as db:
            # Lock the job so a reclaimed lease cannot commit duplicate results.
            job = db.query(EndedConversation).filter_by(id=job_id, status="processing").with_for_update().first()
            lease_time = job.processing_started_at if job else None
            if lease_time is not None:
                lease_time = lease_time.replace(tzinfo=timezone.utc) if lease_time.tzinfo is None else lease_time.astimezone(timezone.utc)
            if not job or lease_time != now:
                return True
            apply_memory_updates(db, job, output)
            seen = set()
            for item in output.decisions:
                fingerprint = digest({"action": item.action, "status": item.outcome_status,
                    "evidence": sorted((e.message_id, e.quote) for e in item.evidence)})
                if fingerprint in seen:
                    continue
                seen.add(fingerprint)
                if item.supersedes_event_id:
                    old = db.query(DecisionEvent).filter_by(id=item.supersedes_event_id,
                        child_id=child_id, status="active").with_for_update().first()
                    if old is None:
                        raise HTTPException(409, "Decision changed since extraction; retry the conversation")
                    old.status = "superseded"
                db.add(DecisionEvent(child_id=child_id, conversation_id=job_id,
                    action=item.action, outcome_status=item.outcome_status, source="child_self_report",
                    situation=item.situation, goal_relationship=item.goal_relationship,
                    evidence=[e.model_dump() for e in item.evidence], occurred_at=job.created_at,
                    supersedes_event_id=item.supersedes_event_id, fingerprint=fingerprint,
                    extractor_version=f"{settings.AI_PROMPT_VERSION}:{settings.GEMINI_MODEL}"))
            job.status = "completed"
            db.commit()
    except Exception as exc:
        # No raw model output, credentials, or transcript in logs/error status.
        error = exc.detail if isinstance(exc, HTTPException) and isinstance(exc.detail, str) else "Extraction failed; retry later"
        with session_factory() as db:
            db.query(EndedConversation).filter_by(id=job_id, status="processing",
                processing_started_at=now).update({"status": "failed", "error": error}, synchronize_session=False)
            db.commit()
        logger.warning("decision_extraction error_class=%s", type(exc).__name__)
    return True


async def worker(session_factory, provider):
    while True:
        try:
            worked = await run_one(session_factory, provider)
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            # e.g. migrations have not been applied; don't terminate the application.
            logger.warning("decision_worker error_class=%s", type(exc).__name__)
            worked = False
        await asyncio.sleep(1 if worked else 5)
