from fastapi import HTTPException

from app.schemas.ai import CoachingOutput, InsightsOutput, NudgeOutput, RiskOutput, SuggestionsOutput
from app.services.ai_context_service import evidence_refs

SCHEMAS = {"chat": CoachingOutput, "insights": InsightsOutput, "nudge": NudgeOutput,
           "intentions": SuggestionsOutput, "risk": RiskOutput}


async def generate(task, snapshot, provider, request=None):
    has_purchases = snapshot["spending"]["count"] > 0
    has_history = snapshot.get("impulse_summary", {}).get("assessment_count", 0) > 0
    has_decisions = bool(snapshot.get("positive_decisions"))
    has_goals = bool(snapshot["goals"])
    if task == "risk" and not has_purchases and not has_history and not has_decisions and "proposed_purchase" not in snapshot:
        return RiskOutput(status="insufficient_data", explanation="No purchases are recorded in the last 30 days. Submit a proposed purchase for an assessment.")
    if task == "insights" and not has_purchases and not has_history and not has_decisions:
        return InsightsOutput(insights=[])
    if task == "intentions" and not has_purchases and not has_goals and not has_history and not has_decisions:
        return SuggestionsOutput(suggestions=[])
    if task == "nudge" and not has_purchases and not has_goals and not has_history and not has_decisions:
        return NudgeOutput(has_nudge=False)
    allowed = evidence_refs(snapshot)
    result = await provider.generate(task, snapshot, allowed, request or {}, SCHEMAS[task])
    refs = list(getattr(result, "evidence_refs", []))
    for factor in getattr(result, "factors", []):
        refs.extend(factor.evidence_refs)
    if not set(refs).issubset(allowed):
        raise HTTPException(502, "AI referenced unavailable evidence")
    if task in ("insights", "intentions"):
        values = getattr(result, "insights" if task == "insights" else "suggestions")
        if values and not refs:
            raise HTTPException(502, "AI omitted supporting evidence")
    return result


def risk_level(score):
    if score is None:
        return "UNKNOWN"
    return "HIGH" if score >= 70 else "MEDIUM" if score >= 40 else "LOW"
