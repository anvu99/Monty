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
        amount=float(row.amount),
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
