# Potex Phase 1 Cutover Runbook

> **Status (2026-05-19):** Cutover complete. All 5 publish targets (`POTEX DB` / `Potex CS` / `Potex Executive` / `Potex Concierge` / `Potex Sales` / `Potex Coaches`) are live with Apps Script trigger automation. This document is retained as a setup/cutover reference for future workbooks (e.g., partner pipeline view).

## 1. Architecture
- `POTEX DB` is the canonical data hub. Source workbooks remain read-only.
- Role workbooks (`Potex CS` / `Potex Executive` / `Potex Concierge` / `Potex Sales` / `Potex Coaches`) are publish targets only.
- The Apps Script project `Potex Automation Hub` (deployed under `y.kang@potex.jp`) drives canonical refresh → publish → writeback.

## 2. Provisioning a new workbook
1. Add the new workbook section to `workbook_manifest.json`.
2. Run `provision_phase1_workbooks.py` (idempotent — creates missing tabs only).
3. Add the new spreadsheet id to `potex-gas/src/config.ts` (as a default) and to script properties if override is required.
4. Rebuild + push GAS:
   ```bash
   cd potex-gas && npm install && npm run deploy
   ```
5. Run `bootstrapProject()` (one-time) and `installTriggers()` from the Apps Script UI.

## 3. Trigger cadence (default, installed by `installTriggers()`)
- `runPublishAll()` — every 1 hour
- `runWritebackCollection()` — every 30 minutes
- `runFullRefresh()` — daily at 07:00 JST

## 4. Operator rules
- Do not edit DB workbook directly.
- Do not edit publish surfaces by hand.
- Human input flows through writeback input tabs only:
  - `CS_別名解決入力` (alias decisions)
  - `CS_更新アクション` (other operator actions)

## 5. Alias resolution loop
1. `runPublishAll()` publishes unresolved aliases to `CS_別名解決入力`.
2. CS operator fills `operator_decision_status` / `operator_selected_customer_id` / `operator_selected_customer_name` / `operator_note`.
3. `runWritebackCollection()` validates and merges decisions into `Customer_Alias_Map`. Invalid rows return as `sync_status=error_*`.
4. Next `runPublishAll()` removes resolved rows from review queues.

## 6. Verification (read-only)
- `generated/inspect_sales_coach_provisioning.py` — row counts across Sales / Coaches publish surfaces.
- Apps Script UI execution log — direct view of trigger runs.
- DB workbook health: `Staging_Customers` row count vs source named rows.
- Publish surface health: each `*_Data_Health` tab should not suddenly drop to 0.

## 7. Known fragilities
- Manually re-merging cells on review tabs swallows `setValues`. The publisher (`potex-gas/src/sheets.ts > clearAndRewrite`) calls `breakApart()` before write to defend against this. If a review tab shows blank headers, suspect re-merge.
- Sheets auto-converts string `'TRUE'`/`'FALSE'` to boolean on roundtrip. The Sales views handle this via case-insensitive comparison (`String(v).toUpperCase() === 'TRUE'`). Apply the same pattern to any new boolean column.
- Stuck `PropertiesService` values can override defaults. New `ENABLE_*` flags should use the Concierge pattern: `asBool(getProp(...)) || Boolean(spreadsheetId)`.
