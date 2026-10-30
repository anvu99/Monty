from fastapi import FastAPI
from contextlib import asynccontextmanager
import asyncio
import logging
from app.services.purchase_assessment import worker as purchase_worker, validate_model
from contextlib import suppress
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.ai import provider
from app.core.database import SessionLocal
from app.services.decision_extraction import worker


@asynccontextmanager
async def lifespan(app):
    task = asyncio.create_task(worker(SessionLocal, provider)) if (
        settings.AI_EXTRACTION_WORKER_ENABLED or settings.AI_SEMANTIC_CONSOLIDATION_ENABLED) else None
    app.state.detector_ready = False
    purchase_task = None
    if settings.PURCHASE_ASSESSMENT_WORKER_ENABLED and settings.DEMO_PURCHASES_ENABLED:
        try:
            validate_model()
            app.state.detector_ready = True
            purchase_task = asyncio.create_task(purchase_worker(SessionLocal, provider))
        except Exception as exc:
            logging.getLogger(__name__).warning("purchase_detector unavailable error=%s", type(exc).__name__)
    try:
        yield
    finally:
        if purchase_task:
            purchase_task.cancel()
            with suppress(asyncio.CancelledError):
                await purchase_task
        if task:
            task.cancel()
            with suppress(asyncio.CancelledError):
                await task
        await provider.close()

app = FastAPI(
    lifespan=lifespan,
    title="Monty API",
    description="Backend API for the Monty financial literacy app",
    version="1.0.0",
    docs_url="/docs",       # Swagger UI at http://localhost:8000/docs
    redoc_url="/redoc",     # ReDoc UI at http://localhost:8000/redoc
)

# Allow the Vite frontend dev server to call the API without CORS errors.
# In production (Render + Vercel), update this to the real Vercel domain.
origins = [
    "http://localhost:5173",   # Vite dev server default port
    "http://localhost:3000",   # Fallback
]

if settings.ENVIRONMENT == "production":
    origins = ["https://monty.vercel.app"]  # Update with real Vercel URL after deploy

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount all v1 API routes under /api prefix
# e.g. GET /api/families, POST /api/child/{id}/goals
app.include_router(api_router, prefix="/api")


@app.get("/health", tags=["health"])
def health_check():
    """
    Phase 0 verification endpoint.
    Returns 200 OK if the server is running correctly.
    """
    return {"status": "ok", "environment": settings.ENVIRONMENT, "purchase_detector_ready": getattr(app.state, "detector_ready", False)}
