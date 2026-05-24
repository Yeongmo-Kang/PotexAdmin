# Potex Workbook UX Priority Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Improve usability across all managed Potex workbooks in priority order based on operator impact, input risk, and decision-making value.

**Architecture:** Treat workbooks as role-specific UIs, not just data outputs. Prioritize sheets where humans actively decide, type, or triage work; secondarily improve manager dashboards; then clean up read-only consumption surfaces. Keep `POTEX DB` low priority except for admin-safe readability because it is not the daily operator surface.

**Tech Stack:** Google Sheets API via `googleapiclient`, existing Apps Script publish/writeback pipeline, Potex managed workbooks (`Potex CS`, `Potex Executive`, `Potex Concierge`, `Potex Sales`, `Potex Coaches`, `POTEX DB`).

---

## Evidence Snapshot (2026-05-22)

### Legacy workbook reference review (2026-05-23)
- Reviewed the actual live sheet `POTEX_顧客管理_v2 のコピーテスト用 のコピー` in Google Sheets, not just the Apps Script code.
- Verified a README-first, role-tab structure that matches Japanese spreadsheet-first operator expectations:
  - `__README`
  - `商談リスト`
  - `コンシェルジュ業務`
  - `受講者管理`
  - `AFS面談管理`
  - `AFS受講管理`
  - `入金管理`
  - `コースマスター`
  - `コーチマスター`
  - `テンプレ`
  - `返金管理`
  - `0_集計用ビュー`
  - `債権履歴`
  - `債権サマリー`
- Verified `__README` acts as an operator-facing landing page with Japanese rule explanations, colored emphasis, and practical workflow notes.
- Planning conclusion: use this workbook as a **UX/reference-language exemplar**, not an architecture exemplar. Reuse its operator-facing patterns (Japanese naming, README-first onboarding, role-tab mental model), but do **not** copy its sheet-coupled formula architecture, version-offset branching, or sheet-as-DB assumptions.

### Already improved
- `Potex CS`: all tabs now have frozen headers, filters, tab colors, and advanced UX on input/review sheets.
- `Potex Executive`: all tabs now have frozen headers, filters, tab colors, and signal-style conditional formatting on key summary tabs.

### Still untouched / under-improved
- `Potex Concierge`: all 3 tabs still have `frozenRows=0`, `hasFilter=false`, `conditionalRuleCount=0`.
- `Potex Sales`: all 5 tabs still have `frozenRows=0`, `hasFilter=false`, `conditionalRuleCount=0`.
- `Potex Coaches`: all 4 tabs still have `frozenRows=0`, `hasFilter=false`, `conditionalRuleCount=0`.
- `POTEX DB`: almost all tabs still have no filters/frozen columns/visual admin affordances; acceptable short-term because this is not the main operator UI.

### Team impact summary
- **CS**: highest daily operational load, highest input error risk, highest need for action prioritization. Mostly addressed already.
- **Executive**: high decision value, lower direct input risk. Mostly addressed already.
- **Sales**: active queue + contracts + pending payments; likely next highest business leverage.
- **Coaches**: daily consumption surface with emotionally heavy follow-up content; readability matters.
- **Concierge**: read-only but still used to interpret follow-up context; moderate value.
- **DB/Admin**: lowest front-line UX priority, but useful for admin/debug readability later.
- **Cross-workbook consistency**: once untouched workbooks reach parity, align Japanese README style, tab naming, and operator wording with the legacy workbook because that is already familiar to Potex operators.

---

## Priority Framework

Score each workbook on three dimensions:

1. **Human input risk** — can a confusing UI cause bad data or failed writeback?
2. **Decision urgency** — does the workbook decide who gets actioned today?
3. **Business leverage** — does improving this surface affect revenue, retention, or escalations quickly?

### Final priority order
1. **Potex Sales**
2. **Potex Coaches**
3. **Potex Concierge**
4. **POTEX DB**
5. **CS / Executive follow-up refinements**

Rationale:
- CS/Executive were highest priority and are now substantially upgraded.
- Sales is the biggest remaining operational/business surface still untouched.
- Coaches directly consume urgent follow-up signals and need faster scanning.
- Concierge is read-only and smaller, so it comes after Coaches.
- DB is admin-only, so readability matters, but not before role workbooks.
- CS/Executive should get a second pass only after the untouched workbooks reach baseline parity.

---

## Workbook-by-Workbook Plan

## Phase 1 — Sales (next highest priority)

**Why first:**
- Contains active revenue / contract / pending payment views.
- Still has zero baseline UX enhancements.
- Misreading `pending` vs `paid`, P0/P1 priorities, or missing canonical linkage has direct business impact.

### Target sheets
- `営業_契約一覧`
- `営業_未入金一覧`
- `営業_ファネル推移`
- `営業_データ状況`
- `営業_使い方`

### UX goals
- Freeze header rows everywhere.
- Freeze 1-2 key left columns depending on sheet.
- Add filters everywhere.
- Apply row priority coloring (`P0`, `P1`, `P2`, `P3`) on actionable queues.
- Highlight payment state / unresolved canonical linkage / pending rows.
- Convert `営業_データ状況` into a signal-style summary like `経営_データ状況`.
- Format date/amount columns for easier scanning where safe.
- Widen notes/status columns if present.

### Specific intent by tab
- **`営業_契約一覧`**: highlight `pending`, blank canonical customer, and top-priority rows.
- **`営業_未入金一覧`**: emphasize `P0/P1`, missing canonical customer, and assigned owner context.
- **`営業_ファネル推移`**: improve date/event scanning; likely freeze date + event type + customer.
- **`営業_データ状況`**: red for unmatched/problem metrics, green for healthy counts only where meaningfully positive.
- **`営業_使い方`**: give operator-facing legend for color meaning and reading order.

---

## Phase 2 — Coaches

**Why second:**
- Coaches consume urgent follow-up/customer-risk information directly.
- `コーチ_要フォロー一覧` contains long comments and emotionally sensitive context, so readability matters a lot.
- Still completely untouched UX-wise.

### Target sheets
- `コーチ_担当負荷`
- `コーチ_要フォロー一覧`
- `コーチ_データ状況`
- `コーチ_使い方`

### UX goals
- Freeze headers and first identifying columns.
- Add filters everywhere.
- Highlight `P1` rows and low-satisfaction alerts.
- Widen comment/gap comment columns with wrap.
- Signal negative remaining capacity in `コーチ_担当負荷`.
- Turn `コーチ_データ状況` into a manager-friendly health block.

### Specific intent by tab
- **`コーチ_担当負荷`**: emphasize low remaining capacity and follow-up burden.
- **`コーチ_要フォロー一覧`**: maximize readability of long comments; freeze customer/coach identifiers.
- **`コーチ_データ状況`**: red for overload/problem metrics, neutral/green for capacity and coverage metrics where appropriate.
- **`コーチ_使い方`**: add “what to read first” and color legend.

---

## Phase 3 — Concierge

**Why third:**
- Read-only surface, so lower input risk than Sales/Coaches.
- Still important because concierge needs quick context reading for follow-up interpretation.
- Smaller workbook; fast win after higher-leverage workbooks.

### Target sheets
- `コンシェルジュ_フォロー一覧`
- `コンシェルジュ_データ状況`
- `コンシェルジュ_使い方`

### UX goals
- Freeze headers and first identifying columns.
- Add filters.
- Highlight `P1` follow-up rows and low-satisfaction/gap-comment cases.
- Widen comment columns.
- Turn `コンシェルジュ_データ状況` into signal-style monitor.

---

## Phase 4 — POTEX DB admin readability

**Why fourth:**
- Not the daily front-line workbook.
- Still valuable for admin/debugging, especially in `Sync_Log`, `Sync_Control`, `Publish_Manifest`, staging sheets, and canonical maps.

### Target areas
- `Sync_Log`
- `Sync_Control`
- `Publish_Manifest`
- `Customer_Coach_Assignments`
- `Exceptions_*`
- `Staging_*`
- high-touch canonical tables only if admin readability benefit is clear

### UX goals
- Freeze headers.
- Add filters to admin/debug tabs.
- Apply status/error highlighting where it improves debugging.
- Consider hiding purely internal helper columns only if it does not interfere with automation or manual admin inspection.

### Important constraint
- Do **not** optimize DB for non-technical operators. It remains an admin/automation workbook.

---

## Phase 5 — Second-pass refinements on CS / Executive

**Why last:**
- They already have baseline + advanced UX.
- Refinements are now lower ROI than bringing other workbooks to parity.

### Candidate refinements
- Hide helper/source columns in CS review tabs where safe.
- Reorder operator-editable columns closer to the left if that does not break publish assumptions.
- Add legend/README or notes for color meanings.
- Add top summary blocks for Executive if leadership wants an even more dashboard-like layout.
- Translate remaining operator-facing English-like value labels (for example `suggested_action` values) into Japanese display text where safe, while preserving machine-safe underlying keys if writeback depends on them.
- Normalize README tone so each role workbook feels closer to the legacy `__README` experience: direct Japanese guidance, reading order, and clear “what to edit / what not to edit” language.

---

## Reference patterns to adopt from the legacy workbook

### Adopt
- `__README` as an explicit landing/guide surface.
- Role-first tab naming that mirrors the operator’s actual job, not internal schema.
- Japanese operational phrasing over developer terminology.
- Workbook-level mental model: sales / concierge / receiver / payments / coach / templates / summaries.
- Strong distinction between daily work tabs and reference/admin tabs.

### Do not adopt directly
- Cross-sheet formula webs as the primary system contract.
- Column-position/version-offset branching (`v2.4`, `+2 shift`, etc.).
- Treating the workbook itself as the source of truth.
- Upgrade-by-accumulated one-off patch functions as the long-term maintenance model.

### Translate into the Potex managed-workbook model
- Keep canonical DB + publish/writeback architecture.
- Add legacy-style operator affordances only at the workbook surface:
  - README-first guidance,
  - Japanese wording,
  - clear role-specific tabs,
  - visible reading order,
  - clear editable vs read-only boundaries.

---

## Execution Tasks

### Task 1: Capture baseline parity gaps for untouched workbooks

**Objective:** Produce a concise matrix of Sales / Coaches / Concierge sheets that still lack frozen rows, filters, and conditional formatting.

**Files:**
- Update: `docs/plans/2026-05-22-workbook-ux-priority-plan.md`
- Optional scratch: local inspection script only if needed

**Verification:**
- Confirm every untouched sheet has baseline metadata recorded.

### Task 2: Implement Sales baseline UX

**Objective:** Bring all Sales tabs to minimum parity with CS/Executive baseline UX.

**Files:**
- No repo code required if using direct Sheets API
- If automation should be codified long-term, add helper in `potex-gas` or local admin script later

**Verification:**
- All Sales tabs show frozen header, filters, tab color, and sensible column widths.

### Task 3: Implement Sales advanced signal formatting

**Objective:** Make Sales immediately readable for daily revenue operations.

**Verification:**
- `営業_未入金一覧` and `営業_契約一覧` visually distinguish urgent vs normal vs resolved-looking rows.
- `営業_データ状況` highlights unmatched/problem metrics.

### Task 4: Implement Coaches baseline UX

**Objective:** Bring all Coach tabs to baseline parity.

**Verification:**
- All Coach tabs show frozen header, filters, and readable widths.

### Task 5: Implement Coaches advanced readability formatting

**Objective:** Make long alert comments and coach workload signals easy to scan.

**Verification:**
- `コーチ_要フォロー一覧` comments wrap cleanly and keep identifiers visible during scroll.
- `コーチ_担当負荷` visibly flags overloaded/low-capacity coaches.

### Task 6: Implement Concierge baseline + advanced UX

**Objective:** Improve concierge read-only follow-up interpretation surfaces.

**Verification:**
- `コンシェルジュ_フォロー一覧` is readable and prioritized.
- `コンシェルジュ_データ状況` has signal-style formatting.

### Task 7: Implement DB admin readability pass

**Objective:** Improve admin/debugging ergonomics without turning DB into an operator UI.

**Verification:**
- `Sync_Log` / `Sync_Control` / `Publish_Manifest` / key exception tabs become easier to inspect.

### Task 8: Re-evaluate CS / Executive for second-pass refinements

**Objective:** Only after parity is reached elsewhere, decide if hiding/reordering columns is worth the risk.

**Verification:**
- Explicit yes/no decision per candidate refinement.

---

## Recommended immediate next action

**Start with `Potex Sales`.**

It is the highest remaining leverage because:
- untouched UX baseline,
- direct revenue/payment visibility,
- clear priority signals already present in the data,
- lower structural risk than reworking CS again.

---

## Success Criteria

A workbook is considered “UX-complete enough” when:
- headers are frozen,
- key identifying columns are frozen,
- filters exist,
- actionable rows have clear color cues,
- long text wraps where needed,
- metric summary tabs use red/green/neutral signals,
- operators can tell **where to look first** within 3 seconds.
