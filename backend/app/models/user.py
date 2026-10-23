from sqlalchemy import Column, ForeignKey, String
from sqlalchemy.orm import relationship

from app.models.base import BaseModel


class User(BaseModel):
    """
    Represents an authenticated user (parent/guardian/admin).
    Belongs to a Family.
    """
    __tablename__ = "users"

    family_id = Column(
        String,
        ForeignKey("families.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(100), nullable=False)
    role = Column(String(20), default="parent", nullable=False)

    # Relationships
    family = relationship("Family", back_populates="users")
