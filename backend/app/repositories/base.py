from typing import Generic, Type, TypeVar

from sqlalchemy.orm import Session

from app.models.base import BaseModel

# T is a placeholder for any model class that inherits from BaseModel
T = TypeVar("T", bound=BaseModel)


class BaseRepository(Generic[T]):
    """
    Generic repository providing standard CRUD operations for any ORM model.

    Usage:
        class GoalRepository(BaseRepository[SavingsGoal]):
            def __init__(self, db: Session):
                super().__init__(SavingsGoal, db)

            # Add domain-specific methods here
            def get_by_child(self, child_id: str) -> list[SavingsGoal]:
                return self.db.query(self.model).filter_by(child_id=child_id).all()
    """

    def __init__(self, model: Type[T], db: Session):
        self.model = model
        self.db = db

    def get(self, id: str) -> T | None:
        """Fetch a single record by primary key. Returns None if not found."""
        return self.db.query(self.model).filter(self.model.id == id).first()

    def get_multi(self, skip: int = 0, limit: int = 100) -> list[T]:
        """Fetch a paginated list of records."""
        return self.db.query(self.model).offset(skip).limit(limit).all()

    def create(self, obj: T) -> T:
        """Persist a new record and return it with its generated id."""
        self.db.add(obj)
        self.db.commit()
        self.db.refresh(obj)
        return obj

    def update(self, obj: T, updates: dict) -> T:
        """Apply a dict of field updates to an existing record."""
        for field, value in updates.items():
            setattr(obj, field, value)
        self.db.commit()
        self.db.refresh(obj)
        return obj

    def delete(self, id: str) -> bool:
        """Delete a record by id. Returns True if deleted, False if not found."""
        obj = self.get(id)
        if obj is None:
            return False
        self.db.delete(obj)
        self.db.commit()
        return True
