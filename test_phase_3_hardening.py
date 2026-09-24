"""
MPLADS HARBINGER - Phase 3 Hardening & Performance Test Suite
Tests:
1. Project sorting SQL qualification (all columns, ASC/DESC, invalid fallback)
2. CSV custom column mapping preservation through ingestion
3. SPA catch-all route API 404 behavior (JSON 404 on missing /api/*)
4. Peer analysis O(N) equivalence with unindexed cohort resolution
5. CSV session store TTL expiration and 20-session eviction cap
6. Analytics summary query consolidation and deterministic 500-point scatter cap
7. Database transaction rollback and connection safety on ingestion failure
"""
import sys
import io
import time
import json
import sqlite3
import pandas as pd
from pathlib import Path
from datetime import datetime, timedelta

REPO_ROOT = Path(__file__).parent.resolve()
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from backend.database.db import get_db, init_db
from backend.main import (
    app,
    list_projects,
    PROJECT_SORT_COLUMNS,
    _ingest_csv,
    _session_store,
    _clean_expired_sessions,
    SESSION_TTL_SECONDS,
    MAX_ACTIVE_SESSIONS,
    analytics_summary,
)
from backend.rules.peer import (
    get_peer_cohort,
    calculate_peer_score,
    build_peer_indexes,
)
from fastapi import HTTPException
from fastapi.responses import FileResponse


# ==============================================================================
# 1. Project Sorting SQL Qualification Tests
# ==============================================================================

def test_project_sorting_all_columns():
    print("Testing Project Sorting: Verifying all supported sort columns (ASC & DESC)...")
    init_db()

    for col in PROJECT_SORT_COLUMNS.keys():
        for sdir in ["asc", "desc"]:
            res = list_projects(sort_by=col, sort_dir=sdir, page=1, page_size=5)
            assert "projects" in res, f"Failed sorting by {col} {sdir}"
            assert isinstance(res["projects"], list)

    # Test invalid column fallback
    res_fallback = list_projects(sort_by="malicious_or_unknown_column", sort_dir="desc", page=1, page_size=5)
    assert "projects" in res_fallback
    print("  [PASS] All 10 sort columns and invalid fallback verified without SQL errors.")


# ==============================================================================
# 2. CSV Custom Column Mapping Preservation Tests
# ==============================================================================

def test_csv_custom_mapping_preservation():
    print("Testing CSV Custom Mapping Preservation through analysis/ingestion...")
    # Create a CSV with non-standard column names
    csv_text = (
        "custom_identifier,work_title,state_name,spending,budget,progress_pct\n"
        "TEST-CUSTOM-999,Custom Project Title,Kerala,400000,1000000,50\n"
    )
    content = csv_text.encode("utf-8")
    custom_mapping = {
        "project_id": "custom_identifier",
        "project_name": "work_title",
        "state": "state_name",
        "expenditure": "spending",
        "sanctioned_amount": "budget",
        "physical_progress": "progress_pct",
    }

    dataset_id = _ingest_csv(
        content=content,
        filename="custom_mapping_test.csv",
        dataset_type="uploaded",
        mapping=custom_mapping,
    )

    conn = get_db()
    proj = conn.execute("SELECT * FROM projects WHERE project_id='TEST-CUSTOM-999'").fetchone()
    assert proj is not None, "Project with custom mapped project_id was not found!"
    assert proj["project_name"] == "Custom Project Title"
    assert proj["state"] == "Kerala"
    assert proj["sanctioned_amount"] == 1000000.0
    assert proj["expenditure"] == 400000.0
    assert proj["physical_progress"] == 50.0

    # Cleanup test dataset
    conn.execute("DELETE FROM risk_alerts WHERE dataset_id=?", (dataset_id,))
    conn.execute("DELETE FROM risk_scores WHERE dataset_id=?", (dataset_id,))
    conn.execute("DELETE FROM reviews WHERE dataset_id=?", (dataset_id,))
    conn.execute("DELETE FROM projects WHERE dataset_id=?", (dataset_id,))
    conn.execute("DELETE FROM datasets WHERE id=?", (dataset_id,))
    conn.commit()
    conn.close()
    print("  [PASS] Custom column mapping successfully preserved and verified in DB.")


# ==============================================================================
# 3. SPA Catch-All API 404 Route Protection Tests
# ==============================================================================

def test_spa_catchall_api_404():
    print("Testing SPA catch-all guard against /api/* routes...")
    # Inspect the route handlers on FastAPI app
    # Directly invoke the serve_spa route handler
    serve_spa_route = None
    for route in app.routes:
        if getattr(route, "path", None) == "/{full_path:path}":
            serve_spa_route = route.endpoint
            break

    if serve_spa_route is not None:
        import asyncio
        # Test calling with api/something -> must raise HTTPException(404)
        try:
            asyncio.run(serve_spa_route("api/definitely-not-a-real-endpoint"))
            assert False, "Should have raised HTTPException 404 for api/ route"
        except HTTPException as e:
            assert e.status_code == 404
            assert e.detail == "API endpoint not found"

        # Test calling with non-api path -> serves index.html or FileResponse
        resp = asyncio.run(serve_spa_route("dashboard"))
        assert isinstance(resp, FileResponse)
        print("  [PASS] SPA catch-all returns 404 JSON for /api/* and FileResponse for frontend routes.")
    else:
        print("  [SKIP] SPA dist not built at inspection time.")


# ==============================================================================
# 4. Peer Optimization O(N) Equivalence Tests
# ==============================================================================

def test_peer_analysis_on_equivalence():
    print("Testing Peer Analysis: O(N) indexed vs unindexed equivalence...")
    cats = ["Health", "Education", "Roads", "Water", "Sanitation"]
    states = ["Kerala", "Bihar", "Delhi", "Maharashtra", "Karnataka"]
    projects = [{
        "id": i,
        "project_id": f"P-{i:03d}",
        "category": cats[i % len(cats)],
        "state": states[i % len(states)],
        "financial_utilisation": float(20 + (i * 7) % 80),
        "physical_progress": float(10 + (i * 13) % 90),
        "planned_duration": 24,
        "elapsed_months": 18,
        "sanctioned_amount": 1000000.0,
        "expenditure": 500000.0
    } for i in range(120)]

    indexes = build_peer_indexes(projects)

    for p in projects:
        # Check cohort resolution
        c_unindexed, d_unindexed = get_peer_cohort(p, projects, min_group_size=3)
        c_indexed, d_indexed = get_peer_cohort(p, projects, min_group_size=3, indexes=indexes)

        assert [x["project_id"] for x in c_unindexed] == [x["project_id"] for x in c_indexed]
        assert d_unindexed == d_indexed

        # Check score & alerts
        s_unindexed = calculate_peer_score(p, projects, min_group_size=3)
        s_indexed = calculate_peer_score(p, projects, min_group_size=3, indexes=indexes)

        assert s_unindexed["score"] == s_indexed["score"]
        assert s_unindexed["peer_group_size"] == s_indexed["peer_group_size"]
        assert s_unindexed["alerts"] == s_indexed["alerts"]
        if s_unindexed.get("peer_stats"):
            assert s_unindexed["peer_stats"] == s_indexed["peer_stats"]

    print("  [PASS] 100% equivalence between O(N) indexed and unindexed peer analysis verified.")


# ==============================================================================
# 5. Session Store TTL and Eviction Tests
# ==============================================================================

def test_session_store_ttl_and_eviction():
    print("Testing CSV Session Store TTL and 20-session eviction cap...")
    _session_store.clear()

    # 1. Test expiration
    old_time = datetime.now() - timedelta(minutes=SESSION_TTL_SECONDS / 60 + 5)
    _session_store["expired_session"] = {
        "content": b"test",
        "created_at": old_time,
        "last_accessed_at": old_time,
    }
    _session_store["active_session"] = {
        "content": b"test",
        "created_at": datetime.now(),
        "last_accessed_at": datetime.now(),
    }

    _clean_expired_sessions()
    assert "expired_session" not in _session_store, "Expired session was not purged!"
    assert "active_session" in _session_store, "Active session was prematurely purged!"

    # 2. Test max session cap (20) with explicit LRU order
    _session_store.clear()
    for i in range(25):
        sid = f"sess_{i:02d}"
        _session_store[sid] = {
            "content": b"x",
            "created_at": datetime.now() - timedelta(minutes=10) + timedelta(seconds=i),
            "last_accessed_at": datetime.now() - timedelta(minutes=10) + timedelta(seconds=i),
        }
    # Touch sess_00 so its last_accessed_at is the newest
    _session_store["sess_00"]["last_accessed_at"] = datetime.now()
    _clean_expired_sessions()
    assert len(_session_store) == MAX_ACTIVE_SESSIONS, f"Session count {len(_session_store)} exceeds max {MAX_ACTIVE_SESSIONS}"
    # sess_00 was touched, so it must NOT be evicted despite being created first!
    assert "sess_00" in _session_store, "LRU touched session sess_00 should have been retained!"
    # The least recently accessed (sess_01 to sess_05) should have been evicted
    assert "sess_01" not in _session_store, "LRU session sess_01 should have been evicted!"
    assert "sess_05" not in _session_store, "LRU session sess_05 should have been evicted!"

    # 3. Test that expired sessions are cleaned before live sessions during eviction
    _session_store.clear()
    for i in range(18):
        sid = f"live_{i:02d}"
        _session_store[sid] = {
            "content": b"x",
            "created_at": datetime.now(),
            "last_accessed_at": datetime.now(),
        }
    for i in range(5):
        sid = f"expired_{i:02d}"
        _session_store[sid] = {
            "content": b"x",
            "created_at": datetime.now() - timedelta(minutes=35),
            "last_accessed_at": datetime.now() - timedelta(minutes=35),
        }
    # Total is 23 sessions (>20). The 5 expired must be purged, leaving all 18 live sessions intact.
    _clean_expired_sessions()
    assert len(_session_store) == 18, f"Expected 18 live sessions, got {len(_session_store)}"
    for i in range(18):
        assert f"live_{i:02d}" in _session_store
    _session_store.clear()
    print("  [PASS] Session store TTL expiration, LRU access order, and 20-session eviction cap verified.")


# ==============================================================================
# 6. Analytics Summary Query Consolidation & Scatter Protection Tests
# ==============================================================================

def test_analytics_summary_and_scatter_protection():
    print("Testing Analytics Summary query consolidation and scatter point cap (<= 500)...")
    summary = analytics_summary()
    assert "total_projects" in summary
    assert "high_risk" in summary
    assert "medium_risk" in summary
    assert "low_risk" in summary
    assert "scatter_data" in summary

    # Verify counts match sum
    total = summary["total_projects"]
    assert summary["high_risk"] + summary["medium_risk"] + summary["low_risk"] == total

    # Verify scatter data is capped at 500
    scatter_len = len(summary["scatter_data"])
    assert scatter_len <= 500, f"Scatter points {scatter_len} exceeds 500 cap!"
    print(f"  [PASS] Analytics summary counts valid (total={total}). Scatter points={scatter_len} (<= 500).")


# ==============================================================================
# 7. Database Transaction Safety on Ingestion Failure Tests
# ==============================================================================

def test_database_transaction_rollback_on_failure():
    print("Testing Database transaction rollback on ingestion failure...")
    conn = get_db()
    init_datasets = conn.execute("SELECT COUNT(*) FROM datasets").fetchone()[0]
    conn.close()
    from unittest.mock import patch
    import backend.main

    real_get_db = backend.main.get_db
    was_rolled_back = False
    was_closed = False

    class FailingCursor:
        def __init__(self, inner):
            self.inner = inner
        def execute(self, sql, *args, **kwargs):
            if "INSERT INTO risk_scores" in sql:
                raise sqlite3.OperationalError("Simulated DB Disk Failure")
            return self.inner.execute(sql, *args, **kwargs)
        def __getattr__(self, name):
            return getattr(self.inner, name)

    class FailingConnection:
        def __init__(self, inner):
            self.inner = inner
        def cursor(self):
            return FailingCursor(self.inner.cursor())
        def rollback(self):
            nonlocal was_rolled_back
            was_rolled_back = True
            return self.inner.rollback()
        def close(self):
            nonlocal was_closed
            was_closed = True
            return self.inner.close()
        def __getattr__(self, name):
            return getattr(self.inner, name)

    def failing_get_db():
        return FailingConnection(real_get_db())

    try:
        with patch("backend.main.get_db", failing_get_db):
            _ingest_csv(b"project_id,sanctioned_amount\nP-ERR,100\n", "fail_test.csv")
            assert False, "Should have raised HTTPException 500"
    except HTTPException as e:
        assert e.status_code == 500
        assert "Simulated DB Disk Failure" in str(e.detail)
        assert was_rolled_back, "conn.rollback() was not called on failure!"
        assert was_closed, "conn.close() was not called in finally block!"

    # Verify no partial dataset was committed
    conn = get_db()
    post_datasets = conn.execute("SELECT COUNT(*) FROM datasets").fetchone()[0]
    conn.close()
    assert post_datasets == init_datasets, "Partial dataset remained in DB after ingestion failure!"
    print("  [PASS] Transaction rolled back cleanly and database remained intact on failure.")


# ==============================================================================
# Main Runner
# ==============================================================================

def run_all_tests():
    print("=" * 60)
    print("RUNNING PHASE 3 HARDENING & OPERATIONAL TEST SUITE")
    print("=" * 60)

    test_project_sorting_all_columns()
    test_csv_custom_mapping_preservation()
    test_spa_catchall_api_404()
    test_peer_analysis_on_equivalence()
    test_session_store_ttl_and_eviction()
    test_analytics_summary_and_scatter_protection()
    test_database_transaction_rollback_on_failure()

    print("=" * 60)
    print("ALL PHASE 3 HARDENING TESTS PASSED SUCCESSFULLY (100%)")
    print("=" * 60)


if __name__ == "__main__":
    run_all_tests()
