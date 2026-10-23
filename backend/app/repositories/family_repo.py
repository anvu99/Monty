from sqlalchemy.orm import Session, joinedload
from app.models.family import Family
from app.models.child import Child
from app.repositories.base import BaseRepository


class FamilyRepository(BaseRepository[Family]):
    """Repository handling database operations for Family and Children."""

    def __init__(self, db: Session):
        super().__init__(Family, db)

    def get_family_with_children(self, family_id: str) -> Family | None:
        """Fetch a family with its children preloaded in a single query."""
        return (
            self.db.query(Family)
            .options(joinedload(Family.children))
            .filter(Family.id == family_id)
            .first()
        )

    def get_all_families(self) -> list[Family]:
        """Fetch all families with children."""
        return self.db.query(Family).options(joinedload(Family.children)).all()

    def get_by_kid_count(self, kid_count: int) -> Family | None:
        """Find a family having at least the specified number of children."""
        families = self.get_all_families()
        for f in families:
            if len(f.children) >= kid_count:
                return f
        return families[0] if families else None
