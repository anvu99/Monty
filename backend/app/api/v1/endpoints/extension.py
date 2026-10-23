from datetime import datetime, timezone
from fastapi import APIRouter
from app.schemas.extension import (
    ApiCheckRiskResponse,
    ApiRiskScore,
    ApiRiskFactor,
    ApiPrediction,
    ApiActiveAlert,
    DismissAlertResponse,
)

router = APIRouter()


@router.get("/extension/check-risk", response_model=ApiCheckRiskResponse)
def check_extension_risk(child_id: str) -> ApiCheckRiskResponse:
    """Extension endpoint to assess purchase risk in real-time."""
    now_str = datetime.now(timezone.utc).isoformat()
    return ApiCheckRiskResponse(
        current_risk_score=ApiRiskScore(
            risk_score=68.0,
            risk_level="MEDIUM",
            factors=[
                ApiRiskFactor(
                    factor="Time of Day",
                    contribution=0.35,
                    description="Transaction occurring after 8:00 PM",
                ),
                ApiRiskFactor(
                    factor="Goal Impact",
                    contribution=0.40,
                    description="Consumes 30% of remaining Skateboard budget",
                ),
            ],
            timestamp=now_str,
        ),
        predictions=[
            ApiPrediction(
                type="impulse_spike",
                risk_level="MEDIUM",
                confidence=0.78,
                message="Likelihood of unplanned digital purchase elevated during evening gaming session.",
                action_suggestion="Suggest a 10-minute wait timer before completing purchase.",
            )
        ],
        active_alerts=[
            ApiActiveAlert(
                alert_id="alert-001",
                type="wait_nudge",
                risk_level="MEDIUM",
                confidence=0.85,
                message="Hey! Remember your Skateboard savings goal? Take 10 minutes to think it over.",
                action_suggestion="Wait 10 minutes",
            )
        ],
    )


@router.post("/extension/dismiss-alert", response_model=DismissAlertResponse)
def dismiss_alert(alert_id: str) -> DismissAlertResponse:
    """Dismiss an active extension alert."""
    return DismissAlertResponse(status="ok", dismissed=True)
