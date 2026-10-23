from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.family import (
    ApiFamilyOverview,
    FamiliesResponse,
    SelectFamilyResponse,
)
from app.services.family_service import FamilyService

router = APIRouter()


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
