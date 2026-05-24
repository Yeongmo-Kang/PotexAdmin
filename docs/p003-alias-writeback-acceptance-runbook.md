# P-003 Alias / Writeback Acceptance Runbook

## Goal
Prove that the live Potex CS workbook can close one unmatched customer case end-to-end without editing the canonical DB workbook directly.

This is the acceptance gate between:
- **Phase 1 deployed** and
- **Phase 1 operationally ready**

---

## Why this matters
The current system is only truly usable for non-technical operators if this loop works:

1. GAS publishes unmatched rows into `CS_別名解決入力`
2. A CS operator resolves the alias there
3. GAS writes the decision back into `Customer_Alias_Map`
4. GAS republishes derived views
5. The unresolved exception is reduced or removed

If this loop fails, the workbook split is still only partially operational.

---

## Preconditions
These must already be true:
- Apps Script project is deployed
- `bootstrapProject()` succeeded
- `installTriggers()` succeeded
- `runCanonicalRefresh()` succeeded
- `runPublishAll()` succeeded
- `Potex CS` workbook contains `CS_別名解決入力`
- `POTEX DB` workbook contains `Customer_Alias_Map` and `Exceptions_FeedbackMatch`

---

## Workbooks involved
- `POTEX DB`
  - https://docs.google.com/spreadsheets/d/1sJuEM1RXn5zVeBj6dVTujnf0P2m-CweLPbt_gpcxFFs/edit?usp=drivesdk
- `Potex CS`
  - https://docs.google.com/spreadsheets/d/1KFRLdsT2-LlhSA0YLkXuV3Oh76yxnhL_6tvmOdvv4yg/edit?usp=drivesdk

---

## Recommended test scope
Use **exactly one** low-risk row for the first acceptance test.

You can inspect current unresolved candidates from the local workspace with:
```bash
cd /mnt/c/Users/zerom/Desktop/DevZero/projects/potex
python inspect_phase1_alias_candidates.py
```

Current live snapshot at the time this runbook was written:
- unresolved alias count in `Potex CS`: `1`
- unresolved exception count in `POTEX DB`: `1`
- current low-risk candidate:
  - `alias_name`: `知子佐藤`
  - `respondent_email`: `cerena999@yahoo.co.jp`
  - `source_sheet`: `通常月用`
  - `source_row`: `35`
  - top suggested canonical candidate: `CUST-0065 / 佐藤知子`
  - suggestion reason: same coach + likely surname/given-name swap

Pick a row in `CS_別名解決入力` where:
- the customer identity is already obvious to a human
- there is low ambiguity
- the operator can confidently map it to one existing canonical customer

Do **not** use a borderline or disputed match for the first acceptance run.

---

## Editable columns
In `CS_別名解決入力`, only edit these columns:
- `operator_decision_status`
- `operator_selected_customer_id`
- `operator_selected_customer_name`
- `operator_note`

Do not edit published source/current-state columns.

---

## Step-by-step acceptance test

### Step 1. Capture baseline
Before editing anything, note these facts for the chosen row:
- `alias_name`
- `respondent_email`
- `source_sheet`
- `source_row`
- current `sync_status`
- whether a matching row exists in `Exceptions_FeedbackMatch`

Also note current counts, if visible:
- row count in `Exceptions_FeedbackMatch`
- whether the alias already exists in `Customer_Alias_Map`

### Step 2. Enter operator decision
In `Potex CS` → `CS_別名解決入力`, fill:
- `operator_decision_status` = `approved`
- `operator_selected_customer_id` = the known canonical customer ID
- `operator_selected_customer_name` = the known canonical customer name
- `operator_note` = short reason, e.g. `phase1 acceptance test`

### Step 3. Run writeback
In Apps Script, run:
- `runWritebackCollection()`

Expected result:
- script finishes successfully
- no validation error about missing customer ID or missing customer name

### Step 4. Run republish
In Apps Script, run:
- `runPublishAll()`

Expected result:
- script finishes successfully
- CS published views refresh from DB state

### Step 5. Verify DB-side writeback
Open `POTEX DB` and verify:
- `Customer_Alias_Map` contains a row for the alias
- the row has the selected canonical customer ID
- the row has the selected canonical customer name
- the row status is approval-like (`approved`, `active`, or `resolved` depending on flow)

### Step 6. Verify exception closure
Open `Exceptions_FeedbackMatch` and confirm one of these is true:
- the specific unresolved row is gone
- or the unresolved count decreased as expected

### Step 7. Verify downstream feedback effects
Check whether the previously blocked case now appears correctly in:
- `Feedback`
- `Ops_Feedback_Review`

Expected result:
- the matched case is now represented with canonical customer linkage

### Step 8. Verify CS-side status
Return to `Potex CS` → `CS_別名解決入力` and confirm the tested row is now either:
- removed from the unresolved publish set
- or marked with processed sync state in the way the flow intends

---

## Pass / fail criteria

### PASS
Mark this acceptance run as PASS if all are true:
- `runWritebackCollection()` succeeds
- `runPublishAll()` succeeds
- `Customer_Alias_Map` is updated correctly
- the relevant unresolved exception is removed or reduced
- the linked feedback/op-review records reflect the resolved customer
- the operator did not need to touch the canonical DB workbook manually

### FAIL
Mark this run as FAIL if any of these happen:
- writeback function errors
- alias row remains unresolved with no DB update
- wrong customer is written
- published views do not reflect the DB change after republish
- operator had to repair canonical data manually

---

## If it fails
Capture and report:
- which step failed
- exact Apps Script error text
- the chosen row’s `alias_name`
- the chosen row’s `source_sheet` and `source_row`
- whether `Customer_Alias_Map` changed at all
- whether `Exceptions_FeedbackMatch` changed at all

That is enough context to debug without broad guessing.

---

## What this unlocks if it passes
If this acceptance test passes, the next safest implementation direction is:
1. mark Phase 1 operationally ready
2. expand refresh-driven ops surfaces (P-005)
3. only then plan `Potex Concierge`
4. keep `Potex Sales` behind commercial-model completion (`Plans`, `Payments`, `ConversionHistory`)
