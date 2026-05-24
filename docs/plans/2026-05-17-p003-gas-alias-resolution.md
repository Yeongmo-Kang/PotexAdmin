# P-003 GAS Customer Alias Resolution Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task if execution is delegated.

**Goal:** Make customer alias resolution operate through the CS workbook + GAS writeback flow as the default day-to-day process.

**Architecture:** The DB workbook remains canonical. Unmatched feedback rows are published into `CS_別名解決入力`, CS operators enter a decision there, `runWritebackCollection()` writes approved results back into `Customer_Alias_Map`, and the writeback flow updates `Feedback`, `Ops_Feedback_Review`, and `Exceptions_FeedbackMatch`. The Python bridge stays as fallback only.

**Tech Stack:** Google Apps Script TypeScript, Google Sheets, clasp, existing `potex-gas/` build flow.

---

## Scope summary

### What already exists
- CS workbook publish path already creates `CS_別名解決入力`
- GAS already exposes `runWritebackCollection()`
- `collectCsWritebackRows()` already writes alias decisions back to DB-side sheets
- Current documented unresolved case: `知子佐藤`

### What is still missing
- Operator workflow is not yet hardened/documented enough for routine use
- Idempotency and overwrite behavior should be verified carefully
- Publish-after-writeback loop should be explicit and validated
- Manual QA checklist for operators is not yet captured as a concrete execution plan

---

## Task 1: Freeze the current interface contract

**Objective:** Confirm the exact columns and sheets that define the alias-resolution workflow so later changes do not break operator usage.

**Files:**
- Inspect: `potex-gas/src/publish/views.ts`
- Inspect: `potex-gas/src/publish/csWorkbook.ts`
- Inspect: `potex-gas/src/writeback/csWriteback.ts`
- Update: `docs/plans/2026-05-17-p003-gas-alias-resolution.md`
- Optional update: `OPERATIONS_MANUAL.md`

**Step 1: Confirm CS input sheet contract**

Verify these columns are the contract for `CS_別名解決入力`:
- `alias_name`
- `respondent_email`
- `related_coach_name`
- `source_sheet`
- `source_row`
- `current_status`
- `current_canonical_customer_id`
- `current_canonical_customer_name`
- `operator_decision_status`
- `operator_selected_customer_id`
- `operator_selected_customer_name`
- `operator_note`
- `sync_status`
- `last_collected_at`

**Step 2: Confirm DB-side writeback targets**

Verify the writeback path updates:
- `Customer_Alias_Map`
- `Feedback`
- `Ops_Feedback_Review`
- `Exceptions_FeedbackMatch`

**Step 3: Record non-obvious behaviors**

Document these implementation facts:
- only rows with `operator_decision_status` and non-`processed` sync state are actionable
- approved statuses are `approved`, `active`, `resolved`
- feedback row uniqueness uses `source_sheet + source_row + respondent_email`
- ops row uniqueness uses `source_sheet + source_row`

**Step 4: Verification**

Run:
```bash
cd /mnt/c/Users/zerom/Desktop/DevZero/projects/potex/potex-gas && npm run build
```

Expected: successful TypeScript build.

---

## Task 2: Make publish → operator input → writeback → republish explicit

**Objective:** Ensure the run order is operationally obvious and no human has to guess which function to run next.

**Files:**
- Modify: `OPERATIONS_MANUAL.md`
- Modify: `PHASE1_CUTOVER_RUNBOOK.md`
- Optional modify: `README.md`

**Step 1: Add the operator loop**

Document the exact sequence:
1. `runPublishAll()` publishes unresolved alias rows to CS workbook
2. CS operator fills decision columns in `CS_別名解決入力`
3. `runWritebackCollection()` writes decisions back to DB workbook
4. `runPublishAll()` runs again so CS workbook reflects resolved state

**Step 2: Add allowed operator edits**

Explicitly state that day-to-day operators should edit only:
- `operator_decision_status`
- `operator_selected_customer_id`
- `operator_selected_customer_name`
- `operator_note`

**Step 3: Add status semantics**

Document recommended values:
- `review`
- `approved`
- `resolved`
- when to use each

**Step 4: Verification**

Review the updated docs and confirm they match the actual GAS code paths already in:
- `publishCsWorkbook()`
- `runWritebackCollection()`

---

## Task 3: Harden writeback behavior against accidental operator mistakes

**Objective:** Reduce the chance that partial or malformed operator input writes bad canonical data.

**Files:**
- Modify: `potex-gas/src/writeback/csWriteback.ts`
- Optional modify: `potex-gas/src/guards.ts`
- Optional modify: `potex-gas/src/logging.ts`

**Step 1: Add explicit validation rules**

Before writing an alias row, require:
- `operator_decision_status` is present
- if status is approval-like, `operator_selected_customer_id` must be present
- if status is approval-like, `operator_selected_customer_name` should be present or recoverable from `Customers`

**Step 2: Fail safe, not silently**

For invalid rows:
- do not mark `sync_status=processed`
- keep the row in CS workbook
- append enough log detail to debug the row

**Step 3: Protect existing good alias rows**

Ensure empty operator fields do not erase previously approved canonical mappings unless the workflow explicitly intends a reset.

**Step 4: Verification**

Run:
```bash
cd /mnt/c/Users/zerom/Desktop/DevZero/projects/potex/potex-gas && npm run build
```

Expected: successful build after validation logic changes.

---

## Task 4: Make republish behavior deterministic after alias writeback

**Objective:** Ensure resolved aliases visibly disappear from exception-driven operator queues after writeback and republish.

**Files:**
- Inspect/modify: `potex-gas/src/publish/csWorkbook.ts`
- Inspect/modify: `potex-gas/src/publish/views.ts`
- Inspect/modify: `potex-gas/src/writeback/csWriteback.ts`

**Step 1: Confirm exception removal path**

Verify `collectCsWritebackRows()` removes resolved `customer_unmatched` rows from `Exceptions_FeedbackMatch`.

**Step 2: Confirm republish effect**

Verify `publishCsWorkbook()` rebuilds:
- `CS_例外確認`
- `CS_別名解決入力`

from DB state after exceptions are removed.

**Step 3: Decide whether processed rows should remain visible**

Pick one explicit behavior and document it:
- resolved rows disappear from `CS_別名解決入力`, or
- resolved rows remain for audit with `sync_status=processed`

Given the current implementation, the default expectation is: resolved exception rows disappear on republish because the input sheet is regenerated from unresolved exceptions.

**Step 4: Verification**

Manual expected result after one successful alias resolution:
- `Customer_Alias_Map` contains the alias
- `Feedback` contains the resolved feedback row
- `Ops_Feedback_Review` contains the resolved operational row
- `Exceptions_FeedbackMatch` no longer contains that unresolved case
- republished `CS_別名解決入力` no longer shows that row

---

## Task 5: Run a single-case acceptance test with the known unresolved customer

**Objective:** Prove the full workflow using the known unmatched row before treating the process as production-ready.

**Files:**
- Use existing sheets/workbooks
- Update: `FEEDBACK_PIPELINE_STATUS.md`
- Update: `agents/session.md`
- Update: `docs/backlog.md`

**Step 1: Prepare the test case**

Use the documented unresolved row:
- alias: `知子佐藤`
- email: `cerena999@yahoo.co.jp`
- coach: `稲川コーチ`

**Step 2: Execute the workflow**

Operational sequence:
1. Run publish flow
2. Enter operator decision in CS workbook
3. Run writeback flow
4. Run publish flow again

**Step 3: Capture evidence**

Record:
- selected canonical customer ID/name
- whether `Customer_Alias_Map` was updated
- whether `Feedback` gained/resolved the row
- whether `Exceptions_FeedbackMatch` shrank by 1

**Step 4: Update status docs**

After success, update:
- `FEEDBACK_PIPELINE_STATUS.md`
- `docs/backlog.md`
- `agents/session.md`

Expected status change:
- P-003 moves from Next Up to completed or near-complete
- unmatched feedback count decreases if the mapping was valid

---

## Task 6: Define fallback policy clearly

**Objective:** Keep the Python bridge available without letting it become the default operating path.

**Files:**
- Modify: `FEEDBACK_PIPELINE_STATUS.md`
- Modify: `OPERATIONS_MANUAL.md`
- Optional modify: `README.md`

**Step 1: State the primary path**

Primary path:
- CS workbook input
- GAS writeback
- GAS republish

**Step 2: State the fallback path**

Fallback only:
```bash
python /mnt/c/Users/zerom/Desktop/DevZero/projects/potex/reconcile_feedback_aliases.py --apply
```

Use fallback only when:
- GAS is unavailable
- emergency recovery is needed
- manual reconciliation must be replayed outside Apps Script

**Step 3: Verification**

Check that all docs describe the same hierarchy:
- GAS-first
- Python bridge second

---

## Final verification checklist

Run:
```bash
cd /mnt/c/Users/zerom/Desktop/DevZero/projects/potex/potex-gas && npm run build
```

Manual acceptance checklist:
- `CS_別名解決入力` shows unresolved customer rows only
- operator-editable columns are clearly documented
- `runWritebackCollection()` processes valid decisions only
- resolved alias decisions update DB-side sheets correctly
- republish removes or clears resolved queue rows consistently
- docs now describe the exact operator loop

---

## Suggested execution order
1. Task 1 — freeze interface contract
2. Task 2 — document the operator loop
3. Task 3 — harden validation
4. Task 4 — verify republish behavior
5. Task 5 — run one real acceptance test
6. Task 6 — lock fallback policy

## Definition of done
P-003 is done when:
- a CS operator can resolve an unmatched customer through spreadsheet input alone
- GAS writes the result back safely
- DB and CS sheets converge after republish
- the process is documented well enough to repeat without tribal knowledge
