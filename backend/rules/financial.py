"""
MPLADS Sentinel — Risk Rules: Financial-Progress Consistency
Rules: FIN-001, FIN-002, FIN-003
"""
from typing import Dict, Any, List


def calculate_financial_score(project: Dict[str, Any]) -> Dict[str, Any]:
    """
    Calculates a financial-progress consistency score (0-100).
    Higher score = more concern about financial vs physical progress mismatch.
    """
    alerts = []
    score = 0

    fin_util = project.get("financial_utilisation") or 0
    phys_prog = project.get("physical_progress") or 0
    sanctioned = project.get("sanctioned_amount") or 0
    expenditure = project.get("expenditure") or 0
    elapsed = project.get("elapsed_months") or 0
    planned = project.get("planned_duration") or 1
    status = (project.get("status") or "").lower()

    # FIN-001: High financial utilisation relative to low physical progress
    if fin_util > 0 and phys_prog >= 0:
        gap = fin_util - phys_prog
        if gap > 20:
            contribution = min(45, gap * 0.8)
            score += contribution
            alerts.append({
                "rule_id": "FIN-001",
                "rule_name": "Financial-Progress Mismatch",
                "signal_type": "Financial / Progress",
                "severity": "HIGH" if gap > 40 else "MEDIUM",
                "evidence": {
                    "financial_utilisation_pct": fin_util,
                    "physical_progress_pct": phys_prog,
                    "gap_pct": round(gap, 1),
                },
                "explanation": (
                    f"Financial utilisation ({fin_util}%) is significantly higher than "
                    f"physical progress ({phys_prog}%). "
                    f"Gap of {round(gap,1)}% may indicate an unusual spending pattern. "
                    "Requires human review."
                ),
                "score_contribution": round(contribution, 1),
            })

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
