import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.ai import get_ai_provider
from app.core.database import get_db
from app.schemas.ai import PurchaseAssessment, PurchaseRequest
from app.schemas.extension import ApiCheckRiskResponse, ApiRiskScore, DismissAlertResponse
from app.services.ai_context_service import build_context, require_child
from app.repositories.impulse_repo import ImpulseRepository
from app.services.coaching_service import generate, risk_level

router = APIRouter()


@router.get("/extension/check-risk", response_model=ApiCheckRiskResponse)
def check_extension_risk(child_id: str, db: Session = Depends(get_db)):
    require_child(db, child_id)
    scores = ImpulseRepository(db).get_scores(child_id, limit=1)
    latest = scores[0] if scores else None
    score = float(latest.impulse_score) if latest else None
    return ApiCheckRiskResponse(current_risk_score=ApiRiskScore(
        status="assessed" if latest else "insufficient_data", risk_score=score, risk_level=risk_level(score),
        explanation="Latest recorded assessment; not a new prediction." if latest else "No recorded assessment. Ask Monty to check a proposed purchase.",
        factors=[], timestamp=latest.timestamp.isoformat() if latest else None), predictions=[], active_alerts=[])


@router.post("/extension/assess-purchase", response_model=PurchaseAssessment)
async def assess_purchase(payload: PurchaseRequest, db: Session = Depends(get_db), ai=Depends(get_ai_provider)):
    result = await generate("risk", build_context(db, payload.child_id, payload), ai, {"message": payload.prompt})
    return PurchaseAssessment(**result.model_dump(), assessment_id=str(uuid.uuid4()),
        timestamp=datetime.now(timezone.utc).isoformat(), risk_level=risk_level(result.risk_score))


@router.post("/extension/dismiss-alert", response_model=DismissAlertResponse)
def dismiss_alert(alert_id: str):
    raise HTTPException(503, "Persistent alerts are not available; no alert was dismissed")
