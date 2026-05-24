#!/usr/bin/env python3
"""Verify that Sales / Coach workbook provisioning placed the expected tabs + headers.

Read-only; uses Google Sheets API only. Run AFTER `provision_phase1_workbooks.py`.
Does not call Apps Script runtime.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Dict, List

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

BASE_DIR = Path(__file__).resolve().parent.parent
IDS_PATH = BASE_DIR / "generated" / "phase1_workbook_ids.json"
MANIFEST_PATH = BASE_DIR / "workbook_manifest.json"
OUT_PATH = BASE_DIR / "generated" / "sales_coach_provisioning_state.json"
TOKEN_PATH = Path.home() / ".hermes" / "google_token.json"


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


def list_tabs(service, spreadsheet_id: str) -> List[str]:
    meta = service.spreadsheets().get(spreadsheetId=spreadsheet_id).execute()
    return [sheet["properties"]["title"] for sheet in meta.get("sheets", [])]


def read_header(service, spreadsheet_id: str, tab_name: str) -> List[str]:
    rows = service.spreadsheets().values().get(
        spreadsheetId=spreadsheet_id,
        range=f"'{tab_name}'!1:1",
    ).execute().get("values", [])
    return rows[0] if rows else []


def read_all_rows(service, spreadsheet_id: str, tab_name: str) -> List[List[str]]:
    rows = service.spreadsheets().values().get(
        spreadsheetId=spreadsheet_id,
        range=f"'{tab_name}'!A:Z",
    ).execute().get("values", [])
    return rows


def inspect_workbook(service, key: str, ids: Dict, manifest: Dict) -> Dict:
    spec = manifest["phase1"][key]
    spreadsheet_id = ids[key]["spreadsheet_id"]
    expected_tabs = list(spec["tabs"].keys())
    actual_tabs = list_tabs(service, spreadsheet_id)

    tab_state = {}
    for tab in expected_tabs:
        expected_header = spec["tabs"][tab]
        if tab not in actual_tabs:
            tab_state[tab] = {"present": False}
            continue
        all_rows = read_all_rows(service, spreadsheet_id, tab)
        actual_header = all_rows[0] if all_rows else []
        data_row_count = max(0, len(all_rows) - 1)
        tab_state[tab] = {
            "present": True,
            "expected_header_len": len(expected_header),
            "actual_header_len": len(actual_header),
            "header_match": actual_header == expected_header,
            "data_row_count": data_row_count,
            "actual_header": actual_header,
        }

    return {
        "spreadsheet_id": spreadsheet_id,
        "name": ids[key]["name"],
        "url": ids[key]["url"],
        "expected_tabs": expected_tabs,
        "actual_tabs": actual_tabs,
        "extra_tabs": [t for t in actual_tabs if t not in expected_tabs],
        "missing_tabs": [t for t in expected_tabs if t not in actual_tabs],
        "tabs": tab_state,
    }


def main():
    service = load_service()
    ids = json.loads(IDS_PATH.read_text(encoding="utf-8"))
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))

    result = {
        "sales": inspect_workbook(service, "sales", ids, manifest),
        "coaches": inspect_workbook(service, "coaches", ids, manifest),
    }

    verdict_ok = all(
        not r["missing_tabs"] and all(t.get("header_match") for t in r["tabs"].values())
        for r in result.values()
    )
    result["verdict"] = "provisioned_and_headers_match" if verdict_ok else "needs_review"

    OUT_PATH.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    summary = {}
    for k, v in result.items():
        if k == "verdict":
            continue
        summary[k] = {
            "missing_tabs": v.get("missing_tabs", []),
            "extra_tabs": v.get("extra_tabs", []),
            "header_mismatch_tabs": [t for t, st in v.get("tabs", {}).items() if not st.get("header_match")],
            "row_counts": {t: st.get("data_row_count", 0) for t, st in v.get("tabs", {}).items() if st.get("present")},
        }
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    print(f"verdict: {result['verdict']}")


if __name__ == "__main__":
    main()
