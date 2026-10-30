import logging
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.models import Transaction, PurchaseAssessmentJob
from app.services import purchase_assessment
from app.schemas.demo_purchase import DemoPurchaseRequest, DemoPurchaseResponse, TransactionAssessment
from app.services.ai_context_service import require_child
from app.services.purchase_scoring_adapter import get_purchase_scoring_adapter

logger = logging.getLogger(__name__)


def demo_enabled():
    if not settings.DEMO_PURCHASES_ENABLED:
        raise HTTPException(404, "Not found")


router = APIRouter(dependencies=[Depends(demo_enabled)])


def matches(row, payload):
    return row.source == "demo" and row.child_id == payload.child_id and (
        row.description, row.merchant_name, row.merchant_category, row.amount, row.currency
    ) == (payload.product, payload.merchant, payload.category, payload.amount, payload.currency)


def result(db, row, scoring):
    # Snapshot committed purchase fields before invoking an independently owned adapter.
    fields = dict(transaction_id=row.id, child_id=row.child_id, product=row.description,
        merchant=row.merchant_name, category=row.merchant_category, amount=row.amount,
        currency=row.currency, timestamp=row.timestamp if row.timestamp.tzinfo else row.timestamp.replace(tzinfo=timezone.utc))
    try:
        assessment = TransactionAssessment.model_validate(scoring.read_assessment(db, row.id))
        if assessment.status == "failed":
            assessment.error = "Purchase saved; assessment failed. Please try refreshing its status later."
    except Exception as exc:
        logger.warning("demo_purchase assessment_read_error=%s", type(exc).__name__)
        assessment = TransactionAssessment(status="failed", error="Purchase saved; assessment status is temporarily unavailable.")
    return DemoPurchaseResponse(**fields, assessment=assessment)


@router.post("/demo/purchases", response_model=DemoPurchaseResponse, status_code=201)
def create_purchase(payload: DemoPurchaseRequest, response: Response, db: Session = Depends(get_db),
                    scoring=Depends(get_purchase_scoring_adapter)):
    require_child(db, payload.child_id)
    row = db.get(Transaction, str(payload.transaction_id))
    if row is not None:
        if not matches(row, payload):
            raise HTTPException(409, "Transaction ID is already used for a different purchase")
        response.status_code = 200
        return result(db, row, scoring)
    row = Transaction(id=str(payload.transaction_id), child_id=payload.child_id,
        description=payload.product, merchant_name=payload.merchant, merchant_category=payload.category,
        amount=payload.amount, currency=payload.currency, source="demo", is_deposit=False,
        timestamp=datetime.now(timezone.utc))
    snapshot = purchase_assessment.capture(db, row)
    try:
        db.add(row)
        db.flush()
        purchase_assessment.enqueue(db, row, snapshot)
        db.commit()
    except IntegrityError:
        db.rollback()
        row = db.get(Transaction, str(payload.transaction_id))
        if row is None:
            raise
        if not matches(row, payload):
            raise HTTPException(409, "Transaction ID is already used for a different purchase") from None
        response.status_code = 200
    return result(db, row, scoring)


@router.get("/demo/purchases/{transaction_id}", response_model=DemoPurchaseResponse)
def get_purchase(transaction_id: UUID, db: Session = Depends(get_db),
                 scoring=Depends(get_purchase_scoring_adapter)):
    row = db.get(Transaction, str(transaction_id))
    if row is None or row.source != "demo":
        raise HTTPException(404, "Demo purchase not found")
    return result(db, row, scoring)


@router.post("/demo/purchases/{transaction_id}/retry-assessment", response_model=DemoPurchaseResponse)
def retry_assessment(transaction_id: UUID, db: Session = Depends(get_db), scoring=Depends(get_purchase_scoring_adapter)):
    row = db.get(Transaction, str(transaction_id))
    if row is None or row.source != "demo":
        raise HTTPException(404, "Demo purchase not found")
    job = db.query(PurchaseAssessmentJob).filter_by(transaction_id=row.id).first()
    if job is None:
        raise HTTPException(404, "Purchase assessment not found")
    purchase_assessment.retry(db, job)
    return result(db, row, scoring)
