"""
MPLADS Sentinel — Risk Service
Orchestrates all four risk checks and produces final risk score.
Checks:
1. Schedule / Delay
2. Financial / Utilisation
3. Peer Outlier
4. Financial–Physical Divergence
"""
import json
from typing import Dict, Any, List, Optional
from backend.rules.schedule import calculate_schedule_score
from backend.rules.financial import calculate_financial_score
from backend.rules.peer import calculate_peer_score
from backend.rules.divergence import calculate_divergence_score


RISK_ENGINE_VERSION = "2.0"


def get_weights(settings: Dict[str, str]) -> Dict[str, float]:
    return {
        "schedule": float(settings.get("schedule_weight", 0.30)),
        "financial": float(settings.get("financial_weight", 0.30)),
        "peer": float(settings.get("peer_weight", 0.20)),
        "divergence": float(settings.get("divergence_weight", 0.20)),
    }


def classify_risk(score: float, settings: Dict[str, str]) -> str:
    low_thresh = float(settings.get("risk_low_threshold", 40))
    med_thresh = float(settings.get("risk_medium_threshold", 70))
    if score < low_thresh:
        return "LOW"
    elif score < med_thresh:
        return "MEDIUM"
    return "HIGH"


def analyze_project(
    project: Dict[str, Any],
    all_projects: List[Dict[str, Any]],
    settings: Dict[str, str],
    min_peer_group: int = 3,
) -> Dict[str, Any]:
    """
    Run all four risk checks on a single project and return the full risk result.
    Respects pre-calculated component scores if present in the project data.
    """
    weights = get_weights(settings)
    all_alerts = []

    # 1. Schedule Score
    if project.get("schedule_score") is not None:
        s1 = float(project["schedule_score"])
    else:
        sch_result = calculate_schedule_score(project)
        s1 = sch_result["score"]
        all_alerts.extend(sch_result["alerts"])

    # 2. Financial Score
    if project.get("financial_score") is not None:
        s2 = float(project["financial_score"])
    else:
        fin_result = calculate_financial_score(project)
        s2 = fin_result["score"]
        all_alerts.extend(fin_result["alerts"])

    # 3. Peer Score
    peer_stats = None
    peer_group_size = 0
    peer_group_desc = ""
    if project.get("peer_score") is not None:
        s3 = float(project["peer_score"])
    else:
        peer_result = calculate_peer_score(project, all_projects, min_peer_group)
        s3 = peer_result["score"]
        all_alerts.extend(peer_result["alerts"])
        peer_stats = peer_result.get("peer_stats")
        peer_group_size = peer_result.get("peer_group_size", 0)
        peer_group_desc = peer_result.get("peer_group_description", "")

    # 4. Financial–Physical Divergence Score
    if project.get("divergence_score") is not None:
        s4 = float(project["divergence_score"])
    else:
        div_result = calculate_divergence_score(project)
        s4 = div_result["score"]
        all_alerts.extend(div_result["alerts"])

    # Final Score (Straight weighted sum of all 4 components)
    final = (
        s1 * weights["schedule"]
        + s2 * weights["financial"]
        + s3 * weights["peer"]
        + s4 * weights["divergence"]
    )
    final = round(min(100, final), 1)
    risk_level = classify_risk(final, settings)

    # Generate Primary Signal based on component thresholds
    triggered_signals = []
    if s1 >= 40:
        triggered_signals.append("Schedule Deviation")
    if s2 >= 40:
        triggered_signals.append("Financial Utilisation")
    if s3 >= 40:
        triggered_signals.append("Peer Outlier")
    if s4 >= 28:
        triggered_signals.append("Financial–Physical Divergence")

    primary_signal = " + ".join(triggered_signals) if triggered_signals else "None"

    return {
        "project_id": project.get("project_id"),
        "schedule_score": s1,
        "financial_score": s2,
        "peer_score": s3,
        "divergence_score": s4,
        "final_score": final,
        "risk_level": risk_level,
        "primary_signal": primary_signal,
        "schedule_weight": weights["schedule"],
        "financial_weight": weights["financial"],
        "peer_weight": weights["peer"],
        "divergence_weight": weights["divergence"],
        "alerts": all_alerts,
        "peer_stats": peer_stats,
        "peer_group_size": peer_group_size,
        "peer_group_description": peer_group_desc,
        "risk_engine_version": RISK_ENGINE_VERSION,
    }


def analyze_dataset(
    projects: List[Dict[str, Any]],
    settings: Dict[str, str],
) -> List[Dict[str, Any]]:
    """
    Analyze all projects in a dataset.
    """
    results = []
    projects_list = list(projects)
    for project in projects_list:
        result = analyze_project(project, projects_list, settings)
        results.append(result)
    return results
