# P-002 Phase 1 Operability Hardening Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task if execution is delegated.

**Goal:** Make the Phase 1 workbook cutover feel operationally complete for non-technical Potex operators by aligning the workbook surface with the live reference sheet patterns already proven in `⭕️使用中｜POTEX数値管理`.

**Architecture:** Keep `POTEX DB` as the canonical hub, publish read models into `Potex CS` and `Potex Executive`, and add the minimum operability layers that the live sheet demonstrates: explicit operator input surfaces, a lightweight data-health/verification surface, and in-workbook guidance/runbook structure. Use GAS to populate these views so the structure stays refreshable rather than manually maintained.

**Tech Stack:** Google Sheets, Google Apps Script TypeScript, clasp, existing `potex-gas/` publish/writeback flow, `workbook_manifest.json` provisioning.

---

## Scope summary

### What the live reference sheet teaches us
- A workbook is easier to operate when it includes a human-facing README tab.
- Derived dashboards should be separated from manual input surfaces.
- Data health / reconciliation views should exist as first-class tabs, not just logs.
- Debug/verification tabs are acceptable when they reduce operator guesswork during rollout.

### What Phase 1 already had
- Split-workbook architecture for DB / CS / Executive.
- Published CS operational views.
- Published Executive summary views.
- Provisioning and script-properties scaffolding.

### What was still missing or inconsistent
- `CS_別名解決入力` was part of the GAS workflow and docs, but not present in `workbook_manifest.json`.
- `経営_データ状況` existed in the workbook manifest but was not populated by the Executive publish flow.
- The live-sheet-inspired operability pattern had been recognized, but not yet converted into a concrete hardening sequence.

---

## Task 1: Align workbook provisioning with the actual CS operator workflow

**Objective:** Ensure a newly provisioned CS workbook already contains every sheet the documented GAS flow expects.

**Files:**
- Modify: `workbook_manifest.json`
- Inspect: `potex-gas/src/publish/views.ts`
- Inspect: `PHASE1_CUTOVER_RUNBOOK.md`

**Step 1: Freeze the CS alias-input contract**

Confirm these headers are the expected contract for `CS_別名解決入力`:
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

**Step 2: Put that contract into provisioning**

Ensure `workbook_manifest.json` includes `CS_別名解決入力` with the exact header order above.

**Step 3: Verification**

Run:
```bash
cd /mnt/c/Users/zerom/Desktop/DevZero/projects/potex/potex-gas && npm run build
```

Expected: successful build, and the manifest now matches the documented CS workflow.

---

## Task 2: Turn Executive workbook data health into a real published view

**Objective:** Add a lightweight verification sheet that mirrors the role of `数値整合性チェック` in the live reference workbook.

**Files:**
- Modify: `potex-gas/src/constants.ts`
- Modify: `potex-gas/src/publish/views.ts`
- Modify: `potex-gas/src/publish/managementWorkbook.ts`
- Inspect: `OPS_WORKBOOK_ARCHITECTURE.md`

**Step 1: Add an explicit Executive view constant**

Expose `経営_データ状況` in `VIEWS` so the publish layer treats it as a first-class surface.

**Step 2: Define the initial health metrics**

Start with simple but useful metrics:
- `customers_count`
- `coaches_count`
- `sessions_count`
- `feedback_count`
- `followup_queue_count`
- `continuation_targets_count`
- `feedback_match_exception_count`

Keep the shape minimal:
- `metric`
- `value`
- `note`

**Step 3: Publish the sheet on every Executive refresh**

Use DB workbook source tabs to rebuild `経営_データ状況` whenever `publishExecutiveWorkbook()` runs.

**Step 4: Verification**

Run:
```bash
cd /mnt/c/Users/zerom/Desktop/DevZero/projects/potex/potex-gas && npm run build
```

Expected: successful build and no TypeScript errors after wiring the additional published tab.

---

## Task 3: Capture the live-sheet pattern mapping in project docs

**Objective:** Make the operability intent discoverable so future work does not regress back to raw-data-only workbook design.

**Files:**
- Modify: `docs/backlog.md`
- Modify: `agents/session.md`
- Optional modify: `README.md`

**Step 1: Record the concrete mapping**

Document this translation from the live sheet into Potex Phase 1:
- `📘README_v2` pattern -> workbook guidance/runbook tabs to add later
- `ダッシュボード` pattern -> `経営_コーチ負荷`, `経営_顧客リスク`
- `数値整合性チェック` pattern -> `経営_データ状況`
- debug/verify pattern -> rollout-time verification sheets or logs around publish/writeback

**Step 2: Record what was hardened now**

Note that the current session already delivered:
- manifest alignment for `CS_別名解決入力`
- real publish support for `経営_データ状況`

**Step 3: Verification**

Read the updated docs and confirm they explain both:
- what changed technically
- why the change improves operator usability

---

## Task 4: Define the next thin slice after this hardening

**Objective:** Keep momentum on P-002 without overbuilding.

**Files:**
- Modify: `docs/backlog.md`
- Inspect: `PHASE1_CUTOVER_RUNBOOK.md`
- Inspect: `generated/phase1_script_properties.json`

**Step 1: Keep the next execution step narrow**

After this hardening, the next P-002 slice should be:
1. create/deploy the GAS project
2. inject script properties
3. run `bootstrapProject()` / `installTriggers()` / `runCanonicalRefresh()` / `runPublishAll()`
4. verify `CS_別名解決入力` and `経営_データ状況` in the real workbooks

**Step 2: Preserve blocked status honestly**

Do not claim customer raw ingest is complete until `SOURCE_CUSTOMERS_WORKBOOK_ID` is available.

**Step 3: Verification**

Make sure the backlog still distinguishes:
- executable now: GAS deploy + publish verification
- blocked later: customer source ingest completion

---

## Acceptance criteria
- `workbook_manifest.json` contains `CS_別名解決入力`.
- Executive publish flow writes `経営_データ状況`.
- Project docs explain why these changes exist and how they connect to the live reference workbook.
- The next operational step remains the real cutover: deploy GAS and verify the published Phase 1 workbooks.
