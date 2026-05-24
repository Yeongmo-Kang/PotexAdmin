#!/usr/bin/env python3
import json
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
IDS_PATH = BASE_DIR / 'generated' / 'phase1_workbook_ids.json'
OUT_PATH = BASE_DIR / 'generated' / 'phase1_script_properties.json'

DEFAULTS = {
    'ENABLE_EXEC': 'true',
    'ENABLE_COACHES': 'true',
    'ENABLE_CONCIERGE': 'false',
    'ENABLE_SALES': 'true',
    'SOURCE_FEEDBACK_WORKBOOK_ID': '1hl2JVJ_DSvjtk8axnZWJ8TTwOIMECfkREg7rN6tbDH8',
    'SOURCE_FEEDBACK_SHEETS': '通常月用,（最終月用）',
    'SOURCE_COMMERCIAL_WORKBOOK_ID': '1arXU3lqzY8c7-mYY7CnDlxEpr5ar68Q2m4h4HEwLYC8',
    'SOURCE_CUSTOMERS_WORKBOOK_ID': '17fkrUdf-vS7tQ06lzR3LDp-PPsWSwajqPcB0vyRXOk4',
    'SOURCE_CUSTOMERS_SHEET_NAME': '顧客管理',
    'SOURCE_APPLICATIONS_SHEET_NAME': 'フォームの回答',
    'SOURCE_CUSTOMERS_FALLBACK_TO_CANONICAL': 'true',
}


def main() -> None:
    ids = json.loads(IDS_PATH.read_text())
    props = {
        'DB_SPREADSHEET_ID': ids['db']['spreadsheet_id'],
        'CS_SPREADSHEET_ID': ids['cs']['spreadsheet_id'],
        'CONCIERGE_SPREADSHEET_ID': ids['concierge']['spreadsheet_id'],
        'EXEC_SPREADSHEET_ID': ids['executive']['spreadsheet_id'],
        'SALES_SPREADSHEET_ID': ids.get('sales', {}).get('spreadsheet_id', ''),
        'COACHES_SPREADSHEET_ID': ids.get('coaches', {}).get('spreadsheet_id', ''),
        **DEFAULTS,
    }
    OUT_PATH.parent.mkdir(exist_ok=True)
    OUT_PATH.write_text(json.dumps(props, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(props, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
