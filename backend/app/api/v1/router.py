from fastapi import APIRouter
from app.api.v1.endpoints import (
    families,
    goals,
    analytics,
    coaching,
    extension,
    conversations,
    demo,
)

api_router = APIRouter()

# Register sub-routers
api_router.include_router(families.router, tags=["Families & Discovery"])
api_router.include_router(goals.router, tags=["Savings Goals"])
api_router.include_router(analytics.router, tags=["Analytics & Impulses"])
api_router.include_router(coaching.router, tags=["AI Coaching & Intentions"])
api_router.include_router(extension.router, tags=["Chrome Extension"])
api_router.include_router(conversations.router, tags=["Conversations"])
api_router.include_router(demo.router, tags=["Demo Purchases"])


@api_router.get("/ping")
def ping():
    """Quick sanity check that the v1 router is wired up correctly."""
    return {"message": "Monty API v1 is alive"}
