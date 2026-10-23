import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, String
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """
    SQLAlchemy declarative base. All ORM models inherit from Base so
    Alembic can detect them and auto-generate migrations.
    """
    pass


class BaseModel(Base):
    """
    Abstract base model with shared fields every table will have.
    Never create a table directly from this — use it as a parent class.

    Fields:
        id         - UUID primary key, auto-generated
        created_at - Timestamp when the row was inserted
        updated_at - Timestamp auto-updated on every write
    """
    __abstract__ = True

    id = Column(
        String,
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
