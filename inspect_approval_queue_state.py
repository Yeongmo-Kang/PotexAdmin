#!/usr/bin/env python3
"""Read-only approval queue inspection for Potex CS workbook.

Uses the Google Sheets API so operators/devs can diagnose approval queue state even
when Apps Script runtime invocation is inconvenient.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Any, Dict, List

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

BASE_DIR = Path(__file__).resolve().parent
PROPS_PATH = BASE_DIR / "generated" / "phase1_script_properties.json"
TOKEN_PATH = Path.home() / ".hermes" / "google_token.json"
OUTPUT_PATH = BASE_DIR / "generated" / "approval_queue_state.json"
JST = timezone(timedelta(hours=9))

CS_APPROVAL_DIAGNOSIS = "CS_承認診断"
CS_APPROVAL_PROGRESS = "CS_承認進捗"
CS_PAYMENT_ALIAS_REVIEW = "CS_入金名寄せ確認"
CS_CONTINUATION_ALIAS_REVIEW = "CS_継続名寄せ確認"


def load_service():
    token = json.loads(TOKEN_PATH.read_text(encoding="utf-8"))
    creds = Credentials(
        token=token.get("token"),
        refresh_token=token.get("refresh_token"),
        token_uri=token.get("token_uri"),
        client_id=token.get("client_id"),
        client_secret=token.get("client_secret"),
        scopes=token.get("scopes"),
    )
    return build("sheets", "v4", credentials=creds, cache_discovery=False)


def read_values(service, spreadsheet_id: str, a1_range: str) -> List[List[str]]:
    return service.spreadsheets().values().get(
        spreadsheetId=spreadsheet_id,
        range=a1_range,
    ).execute().get("values", [])


def list_tabs(service, spreadsheet_id: str) -> List[str]:
    meta = service.spreadsheets().get(spreadsheetId=spreadsheet_id).execute()
    return [sheet["properties"]["title"] for sheet in meta.get("sheets", [])]


def table_to_dicts(rows: List[List[str]]) -> List[Dict[str, str]]:
    if not rows:
        return []
    header = rows[0]
    out = []
    for row in rows[1:]:
        out.append({header[i]: (row[i] if i < len(row) else "") for i in range(len(header)) if header[i]})
    return out


def read_table(service, spreadsheet_id: str, tab_name: str, a1: str = "A:Z") -> Dict[str, Any]:
    try:
        rows = read_values(service, spreadsheet_id, f"'{tab_name}'!{a1}")
    except HttpError as exc:
        return {"present": False, "error": str(exc), "header": [], "rows": []}
    return {
        "present": True,
        "header": rows[0] if rows else [],
        "rows": table_to_dicts(rows),
        "row_count": max(0, len(rows) - 1),
    }


def progress_metrics_by_scope(progress_rows: List[Dict[str, str]]) -> Dict[str, Dict[str, str]]:
    by_scope: Dict[str, Dict[str, str]] = {}
    for row in progress_rows:
        scope = row.get("scope", "")
        metric = row.get("metric", "")
        if not scope or not metric:
            continue
        by_scope.setdefault(scope, {})[metric] = row.get("value", "")
    return by_scope


def to_int(value: Any) -> int:
    try:
        return int(float(str(value or "0").strip()))
    except ValueError:
        return 0


def classify_scope(scope: str, diag_row: Dict[str, str], progress_metrics: Dict[str, str]) -> Dict[str, Any]:
    queue_status = diag_row.get("queue_status", "")
    next_action_owner = diag_row.get("next_action_owner", "")
    primary_bottleneck = diag_row.get("primary_bottleneck", "")
    recommended_next_action = diag_row.get("recommended_next_action", "")
    writeback_freshness = diag_row.get("writeback_freshness", "")

    open_total = to_int(diag_row.get("open_total") or progress_metrics.get("open_total"))
    open_p1 = to_int(diag_row.get("open_p1") or progress_metrics.get("open_p1"))
    p1_undecided = to_int(diag_row.get("p1_undecided") or progress_metrics.get("p1_undecided"))
    decided_waiting_sync = to_int(diag_row.get("decided_waiting_sync") or progress_metrics.get("decided_waiting_sync"))
    invalid_open = to_int(diag_row.get("invalid_open") or progress_metrics.get("invalid_open"))
    source_wait_open = to_int(diag_row.get("source_wait_open") or progress_metrics.get("source_wait_open"))

    overall_state = "clear"
    if invalid_open > 0:
        overall_state = "operator_input_fix_required"
    elif p1_undecided > 0:
        overall_state = "operator_decision_required"
    elif decided_waiting_sync > 0 and writeback_freshness == "writeback stale":
        overall_state = "automation_check_required"
    elif decided_waiting_sync > 0:
        overall_state = "waiting_for_sync"
    elif source_wait_open > 0:
        overall_state = "source_or_candidate_wait"
    elif open_total > 0:
        overall_state = "review_queue_open"

    return {
        "scope": scope,
        "queue_status": queue_status,
        "overall_state": overall_state,
        "next_action_owner": next_action_owner,
        "primary_bottleneck": primary_bottleneck,
        "recommended_next_action": recommended_next_action,
        "counts": {
            "open_total": open_total,
            "open_p1": open_p1,
            "p1_undecided": p1_undecided,
            "decided_waiting_sync": decided_waiting_sync,
            "invalid_open": invalid_open,
            "source_wait_open": source_wait_open,
        },
        "oldest_open_age": diag_row.get("oldest_open_age", ""),
        "oldest_sync_wait_age": diag_row.get("oldest_sync_wait_age", ""),
        "last_writeback_success_at_jst": diag_row.get("last_writeback_success_at_jst") or progress_metrics.get("last_writeback_success_at_jst", ""),
        "writeback_freshness": writeback_freshness,
    }


def main() -> None:
    props = json.loads(PROPS_PATH.read_text(encoding="utf-8"))
    service = load_service()
    cs_spreadsheet_id = props["CS_SPREADSHEET_ID"]

    tabs = list_tabs(service, cs_spreadsheet_id)
    diagnosis = read_table(service, cs_spreadsheet_id, CS_APPROVAL_DIAGNOSIS, "A:Z")
    progress = read_table(service, cs_spreadsheet_id, CS_APPROVAL_PROGRESS, "A:D")
    payment_review = read_table(service, cs_spreadsheet_id, CS_PAYMENT_ALIAS_REVIEW, "A:AZ")
    continuation_review = read_table(service, cs_spreadsheet_id, CS_CONTINUATION_ALIAS_REVIEW, "A:AZ")

    progress_by_scope = progress_metrics_by_scope(progress["rows"])
    diagnosis_rows = {row.get("scope", ""): row for row in diagnosis["rows"] if row.get("scope")}

    scopes = ["payment_alias_review", "continuation_alias_review"]
    scope_reports = [
        classify_scope(scope, diagnosis_rows.get(scope, {}), progress_by_scope.get(scope, {}))
        for scope in scopes
    ]

    operator_decision_required = [r["scope"] for r in scope_reports if r["overall_state"] == "operator_decision_required"]
    operator_input_fix_required = [r["scope"] for r in scope_reports if r["overall_state"] == "operator_input_fix_required"]
    automation_check_required = [r["scope"] for r in scope_reports if r["overall_state"] == "automation_check_required"]
    waiting_for_sync = [r["scope"] for r in scope_reports if r["overall_state"] == "waiting_for_sync"]
    source_or_candidate_wait = [r["scope"] for r in scope_reports if r["overall_state"] == "source_or_candidate_wait"]

    if operator_input_fix_required:
        overall_state = "operator_input_fix_required"
    elif operator_decision_required:
        overall_state = "operator_decision_required"
    elif automation_check_required:
        overall_state = "automation_check_required"
    elif waiting_for_sync:
        overall_state = "waiting_for_sync"
    elif source_or_candidate_wait:
        overall_state = "source_or_candidate_wait"
    else:
        overall_state = "clear"

    report: Dict[str, Any] = {
        "checked_at": datetime.now(JST).isoformat(timespec="seconds"),
        "mode": "read_only_google_sheets_api_inspection",
        "cs_spreadsheet_id": cs_spreadsheet_id,
        "tabs_present": {tab: tab in tabs for tab in [CS_APPROVAL_DIAGNOSIS, CS_APPROVAL_PROGRESS, CS_PAYMENT_ALIAS_REVIEW, CS_CONTINUATION_ALIAS_REVIEW]},
        "row_counts": {
            CS_APPROVAL_DIAGNOSIS: diagnosis.get("row_count", 0),
            CS_APPROVAL_PROGRESS: progress.get("row_count", 0),
            CS_PAYMENT_ALIAS_REVIEW: payment_review.get("row_count", 0),
            CS_CONTINUATION_ALIAS_REVIEW: continuation_review.get("row_count", 0),
        },
        "scope_reports": scope_reports,
        "verdict": {
            "overall_state": overall_state,
            "operator_input_fix_required_scopes": operator_input_fix_required,
            "operator_decision_required_scopes": operator_decision_required,
            "automation_check_required_scopes": automation_check_required,
            "waiting_for_sync_scopes": waiting_for_sync,
            "source_or_candidate_wait_scopes": source_or_candidate_wait,
            "diagnosis_tab_present": diagnosis.get("present", False),
            "progress_tab_present": progress.get("present", False),
        },
    }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report["verdict"], ensure_ascii=False, indent=2))
    print(f"wrote {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
