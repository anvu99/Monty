"""Immutable purchase inputs and lease-protected, resumable assessment stages."""
import asyncio
import copy
import json
import logging
import math
import time
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy import and_, or_

from app.core.config import settings
from app.models import Child, EndedConversation, ImpulseScore, PurchaseAssessmentJob, PurchaseNotification
from app.schemas.purchase_assessment import ConversationSummary, FinalAssessment
from app.services.ai_context_service import build_context, evidence_refs
from app.services.coaching_service import risk_level

logger = logging.getLogger(__name__)
MODEL_VERSION = "v1.0.0"


def utc(value):
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


def capture(db, row):
    from app.services.impulse_service import score_transaction
    # Snapshot facts before adding the purchase; keep the surrounding transaction intact.
    facts = build_context(db, row.child_id, retrieval_text="\n".join((row.description, row.merchant_name, row.merchant_category)), as_of=row.timestamp, release=False)
    child = db.get(Child, row.child_id)
    conversations = db.query(EndedConversation).filter(
        EndedConversation.child_id == row.child_id, EndedConversation.created_at < row.timestamp,
    ).order_by(EndedConversation.created_at.desc(), EndedConversation.id.desc()).limit(3).all()
    features = score_transaction(db, row.child_id, float(row.amount), row.merchant_name,
        row.description, row.merchant_category, row.timestamp, save_to_db=False, features_only=True)
    return {"facts": facts, "ml_inputs": features, "family_id": child.family_id, "child_name": child.name,
        "gemini_model": settings.GEMINI_MODEL, "prompt_version": settings.AI_PROMPT_VERSION,
        "purchase": {"id": row.id, "child_id": row.child_id, "product": row.description,
            "merchant": row.merchant_name, "category": row.merchant_category, "amount": str(row.amount),
            "currency": row.currency, "timestamp": row.timestamp.isoformat()},
        "conversations": [{"id": c.id, "saved_at": utc(c.created_at).isoformat(),
            "messages": copy.deepcopy(c.transcript)} for c in reversed(conversations)]}


def enqueue(db, row, snapshot):
    db.add(PurchaseAssessmentJob(transaction_id=row.id, snapshot=snapshot,
        model_version=MODEL_VERSION, prompt_version=settings.AI_PROMPT_VERSION,
        summaries={}, attempts={}, stage="baseline", status="pending"))


def predict(inputs):
    import numpy as np
    import pandas as pd
    from app.services.impulse_service import ALL_FEATURES_MODEL_B, get_production_model
    model, calibrator = get_production_model()
    if model is None or calibrator is None:
        raise HTTPException(503, "Purchase detector artifacts are unavailable")
    probability = float(model.predict_proba(pd.DataFrame([inputs["features"]])[ALL_FEATURES_MODEL_B])[0, 1])
    score = float(calibrator.predict_proba(np.array([probability]))[0]) * 100
    if not math.isfinite(score) or not 0 <= score <= 100:
        raise HTTPException(502, "Purchase detector returned an invalid score")
    score = round(score, 1)
    return {"score": score, "risk_level": risk_level(score), "model_version": MODEL_VERSION,
        "features": inputs["features"], "defaults": inputs["defaults"],
        "factors": [{"factor": "Recorded purchase context", "contribution": 0,
            "description": "Baseline uses category, timing, goal ratios and prior financial history; these are inputs, not causal explanations.",
            "evidence_refs": ["purchase", "baseline"]}]}


def validate_model():
    from app.services.impulse_service import ALL_FEATURES_MODEL_B
    features = {key: 0.0 for key in ALL_FEATURES_MODEL_B}
    features["merchant_category"] = "Books & Learning"
    predict({"features": features, "defaults": {}})


def validate_quotes(quotes, conversations):
    messages = {(c["id"], m["id"]): m for c in conversations for m in c["messages"]}
    for quote in quotes:
        message = messages.get((quote.conversation_id, quote.message_id))
        if not message or message["role"] != "user" or quote.quote not in message["content"]:
            raise HTTPException(502, "Assessment quote does not match a child message")


def estimate(value):
    # Conservative local estimate including JSON overhead; provider enforces its own full budget too.
    return (len(json.dumps(value, ensure_ascii=False).encode()) + 2) // 3


def chunks(conversation):
    current = []
    size = 0
    for message in conversation["messages"]:
        # Split long individual messages without changing their evidence identity.
        for start in range(0, len(message["content"]), 2500):
            part = {**message, "content": message["content"][start:start + 2500]}
            part_size = estimate(part)
            if current and size + part_size > 1800:
                yield current
                current, size = [], 0
            current.append(part)
            size += part_size
    if current:
        yield current


def payload(snapshot, baseline, summaries):
    context = {**snapshot["facts"], "purchase": snapshot["purchase"], "baseline": baseline,
        "conversations": []}
    for conversation in snapshot["conversations"]:
        saved = summaries.get(conversation["id"])
        context["conversations"].append({"id": conversation["id"], "saved_at": conversation["saved_at"],
            "representation": "summary" if saved is not None else "full",
            **({"chunks": saved} if saved is not None else {"messages": conversation["messages"]})})
    return context


def allowed_refs(snapshot):
    refs = evidence_refs(snapshot["facts"]) | {"baseline", "purchase"}
    refs.update("conversations." + c["id"] for c in snapshot["conversations"])
    return refs


def validate_final(result, snapshot):
    if not set(result.evidence_refs).issubset(allowed_refs(snapshot)):
        raise HTTPException(502, "Assessment referenced unavailable evidence")
    validate_quotes(result.quotes, snapshot["conversations"])
    transcript_claim = any(ref.startswith("conversations.") for ref in result.evidence_refs)
    memory_claim = any(ref.startswith(("semantic_memories.", "core_memory.entries.", "decision_events.")) for ref in result.evidence_refs)
    quoted_ids = {q.conversation_id for q in result.quotes}
    if any(ref.removeprefix("conversations.") not in quoted_ids for ref in result.evidence_refs if ref.startswith("conversations.")):
        raise HTTPException(502, "Conversation evidence requires exact child quotes")
    if result.conversation_effect != "no_relevant_context" and not (transcript_claim or memory_claim):
        raise HTTPException(502, "Conversation effect requires supporting evidence")


def retry(db, row):
    if row.status == "failed":
        row.status, row.error, row.next_attempt_at = "pending", None, None
        row.attempts = {**row.attempts, row.stage: 0}
        db.commit()


class LostLease(Exception):
    pass


async def run_one(factory, provider):
    started = time.monotonic()
    now = datetime.now(timezone.utc)
    eligible = or_(and_(PurchaseAssessmentJob.status == "pending", or_(
        PurchaseAssessmentJob.next_attempt_at.is_(None), PurchaseAssessmentJob.next_attempt_at <= now)),
        and_(PurchaseAssessmentJob.status == "processing", PurchaseAssessmentJob.processing_started_at < now - timedelta(minutes=5)))
    with factory() as db:
        job_id = db.query(PurchaseAssessmentJob.id).filter(eligible).order_by(PurchaseAssessmentJob.created_at, PurchaseAssessmentJob.id).limit(1).scalar()
        if not job_id:
            return False
        claimed = db.query(PurchaseAssessmentJob).filter(PurchaseAssessmentJob.id == job_id, eligible).update(
            {"status": "processing", "processing_started_at": now}, synchronize_session=False)
        db.commit()
        if not claimed:
            return False
        job = db.get(PurchaseAssessmentJob, job_id)
        snapshot, baseline, summaries = copy.deepcopy(job.snapshot), job.baseline, copy.deepcopy(job.summaries)
        attempts = dict(job.attempts)

    def save(**values):
        with factory() as db:
            row = db.query(PurchaseAssessmentJob).filter_by(id=job_id, status="processing").with_for_update().first()
            if not row or utc(row.processing_started_at) != now:
                raise LostLease()
            for key, value in values.items():
                setattr(row, key, value)
            if "baseline" in values and not db.query(ImpulseScore).filter_by(transaction_id=row.transaction_id).first():
                purchase, baseline_value = row.snapshot["purchase"], values["baseline"]
                db.add(ImpulseScore(transaction_id=row.transaction_id, child_id=purchase["child_id"],
                    product_name=purchase["product"][:100], merchant_name=purchase["merchant"],
                    merchant_category=baseline_value["features"]["merchant_category"], amount=purchase["amount"],
                    impulse_score=baseline_value["score"], factors={"baseline": baseline_value["score"]},
                    timestamp=datetime.fromisoformat(purchase["timestamp"]), alert_triggered=False, alert_type="none"))
            row.processing_started_at = datetime.now(timezone.utc)
            db.commit()
            return utc(row.processing_started_at)

    def enter(stage):
        attempts[stage] = attempts.get(stage, 0) + 1
        return save(stage=stage, attempts=dict(attempts))

    stage = "baseline" if baseline is None else "context"
    try:
        if baseline is None:
            now = enter("baseline")
            baseline = predict(snapshot["ml_inputs"])
            now = save(baseline=baseline, stage="context")
        stage = "context"
        now = enter(stage)
        context = payload(snapshot, baseline, summaries)
        # Match the provider's byte-based estimate and reserve framing overhead.
        from app.core.ai import PERSONALITY, TASKS
        overhead = estimate({"system": PERSONALITY + "\n" + TASKS["completed_purchase"],
            "schema": FinalAssessment.model_json_schema(), "allowed_evidence_refs": sorted(allowed_refs(snapshot))}) + 300
        budget = settings.AI_MAX_INPUT_TOKENS - overhead
        if summaries or estimate(context) > budget:
            for conversation in snapshot["conversations"]:
                cached = summaries.setdefault(conversation["id"], [])
                for index, chunk in enumerate(chunks(conversation)):
                    if index < len(cached):
                        continue
                    result = await provider.generate("purchase_summary", {}, set(), {
                        "purchase": snapshot["purchase"], "conversation_id": conversation["id"], "messages": chunk, "_model": snapshot["gemini_model"]}, ConversationSummary)
                    validate_quotes(result.quotes, [{**conversation, "messages": chunk}])
                    cached.append(result.model_dump())
                    now = save(summaries=copy.deepcopy(summaries), stage="context")
            context = payload(snapshot, baseline, summaries)
            if estimate(context["conversations"]) > settings.PURCHASE_SUMMARY_CONTEXT_TOKENS or estimate(context) > budget:
                raise HTTPException(422, "Purchase conversation summaries exceed the configured input budget")
        stage = "gemini"
        now = enter(stage)
        result = await provider.generate("completed_purchase", context, allowed_refs(snapshot), {"_model": snapshot["gemini_model"]}, FinalAssessment)
        validate_final(result, snapshot)
        with factory() as db:
            job = db.query(PurchaseAssessmentJob).filter_by(id=job_id, status="processing").with_for_update().first()
            if not job or utc(job.processing_started_at) != now:
                return True
            purchase = snapshot["purchase"]
            if not db.query(ImpulseScore).filter_by(transaction_id=job.transaction_id).first():
                db.add(ImpulseScore(transaction_id=job.transaction_id, child_id=purchase["child_id"],
                    product_name=purchase["product"][:100], merchant_name=purchase["merchant"],
                    merchant_category=baseline["features"]["merchant_category"], amount=purchase["amount"],
                    impulse_score=baseline["score"], factors={"baseline": baseline["score"]},
                    timestamp=datetime.fromisoformat(purchase["timestamp"]), alert_triggered=False, alert_type="none"))
            job.final_assessment, job.status, job.error = result.model_dump(), "completed", None
            if result.decision == "potentially_impulsive":
                db.add(PurchaseNotification(transaction_id=job.transaction_id, assessment_id=job.id,
                    family_id=snapshot["family_id"], details={**purchase, "child_name": snapshot["child_name"],
                        "explanation": result.explanation, "baseline_score": baseline["score"]}))
            db.commit()
        logger.info("purchase_assessment completed job=%s model=%s summaries=%s latency=%.3f", job_id, snapshot["gemini_model"], bool(summaries), time.monotonic() - started)
    except LostLease:
        pass
    except Exception as exc:
        with factory() as db:
            job = db.query(PurchaseAssessmentJob).filter_by(id=job_id, status="processing").with_for_update().first()
            if job and utc(job.processing_started_at) == now:
                count = job.attempts.get(stage, 1)
                code = exc.status_code if isinstance(exc, HTTPException) else 500
                transient = code in (429, 500, 503, 504) and not (stage == "baseline" or not settings.GEMINI_API_KEY.strip())
                job.status = "pending" if transient and count < 3 else "failed"
                job.next_attempt_at = datetime.now(timezone.utc) + timedelta(seconds=(60 if code == 429 else 15) * count)
                job.error = str(exc.detail) if isinstance(exc, HTTPException) and code == 422 else "Purchase saved; assessment could not finish. Retry assessment after checking model configuration or provider availability."
                db.commit()
        logger.warning("purchase_assessment failed stage=%s error=%s", stage, type(exc).__name__)
    return True


async def worker(factory, provider):
    while True:
        try:
            worked = await run_one(factory, provider)
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            logger.warning("purchase_worker error=%s", type(exc).__name__)
            worked = False
        await asyncio.sleep(1 if worked else 5)
