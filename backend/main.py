"""
MPLADS Sentinel — FastAPI Main Application
"""
import json
import os
import io
import csv
from pathlib import Path
from typing import Optional, List, Dict, Any
from datetime import datetime

from fastapi import FastAPI, UploadFile, File, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

# --- Bootstrap backend package imports ---
import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from backend.database.db import init_db, get_db
from backend.database.seed import seed_operational_db
from backend.services.risk_service import analyze_dataset

# --- App Setup ---
app = FastAPI(title="MPLADS Sentinel API", version="1.0.0")

# CORS setup
cors_origins_env = os.getenv("CORS_ORIGINS", "*")
origins = [o.strip() for o in cors_origins_env.split(",") if o.strip()] if cors_origins_env != "*" else ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Temp storage for parsed CSV data during workflow
_session_store: Dict[str, Any] = {}


@app.on_event("startup")
async def startup():
    init_db()
    # Seed operational demonstration data if database is empty (CSV-independent)
    seed_operational_db()


def _get_settings() -> Dict[str, str]:
    conn = get_db()
    rows = conn.execute("SELECT key, value FROM settings").fetchall()
    conn.close()
    return {r["key"]: r["value"] for r in rows}


def _log_audit(action: str, details: str, actor: str = "System",
               dataset_id: Optional[int] = None, project_id: Optional[int] = None):
    conn = get_db()
    conn.execute(
        "INSERT INTO audit_logs (dataset_id, project_id, action, details, actor) VALUES (?,?,?,?,?)",
        (dataset_id, project_id, action, details, actor)
    )
    conn.commit()
    conn.close()


def _ensure_demo_dataset():
    """Operational database seed delegation."""
    seed_operational_db()


def _ingest_csv(content: bytes, filename: str, dataset_type: str = "uploaded") -> int:
    """Parse, validate, normalize, analyze and store a CSV. Returns dataset_id."""
    from backend.services.csv_service import parse_csv, auto_map_columns, validate_dataframe, normalize_dataframe
    df, meta = parse_csv(content)
    mapping = auto_map_columns(meta["columns"])
    validation = validate_dataframe(df, mapping)
    projects = normalize_dataframe(df, mapping)
    settings = _get_settings()
    risk_results = analyze_dataset(projects, settings)

    conn = get_db()
    cur = conn.cursor()

    # Insert dataset
    cur.execute(
        """INSERT INTO datasets (name, filename, file_size, row_count, column_count, dataset_type,
           data_quality_score, analyzed_at, status) VALUES (?,?,?,?,?,?,?,?,?)""",
        (
            filename.replace(".csv", "").replace("_", " ").title(),
            filename,
            len(content),
            meta["row_count"],
            meta["column_count"],
            dataset_type,
            validation["data_quality_score"],
            datetime.now().isoformat(),
            "analyzed",
        ),
    )
    dataset_id = cur.lastrowid

    # Insert projects + risk
    risk_map = {r["project_id"]: r for r in risk_results}

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

        # Insert alerts
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

        # Create unreviewed review record
        cur.execute(
            "INSERT INTO reviews (project_id, dataset_id, status) VALUES (?,?,?)",
            (proj_row_id, dataset_id, "UNREVIEWED"),
        )

    conn.commit()
    conn.close()

    _log_audit("Dataset Ingested", f"Dataset '{filename}' processed. {len(projects)} projects, {len(risk_results)} risk scores.", dataset_id=dataset_id)
    return dataset_id


# ─── Health ───────────────────────────────────────────────────────────────────

@app.get("/api/health")
def health():
    return {"status": "ok", "version": "1.0.0", "timestamp": datetime.now().isoformat()}


# ─── Datasets ─────────────────────────────────────────────────────────────────

@app.get("/api/datasets")
def list_datasets():
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM datasets ORDER BY uploaded_at DESC"
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@app.get("/api/datasets/{dataset_id}")
def get_dataset(dataset_id: int):
    conn = get_db()
    row = conn.execute("SELECT * FROM datasets WHERE id=?", (dataset_id,)).fetchone()
    conn.close()
    if not row:
        raise HTTPException(404, "Dataset not found")
    return dict(row)


@app.delete("/api/datasets/{dataset_id}")
def delete_dataset(dataset_id: int):
    conn = get_db()
    conn.execute("DELETE FROM risk_alerts WHERE dataset_id=?", (dataset_id,))
    conn.execute("DELETE FROM risk_scores WHERE dataset_id=?", (dataset_id,))
    conn.execute("DELETE FROM reviews WHERE dataset_id=?", (dataset_id,))
    conn.execute("DELETE FROM projects WHERE dataset_id=?", (dataset_id,))
    conn.execute("DELETE FROM datasets WHERE id=?", (dataset_id,))
    conn.commit()
    conn.close()
    _log_audit("Dataset Deleted", f"Dataset ID {dataset_id} deleted.")
    return {"message": "Dataset deleted"}


# ─── CSV Upload Workflow ───────────────────────────────────────────────────────

@app.post("/api/csv/upload")
async def upload_csv(file: UploadFile = File(...)):
    from backend.services.csv_service import parse_csv, auto_map_columns
    if not file.filename.endswith(".csv"):
        raise HTTPException(400, "Only .csv files are supported.")
    MAX_SIZE = 50 * 1024 * 1024  # 50MB
    content = await file.read()
    if len(content) > MAX_SIZE:
        raise HTTPException(400, "File exceeds 50MB limit.")

    df, meta = parse_csv(content)
    mapping = auto_map_columns(meta["columns"])
    session_id = f"upload_{datetime.now().strftime('%Y%m%d%H%M%S%f')}"
    _session_store[session_id] = {"content": content, "df": df, "meta": meta, "mapping": mapping, "filename": file.filename}
    _log_audit("CSV Uploaded", f"File '{file.filename}' uploaded. {meta['row_count']} rows, {meta['column_count']} columns.")
    return {
        "session_id": session_id,
        "filename": file.filename,
        "file_size": len(content),
        "row_count": meta["row_count"],
        "column_count": meta["column_count"],
        "columns": meta["columns"],
        "auto_mapping": mapping,
    }


@app.get("/api/csv/{session_id}/preview")
def csv_preview(session_id: str, rows: int = 10):
    from backend.services.csv_service import get_preview
    s = _session_store.get(session_id)
    if not s:
        raise HTTPException(404, "Session not found or expired.")
    preview = get_preview(s["df"], rows)
    return {"columns": s["meta"]["columns"], "rows": preview}


@app.post("/api/csv/{session_id}/validate")
def csv_validate(session_id: str, mapping: Dict[str, Optional[str]]):
    from backend.services.csv_service import validate_dataframe
    s = _session_store.get(session_id)
    if not s:
        raise HTTPException(404, "Session not found.")
    s["mapping"] = mapping
    validation = validate_dataframe(s["df"], mapping)
    _log_audit("Validation Completed", f"Session {session_id}: quality {validation['data_quality_score']}%")
    return validation


@app.post("/api/csv/{session_id}/analyze")
def csv_analyze(session_id: str):
    s = _session_store.get(session_id)
    if not s:
        raise HTTPException(404, "Session not found.")
    dataset_id = _ingest_csv(s["content"], s["filename"])
    del _session_store[session_id]
    return {"dataset_id": dataset_id, "message": "Analysis complete. Dataset stored."}


@app.post("/api/csv/load-demo")
def load_demo():
    # Clear demo and reload
    conn = get_db()
    demo_rows = conn.execute("SELECT id FROM datasets WHERE dataset_type='demo'").fetchall()
    for row in demo_rows:
        did = row["id"]
        conn.execute("DELETE FROM risk_alerts WHERE dataset_id=?", (did,))
        conn.execute("DELETE FROM risk_scores WHERE dataset_id=?", (did,))
        conn.execute("DELETE FROM reviews WHERE dataset_id=?", (did,))
        conn.execute("DELETE FROM projects WHERE dataset_id=?", (did,))
        conn.execute("DELETE FROM datasets WHERE id=?", (did,))
    conn.commit()
    conn.close()

    demo_path = Path(__file__).parent.parent / "data" / "demo_dataset.csv"
    if not demo_path.exists():
        raise HTTPException(404, "Demo dataset not found.")
    with open(demo_path, "rb") as f:
        content = f.read()
    dataset_id = _ingest_csv(content, "demo_dataset.csv", dataset_type="demo")
    return {"dataset_id": dataset_id, "message": "Demo dataset loaded."}


# ─── Projects ─────────────────────────────────────────────────────────────────

def _build_project_query(
    dataset_id: Optional[int],
    risk_level: Optional[str],
    state: Optional[str],
    district: Optional[str],
    category: Optional[str],
    status: Optional[str],
    search: Optional[str],
    review_status: Optional[str],
):
    where = []
    params = []

    if dataset_id:
        where.append("p.dataset_id=?")
        params.append(dataset_id)
    if risk_level:
        where.append("rs.risk_level=?")
        params.append(risk_level.upper())
    if state:
        where.append("p.state=?")
        params.append(state)
    if district:
        where.append("p.district=?")
        params.append(district)
    if category:
        where.append("p.category=?")
        params.append(category)
    if status:
        where.append("p.status=?")
        params.append(status)
    if review_status:
        where.append("r.status=?")
        params.append(review_status)
    if search:
        q = f"%{search}%"
        where.append("(p.project_id LIKE ? OR p.project_name LIKE ? OR p.state LIKE ? OR p.district LIKE ?)")
        params.extend([q, q, q, q])

    clause = " WHERE " + " AND ".join(where) if where else ""
    return clause, params


@app.get("/api/projects")
def list_projects(
    dataset_id: Optional[int] = None,
    risk_level: Optional[str] = None,
    state: Optional[str] = None,
    district: Optional[str] = None,
    category: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    review_status: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
    sort_by: str = "final_score",
    sort_dir: str = "desc",
):
    clause, params = _build_project_query(dataset_id, risk_level, state, district, category, status, search, review_status)
    safe_sort = sort_by if sort_by in ("final_score", "project_id", "project_name", "state", "financial_utilisation", "physical_progress") else "final_score"
    safe_dir = "DESC" if sort_dir.lower() == "desc" else "ASC"

    conn = get_db()
    total = conn.execute(
        f"SELECT COUNT(*) FROM projects p LEFT JOIN risk_scores rs ON p.id=rs.project_id LEFT JOIN reviews r ON p.id=r.project_id{clause}",
        params
    ).fetchone()[0]

    rows = conn.execute(
        f"""SELECT p.*, rs.schedule_score, rs.financial_score, rs.peer_score, rs.divergence_score,
            rs.final_score, rs.risk_level, rs.primary_signal, r.status as review_status, r.id as review_id
            FROM projects p
            LEFT JOIN risk_scores rs ON p.id=rs.project_id
            LEFT JOIN reviews r ON p.id=r.project_id
            {clause}
            ORDER BY rs.{safe_sort} {safe_dir}
            LIMIT ? OFFSET ?""",
        params + [page_size, (page - 1) * page_size]
    ).fetchall()
    conn.close()

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": (total + page_size - 1) // page_size,
        "projects": [dict(r) for r in rows],
    }


@app.get("/api/projects/{project_id}")
def get_project(project_id: int):
    conn = get_db()
    row = conn.execute(
        """SELECT p.*, rs.schedule_score, rs.financial_score, rs.peer_score, rs.divergence_score,
           rs.final_score, rs.risk_level, rs.primary_signal, rs.schedule_weight, rs.financial_weight,
           rs.peer_weight, rs.divergence_weight, rs.risk_engine_version, rs.analyzed_at as risk_analyzed_at,
           r.status as review_status, r.id as review_id, r.priority, r.assigned_to
           FROM projects p
           LEFT JOIN risk_scores rs ON p.id=rs.project_id
           LEFT JOIN reviews r ON p.id=r.project_id
           WHERE p.id=?""",
        (project_id,),
    ).fetchone()

    if not row:
        raise HTTPException(404, "Project not found")

    alerts = conn.execute(
        "SELECT * FROM risk_alerts WHERE project_id=? ORDER BY severity",
        (project_id,),
    ).fetchall()

    audit = conn.execute(
        "SELECT * FROM audit_logs WHERE project_id=? ORDER BY created_at DESC LIMIT 20",
        (project_id,),
    ).fetchall()

    conn.close()

    result = dict(row)
    result["alerts"] = [
        {**dict(a), "evidence": json.loads(a["evidence"] or "{}")} for a in alerts
    ]
    result["audit_history"] = [dict(a) for a in audit]
    return result


@app.get("/api/projects/{project_id}/peers")
def get_project_peers(project_id: int):
    conn = get_db()
    proj = conn.execute("SELECT * FROM projects WHERE id=?", (project_id,)).fetchone()
    if not proj:
        raise HTTPException(404, "Project not found")

    proj = dict(proj)
    peers = conn.execute(
        """SELECT p.*, rs.final_score, rs.risk_level
           FROM projects p
           LEFT JOIN risk_scores rs ON p.id=rs.project_id
           WHERE p.category=? AND p.id!=? AND p.dataset_id=?
           LIMIT 20""",
        (proj["category"], project_id, proj["dataset_id"]),
    ).fetchall()
    conn.close()
    return {"project": proj, "peers": [dict(p) for p in peers]}


# ─── Risk Queue ───────────────────────────────────────────────────────────────

@app.get("/api/risk-queue")
def risk_queue(
    dataset_id: Optional[int] = None,
    risk_level: Optional[str] = None,
    review_status: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
):
    where = ["rs.final_score IS NOT NULL"]
    params: List[Any] = []
    if dataset_id:
        where.append("p.dataset_id=?")
        params.append(dataset_id)
    if risk_level:
        where.append("rs.risk_level=?")
        params.append(risk_level.upper())
    if review_status:
        where.append("r.status=?")
        params.append(review_status)

    clause = " WHERE " + " AND ".join(where)
    conn = get_db()
    total = conn.execute(
        f"SELECT COUNT(*) FROM projects p LEFT JOIN risk_scores rs ON p.id=rs.project_id LEFT JOIN reviews r ON p.id=r.project_id{clause}",
        params
    ).fetchone()[0]
    rows = conn.execute(
        f"""SELECT p.id, p.project_id, p.project_name, p.state, p.district, p.category,
            p.sanctioned_amount, p.financial_utilisation, p.physical_progress,
            p.elapsed_months, p.planned_duration, p.status,
            rs.schedule_score, rs.financial_score, rs.peer_score, rs.divergence_score, rs.final_score, rs.risk_level,
            rs.primary_signal, r.status as review_status, r.id as review_id
            FROM projects p
            LEFT JOIN risk_scores rs ON p.id=rs.project_id
            LEFT JOIN reviews r ON p.id=r.project_id
            {clause}
            ORDER BY rs.final_score DESC, rs.risk_level DESC
            LIMIT ? OFFSET ?""",
        params + [page_size, (page - 1) * page_size],
    ).fetchall()
    conn.close()
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": (total + page_size - 1) // page_size,
        "queue": [dict(r) for r in rows],
    }


# ─── Analytics ────────────────────────────────────────────────────────────────

@app.get("/api/analytics/summary")
def analytics_summary(dataset_id: Optional[int] = None):
    conn = get_db()
    clause = "WHERE p.dataset_id=?" if dataset_id else ""
    params = [dataset_id] if dataset_id else []

    total = conn.execute(f"SELECT COUNT(*) FROM projects p {clause}", params).fetchone()[0]
    high = conn.execute(f"SELECT COUNT(*) FROM projects p LEFT JOIN risk_scores rs ON p.id=rs.project_id {clause + (' AND' if clause else 'WHERE')} rs.risk_level='HIGH'", params).fetchone()[0]
    medium = conn.execute(f"SELECT COUNT(*) FROM projects p LEFT JOIN risk_scores rs ON p.id=rs.project_id {clause + (' AND' if clause else 'WHERE')} rs.risk_level='MEDIUM'", params).fetchone()[0]
    low = conn.execute(f"SELECT COUNT(*) FROM projects p LEFT JOIN risk_scores rs ON p.id=rs.project_id {clause + (' AND' if clause else 'WHERE')} rs.risk_level='LOW'", params).fetchone()[0]

    fin_stats = conn.execute(
        f"""SELECT AVG(p.financial_utilisation) as avg_fin, AVG(p.physical_progress) as avg_prog,
            SUM(p.sanctioned_amount) as total_sanctioned, SUM(p.expenditure) as total_exp
            FROM projects p {clause}""", params
    ).fetchone()

    signals = conn.execute(
        f"""SELECT ra.signal_type, COUNT(*) as cnt
            FROM risk_alerts ra JOIN projects p ON ra.project_id=p.id
            {clause.replace('p.dataset_id', 'p.dataset_id')}
            GROUP BY ra.signal_type""",
        params
    ).fetchall()

    review_stats = conn.execute(
        f"""SELECT r.status, COUNT(*) as cnt
            FROM reviews r JOIN projects p ON r.project_id=p.id
            {clause.replace('p.dataset_id', 'p.dataset_id')}
            GROUP BY r.status""",
        params
    ).fetchall()

    score_dist = conn.execute(
        f"""SELECT 
            SUM(CASE WHEN rs.final_score < 10 THEN 1 ELSE 0 END) as s0,
            SUM(CASE WHEN rs.final_score >= 10 AND rs.final_score < 20 THEN 1 ELSE 0 END) as s10,
            SUM(CASE WHEN rs.final_score >= 20 AND rs.final_score < 30 THEN 1 ELSE 0 END) as s20,
            SUM(CASE WHEN rs.final_score >= 30 AND rs.final_score < 40 THEN 1 ELSE 0 END) as s30,
            SUM(CASE WHEN rs.final_score >= 40 AND rs.final_score < 50 THEN 1 ELSE 0 END) as s40,
            SUM(CASE WHEN rs.final_score >= 50 AND rs.final_score < 60 THEN 1 ELSE 0 END) as s50,
            SUM(CASE WHEN rs.final_score >= 60 AND rs.final_score < 70 THEN 1 ELSE 0 END) as s60,
            SUM(CASE WHEN rs.final_score >= 70 AND rs.final_score < 80 THEN 1 ELSE 0 END) as s70,
            SUM(CASE WHEN rs.final_score >= 80 AND rs.final_score < 90 THEN 1 ELSE 0 END) as s80,
            SUM(CASE WHEN rs.final_score >= 90 THEN 1 ELSE 0 END) as s90
            FROM projects p LEFT JOIN risk_scores rs ON p.id=rs.project_id {clause}""",
        params
    ).fetchone()

    scatter = conn.execute(
        f"""SELECT p.id, p.project_id, p.project_name, p.financial_utilisation, p.physical_progress,
            rs.final_score, rs.risk_level
            FROM projects p LEFT JOIN risk_scores rs ON p.id=rs.project_id {clause}""",
        params
    ).fetchall()

    state_risk = conn.execute(
        f"""SELECT p.state, rs.risk_level, COUNT(*) as cnt
            FROM projects p LEFT JOIN risk_scores rs ON p.id=rs.project_id
            {clause} GROUP BY p.state, rs.risk_level""",
        params
    ).fetchall()

    requires_review = conn.execute(
        f"""SELECT COUNT(*) FROM reviews r JOIN projects p ON r.project_id=p.id
            LEFT JOIN risk_scores rs ON p.id=rs.project_id
            {clause.replace('p.dataset_id', 'p.dataset_id')}
            {"AND" if clause else "WHERE"} r.status='UNREVIEWED' AND rs.risk_level IN ('HIGH','MEDIUM')""",
        params
    ).fetchone()[0] if dataset_id else 0

    conn.close()

    return {
        "total_projects": total,
        "high_risk": high,
        "medium_risk": medium,
        "low_risk": low,
        "requires_review": requires_review,
        "avg_financial_utilisation": round(fin_stats["avg_fin"] or 0, 1),
        "avg_physical_progress": round(fin_stats["avg_prog"] or 0, 1),
        "total_sanctioned": fin_stats["total_sanctioned"] or 0,
        "total_expenditure": fin_stats["total_exp"] or 0,
        "signals": [dict(s) for s in signals],
        "review_stats": [dict(r) for r in review_stats],
        "score_distribution": [
            {"range": f"{i*10}–{i*10+10}", "count": dict(score_dist).get(f"s{i*10}", 0) or 0}
            for i in range(10)
        ],
        "scatter_data": [dict(r) for r in scatter],
        "state_risk": [dict(r) for r in state_risk],
    }


# ─── Reviews ──────────────────────────────────────────────────────────────────

class ReviewUpdate(BaseModel):
    status: str
    priority: Optional[str] = None
    assigned_to: Optional[str] = None
    comment: Optional[str] = None
    author: Optional[str] = "Reviewer"


@app.get("/api/reviews")
def list_reviews(dataset_id: Optional[int] = None, status: Optional[str] = None):
    where = []
    params = []
    if dataset_id:
        where.append("r.dataset_id=?")
        params.append(dataset_id)
    if status:
        where.append("r.status=?")
        params.append(status)
    clause = " WHERE " + " AND ".join(where) if where else ""
    conn = get_db()
    rows = conn.execute(
        f"""SELECT r.*, p.project_id, p.project_name, p.state, rs.final_score, rs.risk_level
            FROM reviews r
            JOIN projects p ON r.project_id=p.id
            LEFT JOIN risk_scores rs ON p.id=rs.project_id
            {clause} ORDER BY rs.final_score DESC""",
        params
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@app.get("/api/reviews/{review_id}")
def get_review(review_id: int):
    conn = get_db()
    review = conn.execute(
        """SELECT r.*, p.project_id, p.project_name FROM reviews r
           JOIN projects p ON r.project_id=p.id WHERE r.id=?""",
        (review_id,)
    ).fetchone()
    if not review:
        raise HTTPException(404, "Review not found")
    comments = conn.execute(
        "SELECT * FROM review_comments WHERE review_id=? ORDER BY created_at",
        (review_id,)
    ).fetchall()
    conn.close()
    result = dict(review)
    result["comments"] = [dict(c) for c in comments]
    return result


@app.patch("/api/reviews/{review_id}")
def update_review(review_id: int, update: ReviewUpdate):
    conn = get_db()
    review = conn.execute("SELECT * FROM reviews WHERE id=?", (review_id,)).fetchone()
    if not review:
        raise HTTPException(404, "Review not found")

    old_status = review["status"]
    fields = []
    params = []
    if update.status:
        fields.append("status=?")
        params.append(update.status)
    if update.priority:
        fields.append("priority=?")
        params.append(update.priority)
    if update.assigned_to:
        fields.append("assigned_to=?")
        params.append(update.assigned_to)
    fields.append("updated_at=datetime('now')")

    conn.execute(
        f"UPDATE reviews SET {', '.join(fields)} WHERE id=?",
        params + [review_id]
    )

    if update.comment:
        conn.execute(
            "INSERT INTO review_comments (review_id, author, comment) VALUES (?,?,?)",
            (review_id, update.author or "Reviewer", update.comment)
        )

    conn.execute(
        "INSERT INTO audit_logs (project_id, review_id, action, details, actor) VALUES (?,?,?,?,?)",
        (review["project_id"], review_id,
         f"Review Status Changed",
         f"Status: {old_status} → {update.status}. {('Comment: ' + update.comment) if update.comment else ''}",
         update.author or "Reviewer")
    )
    conn.commit()
    conn.close()
    return {"message": "Review updated"}


# ─── Audit Logs ───────────────────────────────────────────────────────────────

@app.get("/api/audit-logs")
def get_audit_logs(dataset_id: Optional[int] = None, project_id: Optional[int] = None, limit: int = 50):
    where = []
    params = []
    if dataset_id:
        where.append("dataset_id=?")
        params.append(dataset_id)
    if project_id:
        where.append("project_id=?")
        params.append(project_id)
    clause = " WHERE " + " AND ".join(where) if where else ""
    conn = get_db()
    rows = conn.execute(
        f"SELECT * FROM audit_logs{clause} ORDER BY created_at DESC LIMIT ?",
        params + [limit]
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


# ─── Settings ─────────────────────────────────────────────────────────────────

@app.get("/api/settings")
def get_settings():
    return _get_settings()


@app.patch("/api/settings")
def update_settings(updates: Dict[str, str]):
    conn = get_db()
    for key, value in updates.items():
        conn.execute(
            "UPDATE settings SET value=?, updated_at=datetime('now') WHERE key=?",
            (value, key)
        )
    conn.commit()
    conn.close()
    _log_audit("Settings Updated", f"Keys updated: {', '.join(updates.keys())}")
    return {"message": "Settings updated"}


# ─── Export ───────────────────────────────────────────────────────────────────

@app.get("/api/export/projects")
def export_projects(dataset_id: Optional[int] = None, risk_level: Optional[str] = None):
    clause, params = _build_project_query(dataset_id, risk_level, None, None, None, None, None, None)
    conn = get_db()
    rows = conn.execute(
        f"""SELECT p.*, rs.schedule_score, rs.financial_score, rs.peer_score, rs.divergence_score, rs.final_score, rs.risk_level, rs.primary_signal, r.status as review_status
            FROM projects p LEFT JOIN risk_scores rs ON p.id=rs.project_id LEFT JOIN reviews r ON p.id=r.project_id
            {clause} ORDER BY rs.final_score DESC""",
        params
    ).fetchall()
    conn.close()

    output = io.StringIO()
    if rows:
        writer = csv.DictWriter(output, fieldnames=dict(rows[0]).keys())
        writer.writeheader()
        writer.writerows([dict(r) for r in rows])

    output.seek(0)
    filename = f"mplads_sentinel_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


# ─── SPA Frontend Serving (if built) ──────────────────────────────────────────

_dist_path = Path(__file__).parent.parent / "frontend" / "dist"
if _dist_path.exists() and (_dist_path / "index.html").exists():
    app.mount("/assets", StaticFiles(directory=str(_dist_path / "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        file_path = _dist_path / full_path
        if file_path.exists() and file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(_dist_path / "index.html")


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run("backend.main:app", host="0.0.0.0", port=port, reload=True)
