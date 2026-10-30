"""Read-only exact-transaction assessment lookup."""
from app.models import PurchaseAssessmentJob
from app.schemas.demo_purchase import TransactionAssessment

class PurchaseScoringAdapter:
    def read_assessment(self, db, transaction_id):
        job = db.query(PurchaseAssessmentJob).filter_by(transaction_id=transaction_id).first()
        if job is None:
            return TransactionAssessment(status="not_connected")
        baseline = job.baseline
        completed = job.status == "completed"
        return TransactionAssessment(status=job.status, assessment_id=job.id,
            conversation_context=[{"id": c["id"], "saved_at": c["saved_at"], "representation": "summary" if c["id"] in job.summaries else "full"} for c in job.snapshot["conversations"]],
            baseline=baseline, final_assessment=job.final_assessment,
            outcome="assessed" if completed else None,
            score=baseline["score"] if completed and baseline else None,
            factors=baseline["factors"] if completed and baseline else [],
            explanation=job.final_assessment["explanation"] if completed else None, error=job.error)

adapter = PurchaseScoringAdapter()

def get_purchase_scoring_adapter():
    return adapter
