from fastapi import APIRouter

# This router is the single entry point for all v1 API routes.
# Each endpoint module registers its own sub-router here.
#
# Phase 1 will add:
#   from app.api.v1.endpoints import families, children, coaching, extension
#   api_router.include_router(families.router, tags=["families"])
#   api_router.include_router(children.router, tags=["children"])
#   ...

api_router = APIRouter()


# Placeholder — will be replaced in Phase 1 when endpoint files are created
@api_router.get("/ping")
def ping():
    """Quick sanity check that the v1 router is wired up correctly."""
    return {"message": "Monty API v1 is alive"}
