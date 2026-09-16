"""
MPLADS Sentinel — CSV Service
Handles CSV parsing, preview, column mapping, validation, and normalization.
"""
import io
import re
import pandas as pd
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime


EXPECTED_FIELDS = {
    "project_id": ["project_id", "id", "proj_id", "projectid", "project id"],
    "project_name": ["project_name", "name", "proj_name", "project name", "work name"],
    "state": ["state", "state_name"],
    "district": ["district", "district_name", "dist"],
    "constituency": ["constituency", "constituency_name", "mp_constituency"],
    "category": ["category", "work_category", "type", "work type"],
    "sanctioned_amount": ["sanctioned_amount", "sanctioned", "sanctioned amount", "approved_amount", "total_amount"],
    "released_amount": ["released_amount", "released", "released amount"],
    "expenditure": ["expenditure", "exp", "amount_spent", "spent"],
    "financial_utilisation": ["financial_utilisation", "financial_utilization", "fin_util", "utilisation", "utilization", "fund_util"],
    "physical_progress": ["physical_progress", "progress", "phys_progress", "physical progress", "completion_pct"],
    "start_date": ["start_date", "start date", "commencement_date", "commenced"],
    "expected_completion": ["expected_completion", "expected_completion_date", "completion_date", "due_date"],
    "actual_completion": ["actual_completion", "actual_completion_date", "completed_date"],
    "planned_duration": ["planned_duration", "duration", "planned_months", "duration_months"],
    "elapsed_months": ["elapsed_months", "elapsed", "months_elapsed"],
    "status": ["status", "work_status", "project_status"],
    "location": ["location", "address", "village", "ward"],
    "schedule_score": ["schedule_score", "schedule score"],
    "financial_score": ["financial_score", "financial score", "financial_progress_score"],
    "peer_score": ["peer_score", "peer score", "peer_outlier_score"],
}


def auto_map_columns(columns: List[str]) -> Dict[str, Optional[str]]:
    """Auto-detect column mappings from CSV headers."""
    mapping = {field: None for field in EXPECTED_FIELDS}
    cols_lower = {c.lower().strip().replace("-", "_").replace(" ", "_"): c for c in columns}

    for field, aliases in EXPECTED_FIELDS.items():
        for alias in aliases:
            alias_normalized = alias.lower().replace(" ", "_").replace("-", "_")
            if alias_normalized in cols_lower:
                mapping[field] = cols_lower[alias_normalized]
                break

    return mapping


def parse_csv(content: bytes) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    """Parse CSV bytes and return DataFrame + metadata."""
    try:
        df = pd.read_csv(io.BytesIO(content), encoding="utf-8", dtype=str)
    except Exception:
        df = pd.read_csv(io.BytesIO(content), encoding="latin-1", dtype=str)

    df.columns = [str(c).strip() for c in df.columns]
    return df, {
        "row_count": len(df),
        "column_count": len(df.columns),
        "columns": list(df.columns),
    }


def get_preview(df: pd.DataFrame, rows: int = 10) -> List[Dict]:
    return df.head(rows).fillna("").to_dict(orient="records")


def validate_dataframe(df: pd.DataFrame, mapping: Dict[str, Optional[str]]) -> Dict[str, Any]:
    """Validate the dataset and return quality report."""
    issues = []
    warnings = []
    valid_rows = len(df)
    total_rows = len(df)

    # Check project IDs
    pid_col = mapping.get("project_id")
    if pid_col and pid_col in df.columns:
        missing_ids = df[pid_col].isna() | (df[pid_col].str.strip() == "")
        if missing_ids.any():
            issues.append({"type": "INVALID", "field": "project_id", "message": f"{missing_ids.sum()} rows have missing project IDs.", "count": int(missing_ids.sum())})

        dupes = df[pid_col].duplicated()
        if dupes.any():
            issues.append({"type": "WARNING", "field": "project_id", "message": f"{dupes.sum()} duplicate project IDs found.", "count": int(dupes.sum())})
    else:
        warnings.append({"type": "WARNING", "field": "project_id", "message": "Project ID column not mapped.", "count": 0})

    # Validate financial fields
    for field in ["sanctioned_amount", "released_amount", "expenditure"]:
        col = mapping.get(field)
        if col and col in df.columns:
            numeric = pd.to_numeric(df[col], errors="coerce")
            neg = (numeric < 0).sum()
            if neg:
                issues.append({"type": "WARNING", "field": field, "message": f"{neg} negative values in {field}.", "count": int(neg)})

    # Validate percentages
    for field in ["financial_utilisation", "physical_progress"]:
        col = mapping.get(field)
        if col and col in df.columns:
            numeric = pd.to_numeric(df[col], errors="coerce")
            over_100 = (numeric > 100).sum()
            negative = (numeric < 0).sum()
            if over_100:
                warnings.append({"type": "WARNING", "field": field, "message": f"{over_100} values exceed 100% in {field}.", "count": int(over_100)})
            if negative:
                issues.append({"type": "INVALID", "field": field, "message": f"{negative} negative percentage values in {field}.", "count": int(negative)})

    # Validate dates
    for field in ["start_date", "expected_completion", "actual_completion"]:
        col = mapping.get(field)
        if col and col in df.columns:
            invalid_dates = 0
            for val in df[col].dropna():
                try:
                    pd.to_datetime(str(val))
                except Exception:
                    invalid_dates += 1
            if invalid_dates:
                warnings.append({"type": "WARNING", "field": field, "message": f"{invalid_dates} unparseable date values in {field}.", "count": invalid_dates})

    # Compute quality score
    error_count = sum(i["count"] for i in issues if i["type"] == "INVALID")
    warning_count = sum(i["count"] for i in warnings)
    
    mapped_count = sum(1 for v in mapping.values() if v is not None)
    completeness = (mapped_count / len(EXPECTED_FIELDS)) * 100

    quality_score = max(0, 100 - (error_count / max(total_rows, 1)) * 50 - (warning_count / max(total_rows, 1)) * 20)
    quality_score = round(min(100, quality_score), 1)

    return {
        "total_rows": total_rows,
        "valid_rows": total_rows - error_count,
        "issues": issues,
        "warnings": warnings,
        "data_quality_score": quality_score,
        "completeness_pct": round(completeness, 1),
        "mapped_fields": mapped_count,
        "total_fields": len(EXPECTED_FIELDS),
    }


def normalize_dataframe(df: pd.DataFrame, mapping: Dict[str, Optional[str]]) -> List[Dict[str, Any]]:
    """
    Normalize and extract project records from the DataFrame using the column mapping.
    Returns a list of normalized project dicts.
    """
    records = []
    for _, row in df.iterrows():
        project: Dict[str, Any] = {}

        for field, col in mapping.items():
            if col and col in df.columns:
                raw_val = row.get(col, None)
                if pd.isna(raw_val) or str(raw_val).strip() == "":
                    project[field] = None
                    continue

                val = str(raw_val).strip()

                # Numeric fields
                if field in ("sanctioned_amount", "released_amount", "expenditure", "planned_duration", "elapsed_months", "schedule_score", "financial_score", "peer_score"):
                    try:
                        val_clean = re.sub(r"[₹,$, ]", "", val)
                        project[field] = float(val_clean)
                    except Exception:
                        project[field] = None

                elif field in ("financial_utilisation", "physical_progress"):
                    try:
                        val_clean = val.replace("%", "").strip()
                        project[field] = float(val_clean)
                    except Exception:
                        project[field] = None

                elif field in ("start_date", "expected_completion", "actual_completion"):
                    try:
                        parsed = pd.to_datetime(val)
                        project[field] = parsed.strftime("%Y-%m-%d")
                    except Exception:
                        project[field] = None

                elif field == "status":
                    status_map = {
                        "ongoing": "Ongoing", "in progress": "Ongoing", "inprogress": "Ongoing",
                        "completed": "Completed", "complete": "Completed", "done": "Completed",
                        "stalled": "Stalled", "abandoned": "Abandoned",
                    }
                    project[field] = status_map.get(val.lower(), val.title())

                elif field in ("state", "district", "constituency", "category"):
                    project[field] = val.title()

                else:
                    project[field] = val
            else:
                project[field] = None

        # Auto-compute financial_utilisation if not present
        if project.get("financial_utilisation") is None:
            sanctioned = project.get("sanctioned_amount")
            expenditure = project.get("expenditure")
            if sanctioned and expenditure and sanctioned > 0:
                project["financial_utilisation"] = round((expenditure / sanctioned) * 100, 1)

        records.append(project)

    return records
