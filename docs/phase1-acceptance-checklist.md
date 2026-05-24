# Phase 1 Acceptance Checklist

## Goal
Validate that the Phase 1 cutover is not just deployed, but operational for non-technical Potex users.

## Current deployed assets
- Apps Script project: `Potex Automation Hub`
- DB workbook: `POTEX DB`
  - https://docs.google.com/spreadsheets/d/1sJuEM1RXn5zVeBj6dVTujnf0P2m-CweLPbt_gpcxFFs/edit?usp=drivesdk
- CS workbook: `Potex CS`
  - https://docs.google.com/spreadsheets/d/1KFRLdsT2-LlhSA0YLkXuV3Oh76yxnhL_6tvmOdvv4yg/edit?usp=drivesdk
- Executive workbook: `Potex Executive`
  - https://docs.google.com/spreadsheets/d/1pnEWHFdGHY6Er3aAXuvAz-H1MwgQcvrEZq_Z5oqdwuY/edit?usp=drivesdk

## Deployment status already confirmed
- `bootstrapProject()` succeeded
- `installTriggers()` succeeded
- `runCanonicalRefresh()` succeeded
- `runPublishAll()` succeeded

---

## 1. DB workbook acceptance
Open `POTEX DB` and confirm:
- `Staging_Customers` exists and is not empty
- `Staging_Feedback` exists and is not empty
- `Feedback` exists and row count is plausible
- `Exceptions_FeedbackMatch` exists
- `Ops_Followup_Queue` exists
- `Ops_Continuation_Targets` exists
- `Ops_Feedback_Review` exists
- `Sync_Log` contains fresh rows from the successful GAS runs

### Notes for interpretation
- `SOURCE_CUSTOMERS_WORKBOOK_ID` is configured to workbook `受講者管理`.
- Current staging validation shows `Staging_Customers` aligns to the named source rows in `顧客管理`.
- Total raw source rows can exceed staging rows because blank-name rows are skipped during staging refresh.
- Final cutover should still run one last full refresh before handoff.

---

## 2. CS workbook acceptance
Open `Potex CS` and confirm:
- `CS_要フォロー一覧` exists and has header + published rows or an intentionally empty queue
- `CS_継続対象一覧` exists and has header + published rows or an intentionally empty queue
- `CS_例外確認` exists
- `CS_別名解決入力` exists
- `CS_別名解決入力` preserves operator-only columns for manual input:
  - `operator_decision_status`
  - `operator_selected_customer_id`
  - `operator_selected_customer_name`
  - `operator_note`

### If there are unmatched feedback rows
Use one low-risk row to test the writeback loop:
1. Enter a valid alias decision in `CS_別名解決入力`
2. Run `runWritebackCollection()` in Apps Script
3. Run `runPublishAll()` again
4. Confirm:
   - the alias is added/updated in `Customer_Alias_Map`
   - the corresponding row is removed or reduced from `Exceptions_FeedbackMatch`
   - the published CS alias-input row disappears or reflects processed status

---

## 3. Executive workbook acceptance
Open `Potex Executive` and confirm:
- `経営_コーチ負荷` exists and has plausible coach-level counts
- `経営_顧客リスク` exists and has plausible counts
- `経営_データ状況` exists and includes at least:
  - `customers_count`
  - `coaches_count`
  - `sessions_count`
  - `feedback_count`
  - `followup_queue_count`
  - `continuation_targets_count`
  - `feedback_match_exception_count`

### Interpretation rule
The exact numbers do not need to be perfect on first cutover.
The acceptance question is whether they are directionally plausible and useful for operator sanity checks.

---

## 4. Trigger acceptance
In Apps Script, confirm project triggers exist for:
- publish refresh cadence
- writeback collection cadence
- daily full refresh cadence

If trigger review is needed, use Apps Script `Triggers` UI and confirm the expected handler names exist:
- `handlePublishTrigger`
- `handleWritebackTrigger`
- `handleDailyRefreshTrigger`

---

## 5. Remaining known gap after acceptance
This deployment does **not** guarantee that the very latest customer source rows have been pulled at the final cutover moment.

Still required before final handoff:
- run one last full refresh
- confirm `顧客管理` / `フォームの回答` still map cleanly into `Staging_Customers`

Current status:
- source customer workbook is identified and configured
- staging alignment has been validated against named source rows

---

## 6. Definition of “Phase 1 operationally ready”
Treat Phase 1 as operationally ready when all of the following are true:
- GAS deployment is live
- DB / CS / Executive publish surfaces populate successfully
- triggers are installed
- `経営_データ状況` gives a usable sanity-check surface
- at least one alias/writeback loop is validated end-to-end
- operators can work from role-based workbooks without editing canonical DB sheets directly
