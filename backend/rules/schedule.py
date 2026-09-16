"""
MPLADS Sentinel — Risk Rules: Schedule Deviation
Rules: SCH-001, SCH-002, SCH-003
"""
from typing import Dict, Any, List


def calculate_schedule_score(project: Dict[str, Any]) -> Dict[str, Any]:
    """
    Calculates a schedule deviation score (0-100) for a project.
    Higher score = more concern about schedule deviation.
    """
    alerts = []
    score = 0

    planned = project.get("planned_duration") or 0
    elapsed = project.get("elapsed_months") or 0
    progress = project.get("physical_progress") or 0
    status = (project.get("status") or "").lower()
    expected_completion = project.get("expected_completion")

    # SCH-001: Project is overdue (not completed but past expected duration)
    if status not in ("completed",) and planned > 0 and elapsed > planned:
        delay = elapsed - planned
        delay_pct = (delay / planned) * 100 if planned > 0 else 0
        contribution = min(40, 20 + delay_pct * 0.5)
        score += contribution
        alerts.append({
            "rule_id": "SCH-001",
            "rule_name": "Schedule Overrun Detected",
            "signal_type": "Schedule Deviation",
            "severity": "HIGH" if delay_pct > 50 else "MEDIUM",
            "evidence": {
                "planned_duration_months": planned,
                "elapsed_months": elapsed,
                "delay_months": delay,
                "delay_percentage": round(delay_pct, 1),
            },
            "explanation": (
                f"Project has exceeded its planned duration. "
                f"Planned: {planned} months, Elapsed: {elapsed} months "
                f"(delay of {delay} months / {round(delay_pct,1)}%)."
            ),
            "score_contribution": round(contribution, 1),
        })

    # SCH-002: Low progress relative to elapsed time (stagnation)
    if planned > 0 and elapsed > 0:
        expected_progress = min(100, (elapsed / planned) * 100)
        gap = expected_progress - progress
        if gap > 25 and status not in ("completed",):
            contribution = min(35, gap * 0.6)
            score += contribution
            alerts.append({
                "rule_id": "SCH-002",
                "rule_name": "Progress Stagnation Detected",
                "signal_type": "Schedule Deviation",
                "severity": "HIGH" if gap > 50 else "MEDIUM",
                "evidence": {
                    "elapsed_months": elapsed,
                    "planned_duration_months": planned,
                    "expected_progress_pct": round(expected_progress, 1),
                    "actual_progress_pct": progress,
                    "progress_gap_pct": round(gap, 1),
                },
                "explanation": (
                    f"Physical progress is significantly behind the expected level. "
                    f"Expected ~{round(expected_progress,1)}% progress after {elapsed} of {planned} planned months, "
                    f"but only {progress}% reported (gap: {round(gap,1)}%)."
                ),
                "score_contribution": round(contribution, 1),
            })

    # SCH-003: Long-duration project with very low progress
    if elapsed >= 12 and progress < 20 and status not in ("completed",):
        contribution = 15
        score += contribution
        alerts.append({
            "rule_id": "SCH-003",
            "rule_name": "Long Duration with Minimal Progress",
            "signal_type": "Schedule Deviation",
            "severity": "MEDIUM",
            "evidence": {
                "elapsed_months": elapsed,
                "physical_progress_pct": progress,
            },
            "explanation": (
                f"Project has been running for {elapsed} months but shows only {progress}% physical progress. "
                "This pattern requires attention."
            ),
            "score_contribution": contribution,
        })

    return {
        "score": min(100, round(score, 1)),
        "alerts": alerts,
    }
