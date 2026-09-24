"""
MPLADS HARBINGER - Phase 2 Correctness & Consistency Test Suite
Verifies:
1. Peer cohort consistency (same-state preference, cross-state fallback, category isolation, self-exclusion)
2. peer_min_group_size configuration propagation
3. CSV numeric validation (malformed non-numeric flagged as INVALID, clean blanks, formatted currency/percentages)
4. CSV normalization alignment with validation
5. Four-signal score integrity (30/30/20/20 weights, [0, 100] bounds, deterministic primary signal, zero duplicates, clean "None")
"""
import sys
from pathlib import Path
import pandas as pd
import numpy as np

REPO_ROOT = Path(__file__).parent.resolve()
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from backend.rules.peer import get_peer_cohort, calculate_peer_score
from backend.rules.divergence import calculate_divergence_score
from backend.rules.financial import calculate_financial_score
from backend.rules.schedule import calculate_schedule_score
from backend.services.risk_service import (
    analyze_project,
    analyze_dataset,
    get_weights,
    classify_risk,
)
from backend.services.csv_service import (
    validate_dataframe,
    normalize_dataframe,
    _parse_numeric_value,
    EXPECTED_FIELDS,
)


# ==============================================================================
# 1. Peer Cohort Consistency Tests
# ==============================================================================

def test_peer_cohort_same_state_preference():
    print("Testing Peer Cohort: Same-state preference...")
    target = {"id": 1, "project_id": "P-001", "category": "Health", "state": "Kerala"}
    all_projects = [
        target,
        {"id": 2, "project_id": "P-002", "category": "Health", "state": "Kerala", "financial_utilisation": 80.0, "physical_progress": 85.0},
        {"id": 3, "project_id": "P-003", "category": "Health", "state": "Kerala", "financial_utilisation": 75.0, "physical_progress": 70.0},
        {"id": 4, "project_id": "P-004", "category": "Health", "state": "Kerala", "financial_utilisation": 90.0, "physical_progress": 90.0},
        {"id": 5, "project_id": "P-005", "category": "Health", "state": "Bihar", "financial_utilisation": 50.0, "physical_progress": 40.0},
    ]

    cohort, desc = get_peer_cohort(target, all_projects, min_group_size=3)
    assert len(cohort) == 3, f"Expected 3 peers, got {len(cohort)}"
    assert all(p["state"] == "Kerala" for p in cohort), "All peers should be from Kerala"
    assert "Kerala" in desc, f"Description should mention Kerala, got '{desc}'"
    print("  [PASS] Same-state cohort formed correctly without cross-state dilution.")


def test_peer_cohort_cross_state_fallback():
    print("Testing Peer Cohort: Cross-state fallback when same-state < min_peer_group...")
    target = {"id": 1, "project_id": "P-001", "category": "Roads", "state": "Goa"}
    all_projects = [
        target,
        {"id": 2, "project_id": "P-002", "category": "Roads", "state": "Goa", "financial_utilisation": 80.0, "physical_progress": 85.0},
        # Only 1 same-state peer available, min_group_size is 3
        {"id": 3, "project_id": "P-003", "category": "Roads", "state": "Maharashtra", "financial_utilisation": 75.0, "physical_progress": 70.0},
        {"id": 4, "project_id": "P-004", "category": "Roads", "state": "Karnataka", "financial_utilisation": 90.0, "physical_progress": 90.0},
        {"id": 5, "project_id": "P-005", "category": "Education", "state": "Goa", "financial_utilisation": 50.0, "physical_progress": 40.0},
    ]

    cohort, desc = get_peer_cohort(target, all_projects, min_group_size=3)
    assert len(cohort) == 3, f"Expected 3 peers in fallback, got {len(cohort)}"
    cohort_ids = {p["project_id"] for p in cohort}
    assert cohort_ids == {"P-002", "P-003", "P-004"}, f"Unexpected cohort: {cohort_ids}"
    assert "all states" in desc.lower(), f"Description should indicate fallback, got '{desc}'"
    print("  [PASS] Fallback to cross-state cohort succeeded when same-state peers were insufficient.")


def test_peer_cohort_excludes_self_and_unrelated_categories():
    print("Testing Peer Cohort: Excludes self (by id & project_id) and unrelated categories...")
    target = {"id": 10, "project_id": "P-010", "category": "Water", "state": "Tamil Nadu"}
    all_projects = [
        target,
        {"id": 10, "project_id": "P-010", "category": "Water", "state": "Tamil Nadu"}, # duplicate reference
        {"id": 11, "project_id": "P-011", "category": "Water", "state": "Tamil Nadu"},
        {"id": 12, "project_id": "P-012", "category": "Water", "state": "Tamil Nadu"},
        {"id": 13, "project_id": "P-013", "category": "Water", "state": "Tamil Nadu"},
        {"id": 14, "project_id": "P-014", "category": "Sanitation", "state": "Tamil Nadu"},
    ]

    cohort, _ = get_peer_cohort(target, all_projects, min_group_size=3)
    peer_ids = [p["project_id"] for p in cohort]
    assert "P-010" not in peer_ids, "Cohort must NOT include the target project itself"
    assert "P-014" not in peer_ids, "Cohort must NOT include projects from other categories"
    assert len(cohort) == 3
    print("  [PASS] Self-exclusion and category isolation verified.")


def test_peer_cohort_insufficient_peers():
    print("Testing Peer Cohort: Insufficient comparable peers...")
    target = {"id": 1, "project_id": "P-001", "category": "RareCategory", "state": "Sikkim"}
    all_projects = [
        target,
        {"id": 2, "project_id": "P-002", "category": "RareCategory", "state": "Sikkim"},
    ]
    cohort, desc = get_peer_cohort(target, all_projects, min_group_size=3)
    assert len(cohort) == 1
    assert "Insufficient comparable projects" in desc
    res = calculate_peer_score(target, all_projects, min_group_size=3)
    assert res["score"] == 0
    assert res["peer_group_size"] == 0
    assert "Insufficient" in res["peer_group_description"]
    print("  [PASS] Graceful handling of insufficient peers verified.")


# ==============================================================================
# 2. peer_min_group_size Configuration Propagation
# ==============================================================================

def test_peer_min_group_size_propagation():
    print("Testing peer_min_group_size propagation in analyze_project & analyze_dataset...")
    target = {
        "project_id": "T-100",
        "category": "Health",
        "state": "Delhi",
        "financial_utilisation": 95.0,
        "physical_progress": 20.0,
    }
    # 3 peers in Delhi, 1 peer in Haryana (total 4 peers in Health)
    all_projects = [
        target,
        {"project_id": "T-101", "category": "Health", "state": "Delhi", "financial_utilisation": 50.0, "physical_progress": 50.0},
        {"project_id": "T-102", "category": "Health", "state": "Delhi", "financial_utilisation": 52.0, "physical_progress": 51.0},
        {"project_id": "T-103", "category": "Health", "state": "Delhi", "financial_utilisation": 48.0, "physical_progress": 49.0},
        {"project_id": "T-104", "category": "Health", "state": "Haryana", "financial_utilisation": 50.0, "physical_progress": 50.0},
    ]

    # When min_group_size = 3:
    # Target has 3 same-state peers (T-101, T-102, T-103), which is >= 3.
    settings_min_3 = {"peer_min_group_size": "3"}
    res_3 = analyze_project(target, all_projects, settings_min_3)
    assert res_3["peer_group_size"] == 3
    assert "Delhi" in res_3["peer_group_description"]

    # When min_group_size = 4:
    # Target has only 3 same-state peers < 4, so falls back to all states (4 peers total >= 4).
    settings_min_4 = {"peer_min_group_size": "4"}
    res_4 = analyze_project(target, all_projects, settings_min_4)
    assert res_4["peer_group_size"] == 4
    assert "all states" in res_4["peer_group_description"].lower()

    # When min_group_size = 5:
    # Target has 4 peers total across all states, which is < 5 -> insufficient.
    settings_min_5 = {"peer_min_group_size": "5"}
    res_5 = analyze_project(target, all_projects, settings_min_5)
    assert res_5["peer_group_size"] == 0
    assert "Insufficient" in res_5["peer_group_description"]

    # Test analyze_dataset propagation
    dataset_res = analyze_dataset(all_projects, settings_min_5)
    assert len(dataset_res) == 5
    for r in dataset_res:
        assert r["peer_group_size"] == 0  # min 5 cannot be met by 4 available peers
    print("  [PASS] peer_min_group_size correctly changes cohort threshold and falls back as configured.")


# ==============================================================================
# 3. CSV Numeric Validation & Normalization
# ==============================================================================

def test_parse_numeric_value_helper():
    print("Testing _parse_numeric_value helper...")
    # Clean blank / null
    assert _parse_numeric_value(None) == (True, None, False)
    assert _parse_numeric_value("") == (True, None, False)
    assert _parse_numeric_value("   ") == (True, None, False)
    assert _parse_numeric_value(np.nan) == (True, None, False)

    # Valid numbers with formatting
    assert _parse_numeric_value(100) == (False, 100.0, False)
    assert _parse_numeric_value("1000") == (False, 1000.0, False)
    assert _parse_numeric_value("₹1,50,000") == (False, 150000.0, False)
    assert _parse_numeric_value("$2,500.50") == (False, 2500.50, False)
    assert _parse_numeric_value(" 75% ", is_percentage=True) == (False, 75.0, False)

    # Malformed strings
    assert _parse_numeric_value("banana") == (False, None, True)
    assert _parse_numeric_value("₹abc") == (False, None, True)
    assert _parse_numeric_value("12.34.56") == (False, None, True)
    assert _parse_numeric_value("abc%", is_percentage=True) == (False, None, True)
    print("  [PASS] _parse_numeric_value helper correctly classifies blanks, numbers, and malformed strings.")


def test_csv_validation_catches_malformed_values():
    print("Testing CSV validation flags malformed non-numeric values as INVALID...")
    data = {
        "pid": ["P1", "P2", "P3", "P4"],
        "cost": ["1000000", "banana", "₹5,00,000", ""],        # 1 malformed, 1 blank
        "util": ["50%", "abc%", "75", None],                   # 1 malformed, 1 blank
        "duration": ["12", "xyz", "24", "  "],                 # 1 malformed, 1 blank
    }
    df = pd.DataFrame(data)
    mapping = {
        "project_id": "pid",
        "sanctioned_amount": "cost",
        "financial_utilisation": "util",
        "planned_duration": "duration",
    }

    report = validate_dataframe(df, mapping)
    invalid_issues = [i for i in report["issues"] if i["type"] == "INVALID"]

    # We expect 3 INVALID issues: 1 for cost, 1 for util, 1 for duration
    malformed_fields = {i["field"] for i in invalid_issues if "malformed" in i["message"]}
    assert "sanctioned_amount" in malformed_fields, "Should flag malformed in sanctioned_amount"
    assert "financial_utilisation" in malformed_fields, "Should flag malformed in financial_utilisation"
    assert "planned_duration" in malformed_fields, "Should flag malformed in planned_duration"

    # Quality score must drop below 100%
    assert report["data_quality_score"] < 100.0, f"Quality score should be reduced, got {report['data_quality_score']}"
    print(f"  [PASS] Caught malformed strings as INVALID. Quality score: {report['data_quality_score']}%.")


def test_csv_normalization_aligns_with_validation():
    print("Testing CSV normalization parses valid values and sets malformed to None...")
    data = {
        "pid": ["P1", "P2", "P3"],
        "cost": ["₹10,00,000", "banana", ""],
        "util": ["82.5%", "invalid", "60%"],
    }
    df = pd.DataFrame(data)
    mapping = {
        "project_id": "pid",
        "sanctioned_amount": "cost",
        "financial_utilisation": "util",
    }

    records = normalize_dataframe(df, mapping)
    assert len(records) == 3

    # Row 0: clean values
    assert records[0]["sanctioned_amount"] == 1000000.0
    assert records[0]["financial_utilisation"] == 82.5

    # Row 1: malformed values -> None
    assert records[1]["sanctioned_amount"] is None
    assert records[1]["financial_utilisation"] is None

    # Row 2: blank cost -> None, valid util -> 60.0
    assert records[2]["sanctioned_amount"] is None
    assert records[2]["financial_utilisation"] == 60.0
    print("  [PASS] Normalization aligns with validation.")


# ==============================================================================
# 4. Four-Signal Integrity & Determinism
# ==============================================================================

def test_four_signal_score_integrity_and_bounds():
    print("Testing Four-Signal Score bounds and default 30/30/20/20 weights...")
    weights = get_weights({})
    assert weights == {"schedule": 0.30, "financial": 0.30, "peer": 0.20, "divergence": 0.20}
    assert sum(weights.values()) == 1.0

    # Max project (scores = 100 each)
    p_max = {
        "project_id": "MAX-01",
        "schedule_score": 100.0,
        "financial_score": 100.0,
        "peer_score": 100.0,
        "divergence_score": 100.0,
    }
    res_max = analyze_project(p_max, [p_max], {})
    assert res_max["final_score"] == 100.0
    assert res_max["risk_level"] == "HIGH"

    # Min project (scores = 0 each)
    p_min = {
        "project_id": "MIN-01",
        "schedule_score": 0.0,
        "financial_score": 0.0,
        "peer_score": 0.0,
        "divergence_score": 0.0,
    }
    res_min = analyze_project(p_min, [p_min], {})
    assert res_min["final_score"] == 0.0
    assert res_min["risk_level"] == "LOW"
    assert res_min["primary_signal"] == "None"

    # Over-100 or negative scores clamped
    p_clamp = {
        "project_id": "CLAMP-01",
        "schedule_score": 150.0,
        "financial_score": 120.0,
        "peer_score": 110.0,
        "divergence_score": 100.0,
    }
    res_clamp = analyze_project(p_clamp, [p_clamp], {})
    assert res_clamp["final_score"] <= 100.0, f"Expected clamped <= 100, got {res_clamp['final_score']}"

    print("  [PASS] Score bounds [0, 100] and default weights verified.")


def test_primary_signal_deterministic_order_and_uniqueness():
    print("Testing Primary Signal deterministic ordering and zero duplicate names...")
    # Trigger all 4 signals
    p_all = {
        "project_id": "ALL-01",
        "schedule_score": 50.0,    # >= 40
        "financial_score": 60.0,   # >= 40
        "peer_score": 45.0,        # >= 40
        "divergence_score": 30.0,  # >= 28
    }
    res_all = analyze_project(p_all, [p_all], {})
    expected = "Schedule Deviation + Financial Utilisation + Peer Outlier + Financial\u2013Physical Divergence"
    assert res_all["primary_signal"] == expected, f"Got: {res_all['primary_signal']}"

    # Verify no duplicate signal tokens
    tokens = res_all["primary_signal"].split(" + ")
    assert len(tokens) == len(set(tokens)), f"Duplicate signals found in: {tokens}"

    # Single signal triggered
    p_single = {
        "project_id": "SINGLE-01",
        "schedule_score": 20.0,
        "financial_score": 10.0,
        "peer_score": 10.0,
        "divergence_score": 40.0,
    }
    res_single = analyze_project(p_single, [p_single], {})
    assert res_single["primary_signal"] == "Financial\u2013Physical Divergence"

    print("  [PASS] Primary signal ordering deterministic, no duplicates, clean 'None' when quiet.")


# ==============================================================================
# Main Runner
# ==============================================================================

def run_all_tests():
    print("=" * 60)
    print("RUNNING PHASE 2 CORRECTNESS & CONSISTENCY REGRESSION TESTS")
    print("=" * 60)

    test_peer_cohort_same_state_preference()
    test_peer_cohort_cross_state_fallback()
    test_peer_cohort_excludes_self_and_unrelated_categories()
    test_peer_cohort_insufficient_peers()
    test_peer_min_group_size_propagation()
    test_parse_numeric_value_helper()
    test_csv_validation_catches_malformed_values()
    test_csv_normalization_aligns_with_validation()
    test_four_signal_score_integrity_and_bounds()
    test_primary_signal_deterministic_order_and_uniqueness()

    print("=" * 60)
    print("ALL PHASE 2 REGRESSION TESTS PASSED SUCCESSFULLY (100%)")
    print("=" * 60)


if __name__ == "__main__":
    run_all_tests()
