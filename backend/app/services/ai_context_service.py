from datetime import datetime, timedelta, timezone
from decimal import Decimal
from math import isfinite

from fastapi import HTTPException
from sqlalchemy import case, func
from sqlalchemy.orm import Session

from app.models import Child, DecisionEvent, DecisionLog, ImpulseScore, SavingsGoal, Transaction
from app.schemas.ai import PurchaseRequest

POSITIVE_RESPONSES = ("waited", "paused", "delayed", "skipped", "agreed_to_wait")


def _historical_context(db: Session, child_id: str, start: datetime, now: datetime) -> dict:
    query = db.query(ImpulseScore).filter(
        ImpulseScore.child_id == child_id,
        ImpulseScore.timestamp >= start, ImpulseScore.timestamp <= now,
    )
    valid = (ImpulseScore.impulse_score >= 0) & (ImpulseScore.impulse_score <= 100)
    count, valid_count, average, high_count = query.with_entities(
        func.count(ImpulseScore.id),
        func.count(case((valid, ImpulseScore.impulse_score))),
        func.avg(case((valid, ImpulseScore.impulse_score))),
        func.sum(case((valid & (ImpulseScore.impulse_score >= 70), 1), else_=0)),
    ).one()
    history = {}
    for item in query.order_by(ImpulseScore.timestamp.desc(), ImpulseScore.id.asc()).limit(8).all():
        score = float(item.impulse_score) if item.impulse_score is not None else None
        score_valid = score is not None and isfinite(score) and 0 <= score <= 100
        history[item.id] = {
            "id": item.id, "timestamp": item.timestamp.isoformat(),
            "product": item.product_name, "amount": str(item.amount),
            "merchant": item.merchant_name, "category": item.merchant_category,
            "score": score if score_valid else None, "score_valid": score_valid,
            "factors": item.factors, "child_response": item.child_response,
        }
    decisions = db.query(DecisionLog).filter(
        DecisionLog.child_id == child_id,
        DecisionLog.timestamp >= start, DecisionLog.timestamp <= now,
        DecisionLog.child_response.in_(POSITIVE_RESPONSES),
    ).order_by(DecisionLog.timestamp.desc(), DecisionLog.id.asc()).limit(2).all()
    return {
        "impulse_summary": {
            "assessment_count": count, "valid_score_count": valid_count,
            "average_score": round(float(average), 2) if average is not None else None,
            "high_score_count": int(high_count or 0),
            "interpretation": "Historical assessments, not confirmed purchases or calibrated probabilities of impulsivity.",
        },
        "historical_assessments": history,
        "positive_decisions": {item.id: {
            "id": item.id, "timestamp": item.timestamp.isoformat(), "trigger": item.trigger,
            "intervention": item.decision, "child_response": item.child_response,
        } for item in decisions},
    }


def require_child(db: Session, child_id: str) -> Child:
    # Replace/compose with the platform's household-access dependency when available.
    child = db.get(Child, child_id)
    if child is None:
        raise HTTPException(404, "Child not found")
    return child


def build_context(db: Session, child_id: str, purchase: PurchaseRequest | None = None) -> dict:
    child = require_child(db, child_id)
    now = datetime.now(timezone.utc)
    start = now - timedelta(days=30)
    goals = db.query(SavingsGoal).filter_by(child_id=child_id, status="active").order_by(SavingsGoal.id).limit(5).all()
    query = db.query(Transaction).filter(
        Transaction.child_id == child_id, Transaction.is_deposit.is_(False),
        Transaction.timestamp >= start, Transaction.timestamp <= now,
    )
    count, total, first, last = query.with_entities(
        func.count(Transaction.id), func.sum(Transaction.amount),
        func.min(Transaction.timestamp), func.max(Transaction.timestamp),
    ).one()
    recent = query.order_by(Transaction.timestamp.desc(), Transaction.id).limit(8).all()
    snapshot = {
        "profile": {"name": child.name, "age": child.age},
        "coverage": {"window_start": start.isoformat(), "window_end": now.isoformat(),
                     "timezone": "UTC; child local timezone unavailable", "currency": "unknown",
                     "first_purchase": first.isoformat() if first else None,
                     "last_purchase": last.isoformat() if last else None},
        "spending": {"count": count, "total": str(total or Decimal(0))},
        "goals": {}, "recent_purchases": {},
    }
    for g in goals:
        remaining = max(Decimal(0), g.target_amount - g.current_amount)
        snapshot["goals"][g.id] = {"name": g.name, "target": str(g.target_amount),
            "saved": str(g.current_amount), "remaining": str(remaining),
            "weekly_contribution": str(g.weekly_contribution)}
    for t in recent:
        snapshot["recent_purchases"][t.id] = {"amount": str(t.amount), "merchant": t.merchant_name,
            "category": t.merchant_category, "timestamp": t.timestamp.isoformat()}
    snapshot.update(_historical_context(db, child_id, start, now))
    events = db.query(DecisionEvent).filter(DecisionEvent.child_id == child_id,
        DecisionEvent.status == "active", DecisionEvent.occurred_at <= now).order_by(
        DecisionEvent.occurred_at.desc(), DecisionEvent.id.asc()).limit(5).all()
    snapshot["decision_events"] = {item.id: {
        "id": item.id, "recorded_at": item.occurred_at.isoformat(),
        "action": item.action, "outcome_status": item.outcome_status, "source": item.source,
        "situation": item.situation, "goal_relationship": item.goal_relationship,
        "evidence_quotes": [entry["quote"] for entry in item.evidence],
        "timing_notice": "Recorded at conversation end; actual action time is not verified.",
    } for item in events}
    if purchase:
        snapshot["proposed_purchase"] = purchase.model_dump(mode="json", exclude={"child_id"})
        # Legacy database records have no currency. Cross-currency goal impact cannot be asserted.
        snapshot["currency_notice"] = "Goal/history currency unknown; do not compare monetary amounts across currencies."
    # Release the read transaction before waiting for an external provider.
    db.rollback()
    return snapshot


def evidence_refs(snapshot: dict) -> set[str]:
    refs = {"profile", "coverage", "spending"}
    refs.update(f"goals.{key}" for key in snapshot["goals"])
    refs.update(f"recent_purchases.{key}" for key in snapshot["recent_purchases"])
    if "impulse_summary" in snapshot:
        refs.add("impulse_summary")
    refs.update(f"historical_assessments.{key}" for key in snapshot.get("historical_assessments", {}))
    refs.update(f"positive_decisions.{key}" for key in snapshot.get("positive_decisions", {}))
    refs.update(f"decision_events.{key}" for key in snapshot.get("decision_events", {}))
    if "proposed_purchase" in snapshot:
        refs.add("proposed_purchase")
    return refs
