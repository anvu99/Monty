from datetime import datetime, timezone
from fastapi import APIRouter
from app.schemas.analytics import (
    ApiSpending,
    CategoryStats,
    WeeklyTrendItem,
    ImpulseIndicators,
    InsightsResponse,
    ApiStreak,
    ApiImpulseScore,
    ImpulseFactor,
)

router = APIRouter()


@router.get("/child/{child_id}/spending", response_model=ApiSpending)
def get_child_spending(child_id: str) -> ApiSpending:
    """Fetch aggregated spending breakdown, trends, and impulse indicators."""
    return ApiSpending(
        child_id=child_id,
        categories={
            "Gaming & In-App": CategoryStats(sum=42.50, count=5, mean=8.50),
            "Snacks & Treats": CategoryStats(sum=28.75, count=6, mean=4.79),
            "Toys & Hobbies": CategoryStats(sum=35.00, count=2, mean=17.50),
            "Books & Learning": CategoryStats(sum=15.00, count=1, mean=15.00),
        },
        weekly_trend=[
            WeeklyTrendItem(week="Week 1", total=32.50),
            WeeklyTrendItem(week="Week 2", total=45.00),
            WeeklyTrendItem(week="Week 3", total=22.00),
            WeeklyTrendItem(week="Week 4", total=21.75),
        ],
        bursts=[
            {"date": "2026-10-18", "merchant": "Roblox", "count": 3, "total": 15.00}
        ],
        recurring=[],
        impulse_indicators=ImpulseIndicators(evening_pct=34.5, weekend_pct=62.0),
    )


@router.get("/child/{child_id}/insights", response_model=InsightsResponse)
def get_child_insights(child_id: str) -> InsightsResponse:
    """Fetch behavioral insights for a child."""
    return InsightsResponse(
        insights=[
            "Emma resisted 3 out of 4 gaming purchase impulses this week!",
            "Most spending happens on Saturday afternoons between 2 PM and 5 PM.",
            "On track to reach the Skateboard savings goal 5 days earlier than projected.",
            "Implementing the 24-hour pause rule reduced snack impulse buys by 40%.",
        ]
    )


@router.get("/child/{child_id}/streak", response_model=ApiStreak)
def get_child_streak(child_id: str) -> ApiStreak:
    """Fetch companion streak status."""
    return ApiStreak(
        id=f"streak-{child_id}",
        child_id=child_id,
        current_days=14 if child_id == "kid-1" else 7,
        longest_days=21 if child_id == "kid-1" else 10,
        last_updated=datetime.now(timezone.utc).isoformat(),
        companion_state="happy",
    )


@router.get("/child/{child_id}/impulse-scores", response_model=list[ApiImpulseScore])
def get_child_impulse_scores(child_id: str) -> list[ApiImpulseScore]:
    """Fetch historical impulse risk transactions."""
    now_str = datetime.now(timezone.utc).isoformat()
    return [
        ApiImpulseScore(
            id="imp-001",
            child_id=child_id,
            timestamp=now_str,
            product_name="Robux 800 Pack",
            amount=9.99,
            merchant_name="Roblox",
            merchant_category="Digital Goods",
            impulse_score=78.5,
            factors={
                "time_of_day": ImpulseFactor(value="Late Evening", impulse_weight=0.35),
                "category_risk": ImpulseFactor(value="In-Game Currency", impulse_weight=0.45),
            },
            alert_triggered=True,
            alert_type="wait_nudge",
            child_response="paused",
        ),
        ApiImpulseScore(
            id="imp-002",
            child_id=child_id,
            timestamp=now_str,
            product_name="Candy Mystery Box",
            amount=4.50,
            merchant_name="Sweet Shop",
            merchant_category="Snacks",
            impulse_score=42.0,
            factors={
                "time_of_day": ImpulseFactor(value="After School", impulse_weight=0.20),
            },
            alert_triggered=False,
            alert_type="none",
            child_response=None,
        ),
    ]
