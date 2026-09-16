"""
MPLADS Sentinel — Risk Rules: Financial–Physical Divergence
Rule: DIV-001
Detects uncoupled disbursement velocity where financial utilisation is significantly
ahead of reported on-ground physical progress.
"""
from typing import Dict, Any, List


def calculate_divergence_score(project: Dict[str, Any]) -> Dict[str, Any]:
    """
    Calculates the financial-physical divergence score (0–100).
    Higher score indicates an unusual divergence between funds spent and works completed.

    Requirements:
    - Only calculates when sanctioned_amount > 0, expenditure is present and valid,
      physical_progress is present and valid, and values are numerically valid.
    - divergence_pp = financial_utilisation - physical_progress
    - divergence < 20 pp: score 0, no alert
    - divergence >= 20 and < 35 pp: score 28, MEDIUM severity alert
    - divergence >= 35 pp: score 40, HIGH severity alert
    """
    alerts: List[Dict[str, Any]] = []
    score = 0.0

    sanctioned = project.get("sanctioned_amount")
    expenditure = project.get("expenditure")
    physical_prog = project.get("physical_progress")

    # Guard: all three fields must be present and not None
    if sanctioned is None or expenditure is None or physical_prog is None:
        return {"score": 0.0, "alerts": alerts}

    # Guard: numeric conversion validation
    try:
        s_val = float(sanctioned)
        e_val = float(expenditure)
        p_val = float(physical_prog)
    except (ValueError, TypeError):
        return {"score": 0.0, "alerts": alerts}

    # Guard: sanctioned_amount must be strictly positive, and progress/expenditure non-negative
    if s_val <= 0 or e_val < 0 or p_val < 0:
        return {"score": 0.0, "alerts": alerts}

    fin_util = (e_val / s_val) * 100.0
    divergence_pp = fin_util - p_val

    # Threshold evaluation
    if divergence_pp >= 35.0:
        score = 40.0
        severity = "HIGH"
        alerts.append({
            "rule_id": "DIV-001",
            "rule_name": "Financial–Physical Divergence",
            "signal_type": "Financial / Physical Progress",
            "severity": severity,
            "evidence": {
                "financial_utilisation_pct": round(fin_util, 1),
                "physical_progress_pct": round(p_val, 1),
                "divergence_pp": round(divergence_pp, 1),
            },
            "explanation": (
                f"Financial progress ({round(fin_util, 1)}%) is substantially ahead of "
                f"reported physical progress ({round(p_val, 1)}%) by {round(divergence_pp, 1)} percentage points. "
                "This unusual pattern requires human review."
            ),
            "score_contribution": 40.0,
        })
    elif divergence_pp >= 20.0:
        score = 28.0
        severity = "MEDIUM"
        alerts.append({
            "rule_id": "DIV-001",
            "rule_name": "Financial–Physical Divergence",
            "signal_type": "Financial / Physical Progress",
            "severity": severity,
            "evidence": {
                "financial_utilisation_pct": round(fin_util, 1),
                "physical_progress_pct": round(p_val, 1),
                "divergence_pp": round(divergence_pp, 1),
            },
            "explanation": (
                f"Financial progress ({round(fin_util, 1)}%) is ahead of "
                f"reported physical progress ({round(p_val, 1)}%) by {round(divergence_pp, 1)} percentage points. "
                "This unusual pattern requires human review."
            ),
            "score_contribution": 28.0,
        })

    return {
        "score": round(score, 1),
        "alerts": alerts,
    }
