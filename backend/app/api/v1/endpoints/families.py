from datetime import datetime, timezone

from app.models import PurchaseNotification
from app.services.purchase_assessment import utc
from app.services.purchase_scoring_adapter import get_purchase_scoring_adapter

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.family import Family
from app.repositories.transaction_repo import TransactionRepository
from app.schemas.analytics import ApiFamilyPurchase, FamilyPurchasesResponse
from app.schemas.family import (
    ApiFamilyOverview,
    FamiliesResponse,
    SelectFamilyResponse,
)
from app.services.family_service import FamilyService

router = APIRouter()


@router.get("/family/{family_id}/purchases", response_model=FamilyPurchasesResponse)
def get_family_purchases(
    family_id: str, limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0), db: Session = Depends(get_db),
) -> FamilyPurchasesResponse:
    if db.get(Family, family_id) is None:
        raise HTTPException(status_code=404, detail="Family not found")
    rows = TransactionRepository(db).get_family_purchases(family_id, limit + 1, offset)
    return FamilyPurchasesResponse(purchases=[ApiFamilyPurchase(
        id=row.id, child_id=row.child_id, child_name=child_name,
        timestamp=row.timestamp.isoformat(), merchant_name=row.merchant_name,
        merchant_category=row.merchant_category, description=row.description,
        amount=float(row.amount), assessment=get_purchase_scoring_adapter().read_assessment(db, row.id),
    ) for row, child_name in rows[:limit]], has_more=len(rows) > limit)


@router.get("/families", response_model=FamiliesResponse)
def get_families(db: Session = Depends(get_db)) -> FamiliesResponse:
    """Fetch list of demo families from cloud database."""
    service = FamilyService(db)
    return service.get_families()


@router.get("/families/select-by-kid-count/{kid_count}", response_model=SelectFamilyResponse)
def select_family_by_kid_count(
    kid_count: int, db: Session = Depends(get_db)
) -> SelectFamilyResponse:
    """Select a demo family matching kid count."""
    service = FamilyService(db)
    return service.select_by_kid_count(kid_count)


@router.get("/family/{family_id}/overview", response_model=ApiFamilyOverview)
def get_family_overview(
    family_id: str, db: Session = Depends(get_db)
) -> ApiFamilyOverview:
    """Fetch live aggregated parent dashboard summary for a family."""
    service = FamilyService(db)
    return service.get_family_overview(family_id)



@router.get("/family/{family_id}/notifications")
def notifications(family_id: str, limit: int = Query(50, ge=1, le=100), offset: int = Query(0, ge=0), db: Session = Depends(get_db)):
    if db.get(Family, family_id) is None:
        raise HTTPException(404, "Family not found")
    query = db.query(PurchaseNotification).filter_by(family_id=family_id)
    rows = query.order_by(PurchaseNotification.created_at.desc(), PurchaseNotification.id).offset(offset).limit(limit + 1).all()
    return {"notifications": [{**r.details, "id": r.id, "transaction_id": r.transaction_id, "created_at": utc(r.created_at).isoformat(),
        "read_at": utc(r.read_at).isoformat() if r.read_at else None} for r in rows[:limit]],
        "unread_count": query.filter(PurchaseNotification.read_at.is_(None)).count(), "has_more": len(rows) > limit}


@router.patch("/family/{family_id}/notifications/{notification_id}/read")
def read_notification(family_id: str, notification_id: str, db: Session = Depends(get_db)):
    row = db.query(PurchaseNotification).filter_by(id=notification_id, family_id=family_id).first()
    if row is None:
        raise HTTPException(404, "Notification not found")
    if row.read_at is None:
        row.read_at = datetime.now(timezone.utc)
        db.commit()
    return {"id": row.id, "read_at": utc(row.read_at).isoformat()}
