from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from typing import Generator

from app.core.config import settings

# Create the database engine (connection pool)
engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,  # Verify connections are alive before using them
)

# Factory for creating DB sessions
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Generator[Session, None, None]:
    """
    FastAPI dependency. Injects a DB session into route handlers.
    Automatically closes the session when the request is done.

    Usage:
        @router.get("/example")
        def my_route(db: Session = Depends(get_db)):
            ...
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
