import uuid
from datetime import datetime, timezone
from fastapi import APIRouter
from app.schemas.coaching import (
    ApiMemory,
    MemoriesResponse,
    ApiDecisionLog,
    DecisionLogResponse,
    ChatRequest,
    ApiChatResponse,
    SuggestedIntention,
    ApiProactiveNudge,
    ProactivePredictionItem,
    ApiIntention,
    CreateIntentionRequest,
    ApiIntentionSuggestion,
    IntentionsResponse,
    ApiLiveFeed,
)

router = APIRouter()

MOCK_INTENTIONS_DB: dict[str, list[ApiIntention]] = {
    "kid-1": [
        ApiIntention(
            id="int-1",
            child_id="kid-1",
            trigger_situation="When browsing Steam during late evening",
            planned_action="Add to wishlist and wait 48 hours before asking mom",
            status="active",
            success_count=5,
            total_triggered=6,
        )
    ]
}


@router.get("/child/{child_id}/memories", response_model=MemoriesResponse)
def get_child_memories(child_id: str) -> MemoriesResponse:
    """Fetch AI agent episodic memories for a child."""
    now_str = datetime.now(timezone.utc).isoformat()
    return MemoriesResponse(
        memories=[
            ApiMemory(
                id="mem-1",
                child_id=child_id,
                created_at=now_str,
                memory_type="preference",
                content="Loves building robots and Minecraft mods. Wants to save up for a robotics kit.",
                category="hobbies",
                suppress_alerts=False,
                confidence=0.95,
            ),
            ApiMemory(
                id="mem-2",
                child_id=child_id,
                created_at=now_str,
                memory_type="impulse_trigger",
                content="Tends to make in-game purchase requests when gaming with friends on Friday nights.",
                category="triggers",
                suppress_alerts=False,
                confidence=0.88,
            ),
        ]
    )


@router.get("/flowchart/{child_id}/decision-log", response_model=DecisionLogResponse)
def get_decision_log(child_id: str) -> DecisionLogResponse:
    """Fetch visual flowchart decision node logs."""
    now_str = datetime.now(timezone.utc).isoformat()
    latest_decision = ApiDecisionLog(
        id="dec-001",
        timestamp=now_str,
        trigger="Roblox in-game cosmetic purchase ($4.99)",
        impulse_score=72.0,
        decision="NUDGE_PAUSE",
        coaching_message="Hey Emma! That's $4.99 — about half of this week's Skateboard savings. Want to pause 10 minutes?",
        ai_justification="Identified high impulse risk based on late evening time and digital currency tag.",
        child_response="agreed_to_wait",
        factors={"time_risk": {"value": "9:15 PM", "impulse_weight": 0.4}},
    )
    return DecisionLogResponse(
        latest=latest_decision,
        history=[latest_decision],
    )


@router.post("/coaching/chat", response_model=ApiChatResponse)
def chat_with_monty(payload: ChatRequest) -> ApiChatResponse:
    """Chat interactively with Monty the AI financial companion."""
    msg = payload.message.lower()
    if "buy" in msg or "want" in msg:
        reply = (
            "I hear you! That sounds really exciting. But let's check your Skateboard goal first: "
            "you're already 56% there! If you skip this impulse buy, you'll reach it next week. What do you think?"
        )
        intention = SuggestedIntention(
            trigger_situation="When I want to buy in-game items",
            planned_action="Check my Skateboard goal first before buying",
        )
    elif "save" in msg or "goal" in msg:
        reply = "You're doing awesome with your savings! Every dollar puts you closer to your goal!"
        intention = None
    else:
        reply = f"Hi there! Monty here. I'm always ready to help you make smart money moves!"
        intention = None

    return ApiChatResponse(
        message=reply,
        suggested_intention=intention,
        memory_updated=True,
    )


@router.get("/coaching/proactive-nudge/{child_id}", response_model=ApiProactiveNudge)
def get_proactive_nudge(child_id: str) -> ApiProactiveNudge:
    """Fetch proactive AI alert or nudge if predicted impulse conditions arise."""
    return ApiProactiveNudge(
        has_nudge=True,
        message="Friday evening coming up! Remember your goal to avoid impulsive in-game purchases.",
        saving_tip="Tip: Put desired game skins on your wishlist instead of buying instantly.",
        prediction=ProactivePredictionItem(
            item="Robux or Game Pass",
            merchant="Roblox",
            amount=9.99,
            confidence=0.82,
        ),
    )


@router.get("/child/{child_id}/implementation-intentions", response_model=IntentionsResponse)
def get_intentions(child_id: str) -> IntentionsResponse:
    """Fetch active implementation intentions and suggested triggers."""
    intentions = MOCK_INTENTIONS_DB.get(child_id, [])
    suggestions = [
        ApiIntentionSuggestion(
            trigger_situation="When browsing an online store after 8 PM",
            planned_action="Close the tab and wait until morning",
        ),
        ApiIntentionSuggestion(
            trigger_situation="When friend asks me to buy a game skin",
            planned_action="Say I'm saving for my Skateboard right now",
        ),
    ]
    return IntentionsResponse(intentions=intentions, suggestions=suggestions)


@router.post("/child/{child_id}/implementation-intentions", response_model=ApiIntention)
def create_intention(child_id: str, payload: CreateIntentionRequest) -> ApiIntention:
    """Create a new 'If-Then' implementation intention."""
    new_intention = ApiIntention(
        id=f"int-{uuid.uuid4().hex[:6]}",
        child_id=child_id,
        trigger_situation=payload.trigger_situation,
        planned_action=payload.planned_action,
        status="active",
        success_count=0,
        total_triggered=0,
    )
    if child_id not in MOCK_INTENTIONS_DB:
        MOCK_INTENTIONS_DB[child_id] = []
    MOCK_INTENTIONS_DB[child_id].append(new_intention)
    return new_intention


@router.get("/child/{child_id}/live-feed", response_model=ApiLiveFeed)
def get_live_feed(child_id: str, since: str | None = None) -> ApiLiveFeed:
    """Real-time live feed polling for notifications, active predictions, and pauses."""
    return ApiLiveFeed(
        new_impulse_scores=[],
        proactive_predictions=[],
        should_wait=False,
        wait_message=None,
        wait_duration_seconds=None,
    )
