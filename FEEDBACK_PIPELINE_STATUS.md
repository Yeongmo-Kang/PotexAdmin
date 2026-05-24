# Potex Feedback Pipeline Status

## What was implemented

### Source ingested
- Google Form responses workbook: `月次振り返りアンケート （回答）`
- Tabs:
  - `通常月用`
  - `（最終月用）`

### New / updated workbook tabs
- `Feedback` (canonical)
- `Ops_Feedback_Review`
- `Exceptions_FeedbackMatch` (Staging_Feedback 흡수 후 raw 응답 직접 적재; P-012 Phase 2 step 2d, 2026-05-20)

## Current pipeline behavior

### 1. Source -> Canonical (no staging)
ingest reads form responses → applies coach/customer normalization → 매칭 성공 행은 `Feedback`, 실패 행은 `Exceptions_FeedbackMatch`에 직접 적재. dedupe key는 `response_id = resp_{12hex}` (SHA-256 hash). `Exceptions_FeedbackMatch`는 alias 승인 시 csWriteback이 promote할 수 있도록 모든 raw 응답 컬럼(`coach_id`, `feedback_type`, `satisfaction_score`, `nps_score`, `nps_category`, `progress_score`, `expectation_score`, `community_score`, `q_gap`, `free_comment`)을 보존한다.

### 2. Coach normalization
Coach names are resolved through `Coach_Alias_Map`, so variants like:
- `坂本` -> `坂本直樹`
- `稲川コーチ` -> `稲川 雄介`
- `小島さん` -> `小島立照`
- `長坂ヒロコーチ` -> `長坂ヒロ`
are already absorbed.

### 3. Customer matching
Customer matching currently uses:
- exact normalized email
- exact normalized name
- name + assigned coach disambiguation

### 4. Canonical feedback table
`Feedback` is now populated from normalized form responses.

### 5. Operational sheet
`Ops_Feedback_Review` is now available as the first feedback operations view.
It can already support:
- low-satisfaction review
- follow-up queue review
- coach-based feedback checks

### 6. Exception queue
Unmatched feedback rows are written to `Exceptions_FeedbackMatch`.

## Current stats (post-acceptance, 2026-05-19)
- total form responses ingested: `58`
- coach matched: `58 / 58`
- customer matched: `58 / 58` (after `知子佐藤 -> CUST-0065 / 佐藤知子` alias approval)
- `Exceptions_FeedbackMatch`: `0` rows
- `CS_別名解決入力`: `0` rows
- low-satisfaction rows: `11`
- needs-followup rows: `18`

## Known current gap
Feedback pipeline itself has no unresolved match. The active CS alias review queues have moved downstream to:
- `CS_入金名寄せ確認` (`P1=39`, payment unmatched) — operator approval pending
- `CS_継続名寄せ確認` (`P1=10`, continuation unmatched) — operator approval pending

Both run the same operator approval → `Customer_Alias_Map` writeback → canonical refresh → republish chain. See `OPERATIONS_MANUAL.md` Section 3.2 / 4 / 6.

## Important caveat
The form structure appears to have changed over time.
For some responses, trailing NPS / satisfaction columns are absent in the raw row values, so not every record currently has both:
- `satisfaction_score`
- `nps_score`

The pipeline still captures:
- progress score
- expectation score
- comment/gap text
- follow-up flags

But score completeness may improve if we later inspect historical form schema evolution more deeply.

## Status of earlier recommended next build steps
All four items in the original recommendation list have shipped:

1. **Customer alias resolution via GAS** — DONE. `CS_別名解決入力` → `Customer_Alias_Map` writeback live; same pattern extended to `CS_入金名寄せ確認` (`source=cs_payment_alias_review`) and `CS_継続名寄せ確認` (`source=cs_continuation_alias_review`). `runWritebackCollection` chains `refreshCanonicalStaging` + 5-workbook republish automatically (`potex-gas/src/main.ts:38-56`).

2. **Canonical `Plans` / `Payments`** — DONE. Live counts: `Plans=228`, `Payments=136`, `Staging_Payments=136`, `ConversionHistory=543+`. Continuation ingest uses alias-aware matching.

3. **Operational views from canonical data** — DONE. `Ops_コーチ_担当負荷` / `Ops_Followup_Queue` / `Ops_Continuation_Targets` all carry Phase 1 **accept** verdict.

4. **Refresh automation beyond feedback** — DONE. Apps Script triggers live: publish 1h, writeback collection 30m, full refresh daily 07:00 JST. `runFullRefresh()` covers customer + feedback + commercial + LINE registration ingest.

## Current focus
- Operator approval against `CS_入金名寄せ確認` (P1=39) and `CS_継続名寄せ確認` (P1=10)
- E2E verification that approval → writeback → republish removes the row within one writeback cycle (~30m)
- Cadence fine-tuning only after operator activity data accumulates
