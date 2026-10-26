from sqlalchemy.orm import Session
from app.repositories.transaction_repo import TransactionRepository
from app.schemas.analytics import (
    ApiSpending,
    CategoryStats,
    ImpulseIndicators,
    WeeklyTrendItem,
    InsightsResponse,
)


class SpendingService:
    """Service calculating spending category breakdowns, weekly trends, and behavioral ratios."""

    def __init__(self, db: Session):
        self.repo = TransactionRepository(db)

    def get_child_spending(self, child_id: str) -> ApiSpending:
        """Fetch live aggregated spending data from Neon PostgreSQL."""
        cat_data = self.repo.get_spending_by_category(child_id)
        categories = {
            cat: CategoryStats(sum=stats["sum"], count=stats["count"], mean=stats["mean"])
            for cat, stats in cat_data.items()
        }

        evening_pct, weekend_pct = self.repo.get_impulse_indicators(child_id)

        # Build weekly trend slices
        weekly_trend = [WeeklyTrendItem(week=f"Week {index + 1}", total=amount)
                        for index, amount in enumerate(self.repo.weekly_spending(child_id))]

        return ApiSpending(
            child_id=child_id,
            categories=categories,
            weekly_trend=weekly_trend,
            bursts=[],
            recurring=[],
            impulse_indicators=ImpulseIndicators(
                evening_pct=evening_pct,
                weekend_pct=weekend_pct,
            ),
        )
