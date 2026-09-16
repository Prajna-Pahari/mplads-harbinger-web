# MPLADS Sentinel

**Explainable Risk Intelligence for MPLADS Monitoring**

Built for Smart India Hackathon 2026 — Problem Statement SIH26102  
Team: **XYLOQ**

---

## What is MPLADS Sentinel?

MPLADS Sentinel is an AI-powered system to detect anomalies, inefficiencies, and unusual patterns in MPLAD Scheme implementation. It combines:

- Rule-based checks (Schedule, Financial-Progress, Peer Comparison)
- Statistical anomaly detection (Z-score outlier analysis)
- Transparent risk scoring (0–100, configurable weights)
- Explainable AI (WHY FLAGGED? with evidence for every alert)
- Human-in-the-loop review workflow

> AI prioritises. Officials decide.  
> The system **never** claims confirmed fraud from automated signals.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite + TypeScript + Tailwind CSS + Recharts + Lucide |
| Backend | Python + FastAPI + Uvicorn |
| Data | Pandas + NumPy + Scikit-learn |
| Database | SQLite |

---

## Getting Started

### Prerequisites

- Python 3.10+ (✓ installed)
- Node.js 18+ (required for frontend — install from nodejs.org)

### 1. Start the Backend

```bash
# From the project root
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```

Or double-click **`start_backend.bat`**

The backend will:
- Initialize SQLite database (`database/sentinel.db`)
- Load the synthetic demo dataset automatically
- Run risk analysis on all projects
- Serve the API at `http://localhost:8000`

### 2. Install Frontend Dependencies (first time only)

```bash
cd frontend
npm install
```

### 3. Start the Frontend

```bash
cd frontend
npm run dev
```

Or double-click **`start_frontend.bat`**

The frontend will be available at **`http://localhost:5173`**

---

## Project Structure

```
MPLADS SENTINAL/
├── backend/
│   ├── main.py                 ← FastAPI app + all API routes
│   ├── database/db.py          ← SQLite schema + initialization
│   ├── services/
│   │   ├── csv_service.py      ← CSV parsing, mapping, validation, normalization
│   │   └── risk_service.py     ← Risk score orchestration
│   └── rules/
│       ├── schedule.py         ← SCH-001, SCH-002, SCH-003
│       ├── financial.py        ← FIN-001, FIN-002, FIN-003
│       └── peer.py             ← PEER-001, PEER-002 (Z-score)
├── frontend/
│   └── src/
│       ├── pages/              ← 10+ page components
│       ├── components/         ← Shared UI components
│       ├── lib/                ← API client + utilities
│       └── types/              ← TypeScript definitions
├── data/
│   └── demo_dataset.csv        ← Synthetic demonstration data (35 projects)
├── start_backend.bat           ← One-click backend startup
└── start_frontend.bat          ← One-click frontend startup
```

---

## Pages

| URL | Description |
|---|---|
| `/` | Landing page with product overview |
| `/dashboard` | Main operational dashboard with KPIs and charts |
| `/projects` | Filterable project list |
| `/risk-queue` | Priority-sorted risk queue |
| `/project/:id` | Full project investigation (6 tabs) |
| `/csv` | 8-step CSV analyzer workflow |
| `/analytics` | Risk, financial, and geographic analytics |
| `/reviews` | Human review workflow |
| `/audit` | System audit log |
| `/settings` | Configurable thresholds and weights |

---

## Risk Engine

Three checks with configurable weights (default):

| Check | Weight | Rules |
|---|---|---|
| Schedule Deviation | 35% | SCH-001, SCH-002, SCH-003 |
| Financial-Progress | 40% | FIN-001, FIN-002, FIN-003 |
| Peer Outlier | 25% | PEER-001, PEER-002 |

Final score: `0.35 × Schedule + 0.40 × Financial + 0.25 × Peer`

Classification: LOW (<40), MEDIUM (40–69), HIGH (≥70) — configurable in Settings.

---

## Demo Flow (Hackathon Judges)

1. Open `http://localhost:5173`
2. Click **Open Dashboard** — see KPIs, charts, project table
3. Click **CSV Analyzer** → Upload a CSV or **Load Demo Dataset**
4. See the 8-step workflow: Preview → Map → Validate → Analyse
5. Navigate to **Risk Queue** — sorted by risk score
6. Click any project — see **WHY FLAGGED?**, Evidence, Peer Comparison
7. Go to **Review** tab — change status, add comment
8. Check **Audit Log** for complete trail

---

## Important Disclaimers

- This is a **prototype** built for demonstration purposes.
- The demo dataset uses **synthetic data** — not real MPLADS records.
- The system **never** automatically confirms fraud.
- Risk alerts use language like "Unusual pattern detected" and "Requires human review."
- All automated signals require human verification before any action.

---

*MPLADS Sentinel · Team XYLOQ · SIH 2026*
