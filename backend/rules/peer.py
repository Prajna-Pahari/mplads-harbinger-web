"""
MPLADS Sentinel — Risk Rules: Contextual Peer Outlier
Rules: PEER-001, PEER-002
"""
import numpy as np
from typing import Dict, Any, List, Optional


def calculate_peer_score(
    project: Dict[str, Any],
    all_projects: List[Dict[str, Any]],
    min_group_size: int = 3,
) -> Dict[str, Any]:
    """
    Calculates a peer outlier score (0-100).
    Groups similar projects by category+state, then checks if the target is an outlier.
    """
    alerts = []
    score = 0
    peer_stats = None

    pid = project.get("project_id")
    category = project.get("category", "")
    state = project.get("state", "")
    fin_util = project.get("financial_utilisation")
    phys_prog = project.get("physical_progress")
    elapsed = project.get("elapsed_months")

    # Build peer group: same category + state, excluding the project itself
    peers = [
        p for p in all_projects
        if p.get("project_id") != pid
        and p.get("category") == category
        and p.get("state") == state
    ]

    # Fallback: widen to just category if not enough peers
    if len(peers) < min_group_size:
        peers = [
            p for p in all_projects
            if p.get("project_id") != pid
            and p.get("category") == category
        ]

    if len(peers) < min_group_size:
        return {
            "score": 0,
            "alerts": [],
            "peer_stats": None,
            "peer_group_size": 0,
            "peer_group_description": "Insufficient comparable projects for peer analysis.",
        }

    group_label = f"{category} projects in {state}" if len([
        p for p in all_projects
        if p.get("project_id") != pid
        and p.get("category") == category
        and p.get("state") == state
    ]) >= min_group_size else f"{category} projects (all states)"

    # Compute peer statistics
    peer_fin = [p["financial_utilisation"] for p in peers if p.get("financial_utilisation") is not None]
    peer_prog = [p["physical_progress"] for p in peers if p.get("physical_progress") is not None]

    peer_stats = {}
    if peer_fin:
        peer_stats["financial_utilisation"] = {
            "median": round(float(np.median(peer_fin)), 1),
            "mean": round(float(np.mean(peer_fin)), 1),
            "std": round(float(np.std(peer_fin)), 1),
            "min": round(float(np.min(peer_fin)), 1),
            "max": round(float(np.max(peer_fin)), 1),
            "q1": round(float(np.percentile(peer_fin, 25)), 1),
            "q3": round(float(np.percentile(peer_fin, 75)), 1),
        }

    if peer_prog:
        peer_stats["physical_progress"] = {
            "median": round(float(np.median(peer_prog)), 1),
            "mean": round(float(np.mean(peer_prog)), 1),
            "std": round(float(np.std(peer_prog)), 1),
            "min": round(float(np.min(peer_prog)), 1),
            "max": round(float(np.max(peer_prog)), 1),
            "q1": round(float(np.percentile(peer_prog, 25)), 1),
            "q3": round(float(np.percentile(peer_prog, 75)), 1),
        }

    # PEER-001: Financial utilisation outlier (z-score based)
    if fin_util is not None and len(peer_fin) >= min_group_size:
        mean_f = np.mean(peer_fin)
        std_f = np.std(peer_fin)
        if std_f > 0:
            z = abs((fin_util - mean_f) / std_f)
            if z > 1.5:
                contribution = min(50, z * 12)
                score += contribution
                iqr_low = peer_stats["financial_utilisation"]["q1"]
                iqr_high = peer_stats["financial_utilisation"]["q3"]
                alerts.append({
                    "rule_id": "PEER-001",
                    "rule_name": "Financial Utilisation Peer Outlier",
                    "signal_type": "Peer Comparison",
                    "severity": "HIGH" if z > 2.5 else "MEDIUM",
                    "evidence": {
                        "project_financial_utilisation": fin_util,
                        "peer_median": peer_stats["financial_utilisation"]["median"],
                        "peer_range": f"{iqr_low}%–{iqr_high}%",
                        "peer_group": group_label,
                        "peer_count": len(peers),
                        "z_score": round(z, 2),
                    },
                    "explanation": (
                        f"Project financial utilisation ({fin_util}%) is an outlier compared to "
                        f"similar {group_label} (peer median: {peer_stats['financial_utilisation']['median']}%, "
                        f"typical range: {iqr_low}%–{iqr_high}%). "
                        "Unusual pattern detected relative to comparable works."
                    ),
                    "score_contribution": round(contribution, 1),
                })

    # PEER-002: Physical progress outlier
    if phys_prog is not None and len(peer_prog) >= min_group_size:
        mean_p = np.mean(peer_prog)
        std_p = np.std(peer_prog)
        if std_p > 0:
            z = abs((phys_prog - mean_p) / std_p)
            if z > 1.5:
                contribution = min(35, z * 10)
                score += contribution
                iqr_low = peer_stats["physical_progress"]["q1"]
                iqr_high = peer_stats["physical_progress"]["q3"]
                alerts.append({
                    "rule_id": "PEER-002",
                    "rule_name": "Physical Progress Peer Outlier",
                    "signal_type": "Peer Comparison",
                    "severity": "MEDIUM",
                    "evidence": {
                        "project_physical_progress": phys_prog,
                        "peer_median": peer_stats["physical_progress"]["median"],
                        "peer_range": f"{iqr_low}%–{iqr_high}%",
                        "peer_group": group_label,
                        "peer_count": len(peers),
                        "z_score": round(z, 2),
                    },
                    "explanation": (
                        f"Project physical progress ({phys_prog}%) is an outlier compared to "
                        f"similar {group_label} (peer median: {peer_stats['physical_progress']['median']}%, "
                        f"typical range: {iqr_low}%–{iqr_high}%). "
                        "Progress pattern differs from comparable works."
                    ),
                    "score_contribution": round(contribution, 1),
                })

    return {
        "score": min(100, round(score, 1)),
        "alerts": alerts,
        "peer_stats": peer_stats,
        "peer_group_size": len(peers),
        "peer_group_description": group_label,
    }
