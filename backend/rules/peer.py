"""
MPLADS Sentinel — Risk Rules: Contextual Peer Outlier
Rules: PEER-001, PEER-002
"""
import numpy as np
from typing import Dict, Any, List, Optional, Tuple


def build_peer_indexes(
    all_projects: List[Dict[str, Any]]
) -> Tuple[Dict[Tuple[str, str], List[Dict[str, Any]]], Dict[str, List[Dict[str, Any]]]]:
    """
    Builds pre-grouped lookup dictionaries for category+state and category.
    Runs once in O(N) time per dataset.
    """
    by_category_state: Dict[Tuple[str, str], List[Dict[str, Any]]] = {}
    by_category: Dict[str, List[Dict[str, Any]]] = {}

    for p in all_projects:
        cat = p.get("category", "")
        st = p.get("state", "")
        key_cs = (cat, st)
        if key_cs not in by_category_state:
            by_category_state[key_cs] = []
        by_category_state[key_cs].append(p)

        if cat not in by_category:
            by_category[cat] = []
        by_category[cat].append(p)

    return by_category_state, by_category


def get_peer_cohort(
    project: Dict[str, Any],
    all_projects: List[Dict[str, Any]],
    min_group_size: int = 3,
    indexes: Optional[Tuple[Dict[Tuple[str, str], List[Dict[str, Any]]], Dict[str, List[Dict[str, Any]]]]] = None,
) -> Tuple[List[Dict[str, Any]], str]:
    """
    Constructs the peer cohort for a target project from all available projects.
    Cohort definition:
    1. Same category + same state (excluding target project)
    2. Fallback to same category across all states if same-state count < min_group_size
    Returns (peers, group_description).
    """
    pid = project.get("project_id")
    target_db_id = project.get("id")
    category = project.get("category", "")
    state = project.get("state", "")

    def is_self(p: Dict[str, Any]) -> bool:
        if pid and p.get("project_id") == pid:
            return True
        if target_db_id and p.get("id") == target_db_id:
            return True
        return False

    if indexes is not None:
        by_category_state, by_category = indexes
        # 1. Primary: Same category + same state (excluding self)
        same_state_candidates = by_category_state.get((category, state), [])
        same_state_peers = [p for p in same_state_candidates if not is_self(p)]

        if len(same_state_peers) >= min_group_size:
            return same_state_peers, f"{category} projects in {state}"

        # 2. Fallback: Same category across all states (excluding self)
        cross_state_candidates = by_category.get(category, [])
        cross_state_peers = [p for p in cross_state_candidates if not is_self(p)]

        group_label = (
            f"{category} projects (all states)"
            if len(cross_state_peers) >= min_group_size
            else "Insufficient comparable projects for peer analysis."
        )
        return cross_state_peers, group_label

    # Unindexed fallback for ad-hoc / single project evaluations
    same_state_peers = [
        p for p in all_projects
        if not is_self(p)
        and p.get("category") == category
        and p.get("state") == state
    ]

    if len(same_state_peers) >= min_group_size:
        return same_state_peers, f"{category} projects in {state}"

    cross_state_peers = [
        p for p in all_projects
        if not is_self(p)
        and p.get("category") == category
    ]

    group_label = (
        f"{category} projects (all states)"
        if len(cross_state_peers) >= min_group_size
        else "Insufficient comparable projects for peer analysis."
    )
    return cross_state_peers, group_label


def calculate_peer_score(
    project: Dict[str, Any],
    all_projects: List[Dict[str, Any]],
    min_group_size: int = 3,
    indexes: Optional[Any] = None,
) -> Dict[str, Any]:
    """
    Calculates a peer outlier score (0-100).
    Groups similar projects by category+state, then checks if the target is an outlier.
    """
    alerts = []
    score = 0
    peer_stats = None

    fin_util = project.get("financial_utilisation")
    phys_prog = project.get("physical_progress")
    elapsed = project.get("elapsed_months")

    # Build peer group using shared cohort logic
    peers, group_label = get_peer_cohort(project, all_projects, min_group_size, indexes=indexes)

    if len(peers) < min_group_size:
        return {
            "score": 0,
            "alerts": [],
            "peer_stats": None,
            "peer_group_size": 0,
            "peer_group_description": "Insufficient comparable projects for peer analysis.",
        }

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
