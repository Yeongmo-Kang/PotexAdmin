#!/usr/bin/env python3
import json
from pathlib import Path
from typing import Dict, List

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

BASE_DIR = Path(__file__).resolve().parent
MANIFEST_PATH = BASE_DIR / 'workbook_manifest.json'
OUTPUT_DIR = BASE_DIR / 'generated'
OUTPUT_DIR.mkdir(exist_ok=True)
IDS_PATH = OUTPUT_DIR / 'phase1_workbook_ids.json'
TOKEN = Path.home() / '.hermes' / 'google_token.json'
SCOPES = [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive',
]


def auth():
    creds = Credentials.from_authorized_user_file(str(TOKEN), SCOPES)
    if creds.expired and creds.refresh_token:
        creds.refresh(Request())
    sheets = build('sheets', 'v4', credentials=creds)
    drive = build('drive', 'v3', credentials=creds)
    return sheets, drive


def load_manifest() -> dict:
    return json.loads(MANIFEST_PATH.read_text())


def load_existing_ids() -> dict:
    if not IDS_PATH.exists():
        return {}
    return json.loads(IDS_PATH.read_text())


def get_sheet_names(sheets_service, spreadsheet_id: str) -> List[str]:
    meta = sheets_service.spreadsheets().get(spreadsheetId=spreadsheet_id).execute()
    return [s['properties']['title'] for s in meta.get('sheets', [])]


def ensure_tabs(sheets_service, spreadsheet_id: str, tab_names: List[str]):
    existing = set(get_sheet_names(sheets_service, spreadsheet_id))
    requests = []
    for name in tab_names:
        if name not in existing:
            requests.append({'addSheet': {'properties': {'title': name, 'gridProperties': {'rowCount': 200, 'columnCount': 30}}}})
    if requests:
        sheets_service.spreadsheets().batchUpdate(spreadsheetId=spreadsheet_id, body={'requests': requests}).execute()


def overwrite_sheet(sheets_service, spreadsheet_id: str, sheet_name: str, header: List[str]):
    sheets_service.spreadsheets().values().clear(spreadsheetId=spreadsheet_id, range=f'{sheet_name}!A:ZZ', body={}).execute()
    sheets_service.spreadsheets().values().update(
        spreadsheetId=spreadsheet_id,
        range=f'{sheet_name}!A1',
        valueInputOption='USER_ENTERED',
        body={'values': [header]},
    ).execute()


def create_workbook(drive_service, title: str) -> Dict[str, str]:
    metadata = {
        'name': title,
        'mimeType': 'application/vnd.google-apps.spreadsheet',
    }
    created = drive_service.files().create(body=metadata, fields='id,name,webViewLink').execute()
    return created


def get_existing_workbook(drive_service, spreadsheet_id: str) -> Dict[str, str]:
    existing = drive_service.files().get(fileId=spreadsheet_id, fields='id,name,webViewLink').execute()
    return existing


def main():
    sheets_service, drive_service = auth()
    manifest = load_manifest()['phase1']
    existing_ids = load_existing_ids()

    db_workbook = get_existing_workbook(drive_service, manifest['db']['existing_spreadsheet_id'])
    results = {
        'db': {
            'spreadsheet_id': manifest['db']['existing_spreadsheet_id'],
            'name': db_workbook.get('name', manifest['db']['name']),
            'url': db_workbook.get('webViewLink', ''),
        }
    }

    # Ensure DB tabs exist
    ensure_tabs(sheets_service, manifest['db']['existing_spreadsheet_id'], manifest['db']['required_tabs'])

    # Create or reuse role-based workbooks
    for key in ['cs', 'concierge', 'executive', 'sales', 'coaches']:
        spec = manifest[key]
        existing_spec = existing_ids.get(key) or {}
        spreadsheet_id = existing_spec.get('spreadsheet_id', '').strip()
        if spreadsheet_id:
            workbook = get_existing_workbook(drive_service, spreadsheet_id)
        else:
            workbook = create_workbook(drive_service, spec['name'])
            spreadsheet_id = workbook['id']

        results[key] = {
            'spreadsheet_id': spreadsheet_id,
            'name': workbook.get('name', spec['name']),
            'url': workbook.get('webViewLink', ''),
        }
        tab_names = list(spec['tabs'].keys())
        ensure_tabs(sheets_service, spreadsheet_id, tab_names)
        existing = get_sheet_names(sheets_service, spreadsheet_id)
        # Remove localized default first sheet if not part of desired tabs
        meta = sheets_service.spreadsheets().get(spreadsheetId=spreadsheet_id).execute()
        for default_name in [name for name in existing if name in ('Sheet1', 'シート1') and name not in spec['tabs']]:
            sid = next(s['properties']['sheetId'] for s in meta['sheets'] if s['properties']['title'] == default_name)
            sheets_service.spreadsheets().batchUpdate(spreadsheetId=spreadsheet_id, body={'requests': [{'deleteSheet': {'sheetId': sid}}]}).execute()
        for tab_name, header in spec['tabs'].items():
            overwrite_sheet(sheets_service, spreadsheet_id, tab_name, header)

    IDS_PATH.write_text(json.dumps(results, ensure_ascii=False, indent=2))
    print(json.dumps(results, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
