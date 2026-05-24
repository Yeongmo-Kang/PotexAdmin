# Potex Executive Data Trust & Freshness Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Make the Executive workbook safe for daily management meetings by showing not just the current numbers, but also whether those numbers are fresh, where updates may be missing, and which operational area is likely causing mismatch risk.

**Architecture:** Keep the existing Potex canonical DB + publish model. Do **not** turn the Executive workbook into another calculation-heavy spreadsheet. Instead, compute trust/freshness indicators in Apps Script during publish, render them as explicit management-facing signals, and preserve the legacy workbook’s strong Japanese, role-based, easy-to-read UX. When human update omissions are the reason numbers drift, expose the omission itself as a first-class signal.

**Tech Stack:** Google Apps Script (`potex-gas/src/`), existing publish pipeline (`publish/managementWorkbook.ts`, `publish/views.ts`), `Sync_Log`, canonical tables in `POTEX DB`, managed workbook manifest (`workbook_manifest.json`).

**Repo Rule:** Treat GitHub `origin/main` as the primary source of truth for this plan and its follow-up implementation. The local workspace copy is a working tree / backup, not the primary handoff surface.

---

## Why this plan exists

The user’s requirement is now explicit:

1. The workbook should remain easy for real operators and executives to read.
2. Executives use the workbook in **daily meetings**.
3. One cause of bad decisions is that **displayed numbers do not always match reality**.
4. Another important cause is **human update omission** — some operators fail to update their area on time.
5. Before or during a management meeting, the workbook should make it easy to see:
   - whether the numbers are fresh enough to trust,
   - which area is likely stale,
   - and how to interpret numbers if an update was likely missed.

This means the Executive workbook must move from a passive KPI view to a **decision-support + trust-status view**.

---

## Existing implementation we should build on

The current code already has useful foundations:

- `potex-gas/src/publish/managementWorkbook.ts`
  - publishes `経営_使い方`, `経営_コーチ負荷`, `経営_顧客リスク`, `経営_データ状況`, `経営_例外推移`
- `potex-gas/src/publish/views.ts`
  - `buildExecReadme()` already defines a management reading order
  - `buildExecDataHealth()` already emits canonical/exception health metrics
  - `buildExecExceptionTrend()` already emits daily trend snapshots from `Sync_Log`
  - there is already a working pattern for “stale” logic in partner assignment metrics (`partner_stale_30d_count`)
- `potex-gas/src/logging.ts`
  - `Sync_Log` exists and is already operator-readable
  - publish/writeback/full refresh success timestamps are already available

This plan extends those foundations instead of inventing a parallel reporting system.

---

## Product outcome

After implementation, the Executive workbook should let a manager answer these questions in under 60 seconds:

1. **Are today’s numbers fresh enough to use?**
2. **If not, which domain is stale?**
   - sales / payments / CS review / coach assignment / partner status / line registration / feedback / continuation
3. **Is the issue automation failure, sync lag, or human update omission?**
4. **What is the likely decision bias if we proceed anyway?**
   - e.g. “payments likely underreported”, “follow-up queue likely understated”, “partner progress likely stale”
5. **What should the operator check first after the meeting?**

---

## UX contract

We are preserving the legacy workbook’s strengths while improving trust.

### Keep
- Japanese role-based naming
- README-first guidance
- easy visual scanning
- manager-facing summaries instead of raw DB surfaces

### Add
- a top-level “meeting trust” view
- freshness timestamps
- stale-domain warnings
- explicit “likely missing update” hints
- simple interpretation notes for executives

### Do not add
- giant explanation walls
- raw technical debug output on executive tabs
- formula webs in the workbook itself
- spreadsheet-as-database behavior

---

## New Executive surfaces to add

### 1. `経営_更新状況`
Purpose: a meeting-prep and live-meeting freshness panel.

Expected columns:
- `domain`
- `status`
- `last_effective_update_at_jst`
- `expected_cadence`
- `stale_threshold`
- `stale_by`
- `likely_issue_type`
- `likely_decision_risk`
- `recommended_check`

Example domains:
- `commercial_payments`
- `sales_funnel`
- `cs_alias_review`
- `cs_continuation_review`
- `feedback_followup`
- `coach_assignment`
- `partner_status`
- `line_registration`
- `publish_pipeline`

### 2. `経営_会議前チェック`
Purpose: a short red/orange/green checklist for the meeting owner.

Expected rows:
- Executive publish freshness OK?
- Full refresh freshness OK?
- Writeback freshness OK?
- Any stale domains above threshold?
- Any unresolved mismatch-risk domains?
- Any domains likely underreported due to missed updates?

### 3. Expansion of `経営_データ状況`
Purpose: keep it as the stable KPI/health summary, but add trust-facing metrics.

Add metrics like:
- `last_publish_success_at_jst`
- `last_full_refresh_success_at_jst`
- `last_writeback_success_at_jst`
- `stale_domain_count`
- `stale_high_risk_domain_count`
- `meeting_risk_status`
- `domains_with_likely_human_update_omission`

---

## Freshness model

We need an explicit freshness policy instead of implicit guessing.

### Domain freshness policy
Implement a small config object in code that defines, per domain:
- anchor source(s)
- timestamp field(s)
- fallback timestamp field(s)
- expected update cadence
- stale threshold
- risk note if stale

Example policy sketch:

```ts
{
  commercial_payments: {
    expectedCadenceHours: 24,
    staleThresholdHours: 36,
    anchor: 'Payments.updated_at || latest successful payment-related writeback/full refresh',
    likelyDecisionRisk: '売上・入金進捗が実態より低く見える可能性',
  },
  cs_alias_review: {
    expectedCadenceHours: 24,
    staleThresholdHours: 36,
    anchor: 'latest open review row updated/collected timestamp + latest writeback success',
    likelyDecisionRisk: '未紐づけ件数や保留件数が古いまま会議に出る可能性',
  },
  partner_status: {
    expectedCadenceHours: 24,
    staleThresholdHours: 72,
    anchor: 'last_partner_update_at || updated_at || assigned_at',
    likelyDecisionRisk: 'パートナー進捗が遅れて見える/進んで見える可能性',
  }
}
```

### Important distinction
The logic must distinguish between:

1. **Pipeline freshness**
   - Was publish/writeback/full refresh actually run?

2. **Operational data freshness**
   - Did humans actually update the operational source/canonical rows?

3. **Mismatch risk**
   - Even if publish ran, was the underlying business update omitted?

This is the core user requirement.

---

## Heuristic for “likely human update omission”

We cannot perfectly prove every omission, so we should implement explicit heuristics and label them honestly.

### Label vocabulary
Use user-friendly Japanese labels such as:
- `更新良好`
- `要確認（更新遅れの可能性）`
- `高リスク（会議前に確認推奨）`
- `自動更新は成功 / 元データ更新漏れの可能性`
- `自動更新自体が未実行の可能性`

### Omission heuristics
A domain should be flagged as likely human-update-omitted when:
- publish is fresh enough **but** domain anchor data is old,
- or row counts / queue states have not changed beyond expected cadence,
- or downstream summary is current but upstream action rows still look untouched,
- or “waiting first update” style metrics remain open longer than allowed,
- or unresolved/open review counts remain static across multiple successful runs.

### Decision-support requirement
When a domain is stale, we must show not only the stale state but also:
- **what is likely missing**
- **how that biases the displayed number**

Examples:
- payments stale → revenue/inflow may be undercounted
- partner stale → progress may be understated or frozen on old statuses
- CS review stale → unresolved alias/continuation queues may be larger than shown as “processed reality”

---

## Files to modify

### Primary code
- Modify: `potex-gas/src/constants.ts`
- Modify: `potex-gas/src/publish/views.ts`
- Modify: `potex-gas/src/publish/managementWorkbook.ts`
- Modify: `potex-gas/src/logging.ts`
- Modify: `workbook_manifest.json`

### Documentation
- Modify: `OPERATIONS_MANUAL.md`
- Modify: `docs/backlog.md`
- Modify: `agents/session.md`
- Create: `docs/plans/2026-05-24-executive-data-trust-and-freshness-plan.md`

### Optional if needed for formatting helpers
- Modify: `potex-gas/src/sheets.ts`

---

## Implementation phases

## Phase 0 — lock the vocabulary and signal contract

### Task 1: Define management trust vocabulary

**Objective:** Standardize the statuses and notes that executives will see so implementation does not drift into ad-hoc wording.

**Files:**
- Modify: `docs/plans/2026-05-24-executive-data-trust-and-freshness-plan.md`
- Modify later during implementation: `potex-gas/src/publish/views.ts`

**Steps:**
1. Define allowed `status` labels for freshness cards.
2. Define allowed `likely_issue_type` labels.
3. Define allowed `likely_decision_risk` note patterns.
4. Keep them short, Japanese, and executive-readable.

**Verification:**
- The plan contains a stable vocabulary list.
- No ambiguous English-like machine wording is exposed to managers.

### Task 2: Define domain freshness policy table

**Objective:** Decide which domains appear in `経営_更新状況` and what timestamp/threshold logic each uses.

**Files:**
- Modify later during implementation: `potex-gas/src/publish/views.ts`
- Reference: `potex-gas/src/publish/managementWorkbook.ts`

**Steps:**
1. List the executive-relevant domains.
2. For each, define:
   - source rows
n   - primary timestamp fields
   - fallback timestamp fields
   - expected cadence
   - stale threshold
   - decision-risk note
3. Keep policy in one central constant.

**Verification:**
- Every domain in the new executive view has a deterministic source and threshold.

---

## Phase 1 — add freshness computation helpers

### Task 3: Add date/freshness utility helpers to `views.ts`

**Objective:** Implement generic helpers for “hours since”, “latest usable timestamp”, and freshness classification.

**Files:**
- Modify: `potex-gas/src/publish/views.ts`

**Steps:**
1. Add helpers to parse timestamps from row fields safely.
2. Add a helper to compute the latest timestamp across multiple candidate fields.
3. Add a helper that returns:
   - latest timestamp
   - age
   - stale flag
   - stale severity
4. Reuse the existing `daysSince` / date formatting patterns where possible.

**Verification:**
- Helpers can be used by both `経営_更新状況` and `経営_会議前チェック`.
- No per-domain copy-paste date logic spreads across the file.

### Task 4: Add `Sync_Log` extraction helpers for latest successful job timestamps

**Objective:** Expose the newest successful publish, full refresh, and writeback timestamps cleanly.

**Files:**
- Modify: `potex-gas/src/publish/views.ts`
- Reference: `potex-gas/src/logging.ts`

**Steps:**
1. Parse `Sync_Log` rows once into reusable job summaries.
2. Add helpers for:
   - latest `runPublishAll` success
   - latest `runFullRefresh` success
   - latest `runWritebackCollection` success
3. Return formatted JST strings for display.

**Verification:**
- The new helpers reuse the same source of truth as `buildExecExceptionTrend()`.
- Timestamps are stable and displayable in executive-facing tabs.

---

## Phase 2 — build new executive trust views

### Task 5: Add new view constants

**Objective:** Register the new executive sheets in one place.

**Files:**
- Modify: `potex-gas/src/constants.ts`
- Modify: `workbook_manifest.json`

**Steps:**
1. Add `VIEWS.EXEC_UPDATE_STATUS = '経営_更新状況'`.
2. Add `VIEWS.EXEC_MEETING_CHECK = '経営_会議前チェック'`.
3. Add the sheets to the workbook manifest for Executive workbook provisioning.

**Verification:**
- The workbook can auto-create both tabs during publish.

### Task 6: Implement `buildExecUpdateStatus()`

**Objective:** Create the main executive freshness/status table.

**Files:**
- Modify: `potex-gas/src/publish/views.ts`

**Steps:**
1. Create the header:
   - `domain`, `status`, `last_effective_update_at_jst`, `expected_cadence`, `stale_threshold`, `stale_by`, `likely_issue_type`, `likely_decision_risk`, `recommended_check`
2. Implement one row per domain using the freshness policy.
3. Distinguish:
   - publish stale
   - writeback stale
   - source-data stale
   - likely human omission
4. Make the notes human-readable and meeting-oriented.

**Verification:**
- The resulting tab can be read top-to-bottom without opening DB tabs.
- A manager can identify the likely stale area in under 1 minute.

### Task 7: Implement `buildExecMeetingCheck()`

**Objective:** Create a short meeting gate/checklist that says whether to trust today’s meeting deck.

**Files:**
- Modify: `potex-gas/src/publish/views.ts`

**Steps:**
1. Add checklist rows such as:
   - publish freshness
   - full refresh freshness
   - writeback freshness
   - stale domains present?
   - high-risk stale domains present?
   - likely human-update omissions present?
2. Add a final synthesized overall status:
   - `GO`
   - `GO_WITH_CAUTION`
   - `CHECK_BEFORE_MEETING`
3. Add one short interpretation line for executives.

**Verification:**
- A meeting owner can decide whether to proceed as-is or verify numbers first.

### Task 8: Extend `buildExecDataHealth()` with trust metrics

**Objective:** Keep the existing KPI/health table, but add meeting trust metrics to it.

**Files:**
- Modify: `potex-gas/src/publish/views.ts`

**Steps:**
1. Add publish/writeback/full-refresh latest success timestamps.
2. Add stale-domain counters.
3. Add likely-human-omission counters.
4. Add a summary `meeting_risk_status` metric.

**Verification:**
- `経営_データ状況` remains compact but now reflects trust state, not only raw counts.

---

## Phase 3 — wire the new views into publish

### Task 9: Update `publishExecutiveWorkbook()`

**Objective:** Publish the new management trust tabs alongside existing executive tabs.

**Files:**
- Modify: `potex-gas/src/publish/managementWorkbook.ts`

**Steps:**
1. Read any additional source rows required for freshness heuristics.
2. Call:
   - `buildExecUpdateStatus(...)`
   - `buildExecMeetingCheck(...)`
3. `clearAndRewrite()` them into the Executive workbook.
4. Keep the existing publish order sensible:
   - `経営_使い方`
   - `経営_会議前チェック`
   - `経営_更新状況`
   - `経営_データ状況`
   - `経営_例外推移`
   - detail tabs

**Verification:**
- A single publish run creates and fills the new tabs.
- The reading order matches the README guidance.

### Task 10: Update `buildExecReadme()` reading order

**Objective:** Make the Executive README explicitly point managers to freshness/trust first.

**Files:**
- Modify: `potex-gas/src/publish/views.ts`

**Steps:**
1. Change `read_first` to:
   - `経営_会議前チェック`
   - then `経営_更新状況`
   - then `経営_データ状況`
   - then `経営_例外推移`
2. Add one line explaining that stale warnings may reflect human update omission, not just automation failure.

**Verification:**
- The README matches the new management workflow.

---

## Phase 4 — make omission risk easier to interpret

### Task 11: Add domain-specific “likely decision bias” notes

**Objective:** Help executives reason safely even when updates are missing.

**Files:**
- Modify: `potex-gas/src/publish/views.ts`

**Steps:**
1. For each stale domain, add a short bias note.
2. Keep the notes specific and practical.

Example patterns:
- payments stale → `入金実績は実態より少なく見える可能性`
- partner stale → `進捗停滞に見えるが未更新の可能性`
- CS review stale → `未解決件数は見えている数より多い可能性`
- followup stale → `顧客リスクは実態より過少表示の可能性`

**Verification:**
- A manager can understand how to discount the number, not just that it is stale.

### Task 12: Add recommended check pointers

**Objective:** Point operators to the likely fix location quickly.

**Files:**
- Modify: `potex-gas/src/publish/views.ts`

**Steps:**
1. For each domain, expose a `recommended_check` field.
2. Use workbook/tab-oriented guidance, not technical internals.

Examples:
- `Potex CS > CS_入金名寄せ確認 / writeback 実行履歴`
- `POTEX DB > Sync_Log`
- `担当者の元シート更新漏れ確認`
- `partner status 入力欄 / last_partner_update_at`

**Verification:**
- The executive workbook itself is enough to triage the next check owner.

---

## Phase 5 — formatting and operator clarity

### Task 13: Add clear status-first formatting to the new tabs

**Objective:** Make the new executive trust tabs readable in daily meetings.

**Files:**
- Modify if needed: `potex-gas/src/sheets.ts`
- Modify if needed: any existing workbook formatting helper used for Executive workbook

**Steps:**
1. Freeze headers.
2. Add filters.
3. Apply tab color.
4. Add conditional formatting:
   - red for high-risk stale
   - orange for warning
   - green for healthy
5. Widen note columns for management readability.

**Verification:**
- The new tabs are scannable during a live meeting without horizontal struggle.

---

## Phase 6 — docs and rollout

### Task 14: Update `OPERATIONS_MANUAL.md`

**Objective:** Explain how to interpret freshness warnings and omission-risk signals.

**Files:**
- Modify: `OPERATIONS_MANUAL.md`

**Steps:**
1. Add sections for `経営_会議前チェック` and `経営_更新状況`.
2. Explain the difference between:
   - automation lag
   - sync lag
   - human update omission
3. Add “what to do before the meeting” and “what to do after the meeting” guidance.

**Verification:**
- A non-technical operator can explain a stale warning to management.

### Task 15: Update session/backlog state

**Objective:** Preserve the plan and mark the new workstream clearly.

**Files:**
- Modify: `docs/backlog.md`
- Modify: `agents/session.md`

**Steps:**
1. Add this effort as an active or next-priority executive reliability workstream.
2. Note the new user requirement explicitly: update omissions must be visible before/during meetings.
3. Record the intended workbook surfaces.

**Verification:**
- The next session can resume implementation without rediscovering the problem statement.

---

## Acceptance checklist

Implementation is complete only when all are true:

- [ ] Executive workbook has a `経営_会議前チェック` tab.
- [ ] Executive workbook has a `経営_更新状況` tab.
- [ ] README reading order points to freshness/trust first.
- [ ] `経営_データ状況` includes trust/freshness metrics.
- [ ] Stale-domain detection distinguishes pipeline freshness from human update omission.
- [ ] Each stale domain includes a likely decision-risk note.
- [ ] Each stale domain includes a recommended next check.
- [ ] New tabs are visually scannable in a live meeting.
- [ ] Runbooks explain how to interpret the warnings.

---

## Verification plan

### Functional verification
1. Run publish.
2. Confirm new tabs exist in `Potex Executive`.
3. Confirm values populate without formulas in the workbook surface.
4. Confirm README references the new tabs.

### Behavior verification
1. Simulate stale publish / stale writeback / stale source updates.
2. Confirm status labels change correctly.
3. Confirm likely issue type changes correctly.
4. Confirm decision-risk notes match the domain.

### Meeting usability verification
1. Open only the Executive workbook.
2. Check whether a human can answer within 1 minute:
   - are numbers trustworthy?
   - what is stale?
   - what decision caveat applies?
   - what should be checked next?

---

## Recommended implementation order

1. Task 5 — add constants/manifest
2. Task 3 — freshness utility helpers
3. Task 4 — Sync_Log timestamp helpers
4. Task 6 — `buildExecUpdateStatus()`
5. Task 7 — `buildExecMeetingCheck()`
6. Task 8 — extend `buildExecDataHealth()`
7. Task 9 — wire publish flow
8. Task 10 — update README reading order
9. Task 11 — decision-bias notes
10. Task 12 — recommended check hints
11. Task 13 — formatting
12. Task 14/15 — docs and state updates

---

## Final implementation note

This feature should be treated as a **decision safety system**, not a cosmetic reporting enhancement. The user’s core concern is not merely “better dashboard UX,” but preventing managers from making the wrong call because:

- the displayed number is stale,
- the automation ran but the operators did not update their part,
- or the workbook hides the omission instead of surfacing it.

That requirement must stay visible in every implementation choice.
