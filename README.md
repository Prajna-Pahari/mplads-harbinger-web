# MPLADS HARBINGER

**Explainable Risk Intelligence for MPLADS Monitoring**

Built for Smart India Hackathon 2026 — Problem Statement SIH26102  
Team: **XYLOQ**

> *"Harbinger does not declare wrongdoing. It identifies the warning signs that deserve attention."*

---

## 1. What is MPLADS HARBINGER?

**MPLADS HARBINGER** is a government-facing operational monitoring and risk intelligence platform designed to identify unusual patterns, schedule slippages, and implementation inconsistencies across MPLAD Scheme projects.

Rather than making accusations, HARBINGER provides transparent, explainable decision support:
- **Detects** anomalous patterns using deterministic rules and statistical benchmarks.
- **Prioritises** projects into an operational risk queue based on multi-signal indicators.
- **Explains** every alert with transparent mathematical and contextual evidence (**WHY FLAGGED?**).
- **Enables** administrative officers to record human findings, assign reviews, and maintain an audit trail of administrative actions and review updates.

---

## 2. Product Philosophy & Operational Flow

HARBINGER operates on a structured operational methodology:

$$\text{Detect} \longrightarrow \text{Prioritise} \longrightarrow \text{Explain} \longrightarrow \text{Investigate} \longrightarrow \text{Act}$$

### Operational Pipeline:
1. **Data Ingestion & Seeding:** Reads structured MPLADS project records.
2. **Validation & Normalisation:** Standardises project timelines, sanctioned amounts, disbursements, and reported milestones.
3. **Multi-Signal Analysis:** Evaluates 4 independent, explainable risk components.
4. **Weighted Risk Scoring:** Generates a deterministic 0–100 composite score.
5. **Why Flagged? Evidence:** Generates human-readable explanations with quantitative evidence.
6. **Investigation Console:** Surfaces project-level breakdowns, peer cohorts, and historical timelines.
7. **Human Review & Audit:** Tracks officer determinations and maintains accountability logs.

> **Note on Architecture:** Exploratory sandbox dataset testing and analytical experimentation are isolated in the separate **MPLADS HARBINGER DATA LAB** workspace. The core HARBINGER application provides production monitoring, triage, review workflows, and an operational CSV ingestion & analysis workflow (`/csv-analyzer`).

---

## 3. Four Core Risk Signals

HARBINGER evaluates projects across four independent risk signals:

| Signal Component | Focus Area | Key Indicators | Default Weight |
| :--- | :--- | :--- | :--- |
| **1. Schedule Deviation** | Implementation Timelines | Unstarted sanctioned works, milestones exceeding planned duration | **30%** |
| **2. Financial Utilisation** | Budget & Expenditure | Low fund absorption after prolonged elapsed time, expenditures exceeding sanctioned budget | **30%** |
| **3. Peer Outlier** | Statistical Progress Anomalies | Cohort Z-score comparison of financial utilisation and physical progress relative to similar sector works | **20%** |
| **4. Financial–Physical Divergence** | Progress Alignment | Financial utilisation substantially outpacing reported physical progress | **20%** |

### Composite Risk Scoring & Classification
The final composite risk score is a deterministic weighted linear combination:

$$\text{Final Score} = (\text{Schedule} \times 0.30) + (\text{Financial} \times 0.30) + (\text{Peer} \times 0.20) + (\text{Divergence} \times 0.20)$$

- **LOW Risk:** Score $< 40$ (Routine monitoring)
- **MEDIUM Risk:** Score $40\text{--}69$ (Elevated risk, review recommended)
- **HIGH Risk:** Score $\ge 70$ (High priority, human verification recommended)

### Financial–Physical Divergence Specification (`DIV-001`)
- **Formula:**
  $$\text{Financial Utilisation} = \left(\frac{\text{Expenditure}}{\text{Sanctioned Amount}}\right) \times 100$$
  $$\text{Divergence (pp)} = \text{Financial Utilisation} - \text{Physical Progress}$$
- **Thresholds:**
  - $\Delta < 20\text{ pp}$: No divergence signal
  - $20\text{ pp} \le \Delta < 35\text{ pp}$: **MEDIUM** severity alert (Score contribution: 28 points)
  - $\Delta \ge 35\text{ pp}$: **HIGH** severity alert (Score contribution: 40 points)
- **Data Guards:** Calculation runs only when `sanctioned_amount > 0`, `expenditure >= 0`, `physical_progress >= 0`, and values are numerically valid. Missing values never trigger false signals.

---

## 4. Application Routes

| Route | View | Description |
| :--- | :--- | :--- |
| `/` | Landing Page | Strategic overview of HARBINGER risk intelligence and monitoring principles |
| `/dashboard` | Executive Dashboard | Operational KPI metrics, risk level distributions, and state-level geographic summaries |
| `/projects` | Master Projects Table | Searchable, filterable project registry with multi-column sorting and CSV import/export |
| `/risk-queue` | Priority Risk Queue | Triage queue sorting elevated risk works requiring administrative attention |
| `/project/:id` | Project Investigation | Deep-dive console featuring the **WHY FLAGGED?** breakdown, peer comparison, and timeline |
| `/analytics` | Risk Analytics | Financial absorption charts, physical vs financial scatter plots, and score distributions |
| `/reviews` | Review Workflow | Official review queue with priority tagging, reviewer assignment, and comments |
| `/audit` | Audit Log | Immutable system log tracking status changes, administrative actions, and review updates |
| `/settings` | Settings & Thresholds | Configurable threshold adjustments and risk engine weight rebalancing |
| `/csv-analyzer` | CSV Analyzer | Multi-step CSV ingestion, column mapping, validation, and multi-signal risk analysis |
| `/reports` | Data Export & Briefings | Operational data export console (CSV dataset export; executive reporting in development) |

---

## 5. Technology Stack

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, Recharts, Lucide React
- **Backend:** Python 3.11, FastAPI, Uvicorn, SQLite
- **Architecture:** React/Vite frontend + FastAPI backend, deployable as a single unified service

---

## 6. Project Structure

```
MPLADS-main/
├── backend/
│   ├── main.py                 # FastAPI application, route handlers, and SPA static hosting
│   ├── database/
│   │   ├── db.py               # SQLite schema setup, migrations, and settings initialization
│   │   ├── seed.py             # Structured demo data seeder
│   │   └── demo_seed.json      # Structured demonstration project records
│   ├── rules/
│   │   ├── schedule.py         # Schedule Deviation rules (SCH-001, SCH-002, SCH-003)
│   │   ├── financial.py        # Financial Utilisation rules (FIN-002, FIN-003)
│   │   ├── peer.py             # Statistical Peer Outlier rules (PEER-001, PEER-002)
│   │   └── divergence.py       # Financial–Physical Divergence rule (DIV-001)
│   └── services/
│       ├── risk_service.py     # 4-signal risk engine orchestration and scoring
│       └── csv_service.py      # CSV parsing, preview, column mapping, and validation service
├── frontend/
│   ├── src/
│   │   ├── pages/              # 11 operational page views (including CSVAnalyzerPage)
│   │   ├── components/         # Reusable navigation, risk badges, charts, and modals
│   │   ├── lib/                # API client and formatting utilities
│   │   └── types/              # TypeScript data interfaces and alert schemas
│   ├── package.json            # Node.js dependencies
│   └── vite.config.ts          # Vite bundler configuration
├── data/
│   └── demo_dataset.csv        # Reference project data
├── test_task_5_divergence.py   # Comprehensive Task 5 unit and integration test suite
├── test_api.py                 # API endpoints regression test
├── test_risk.py                # Risk queue and signals regression test
├── test_score.py               # Project scoring regression test
├── render.yaml                 # Unified Render deployment configuration
└── README.md                   # Operational product documentation
```

---

## 7. Getting Started Locally

### Prerequisites
- **Python 3.11+**
- **Node.js 18+** & npm

### 1. Start the Backend
From the repository root:
```bash
# Optional: create and activate virtualenv
python -m venv venv
# Windows: venv\Scripts\activate | Linux/macOS: source venv/bin/activate

pip install -r requirements.txt
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```
The backend initializes `sentinel.db`, verifies database schema migrations, automatically seeds demonstration records, and serves the API at `http://localhost:8000`.

### 2. Start the Frontend
In a separate terminal:
```bash
cd frontend
npm install
npm run dev
```
The development frontend will launch at `http://localhost:5173`.

---

## 8. Single-Service Production Deployment

HARBINGER is designed to deploy as a single unified service (e.g., Render, Railway, or AWS container):
1. The build step compiles the frontend assets:
   ```bash
   cd frontend && npm install && npm run build
   ```
2. The FastAPI backend serves static assets from `frontend/dist` and routes all frontend paths to `index.html`.
3. The deployment specification is configured in `render.yaml`.

---

## 9. Demonstration Walkthrough (Hackathon Flow)

1. **Open HARBINGER:** Navigate to `/dashboard` to review the operational posture, active alerts, and geographic project distribution.
2. **Prioritised Triage:** Open `/risk-queue` to inspect works ranked by composite risk score.
3. **Inspect a Flagged Project:** Click an elevated-risk project (e.g., `MPLADS-DEMO-H1`) to open the investigation console.
4. **Review "WHY FLAGGED?":** Observe the exact quantitative breakdown across all four signals:
   - Schedule deviation ratio
   - Financial utilisation percentage
   - Statistical deviation of financial utilisation and physical progress vs peer cohort
   - Financial–Physical Divergence (`DIV-001`: financial progress substantially outpacing physical progress)
5. **Contextual Deep-Dive:** Review the milestone timeline, expenditure milestones, and peer distribution charts.
6. **Human-in-the-Loop Action:** Navigate to the **Review** tab to assign an investigating officer, update status, and log review findings.
7. **Verify Accountability:** Open `/audit` to confirm the action was permanently recorded in the system audit log.

---

## 10. Quality Assurance & Regression Verification

The project includes an automated test suite verifying both operational stability and risk scoring fidelity:
- **`test_task_5_divergence.py`:** Verifies all 7 divergence conditions (zero divergence, moderate divergence, severe divergence, missing physical progress, zero sanctioned amount, 4-signal weighted math, and absence of duplicate scoring).
- **`test_api.py`, `test_risk.py`, `test_score.py`:** Verifies endpoint stability, queue ordering, and score precision.
- **Frontend Type Safety:** Verified via `npx tsc --noEmit` and production build `npm run build`.

---

## 11. Important Disclaimers

- **Prototype for Demonstration:** MPLADS HARBINGER is an operational prototype developed for Smart India Hackathon 2026.
- **Synthetic Demonstration Data:** The demonstration environment operates on structured synthetic/seeded project records. It is designed to work with structured MPLADS / eSAKSHI-compatible project records and government data sources; it does **not** connect to a live eSAKSHI government API.
- **Decision Support Only:** Automated risk signals identify patterns that warrant review; they do **not** declare guilt, fraud, or administrative wrongdoing.
- **Mandatory Human Verification:** Every signal requires verification by authorized officers before any administrative action is taken.
- **Analytical Metrics:** Peer Outlier and Financial–Physical Divergence are analytical indicators developed for HARBINGER to assist prioritization and should not be cited as official MPLADS statutory violation definitions.

---

*MPLADS HARBINGER · Team XYLOQ · Smart India Hackathon 2026*
