import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.ai import get_ai_provider
from app.core.database import get_db
from app.schemas.ai import PurchaseAssessment, PurchaseRequest
from app.schemas.extension import (
    ApiCheckRiskResponse,
    ApiRiskFactor,
    ApiRiskScore,
    DetectProductRequest,
    DetectProductResponse,
    DismissAlertResponse,
)
from app.services.ai_context_service import build_context, require_child
from app.repositories.impulse_repo import ImpulseRepository
from app.services.coaching_service import generate, risk_level
from app.services.impulse_service import score_transaction

router = APIRouter()


@router.get("/extension/check-risk", response_model=ApiCheckRiskResponse)
def check_extension_risk(child_id: str, db: Session = Depends(get_db)):
    effective_id = "kid-1" if child_id == "demo_child_001" else child_id
    require_child(db, effective_id)
    scores = ImpulseRepository(db).get_scores(effective_id, limit=1)
    latest = scores[0] if scores else None
    score = float(latest.impulse_score) if latest else None
    
    factors_list = []
    if latest and latest.factors:
        if isinstance(latest.factors, dict):
            for k, v in latest.factors.items():
                factors_list.append(ApiRiskFactor(
                    factor=k,
                    contribution=float(v) if isinstance(v, (int, float)) else 0.5,
                    description=f"{k} contribution to overall risk"
                ))
                
    return ApiCheckRiskResponse(
        current_risk_score=ApiRiskScore(
            status="assessed" if latest else "insufficient_data",
            risk_score=score,
            risk_level=risk_level(score),
            explanation="Latest recorded assessment; not a new prediction." if latest else "No recorded assessment. Ask Monty to check a proposed purchase.",
            factors=factors_list,
            timestamp=latest.timestamp.isoformat() if latest else None
        ),
        predictions=[],
        active_alerts=[]
    )


@router.post("/extension/detect", response_model=DetectProductResponse)
def detect_product(payload: DetectProductRequest, db: Session = Depends(get_db)):
    """
    Tier 1 Fast ML Scorer (<10ms).
    Evaluates click-time signals from Chrome extension and persists an ImpulseScore.
    """
    effective_id = "kid-1" if payload.child_id == "demo_child_001" else payload.child_id
    require_child(db, effective_id)
    
    ts = None
    if payload.timestamp:
        try:
            ts = datetime.fromisoformat(payload.timestamp.replace("Z", "+00:00"))
        except Exception:
            ts = datetime.now(timezone.utc)
            
    result = score_transaction(
        db=db,
        child_id=effective_id,
        amount=payload.price,
        merchant=payload.merchant,
        product_name=payload.product_name,
        timestamp=ts,
        save_to_db=True,
    )
    
    factors_dict = {f["factor"]: f["contribution"] for f in result.get("factors", [])}
    norm_score = round(result["impulse_score"] / 100.0, 3)
    
    return DetectProductResponse(
        alert_id=result["score_id"] or str(uuid.uuid4()),
        should_alert=result["alert_triggered"],
        alert_type=result["alert_type"],
        impulse_score=norm_score,
        risk_level=result["risk_level"],
        factors=factors_dict,
        message=f"Purchase evaluated. Impulse risk is {result['risk_level']} ({result['impulse_score']}%)."
    )


@router.post("/extension/assess-purchase", response_model=PurchaseAssessment)
async def assess_purchase(payload: PurchaseRequest, db: Session = Depends(get_db), ai=Depends(get_ai_provider)):
    effective_id = "kid-1" if payload.child_id == "demo_child_001" else payload.child_id
    # Run Tier 1 fast ML scoring first to record the event in the DB
    try:
        score_transaction(
            db=db,
            child_id=effective_id,
            amount=float(payload.amount),
            merchant=payload.merchant,
            product_name=payload.product,
            category=payload.category,
            timestamp=payload.timestamp,
            save_to_db=True,
        )
    except Exception:
        pass  # Ensure LLM coaching proceeds even if ML scoring has missing data

    retrieval_text = "\n".join((payload.prompt, payload.product, payload.merchant, payload.category))
    result = await generate("risk", build_context(db, effective_id, payload, retrieval_text=retrieval_text), ai, {"message": payload.prompt})
    return PurchaseAssessment(**result.model_dump(), assessment_id=str(uuid.uuid4()),
        timestamp=datetime.now(timezone.utc).isoformat(), risk_level=risk_level(result.risk_score))


@router.post("/extension/dismiss-alert", response_model=DismissAlertResponse)
def dismiss_alert(alert_id: str):
    raise HTTPException(503, "Persistent alerts are not available; no alert was dismissed")
