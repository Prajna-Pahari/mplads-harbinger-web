"""
MPLADS Sentinel — Operational Database Seed
Provides structured seeding for demonstration data without relying on CSV ingestion.
"""
import json
from pathlib import Path
from datetime import datetime
from typing import Optional

from backend.database.db import get_db
from backend.services.risk_service import analyze_dataset


def seed_operational_db() -> Optional[int]:
    """
    Seeds the operational database with demonstration projects if no datasets exist.
    Returns dataset_id if seeded, None if database already contains datasets.
    """
    conn = get_db()
    count = conn.execute("SELECT COUNT(*) FROM datasets").fetchone()[0]
    if count > 0:
        conn.close()
        return None

    seed_file = Path(__file__).parent / "demo_seed.json"
    if not seed_file.exists():
        conn.close()
        return None

    with open(seed_file, "r", encoding="utf-8") as f:
        projects = json.load(f)

    # Fetch settings for risk engine
    rows = conn.execute("SELECT key, value FROM settings").fetchall()
    settings = {r["key"]: r["value"] for r in rows}

    risk_results = analyze_dataset(projects, settings)
    risk_map = {r["project_id"]: r for r in risk_results}

    cur = conn.cursor()

    # Insert dataset record
    cur.execute(
        """INSERT INTO datasets (name, filename, file_size, row_count, column_count, dataset_type,
           data_quality_score, analyzed_at, status) VALUES (?,?,?,?,?,?,?,?,?)""",
        (
            "Demo Dataset",
            "demo_seed.json",
            seed_file.stat().st_size,
            len(projects),
            18,
            "demo",
            100.0,
            datetime.now().isoformat(),
            "analyzed",
        ),
    )
    dataset_id = cur.lastrowid

    # Insert projects + risk scores + risk alerts + reviews
    for p in projects:
        pid_val = p.get("project_id") or f"AUTO-{hash(str(p))}"
        cur.execute(
            """INSERT OR REPLACE INTO projects
               (dataset_id, project_id, project_name, state, district, constituency, category,
                sanctioned_amount, released_amount, expenditure, financial_utilisation,
                physical_progress, start_date, expected_completion, actual_completion,
                planned_duration, elapsed_months, status, location)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (
                dataset_id, pid_val,
                p.get("project_name"), p.get("state"), p.get("district"),
                p.get("constituency"), p.get("category"),
                p.get("sanctioned_amount"), p.get("released_amount"), p.get("expenditure"),
                p.get("financial_utilisation"), p.get("physical_progress"),
                p.get("start_date"), p.get("expected_completion"), p.get("actual_completion"),
                p.get("planned_duration"), p.get("elapsed_months"),
                p.get("status"), p.get("location"),
            ),
        )
        proj_row_id = cur.lastrowid
        risk = risk_map.get(pid_val, {})

        cur.execute(
            """INSERT INTO risk_scores
               (project_id, dataset_id, schedule_score, financial_score, peer_score, divergence_score,
                final_score, risk_level, primary_signal, schedule_weight, financial_weight, peer_weight,
                divergence_weight, risk_engine_version)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (
                proj_row_id, dataset_id,
                risk.get("schedule_score", 0), risk.get("financial_score", 0),
                risk.get("peer_score", 0), risk.get("divergence_score", 0),
                risk.get("final_score", 0), risk.get("risk_level", "LOW"),
                risk.get("primary_signal", "None"),
                risk.get("schedule_weight", 0.30), risk.get("financial_weight", 0.30),
                risk.get("peer_weight", 0.20), risk.get("divergence_weight", 0.20),
                risk.get("risk_engine_version", "2.0"),
            ),
        )

        for alert in risk.get("alerts", []):
            cur.execute(
                """INSERT INTO risk_alerts
                   (project_id, dataset_id, rule_id, rule_name, signal_type, severity,
                    evidence, explanation, score_contribution)
                   VALUES (?,?,?,?,?,?,?,?,?)""",
                (
                    proj_row_id, dataset_id,
                    alert["rule_id"], alert["rule_name"], alert["signal_type"],
                    alert["severity"], json.dumps(alert.get("evidence", {})),
                    alert.get("explanation", ""), alert.get("score_contribution", 0),
                ),
            )

        cur.execute(
            "INSERT INTO reviews (project_id, dataset_id, status) VALUES (?,?,?)",
            (proj_row_id, dataset_id, "UNREVIEWED"),
        )

    # Insert audit log
    cur.execute(
        "INSERT INTO audit_logs (dataset_id, action, details, actor) VALUES (?,?,?,?)",
        (dataset_id, "Dataset Seeded", f"Operational demo dataset seeded with {len(projects)} projects.", "System"),
    )

    conn.commit()
    conn.close()
    return dataset_id
