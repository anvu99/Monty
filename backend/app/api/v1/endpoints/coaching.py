import uuid
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.ai import get_ai_provider
from app.core.database import get_db
from app.repositories.impulse_repo import ImpulseRepository
from app.repositories.memory_repo import MemoryRepository
from app.schemas.coaching import ApiMemory
from app.schemas.coaching import (
    ApiChatResponse, ApiDecisionLog, ApiIntention, ApiLiveFeed, ApiProactiveNudge,
    ChatRequest, CreateIntentionRequest, DecisionLogResponse, IntentionsResponse, MemoriesResponse,
)
from app.services.ai_context_service import build_context, require_child
from app.services.coaching_service import generate

router = APIRouter()
# Temporary, process-local user-created intentions; no seeded commitments.
intentions_store: dict[str, list[ApiIntention]] = {}


@router.get("/child/{child_id}/memories", response_model=MemoriesResponse)
def get_child_memories(child_id: str, db: Session = Depends(get_db)):
    require_child(db, child_id)
    return MemoriesResponse(memories=[ApiMemory(
        id=m.id, child_id=m.child_id, created_at=m.created_at.isoformat(),
        memory_type=m.memory_type, content=m.content, category=m.category,
        merchant_name=m.merchant_name, suppress_alerts=m.suppress_alerts,
        suppress_until=m.suppress_until.isoformat() if m.suppress_until else None,
        confidence=m.confidence,
    ) for m in MemoryRepository(db).get_memories(child_id)])


@router.get("/flowchart/{child_id}/decision-log", response_model=DecisionLogResponse)
def get_decision_log(child_id: str, db: Session = Depends(get_db)):
    require_child(db, child_id)
    records = ImpulseRepository(db).get_decision_history(child_id)
    history = [ApiDecisionLog(
        id=d.id, timestamp=d.timestamp.isoformat(), trigger=d.trigger, impulse_score=d.impulse_score,
        decision=d.decision, coaching_message=d.coaching_message, ai_justification=d.ai_justification,
        child_response=d.child_response, factors=d.factors or {},
        pipeline_nodes=d.pipeline_nodes, pipeline_edges=d.pipeline_edges,
    ) for d in records]
    return DecisionLogResponse(latest=history[0] if history else None, history=history)


@router.post("/coaching/chat", response_model=ApiChatResponse)
async def chat_with_monty(payload: ChatRequest, db: Session = Depends(get_db), ai=Depends(get_ai_provider)):
    snapshot = build_context(db, payload.child_id)
    result = await generate("chat", snapshot, ai, {"message": payload.message, "user_context": payload.context,
        "history": [message.model_dump() for message in payload.history]})
    return ApiChatResponse(message=result.message,
        suggested_intention=result.suggested_intention.model_dump() if result.suggested_intention else None,
        memory_updated=False)


@router.get("/coaching/proactive-nudge/{child_id}", response_model=ApiProactiveNudge)
def get_proactive_nudge(child_id: str, db: Session = Depends(get_db)):
    require_child(db, child_id)
    # No stored nudges yet. Reading a dashboard must never trigger generation.
    return ApiProactiveNudge(has_nudge=False, prediction=None)


@router.get("/child/{child_id}/implementation-intentions", response_model=IntentionsResponse)
def get_intentions(child_id: str, db: Session = Depends(get_db)):
    require_child(db, child_id)
    return IntentionsResponse(intentions=intentions_store.get(child_id, []), suggestions=[])


@router.post("/child/{child_id}/implementation-intentions", response_model=ApiIntention)
def create_intention(child_id: str, payload: CreateIntentionRequest, db: Session = Depends(get_db)):
    require_child(db, child_id)
    item = ApiIntention(id=f"int-{uuid.uuid4().hex}", child_id=child_id,
        trigger_situation=payload.trigger_situation, planned_action=payload.planned_action)
    intentions_store.setdefault(child_id, []).append(item)
    return item


@router.get("/child/{child_id}/live-feed", response_model=ApiLiveFeed)
def get_live_feed(child_id: str, since: str | None = None, db: Session = Depends(get_db)):
    require_child(db, child_id)
    return ApiLiveFeed()
