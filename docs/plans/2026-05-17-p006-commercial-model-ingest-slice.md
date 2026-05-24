# P-006 Commercial Model Ingest Slice Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Replace the current placeholder `Plans` / `Payments` / `ConversionHistory` rows with source-backed commercial data, starting from the safest real sheets already visible in the live operational workbook.

**Architecture:** Keep `POTEX DB` as the canonical hub. Add a thin source-backed commercial ingest slice before attempting any sales-facing workbook. Phase 1 of P-006 should generate real `Plans`, introduce `Staging_Payments` + source-backed `Payments`, and create a minimal but defensible `ConversionHistory` backfill from operational status events.

**Tech Stack:** Google Sheets source tabs, Python inspection scripts, Apps Script canonical refresh/publish pipeline, spreadsheet-first operator workflow.

---

## Current grounded findings

- `Plans`, `Payments`, and `ConversionHistory` already exist in `POTEX DB`, but their current contents look like placeholder/demo data rather than source-backed canonical rows.
- Live `Plans` rows use values like `Starter 8`, `Trial + Proposal`, `Short 4`, while the linked customers currently show `course_name = マスター6か月`.
- Live `Payments` rows also look synthetic (`INV-2026-001`, English notes).
- Live `ConversionHistory` rows use synthetic event values like `lead_created` with English notes.
- The live operational workbook `⭕️使用中｜POTEX数値管理` contains promising commercial source tabs:
  - `着金管理マスター`
  - `継続プラン管理`
  - `体験者一覧`
  - `失注理由ログ`
  - `営業フォロー`
- `CURRENT_TO_MVP_MAPPING.md` already concludes:
  - `Plans` can be derived from `顧客管理`.`コース`
  - `Payments` cannot be fully restored from currently confirmed source sheets alone
  - `ConversionHistory` should start with a minimal event backfill rather than perfect historical reconstruction

---

## Recommended implementation scope

### In scope for this slice
1. Real-source `Plans` generation
2. `Staging_Payments` introduction and initial `Payments` ingest from `着金管理マスター`
3. Minimal `ConversionHistory` backfill from customer lifecycle + sales outcome sources
4. Data-health visibility for commercial row counts/exceptions

### Explicit non-scope
- No `Potex Sales` workbook yet
- No perfect revenue accounting reconstruction
- No broad commercial dashboard buildout
- No operator writeback flow for payments yet

---

## Task 1: Freeze inspection evidence in docs

**Objective:** Record exactly why current commercial tables are not trustworthy yet.

**Files:**
- Create: `generated/commercial_model_inspection_2026-05-17.md`
- Modify: `docs/backlog.md`
- Modify: `agents/session.md`

**Step 1: Write inspection summary**
Include:
- current row counts for `Plans`, `Payments`, `ConversionHistory`
- evidence that current rows are placeholder/synthetic
- source tabs discovered in `⭕️使用中｜POTEX数値管理`

**Step 2: Update backlog/session status**
State that P-006 should begin by replacing placeholder commercial rows with source-backed canonical data.

**Step 3: Verify**
- Confirm docs mention `着金管理マスター` / `継続プラン管理` as the next real commercial sources.

---

## Task 2: Add staging contract for payments

**Objective:** Create the DB-side structural contract before touching canonical `Payments` logic.

**Files:**
- Modify: `workbook_manifest.json`
- Modify: `provision_phase1_workbooks.py`
- Modify: `potex-gas/src/constants.ts`
- Modify: `potex-gas/src/canonical/ingest.ts`
- Modify: `docs/sheet-reference.md`
- Modify: `docs/database-overview.md`

**Step 1: Add `Staging_Payments` tab to manifest/DB contract**
Suggested columns:
- `staging_payment_id`
- `source_sheet`
- `source_row`
- `line_name`
- `customer_name`
- `experience_date`
- `contract_date`
- `sales_owner_name`
- `plan_name_raw`
- `amount_text_raw`
- `amount_numeric`
- `segment`
- `paid_flag`
- `paid_date`
- `note`

**Step 2: Provision and verify header only**
Run the workbook provisioner and verify `Staging_Payments` exists in `POTEX DB`.

**Step 3: Update docs**
Document `Staging_Payments` as a raw ingest layer sourced from `着金管理マスター`.

---

## Task 3: Implement real-source `Plans` generation

**Objective:** Replace synthetic `Plans` rows with rows derived from actual customer/course data.

**Files:**
- Modify: `potex-gas/src/canonical/ingest.ts`
- Modify: `potex-gas/src/sheets.ts` if helper changes are needed
- Modify: `inspect_phase1_operability.py` or a new inspection script if needed
- Test/inspect with: `受講者管理`.`顧客管理`, `受講者管理`.`フォームの回答`, optional `継続プラン管理`

**Step 1: Define the minimal plan-generation rule**
Use one canonical current-plan row per customer with:
- `plan_id`
- `customer_id`
- `plan_name`
- `plan_type`
- `sessions_included` (nullable if not safely derivable)
- `contract_date`
- `start_date`
- `end_date`
- `amount_tax_included` (nullable at first if not defensible)
- `status`
- `note`

**Step 2: Source priority**
Recommended priority:
1. `顧客管理`.`コース` for base plan name
2. `フォームの回答`.`ご希望のプラン` for supporting detail
3. `継続プラン管理` only for explicit continuation-plan enrichment, not for broad overwrite

**Step 3: Replace synthetic rows**
`Plans` should be fully regenerated from source-backed logic during refresh, not patched manually.

**Step 4: Verify**
- sample `Plans.plan_name` should now align with linked `Customers.course_name`
- no remaining `Starter 8` / `Trial + Proposal` synthetic examples unless actually present in source

---

## Task 4: Implement first-pass `Payments` ingest from `着金管理マスター`

**Objective:** Capture real payment events from the best currently visible payment-like source.

**Files:**
- Modify: `potex-gas/src/canonical/ingest.ts`
- Modify: `potex-gas/src/config.ts` only if source metadata needs explicit properties
- Optional create: `generated/payment_source_header_snapshot.json`

**Step 1: Read `着金管理マスター` using the real header row**
Important: the actual header starts below explanatory rows, so the ingest must not assume row 1 is the schema header.

**Step 2: Write `Staging_Payments`**
Preserve raw columns and source coordinates exactly.

**Step 3: Normalize into canonical `Payments`**
Minimum safe fields:
- `payment_id`
- `customer_id` (nullable if unmatched)
- `plan_id` (nullable at first)
- `payment_date`
- `amount`
- `payment_method` (nullable)
- `payment_status`
- `invoice_number` (nullable)
- `note`

**Step 4: Matching rule**
Use a conservative customer matching order:
1. exact name match to canonical customer
2. alias match if available
3. unmatched rows should remain visible via a future exception surface rather than force-linked

**Step 5: Verify**
- `Payments` row count should reflect real paid/contract events from `着金管理マスター`
- values like `¥597,800` should normalize into numeric amount fields
- unmatched payment rows should be countable

---

## Task 5: Implement minimal `ConversionHistory` backfill

**Objective:** Build a defensible event trail without pretending full historical perfection.

**Files:**
- Modify: `potex-gas/src/canonical/ingest.ts`
- Inspect source tabs:
  - `体験者一覧`
  - `失注理由ログ`
  - `顧客管理`
  - `着金管理マスター`

**Step 1: Define minimum event types**
Start with only:
- `lead_created`
- `experience_scheduled`
- `contracted`
- `paid`
- `completed`
- `lost`

**Step 2: Use conservative source mapping**
- `体験者一覧`.`体験申込日` -> `lead_created`
- `体験者一覧`.`コーチング体験日` -> `experience_scheduled`
- `体験者一覧`.`成約/失注` + `成約日` -> `contracted` or `lost`
- `着金管理マスター`.`着金済み` + `着金日` -> `paid`
- `顧客管理`.`受講終了` / latest session horizon -> `completed`

**Step 3: Keep event provenance**
If the current schema lacks source columns, either:
- extend `ConversionHistory`, or
- at minimum write provenance into `note`

**Step 4: Verify**
- at least one customer should show a plausible ordered path
- synthetic English lifecycle notes should disappear from regenerated rows

---

## Task 6: Add commercial data health visibility

**Objective:** Make the new commercial slice inspectable before any sales workbook exists.

**Files:**
- Modify: `potex-gas/src/publish/views.ts`
- Modify: `potex-gas/src/publish/managementWorkbook.ts`
- Modify: `inspect_phase1_operability.py`
- Modify: `docs/phase1-acceptance-checklist.md` if needed

**Step 1: Extend `経営_データ状況` or inspection output**
Add metrics such as:
- `plans_count`
- `payments_count`
- `conversion_events_count`
- `payment_unmatched_count` (if available)

**Step 2: Verify**
- counts change from placeholder baseline to source-backed baseline
- operators can see whether commercial ingest is populated without opening DB raw sheets

---

## Task 7: Final verification and cutover note

**Objective:** Prove the slice is ready for real use as a canonical backend, even before a Sales workbook exists.

**Files:**
- Modify: `docs/backlog.md`
- Modify: `agents/session.md`
- Optional create: `generated/commercial_model_verification.json`

**Step 1: Verification checklist**
- `Plans` rows align with canonical customer course data
- `Payments` rows come from `着金管理マスター`, not demo placeholders
- `ConversionHistory` events are source-backed and plausible
- no English demo notes remain unless present in a real source

**Step 2: Status update**
Mark P-006 as started with a concrete slice definition; keep `Potex Sales` explicitly out of scope until this passes.

---

## Acceptance criteria

Treat this slice as complete when all of the following are true:
- `Plans` no longer contain obvious placeholder/demo rows
- `Payments` are sourced from a real operational workbook tab
- `ConversionHistory` contains minimal but source-backed lifecycle events
- commercial row counts are visible in an inspection or health surface
- no new operator writeback process was introduced prematurely
