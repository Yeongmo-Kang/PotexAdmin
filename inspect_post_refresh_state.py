#!/usr/bin/env python3
"""Read-only post-refresh inspection for Potex Phase 1 workbooks.

This script intentionally does not call Apps Script runtime functions. It uses the
Google Sheets API to inspect already-published workbook state, so it remains useful
when `clasp run` is blocked by local Apps Script OAuth scopes.
"""

from __future__ import annotations

import json
from collections import Counter
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Any, Dict, List

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

BASE_DIR = Path(__file__).resolve().parent
PROPS_PATH = BASE_DIR / "generated" / "phase1_script_properties.json"
TOKEN_PATH = Path.home() / ".hermes" / "google_token.json"
OUTPUT_PATH = BASE_DIR / "generated" / "post_refresh_state.json"
JST = timezone(timedelta(hours=9))

HEALTH_METRICS = [
    "line_registrations_count",
    "line_registration_unmatched_count",
    "acquisition_with_channel_count",
    "acquisition_without_channel_count",
    "acquisition_top_channels",
    "continuation_unmatched_count",
]


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


def health_summary(service, spreadsheet_id: str, tab_name: str) -> Dict[str, Any]:
    try:
        rows = read_values(service, spreadsheet_id, f"'{tab_name}'!A:Z")
    except HttpError as exc:
        return {"present": False, "error": str(exc)}
    dicts = table_to_dicts(rows)
    by_metric = {row.get("metric", ""): row for row in dicts}
    metrics = {
        metric: {
            "present": metric in by_metric,
            "value": by_metric.get(metric, {}).get("value", ""),
            "note": by_metric.get(metric, {}).get("note", ""),
        }
        for metric in HEALTH_METRICS
    }
    return {
        "present": True,
        "row_count": max(0, len(rows) - 1),
        "header": rows[0] if rows else [],
        "metrics": metrics,
    }


def review_queue_summary(service, spreadsheet_id: str, tab_name: str) -> Dict[str, Any]:
    try:
        rows = read_values(service, spreadsheet_id, f"'{tab_name}'!A:AZ")
    except HttpError as exc:
        return {"present": False, "error": str(exc)}
    if not rows:
        return {"present": True, "row_count": 0, "header": [], "priority_counts": {}}
    header = rows[0]
    dicts = table_to_dicts(rows)
    priority_counts = Counter(row.get("priority", "") for row in dicts)
    sync_counts = Counter(row.get("sync_status", "") for row in dicts)
    decision_counts = Counter(row.get("operator_decision_status", "") for row in dicts)
    blank_header_count = sum(1 for cell in header if not cell)
    required_review_columns = [
        "operator_decision_status",
        "operator_selected_customer_id",
        "operator_selected_customer_name",
        "operator_note",
        "sync_status",
        "last_collected_at",
    ]
    missing_required = [col for col in required_review_columns if col not in header]
    return {
        "present": True,
        "row_count": max(0, len(rows) - 1),
        "header": header,
        "blank_header_count": blank_header_count,
        "missing_required_review_columns": missing_required,
        "priority_counts": dict(priority_counts),
        "sync_status_counts": dict(sync_counts),
        "operator_decision_status_counts": dict(decision_counts),
        "stale_risk": bool(blank_header_count or missing_required),
    }


def approval_diagnosis_summary(service, spreadsheet_id: str, tab_name: str) -> Dict[str, Any]:
    try:
        rows = read_values(service, spreadsheet_id, f"'{tab_name}'!A:Z")
    except HttpError as exc:
        return {"present": False, "error": str(exc)}
    dicts = table_to_dicts(rows)
    return {
        "present": True,
        "row_count": max(0, len(rows) - 1),
        "header": rows[0] if rows else [],
        "queue_status_counts": dict(Counter(row.get("queue_status", "") for row in dicts)),
        "next_action_owner_counts": dict(Counter(row.get("next_action_owner", "") for row in dicts)),
        "scope_status": {
            row.get("scope", ""): {
                "queue_status": row.get("queue_status", ""),
                "recommended_next_action": row.get("recommended_next_action", ""),
                "writeback_freshness": row.get("writeback_freshness", ""),
            }
            for row in dicts if row.get("scope")
        },
    }


def main() -> None:
    props = json.loads(PROPS_PATH.read_text(encoding="utf-8"))
    service = load_service()
    workbook_ids = {
        "db": props["DB_SPREADSHEET_ID"],
        "cs": props["CS_SPREADSHEET_ID"],
        "exec": props["EXEC_SPREADSHEET_ID"],
        "concierge": props["CONCIERGE_SPREADSHEET_ID"],
    }

    tabs = {name: list_tabs(service, sid) for name, sid in workbook_ids.items()}
    customer_acquisition_source_absent = {
        name: "Customer_Acquisition_Source" not in tab_list
        for name, tab_list in tabs.items()
    }

    report: Dict[str, Any] = {
        "checked_at": datetime.now(JST).isoformat(timespec="seconds"),
        "mode": "read_only_google_sheets_api_inspection",
        "workbook_ids": workbook_ids,
        "tabs": {name: {"count": len(tab_list), "names": tab_list} for name, tab_list in tabs.items()},
        "customer_acquisition_source_absent": customer_acquisition_source_absent,
        "health": {
            "exec": health_summary(service, workbook_ids["exec"], "経営_データ状況"),
            "concierge": health_summary(service, workbook_ids["concierge"], "コンシェルジュ_データ状況"),
        },
        "cs_review_queues": {
            "CS_Payment_Alias_Review": review_queue_summary(service, workbook_ids["cs"], "CS_入金名寄せ確認"),
            "CS_Continuation_Alias_Review": review_queue_summary(service, workbook_ids["cs"], "CS_継続名寄せ確認"),
        },
        "cs_approval_diagnosis": approval_diagnosis_summary(service, workbook_ids["cs"], "CS_承認診断"),
    }

    health = report["health"]
    acquisition_metrics_present = all(
        health[book].get("metrics", {}).get("acquisition_with_channel_count", {}).get("present")
        and health[book].get("metrics", {}).get("acquisition_top_channels", {}).get("present")
        for book in ["exec", "concierge"]
    )
    review_queues_safe = not report["cs_review_queues"]["CS_Payment_Alias_Review"].get("stale_risk", True)
    report["verdict"] = {
        "customer_acquisition_source_absent_everywhere": all(customer_acquisition_source_absent.values()),
        "acquisition_metrics_present_in_exec_and_concierge": acquisition_metrics_present,
        "cs_payment_alias_review_safe_for_operator_approval": review_queues_safe,
        "cs_continuation_alias_review_present": report["cs_review_queues"]["CS_Continuation_Alias_Review"].get("present", False),
        "cs_approval_diagnosis_present": report["cs_approval_diagnosis"].get("present", False),
    }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report["verdict"], ensure_ascii=False, indent=2))
    print(f"wrote {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
