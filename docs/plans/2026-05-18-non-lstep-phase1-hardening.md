# Non-LStep Phase 1 Hardening Implementation Plan

> **For Hermes:** Use subagent-driven-development skill if this plan turns into code-heavy implementation. For now, this is a low-risk documentation/inspection slice that can be executed directly.

**Goal:** Progress Potex Phase 1 while LStep/TimeRex/marketing-CS workflow decisions are intentionally parked.

**Architecture:** Keep `POTEX DB` as the only canonical database. Do not modify source/reference workbooks. Focus on runbook consistency, operator-facing documentation, and inspectability around already-built CS/Executive/Concierge surfaces.

**Tech Stack:** Google Sheets, Apps Script (`potex-gas`), Python Google Sheets API inspection scripts, Markdown runbooks.

---

## Scope

### In scope
- Clarify that LStep/TimeRex/marketing-CS automation is parked until business workflow confirmation.
- Harden Phase 1 cutover runbook around already-provisioned workbooks.
- Update sheet reference/operator docs for currently live CS/Executive/Concierge surfaces.
- Add a deterministic post-refresh inspection checklist that does not depend on `clasp run`.
- Clean stale backlog statements that assume old P1/P2/P3 payment queue counts before latest publish.

### Out of scope
- LStep API / webhook / TimeRex integration.
- Slack reporting workflow change.
- Automatic LStep writeback.
- Source workbook mutation.
- Operator approval of alias/payment rows before fresh publish verification.

---

## Task 1: Mark LStep/TimeRex path as parked

**Objective:** Prevent accidental implementation against an unconfirmed marketing-CS workflow.

**Files:**
- Modify: `docs/backlog.md`
- Modify: `agents/session.md`
- Modify: `CLAUDE.md`

**Steps:**
1. Add a short note that LStep/TimeRex/marketing-CS workflow is intentionally parked.
2. State that current spreadsheet readers remain thin and replaceable.
3. State that no LStep writeback/API work should start until plan/option/API/TimeRex requirements are confirmed.
4. Verify by searching for `LStep/TimeRex` and `parked` in docs.

**Verification:**
```bash
python - <<'PY'
from pathlib import Path
for p in ['docs/backlog.md','agents/session.md','CLAUDE.md']:
    text = Path(p).read_text(encoding='utf-8')
    assert 'LStep' in text
print('ok')
PY
```

---

## Task 2: Finalize Phase 1 cutover runbook for current reality

**Objective:** Make the runbook match the current deployed state and known CLI limitations.

**Files:**
- Modify: `PHASE1_CUTOVER_RUNBOOK.md`

**Steps:**
1. Add a subsection under final full refresh noting that CLI `clasp run runFullRefresh` may be blocked by local OAuth scopes.
2. Document fallback verification path using Google Sheets API inspection and existing Python scripts.
3. Add current required checks:
   - `Customer_Acquisition_Source` absent.
   - `経営_データ状況` / `コンシェルジュ_データ状況` acquisition metrics present after publish.
   - `CS_入金名寄せ確認` header is not blank/stale before approval.
   - `CS_継続名寄せ確認` existence/row count is checked after publish.
4. Do not add manual UI steps except where unavoidable; prefer script-based inspection.

**Verification:**
- Search runbook for `clasp run`, `Customer_Acquisition_Source`, `CS_入金名寄せ確認`.

---

## Task 3: Update sheet reference for current CS review tabs

**Objective:** Ensure non-technical operators know which tabs are read-only and which columns are editable.

**Files:**
- Modify: `docs/sheet-reference.md`
- Modify: `OPERATIONS_MANUAL.md`

**Steps:**
1. Add entries for `CS_入金名寄せ確認` and `CS_継続名寄せ確認` to sheet reference if missing.
2. For each tab, list editable columns only:
   - `operator_decision_status`
   - `operator_selected_customer_id`
   - `operator_selected_customer_name`
   - `operator_note`
3. Add warning: do not approve rows before fresh publish verification if header/priority counts look stale.
4. Add note that publish columns must not be edited.

**Verification:**
- Search for both tab names in `docs/sheet-reference.md` and `OPERATIONS_MANUAL.md`.

---

## Task 4: Add post-refresh inspection script/report plan

**Objective:** Make post-refresh verification repeatable even when Apps Script execution API is blocked locally.

**Files:**
- Create or modify: `inspect_post_refresh_state.py` or extend `inspect_phase1_operability.py`
- Output: `generated/post_refresh_state.json`

**Steps:**
1. Read IDs from `generated/phase1_script_properties.json`.
2. Use `~/.hermes/google_token.json` with Google Sheets API.
3. Collect:
   - workbook tab presence
   - `Customer_Acquisition_Source` absence
   - `経営_データ状況` metrics
   - `コンシェルジュ_データ状況` metrics
   - `CS_入金名寄せ確認` header and priority counts
   - `CS_継続名寄せ確認` presence and priority counts
4. Emit JSON report with timestamp and verdicts.
5. Keep it read-only.

**Verification:**
```bash
python inspect_post_refresh_state.py
python -m json.tool generated/post_refresh_state.json >/dev/null
```

---

## Task 5: Build/push after documentation or code changes

**Objective:** Ensure no TypeScript regression if code was touched.

**Files:**
- `potex-gas/src/**` only if code changes are made.

**Steps:**
1. If only Markdown changed, no GAS push is needed.
2. If TypeScript changed:
   ```bash
   cd potex-gas
   npm run build
   npm run push
   ```
3. Record build/push result in `agents/session.md`.

**Verification:**
- `npm run build` passes when code changed.

---

## Task 6: Update backlog/session closeout

**Objective:** Leave the project resumable.

**Files:**
- Modify: `agents/session.md`
- Modify: `docs/backlog.md`

**Steps:**
1. Mark the non-LStep hardening slice as completed or in-progress with clear next step.
2. Keep LStep/TimeRex under parked / needs-confirmation.
3. Record which verification remains dependent on next live full refresh/publish.
4. Ensure next priorities do not tell operators to approve stale rows.

**Verification:**
- Read `agents/session.md` and `docs/backlog.md` around priority sections.

---

## Exit Criteria

- LStep/TimeRex work is explicitly parked in docs.
- Phase 1 runbook includes current post-refresh checks and CLI limitation.
- Sheet reference covers both payment and continuation alias review tabs.
- A repeatable read-only inspection path exists or is planned with exact output path.
- Backlog/session next steps are safe and non-stale.
