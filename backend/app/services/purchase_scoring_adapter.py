"""Read-only integration seam owned jointly with the transaction-scoring feature.

Replace read_assessment with a transaction-ID lookup when scoring persistence is
available. Never substitute the child's latest score or trigger generation here.
"""
from app.schemas.demo_purchase import TransactionAssessment


class PurchaseScoringAdapter:
    def read_assessment(self, db, transaction_id: str) -> TransactionAssessment:
        return TransactionAssessment(status="not_connected")


adapter = PurchaseScoringAdapter()


def get_purchase_scoring_adapter():
    return adapter
