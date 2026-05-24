# Workbook UX Maintenance

## Purpose

`tools/apply_workbook_ux.py` re-applies the current Potex workbook UX package so formatting does not depend on one-off manual API calls.

This script is intended for:
- reapplying frozen headers / filters / tab colors after sheet recreation
- restoring conditional formatting after tab resets
- repopulating README / legend tabs
- rehiding safe helper / source / ID columns on role workbooks
- reapplying per-sheet Japanese guidance notes on headers
- restoring editable-column dropdown validation and yellow input emphasis
- restoring column-group header colors / practical widths / wrapped comment columns

## Script

Path:
- `tools/apply_workbook_ux.py`

## Requirements

- Google OAuth token at `~/.hermes/google_token.json`
- Python environment with `google-auth`, `google-auth-httplib2`, `google-api-python-client`

## Usage

### Reapply all maintained workbook UX

```bash
python tools/apply_workbook_ux.py --scope all
```

### Reapply one workbook group only

```bash
python tools/apply_workbook_ux.py --scope sales
python tools/apply_workbook_ux.py --scope coaches
python tools/apply_workbook_ux.py --scope concierge
python tools/apply_workbook_ux.py --scope db
```

### Reapply only README + hidden helper columns

```bash
python tools/apply_workbook_ux.py --readmes-only
```

## Current coverage

### Role workbooks
- `Potex CS`
- `Potex Executive`
- `Potex Sales`
- `Potex Coaches`
- `Potex Concierge`

### Admin workbook sections
- `Sync_Log`
- `Sync_Control`
- `Publish_Manifest`
- `Exceptions_FeedbackMatch`
- `Exceptions_ContinuationMatch`
- `Staging_Payments`
- `Customer_Coach_Assignments`

### Extra second-pass cleanup
- repopulates `営業_使い方`, `コーチ_使い方`, `コンシェルジュ_使い方`
- rehides safe helper/source/id columns in selected `CS` / `Sales` / `Coaches` / `Concierge` tabs

## Notes

- The script is intentionally conservative: it hides only columns already judged safe for operator UX.
- `POTEX DB` is treated as an admin/debug workbook, not an operator workbook.
- If a publish schema changes, update the header names in `HIDE_COLUMNS` or the formulas in `apply_baseline_and_signals()`.

## Recommended operator policy

When a workbook/tab is recreated or a publish reset wipes formatting:
1. run the relevant publish job first,
2. run `tools/apply_workbook_ux.py`,
3. visually spot-check the key tabs,
4. confirm hidden helper columns and README legends still match the current schema.
