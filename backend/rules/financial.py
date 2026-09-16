"""
MPLADS Sentinel — Risk Rules: Financial Utilisation & Budget Consistency
Rules: FIN-002, FIN-003
(Note: Financial-vs-physical divergence is managed separately in rules/divergence.py via DIV-001)
"""
from typing import Dict, Any, List


def calculate_financial_score(project: Dict[str, Any]) -> Dict[str, Any]:
    """
    Calculates a financial utilisation and budget consistency score (0-100).
    Evaluates delayed utilisation and expenditure exceeding sanctioned budget.
    """
    alerts = []
    score = 0

    fin_util = project.get("financial_utilisation") or 0
    sanctioned = project.get("sanctioned_amount") or 0
    expenditure = project.get("expenditure") or 0
    elapsed = project.get("elapsed_months") or 0
    planned = project.get("planned_duration") or 1
    status = (project.get("status") or "").lower()

    # FIN-002: Very low utilisation despite long elapsed time
    if elapsed >= 12 and fin_util < 30 and status not in ("completed",):
        contribution = 20
        score += contribution
        alerts.append({
            "rule_id": "FIN-002",
            "rule_name": "Low Utilisation Despite Prolonged Duration",
            "signal_type": "Financial / Progress",
            "severity": "MEDIUM",
            "evidence": {
                "elapsed_months": elapsed,
                "financial_utilisation_pct": fin_util,
            },
            "explanation": (
                f"Only {fin_util}% of sanctioned funds have been utilised after {elapsed} months. "
                "This pattern may indicate project delay or implementation issues."
            ),
            "score_contribution": contribution,
        })

    # FIN-003: Expenditure exceeds sanctioned amount (anomalous)
    if sanctioned > 0 and expenditure > sanctioned * 1.05:
        over_pct = ((expenditure - sanctioned) / sanctioned) * 100
        contribution = min(30, 15 + over_pct)
        score += contribution
        alerts.append({
            "rule_id": "FIN-003",
            "rule_name": "Expenditure Exceeds Sanctioned Amount",
            "signal_type": "Financial / Progress",
            "severity": "HIGH",
            "evidence": {
                "sanctioned_amount": sanctioned,
                "expenditure": expenditure,
                "overspend_pct": round(over_pct, 1),
            },
            "explanation": (
                f"Expenditure (₹{expenditure:,.0f}) exceeds sanctioned amount (₹{sanctioned:,.0f}) "
                f"by {round(over_pct,1)}%. This is an unusual pattern requiring immediate review."
            ),
            "score_contribution": round(contribution, 1),
        })

    return {
        "score": min(100, round(score, 1)),
        "alerts": alerts,
    }
