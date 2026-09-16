"""
MPLADS Sentinel — SQLite Database Setup
"""
import sqlite3
import os
from pathlib import Path

DB_PATH = Path(__file__).parent.parent / "database" / "sentinel.db"

def get_db():
    DB_PATH.parent.mkdir(exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn

def init_db():
    conn = get_db()
    cur = conn.cursor()
    cur.executescript("""
        CREATE TABLE IF NOT EXISTS datasets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            filename TEXT NOT NULL,
            file_size INTEGER,
            row_count INTEGER,
            column_count INTEGER,
            dataset_type TEXT DEFAULT 'uploaded',
            data_quality_score REAL,
            uploaded_at TEXT DEFAULT (datetime('now')),
            analyzed_at TEXT,
            status TEXT DEFAULT 'uploaded'
        );

        CREATE TABLE IF NOT EXISTS projects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            dataset_id INTEGER REFERENCES datasets(id),
            project_id TEXT NOT NULL,
            project_name TEXT,
            state TEXT,
            district TEXT,
            constituency TEXT,
            category TEXT,
            sanctioned_amount REAL,
            released_amount REAL,
            expenditure REAL,
            financial_utilisation REAL,
            physical_progress REAL,
            start_date TEXT,
            expected_completion TEXT,
            actual_completion TEXT,
            planned_duration INTEGER,
            elapsed_months INTEGER,
            status TEXT,
            location TEXT,
            UNIQUE(dataset_id, project_id)
        );

        CREATE TABLE IF NOT EXISTS risk_scores (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER REFERENCES projects(id),
            dataset_id INTEGER REFERENCES datasets(id),
            schedule_score REAL DEFAULT 0,
            financial_score REAL DEFAULT 0,
            peer_score REAL DEFAULT 0,
            divergence_score REAL DEFAULT 0,
            final_score REAL DEFAULT 0,
            risk_level TEXT DEFAULT 'LOW',
            primary_signal TEXT DEFAULT 'None',
            schedule_weight REAL DEFAULT 0.30,
            financial_weight REAL DEFAULT 0.30,
            peer_weight REAL DEFAULT 0.20,
            divergence_weight REAL DEFAULT 0.20,
            risk_engine_version TEXT DEFAULT '2.0',
            analyzed_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS risk_alerts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER REFERENCES projects(id),
            dataset_id INTEGER REFERENCES datasets(id),
            rule_id TEXT NOT NULL,
            rule_name TEXT NOT NULL,
            signal_type TEXT NOT NULL,
            severity TEXT NOT NULL,
            evidence TEXT,
            explanation TEXT,
            score_contribution REAL,
            created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS reviews (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER REFERENCES projects(id),
            dataset_id INTEGER REFERENCES datasets(id),
            status TEXT DEFAULT 'UNREVIEWED',
            priority TEXT DEFAULT 'NORMAL',
            assigned_to TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS review_comments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            review_id INTEGER REFERENCES reviews(id),
            author TEXT NOT NULL,
            comment TEXT NOT NULL,
            created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS audit_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            dataset_id INTEGER,
            project_id INTEGER,
            review_id INTEGER,
            action TEXT NOT NULL,
            details TEXT,
            actor TEXT DEFAULT 'System',
            created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            description TEXT,
            updated_at TEXT DEFAULT (datetime('now'))
        );

        INSERT OR IGNORE INTO settings VALUES ('risk_low_threshold', '40', 'Score below this = LOW risk', datetime('now'));
        INSERT OR IGNORE INTO settings VALUES ('risk_medium_threshold', '70', 'Score below this = MEDIUM risk', datetime('now'));
        INSERT OR IGNORE INTO settings VALUES ('schedule_weight', '0.30', 'Weight for schedule score', datetime('now'));
        INSERT OR IGNORE INTO settings VALUES ('financial_weight', '0.30', 'Weight for financial score', datetime('now'));
        INSERT OR IGNORE INTO settings VALUES ('peer_weight', '0.20', 'Weight for peer score', datetime('now'));
        INSERT OR IGNORE INTO settings VALUES ('divergence_weight', '0.20', 'Weight for divergence score', datetime('now'));
        INSERT OR IGNORE INTO settings VALUES ('peer_min_group_size', '3', 'Minimum group size for peer comparison', datetime('now'));
    """)

    # Safe migration: ensure divergence_score and divergence_weight exist in existing databases
    cur.execute("PRAGMA table_info(risk_scores)")
    risk_cols = [r["name"] for r in cur.fetchall()]
    if "divergence_score" not in risk_cols:
        cur.execute("ALTER TABLE risk_scores ADD COLUMN divergence_score REAL DEFAULT 0")
    if "divergence_weight" not in risk_cols:
        cur.execute("ALTER TABLE risk_scores ADD COLUMN divergence_weight REAL DEFAULT 0.20")

    # Update legacy default weights in settings table
    cur.execute("UPDATE settings SET value='0.30', updated_at=datetime('now') WHERE key='schedule_weight' AND value='0.35'")
    cur.execute("UPDATE settings SET value='0.30', updated_at=datetime('now') WHERE key='financial_weight' AND value='0.40'")
    cur.execute("UPDATE settings SET value='0.20', updated_at=datetime('now') WHERE key='peer_weight' AND value='0.25'")
    cur.execute("INSERT OR IGNORE INTO settings VALUES ('divergence_weight', '0.20', 'Weight for divergence score', datetime('now'))")

    conn.commit()
    conn.close()
