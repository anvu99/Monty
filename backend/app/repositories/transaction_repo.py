from datetime import datetime, timedelta, timezone
from decimal import Decimal
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.models.transaction import Transaction
from app.models.child import Child
from app.repositories.base import BaseRepository


class TransactionRepository(BaseRepository[Transaction]):
    """Repository handling transaction queries, aggregations, and temporal sequences."""

    def __init__(self, db: Session):
        super().__init__(Transaction, db)

    def get_purchases(self, child_id: str, limit: int, offset: int) -> list[Transaction]:
        return (
            self.db.query(Transaction)
            .filter(Transaction.child_id == child_id, Transaction.is_deposit.is_(False))
            .order_by(Transaction.timestamp.desc(), Transaction.id.asc())
            .offset(offset).limit(limit).all()
        )

    def get_family_purchases(self, family_id: str, limit: int, offset: int):
        now = datetime.now(timezone.utc)
        return (
            self.db.query(Transaction, Child.name)
            .join(Child, Transaction.child_id == Child.id)
            .filter(Child.family_id == family_id, Transaction.is_deposit.is_(False),
                    Transaction.timestamp <= now)
            .order_by(Transaction.timestamp.desc(), Transaction.id.asc())
            .offset(offset).limit(limit).all()
        )

    def weekly_spending(self, child_id: str):
        now = datetime.now(timezone.utc)
        start = now.replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=27)
        totals = [Decimal(0) for _ in range(4)]
        rows = self.db.query(Transaction).filter(Transaction.child_id == child_id,
            Transaction.is_deposit.is_(False), Transaction.timestamp >= start, Transaction.timestamp <= now).all()
        for row in rows:
            date = row.timestamp.replace(tzinfo=timezone.utc) if row.timestamp.tzinfo is None else row.timestamp.astimezone(timezone.utc)
            totals[(date - start).days // 7] += row.amount
        return [float(total) for total in totals]

    def get_time_series(self, child_id: str, limit: int = 100) -> list[Transaction]:
        """Fetch transactions ordered by timestamp (optimized for LSTM / sequential processing)."""
        return (
            self.db.query(Transaction)
            .filter(Transaction.child_id == child_id)
            .order_by(Transaction.timestamp.asc())
            .limit(limit)
            .all()
        )

    def get_spending_by_category(self, child_id: str) -> dict[str, dict[str, float]]:
        """
        Aggregate spending breakdown per category using SQL functions.
        Returns: { 'Gaming & In-App': { 'sum': 42.50, 'count': 5, 'mean': 8.50 } }
        """
        results = (
            self.db.query(
                Transaction.merchant_category,
                func.sum(Transaction.amount).label("total_sum"),
                func.count(Transaction.id).label("total_count"),
                func.avg(Transaction.amount).label("avg_amount"),
            )
            .filter(Transaction.child_id == child_id, Transaction.is_deposit == False)
            .group_by(Transaction.merchant_category)
            .all()
        )

        categories = {}
        for cat, total_sum, total_count, avg_amount in results:
            categories[cat] = {
                "sum": float(total_sum or 0),
                "count": int(total_count or 0),
                "mean": round(float(avg_amount or 0), 2),
            }
        return categories

    def get_impulse_indicators(self, child_id: str) -> tuple[float, float]:
        """
        Calculate evening percentage (after 6 PM) and weekend percentage.
        Essential behavioral indicators for impulse prediction.
        """
        transactions = (
            self.db.query(Transaction)
            .filter(Transaction.child_id == child_id, Transaction.is_deposit == False)
            .all()
        )
        if not transactions:
            return (0.0, 0.0)

        evening_count = 0
        weekend_count = 0
        total = len(transactions)

        for t in transactions:
            if t.timestamp.hour >= 18:
                evening_count += 1
            if t.timestamp.weekday() in [5, 6]:  # Saturday or Sunday
                weekend_count += 1

        return (
            round((evening_count / total) * 100, 1),
            round((weekend_count / total) * 100, 1),
        )
