"""
MPLADS HARBINGER — Task 5 Test Suite
Verifies the integration of Financial–Physical Divergence as the 4th production risk signal.
Covers Test Cases A through G, schema migration, versioning, and de-duplication.
"""
import sys
import os
from pathlib import Path

# Ensure repo root is on sys.path
REPO_ROOT = Path(__file__).parent.resolve()
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from backend.rules.divergence import calculate_divergence_score
from backend.rules.financial import calculate_financial_score
from backend.services.risk_service import (
    analyze_project,
    get_weights,
    RISK_ENGINE_VERSION,
)
from backend.database.db import init_db, get_db


def test_case_a_no_divergence():
    print("Test Case A: No divergence (70% util, 60% phys, 10 pp)...")
    # sanctioned: 1,000,000; expenditure: 700,000 -> util = 70.0%; physical: 60.0% -> gap = 10.0 pp (< 20 pp)
    project = {
        "sanctioned_amount": 1000000.0,
        "expenditure": 700000.0,
        "physical_progress": 60.0,
    }
    result = calculate_divergence_score(project)
    assert result["score"] == 0.0, f"Expected score 0, got {result['score']}"
    assert len(result["alerts"]) == 0, f"Expected 0 alerts, got {len(result['alerts'])}"
    print("  [PASS] Score: 0, Alerts: 0 (No signal triggered)")


def test_case_b_moderate_divergence():
    print("Test Case B: Moderate divergence (82% util, 60% phys, 22 pp)...")
    # sanctioned: 1,000,000; expenditure: 820,000 -> util = 82.0%; physical: 60.0% -> gap = 22.0 pp
    project = {
        "sanctioned_amount": 1000000.0,
        "expenditure": 820000.0,
        "physical_progress": 60.0,
    }
    result = calculate_divergence_score(project)
    assert result["score"] == 28.0, f"Expected score 28, got {result['score']}"
    assert len(result["alerts"]) == 1, f"Expected 1 alert, got {len(result['alerts'])}"
    alert = result["alerts"][0]
    assert alert["rule_id"] == "DIV-001"
    assert alert["severity"] == "MEDIUM"
    assert alert["evidence"]["divergence_pp"] == 22.0
    assert alert["score_contribution"] == 28.0
    assert alert["signal_type"] == "Financial / Physical Progress"
    print("  [PASS] Score: 28, Severity: MEDIUM, Rule: DIV-001, Divergence: 22.0 pp")


def test_case_c_severe_divergence():
    print("Test Case C: Severe divergence (82% util, 45% phys, 37 pp)...")
    # sanctioned: 1,000,000; expenditure: 820,000 -> util = 82.0%; physical: 45.0% -> gap = 37.0 pp (>= 35 pp)
    project = {
        "sanctioned_amount": 1000000.0,
        "expenditure": 820000.0,
        "physical_progress": 45.0,
    }
    result = calculate_divergence_score(project)
    assert result["score"] == 40.0, f"Expected score 40, got {result['score']}"
    assert len(result["alerts"]) == 1, f"Expected 1 alert, got {len(result['alerts'])}"
    alert = result["alerts"][0]
    assert alert["rule_id"] == "DIV-001"
    assert alert["severity"] == "HIGH"
    assert alert["evidence"]["divergence_pp"] == 37.0
    assert alert["evidence"]["financial_utilisation_pct"] == 82.0
    assert alert["evidence"]["physical_progress_pct"] == 45.0
    assert alert["score_contribution"] == 40.0
    print("  [PASS] Score: 40, Severity: HIGH, Rule: DIV-001, Divergence: 37.0 pp")


def test_case_d_missing_physical_progress():
    print("Test Case D: Missing physical progress...")
    project = {
        "sanctioned_amount": 1000000.0,
        "expenditure": 820000.0,
        "physical_progress": None,
    }
    result = calculate_divergence_score(project)
    assert result["score"] == 0.0
    assert len(result["alerts"]) == 0
    print("  [PASS] Missing physical progress handled safely: score=0, alerts=0")


def test_case_e_zero_sanctioned_amount():
    print("Test Case E: Zero or invalid sanctioned amount...")
    for s_amt in [0, -100000]:
        project = {
            "sanctioned_amount": s_amt,
            "expenditure": 820000.0,
            "physical_progress": 45.0,
        }
        result = calculate_divergence_score(project)
        assert result["score"] == 0.0
        assert len(result["alerts"]) == 0
    print("  [PASS] Zero/negative sanctioned amount handled safely: score=0, alerts=0")


def test_case_f_production_4_signal_weighted_score():
    print("Test Case F: Production 4-signal weighted score...")
    settings = {
        "schedule_weight": "0.30",
        "financial_weight": "0.30",
        "peer_weight": "0.20",
        "divergence_weight": "0.20",
    }
    weights = get_weights(settings)
    assert weights["schedule"] == 0.30
    assert weights["financial"] == 0.30
    assert weights["peer"] == 0.20
    assert weights["divergence"] == 0.20
    assert round(sum(weights.values()), 4) == 1.0

    # Project with explicit component scores to test weighted math
    project = {
        "project_id": "TEST-4COMP-001",
        "schedule_score": 50.0,
        "financial_score": 30.0,
        "peer_score": 20.0,
        "divergence_score": 40.0,
    }
    # Expected: 50*0.30 (15) + 30*0.30 (9) + 20*0.20 (4) + 40*0.20 (8) = 36.0
    analysis = analyze_project(project, [project], settings)
    assert analysis["schedule_score"] == 50.0
    assert analysis["financial_score"] == 30.0
    assert analysis["peer_score"] == 20.0
    assert analysis["divergence_score"] == 40.0
    assert analysis["final_score"] == 36.0, f"Expected 36.0, got {analysis['final_score']}"
    assert analysis["schedule_weight"] == 0.30
    assert analysis["financial_weight"] == 0.30
    assert analysis["peer_weight"] == 0.20
    assert analysis["divergence_weight"] == 0.20
    assert analysis["risk_engine_version"] == "2.0"
    print("  [PASS] 4-component weighted math verified: 15 + 9 + 4 + 8 = 36.0 (Version 2.0)")


def test_case_g_no_duplicate_scoring():
    print("Test Case G: Verification that financial/physical mismatch is NOT scored twice...")
    # Project with 82% util vs 45% phys:
    # FIN-001 previously triggered here. Now calculate_financial_score must NOT generate FIN-001.
    project = {
        "project_id": "TEST-DEDUP-001",
        "sanctioned_amount": 1000000.0,
        "expenditure": 820000.0,
        "financial_utilisation": 82.0,
        "physical_progress": 45.0,
        "elapsed_months": 6,
        "planned_duration": 12,
        "status": "Ongoing",
    }
    fin_res = calculate_financial_score(project)
    rule_ids = [a["rule_id"] for a in fin_res["alerts"]]
    assert "FIN-001" not in rule_ids, f"FIN-001 must not be in financial rules: {rule_ids}"
    assert fin_res["score"] == 0, f"Expected fin score 0 (no low util or overspend), got {fin_res['score']}"

    # Only divergence rule should trigger DIV-001
    div_res = calculate_divergence_score(project)
    assert len(div_res["alerts"]) == 1
    assert div_res["alerts"][0]["rule_id"] == "DIV-001"

    # In overall project analysis, only 1 alert for divergence is generated
    analysis = analyze_project(project, [project], {})
    alert_rules = [a["rule_id"] for a in analysis["alerts"]]
    assert "DIV-001" in alert_rules
    assert "FIN-001" not in alert_rules
    print("  [PASS] Verified: FIN-001 is removed, DIV-001 fires independently without duplicate scoring.")


def test_database_migration():
    print("Testing database migration & schema compatibility...")
    init_db()
    conn = get_db()
    cur = conn.cursor()

    # Check risk_scores columns
    cur.execute("PRAGMA table_info(risk_scores)")
    cols = [r["name"] for r in cur.fetchall()]
    assert "divergence_score" in cols, "divergence_score column missing from risk_scores"
    assert "divergence_weight" in cols, "divergence_weight column missing from risk_scores"

    # Check settings table defaults
    cur.execute("SELECT key, value FROM settings")
    s_map = {r["key"]: r["value"] for r in cur.fetchall()}
    assert s_map.get("schedule_weight") == "0.30"
    assert s_map.get("financial_weight") == "0.30"
    assert s_map.get("peer_weight") == "0.20"
    assert s_map.get("divergence_weight") == "0.20"

    conn.close()
    print("  [PASS] Database schema migration verified (columns & 4-signal settings weights present).")


def test_primary_signal_generation():
    print("Testing primary signal generation...")
    settings = {
        "schedule_weight": "0.30",
        "financial_weight": "0.30",
        "peer_weight": "0.20",
        "divergence_weight": "0.20",
    }
    # Project triggering only divergence
    project = {
        "project_id": "TEST-DIV-ONLY",
        "sanctioned_amount": 1000000.0,
        "expenditure": 820000.0,
        "physical_progress": 45.0,
        "elapsed_months": 6,
        "planned_duration": 12,
        "status": "Ongoing",
    }
    res = analyze_project(project, [project], settings)
    assert "Financial–Physical Divergence" in res["primary_signal"], f"Expected 'Financial–Physical Divergence' in primary_signal, got '{res['primary_signal']}'"
    print(f"  [PASS] Primary signal correctly surfaces: '{res['primary_signal']}'")


def test_non_accusatory_language():
    print("Testing non-accusatory terminology in rules...")
    project = {
        "sanctioned_amount": 1000000.0,
        "expenditure": 820000.0,
        "physical_progress": 45.0,
    }
    res = calculate_divergence_score(project)
    text = str(res).lower()
    for forbidden in ["fraud", "corruption", "guilty", "guilt", "wrongdoing detected"]:
        assert forbidden not in text, f"Forbidden accusatory term found: {forbidden}"
    print("  [PASS] Non-accusatory language verified.")


if __name__ == "__main__":
    print("=" * 60)
    print("RUNNING TASK 5 DIVERGENCE TEST SUITE")
    print("=" * 60)
    test_case_a_no_divergence()
    test_case_b_moderate_divergence()
    test_case_c_severe_divergence()
    test_case_d_missing_physical_progress()
    test_case_e_zero_sanctioned_amount()
    test_case_f_production_4_signal_weighted_score()
    test_case_g_no_duplicate_scoring()
    test_database_migration()
    test_primary_signal_generation()
    test_non_accusatory_language()
    print("=" * 60)
    print("ALL TASK 5 TESTS PASSED SUCCESSFULLY (100%)")
    print("=" * 60)
