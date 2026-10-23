from sqlalchemy import Column, String
from sqlalchemy.orm import relationship

from app.models.base import BaseModel


class Family(BaseModel):
    """
    Represents a household in Monty.
    A family has one or more parents (Users) and one or more Children.
    """
    __tablename__ = "families"

    name = Column(String(100), nullable=False)

    # Relationships
    # cascade="all, delete-orphan" ensures if a family is deleted,
    # its users and children are cleaned up automatically.
    users = relationship(
        "User",
        back_populates="family",
        cascade="all, delete-orphan",
    )
    children = relationship(
        "Child",
        back_populates="family",
        cascade="all, delete-orphan",
    )
