from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.repositories.impulse_repo import ImpulseRepository
from app.schemas.analytics import (
    ApiImpulseScore,
    ApiSpending,
    ApiStreak,
    ImpulseFactor,
    InsightsResponse,
)
from app.services.spending_service import SpendingService
from app.services.ai_context_service import build_context

router = APIRouter()


@router.get("/child/{child_id}/spending", response_model=ApiSpending)
def get_child_spending(
    child_id: str, db: Session = Depends(get_db)
) -> ApiSpending:
    """Fetch live aggregated spending breakdown and behavioral ratios."""
    service = SpendingService(db)
    return service.get_child_spending(child_id)


@router.get("/child/{child_id}/insights", response_model=InsightsResponse)
def get_child_insights(
    child_id: str, db: Session = Depends(get_db)
) -> InsightsResponse:
    """Deterministic facts; personalized interpretation is requested through chat."""
    snapshot = build_context(db, child_id)
    count = snapshot["spending"]["count"]
    if not count:
        return InsightsResponse(insights=[])
    return InsightsResponse(insights=[
        f"{count} purchases recorded in the last 30 days.",
        f"{len(snapshot['goals'])} active goals included in the current overview.",
    ])


@router.get("/child/{child_id}/streak", response_model=ApiStreak)
def get_child_streak(child_id: str) -> ApiStreak:
    """Fetch companion streak status."""
    return ApiStreak(
        id=f"streak-{child_id}",
        child_id=child_id,
        current_days=14 if child_id == "kid-1" else 7,
        longest_days=21 if child_id == "kid-1" else 10,
        last_updated=datetime.now(timezone.utc).isoformat(),
        companion_state="happy",
    )


@router.get("/child/{child_id}/impulse-scores", response_model=list[ApiImpulseScore])
def get_child_impulse_scores(
    child_id: str, db: Session = Depends(get_db)
) -> list[ApiImpulseScore]:
    """Fetch historical impulse risk transactions from cloud database."""
    repo = ImpulseRepository(db)
    db_scores = repo.get_scores(child_id)
    if not db_scores:
        # Fallback if no scores recorded yet
        return []

    results = []
    for s in db_scores:
        factor_dict = {}
        if isinstance(s.factors, dict):
            for k, v in s.factors.items():
                if isinstance(v, dict):
                    factor_dict[k] = ImpulseFactor(
                        value=str(v.get("value", "")),
                        impulse_weight=float(v.get("impulse_weight", 0.0)),
                    )
        ts_str = (
            s.timestamp.isoformat()
            if hasattr(s.timestamp, "isoformat")
            else str(s.timestamp)
        )
        results.append(
            ApiImpulseScore(
                id=s.id,
                child_id=s.child_id,
                timestamp=ts_str,
                product_name=s.product_name,
                amount=float(s.amount),
                merchant_name=s.merchant_name,
                merchant_category=s.merchant_category,
                impulse_score=float(s.impulse_score),
                factors=factor_dict,
                alert_triggered=s.alert_triggered,
                alert_type=s.alert_type,
                child_response=s.child_response,
            )
        )
    return results
