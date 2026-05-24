# Claude → Hermes Handoff (2026-05-21)

이전 baseline: `agents/handoffs/2026-05-19-hermes-to-claude-prompt.md` (D-002 cleanup으로 디렉토리 자체가 한 번 삭제됨. 이 문서로 핸드오프 라인 재시작.)

대상 기간: 2026-05-19 baseline 이후 → 2026-05-21까지 Claude 세션이 처리한 모든 작업.

---

## 1. 워크북 / 데이터 현황 (변동 없음)
- Publish 5종 (`POTEX DB` / `Potex CS` / `Potex Executive` / `Potex Concierge` / `Potex Sales` / `Potex Coaches`) 전부 live.
- Trigger: publish 1h / writeback 30m / full refresh daily 07:00 JST.
- 통합 데이터 (POTEX DB):
  - Customers 224 / Coaches 38 / Feedback 58 (58/58 matched) / Plans 228 / Payments 136 (unmatched 39) / ConversionHistory 660 / Line_Registrations 10,675.
- Sales: Contracts 136 / Pending 85 / Funnel 660 / Health 8.
- Coach: Load 38 / Followup 18 / Health 6.
- Operator approval 큐: `CS_入金名寄せ確認` P1=39 / `CS_継続名寄せ確認` P1=10 (대기, 코드 게이트는 모두 열림).

---

## 2. 이번 세션 변경 사항 요약 (2026-05-19 → 2026-05-21)

### 2.1 D-002 — Project cleanup (2026-05-20, push 완료)
- DEPRECATED Python 스크립트 10개 / 구식 root 문서 7개 / 빈 dir 5개 / handoff 8개 (이전 hermes-claude 핸드오프 포함) / .hermes/plans 2개 / 일회성 snapshot 10개 제거.
- `main.ts` publish-all 헬퍼 + `views.ts` `isPaid()` 헬퍼 추출.
- `constants.ts`의 미사용 `OPS_ZERO_SESSION_REVIEW` 제거.
- `PHASE1_CUTOVER_RUNBOOK.md`는 historical reference 형태로 축약.
- **주의**: handoff 8개가 이 단계에서 삭제됨 → 본 문서가 새로운 핸드오프 1호.

### 2.2 D-003 — Operator-facing column reorder + DB audit columns (2026-05-20, push 완료)
- 11개 publish view header를 `priority → action context → input → source/audit at end` 패턴으로 재배열.
  - 대상: `CS_要フォロー一覧` / `CS_継続対象一覧` / `CS_別名解決入力` / `CS_入金名寄せ確認` / `CS_継続名寄せ確認` / `営業_契約一覧` / `営業_未入金一覧` / `営業_ファネル推移` / `経営_コーチ負荷` / `コーチ_担当負荷` / `コーチ_要フォロー一覧` / `コンシェルジュ_フォロー一覧`.
- DB canonical 7종 (`Staging_Customers` / `Staging_Feedback` / `Staging_Payments` / `Staging_LineRegistration` / `Feedback` / `Exceptions_FeedbackMatch` / `Exceptions_ContinuationMatch`)에 `created_at` / `updated_at` 우측 끝 추가 (`syncedAt` 한 시점으로 thread). 빌드 158.2kb.

### 2.3 D-004 — DB 전체 created_at/updated_at 강제 (2026-05-20, push 완료)
- `Customer_Alias_Map` / `Ops_Feedback_Review` (pipeline-managed) header 상수에 두 컬럼 추가 + writeback에서 기존 row의 `created_at` 보존 / 신규 row는 `syncedAt`.
- 수동 maintained 시트 8종 (`Customers` / `Coaches` / `Sessions` / `Coach_Alias_Map` / `Customer_Alias_Map` / `Ops_Followup_Queue` / `Ops_コーチ_担当負荷` / `Ops_Continuation_Targets`)에 `ensureAuditColumns()` migration 추가 — `refreshCanonicalStaging()` 진입 시 컬럼이 없으면 우측 끝에 append + 빈 셀 `syncedAt` backfill (idempotent).
- `Sync_Log`은 append-only로 `timestamp`가 created_at 역할 → 제외.
- DB schema 문서 신설: `docs/db-schema.md`. 빌드 161.0kb.

### 2.4 D-005 — "DB가 원본" 1차 cleanup (2026-05-20, push 완료 + 운영자 runFullRefresh 완료)
- canonical 표에서 raw source 좌표 trace 제거:
  - `Customer_Coach_Assignments` / `Customer_Channel_Links` 헤더에서 `source_sheet`/`source_row` 삭제.
  - `Plans` / `Payments` `note`에서 `source=...` 제거.
  - `ConversionHistory.note` 9곳 `source=...` 제거 (`changed_by`가 도메인 전달).
- `Feedback` / `Exceptions_*` 의 source 좌표는 dedupe/evidence 키로 필요해 일단 보존 → P-012 Phase 2에서 재설계.
- `docs/db-schema.md` 전면 재작성 (role-centric, plain language). 빌드 160.0kb.

### 2.5 P-012 — Staging cutover spec + 운영팀 회답 7건 (2026-05-20)
- spec: `docs/plans/2026-05-20-staging-cutover.md` (4 staging × 4 phase 분리).
- 운영팀 회답 결정:
  - Phase 1 (Line_Registrations) **착수 가능** — `line_user_id` 빈 행 0건 (Q-LR-1).
  - Phase 2 (Feedback) **착수 가능** — response_id hash 도입, source 좌표 완전 제거 (Q-FB-1/2).
  - Phase 3 (Payments) **보류** — 영업팀 자동화와 묶음, 별도 P-013로 분리 (Q-PY-1).
  - Phase 4 (Customers) **matrix 대기** — 사용자가 ownership matrix 직접 작성, `Customer_Edit_History` 동반 (Q-CU-1/2).
  - LStep API 보류 유지 (Q-LR-2).

### 2.6 P-012 Phase 1a/1b — Line_Registrations cutover (2026-05-20, push 완료)
- **1a**: `Line_Registrations` canonical 신설 (source 좌표 컬럼 제거, `line_registration_id` PK 안정). `Staging_LineRegistration`과 parallel write. line_registration event note `source=...` 제거. 빌드 161.4kb.
- **1b**: reader 4종 (`csWorkbook` / `conciergeWorkbook` / `managementWorkbook` / `views.ts`) `LINE_REGISTRATIONS`로 전환. `STAGING_LINE_REGISTRATION` constant / header export / `stagingLineRegistrations` LineOutputs 필드 / ingest staging 쓰기 전부 제거. `scoreLineCandidate` / `buildLineRegistrationLookup` / `buildCustomerChannelLinks` 새 필드명 (`line_registration_id` / `segment`)로 갱신. publish header `candidate_source_segment`/`candidate_source_sheet`/`candidate_source_row` → `candidate_segment` / `candidate_line_registration_id`로 재명명 (writeback header 동기). 빌드 159.8kb.
- 운영자 `runFullRefresh` 후 `Staging_LineRegistration` 시트 orphan → `dropOrphanStagingLineRegistration()` (Phase 2b에서 추가) 헬퍼로 1회 실행 완료.

### 2.7 P-012 Phase 2 step 2a — Feedback response_id additive (2026-05-20, push 완료)
- `Feedback` / `Staging_Feedback` / `Exceptions_FeedbackMatch` 헤더에 `response_id` 컬럼 추가 (additive).
- `buildResponseId(sourceSheet, submittedAt, respondentEmail, rawCoachName)` SHA-256 → `resp_{12자hex}`. ingest 모든 path에서 채움.
- source 좌표 보존, `feedbackKey()`/evidence 의미 미변경 (step 2b 분리). 빌드 160.7kb.

### 2.8 P-012 Phase 2 step 2b — feedbackKey 시그니처 변경 (2026-05-20, push 완료)
- `feedbackKey(responseId, sourceSheet, sourceRow, respondentEmail)` 시그니처 변경, response_id 우선 (`rid::{response_id}`), 빈 경우만 legacy source-coord fallback. 4 call sites 전환.
- `buildFeedbackRow`에 `response_id` 통과.
- `Customer_Alias_Map.evidence`는 alias resolution input 경로에서 `response:{response_id}` 형식 emit (payment/continuation 경로는 그대로 source-coord).
- `dropOrphanStagingLineRegistration()` 헬퍼 추가. **운영자 1회 실행 완료** — Staging_LineRegistration 시트 제거됨. 빌드 161.1kb.

### 2.9 P-012 Phase 2 step 2c — canonical cutover (2026-05-20, push 완료)
- `Feedback` / `Exceptions_FeedbackMatch` 헤더에서 `source_sheet` / `source_row` 제거.
- `feedbackKey()` → 1-arg `(responseId)` only. legacy fallback 제거.
- `opsKey()` 삭제 — Ops_Feedback_Review dedupe는 `feedback_id` 직접 비교.
- `CS_別名解決入力` 뷰 헤더에서 source 좌표 2 컬럼 제거. `aliasInputKey()` → `(response_id, alias_name)`.
- `buildFeedbackRow` / `buildOpsFeedbackRow` source 좌표 emit 제거.
- evidence: feedback 경로는 response_id 없으면 빈 `response:`로 emit (실데이터는 항상 채워짐).
- csWriteback `normalizeEmail`, views.ts `normalizeEmail` dead helper 정리. 빌드 159.8kb (-1.8kb).

### 2.10 P-012 Phase 2 step 2d — Staging_Feedback 시트 제거 (2026-05-20, push 완료)
- ingest가 raw 응답을 `Exceptions_FeedbackMatch`에 직접 적재.
- `Exceptions_FeedbackMatch` 헤더 확장: `coach_id` / `feedback_type` / `satisfaction_score` / `nps_score` / `nps_category` / `progress_score` / `expectation_score` / `community_score` / `q_gap` / `free_comment` 추가; `staging_feedback_id` 제거. → alias 승인 시 csWriteback이 exception row만으로 `Feedback`/`Ops_Feedback_Review` build 가능.
- csWriteback `stagingRows`/`stagingById` 룩업 블록 삭제. `buildFeedbackRow`/`buildOpsFeedbackRow` 파라미터 `staging` → `exc`.
- `STAGING_FEEDBACK_HEADER` 상수 / `SHEETS.STAGING_FEEDBACK` 키 삭제.
- ingest in-memory builder의 죽은 `staging_feedback_id` / `source_workbook` / `source_sheet` / `source_row` 필드 정리.
- `dropOrphanStagingFeedback()` 헬퍼 추가 (gas-entry + build-gas 등록). 빌드 159.0kb (-0.8kb).
- **운영자 실행 완료** — orphan `Staging_Feedback` 시트 제거됨.

### 2.11 P-012 Phase 2 post-cleanup (2026-05-20, push 완료)
- `buildStagingFeedback` → `buildFeedbackResponses` rename (이제 in-memory ingest pipeline, staging 아님).
- `buildFeedbackOutputs` 파라미터 `stagingRows` → `responseRows`.
- `Sync_Log` stats에 `feedbackResponseIdCollisions` 카운터 추가 (response_id SHA-256 hash 충돌 모니터링, 1 이상이면 즉시 조사).
- `経営_データ状況`에 `feedback_response_id_collision_count` metric 추가 (canonical Feedback rows sharing response_id, expected 0).
- 활성 docs 정리: `CLAUDE.md` / `OPS_WORKBOOK_ARCHITECTURE.md` / `docs/sheet-reference.md` / `docs/database-overview.md` / `potex-gas/README.md` / `FEEDBACK_PIPELINE_STATUS.md`에서 `Staging_Feedback` 잔재 제거. 빌드 160.0kb.

### 2.12 Sync_Log target fix (2026-05-20, push 완료)
- 운영자 검증에서 `POTEX DB > Sync_Log`가 비어 있는 버그.
- 원인: `appendSyncLog`가 `SpreadsheetApp.getActiveSpreadsheet()` 사용 → 트리거 컨테이너 바인딩에 따라 다른 워크북에 쓰거나 unbound 시 silent fail.
- 수정: `logging.ts` 재작성 — `PropertiesService.getScriptProperties().getProperty(PROPS.DB_SPREADSHEET_ID)` → `SpreadsheetApp.openById(dbId)` 명시적 POTEX DB target. active fallback + try/catch best-effort (logging 실패가 메인 잡 break 금지).
- clasp OAuth 만료(`invalid_grant`) → 재로그인 후 push 완료. 빌드 160.5kb.
- 5종 publish 워크북에 rogue `Sync_Log` 없음 확인 (운영자).

### 2.13 Sync_Log readability fix (2026-05-20, push 완료)
- 신규 append 확인되었으나 헤더 없음 + stats가 JSON blob 한 줄 → 가독성 낮음.
- `ensureSyncLogHeader()` 추가 — 첫 행이 `timestamp/job_name/status/stats`가 아니면 `insertRowBefore(1)` 후 setValues + `setFrozenRows(1)` (기존 데이터 행 보존).
- `formatStats()` — 키 알파벳 정렬 + `key=value` 줄바꿈 join (Sheets 셀 내 줄바꿈 표시).
- 빌드 161.7kb.

### 2.14 P-007 step 1 — docs 보강 + continuation_exception_id additive (2026-05-20, push 완료)
- `OPERATIONS_MANUAL.md` `経営_データ状況` 섹션 재작성: 카운트 / 예외-미매칭(4 sheets 매핑: `feedback_match_exception_count` → CS_別名解決入力; `payment_unmatched_count` → CS_入金名寄せ確認; `continuation_unmatched_count` → CS_継続名寄せ確認; `line_registration_unmatched_count` → customer ingest) / 데이터 무결성(`feedback_response_id_collision_count`, 0 expected) / acquisition.
- `Sync_Log` (POTEX DB) 운영자 가이드 섹션 신설 — job_name 목록, error 대응 흐름, response_id collision 확인 가이드, append-only 수정 금지.
- `Exceptions_ContinuationMatch` `CONTINUATION_EXCEPTION_HEADER`에 `continuation_exception_id` (`ce_{12자hex}` SHA-256 of `raw_name+raw_plan+raw_contract_date+raw_amount`) 컬럼 additive 추가.
- `buildContinuationExceptionId()` 헬퍼 `commercial.ts` export.
- `CS_継続名寄せ確認` header에 동일 컬럼 우측 추가 (기존 `exception_source_sheet`/`exception_source_row` + `continuationReviewKey()` 룩업 유지 — P1=10 대기 큐 무영향). 빌드 162.6kb.

### 2.15 P-007 step 2 — dual-key lookup + ce_id evidence (2026-05-20, push 완료)
- `CS_継続名寄せ確認`의 `existingInputByKey`를 dual-key로 전환: `continuation_exception_id` 우선(`ce::{ce_id}`), 빈 경우 `(exception_source_sheet, exception_source_row)` 튜플 fallback(`src::{sheet}||{row}`).
- 신규 row는 ce_id로, P1=10 기존 row는 source-coord로 (양쪽 indexed).
- `continuationReviewKeyByCeId()` / `continuationReviewKeyBySource()` 헬퍼 추가.
- `csWriteback`의 continuation alias `evidence`도 ce_id 우선 (`continuation_exception_id:{ce_id}`), 미존재 시 legacy `{sheet} row {row}` fallback. 빌드 163.3kb.

### 2.16 P-007 step 3 — final cut (2026-05-20, push 완료) ★마지막 변경
- Continuation exception 흐름의 source-coord 잔재 + dual-key transitional 코드 **전체 제거**.
- 변경:
  1. `CONTINUATION_EXCEPTION_HEADER`에서 `source_sheet`/`source_row` 삭제 + `commercial.ts` ingest emit에서 제거. → `Exceptions_ContinuationMatch`는 `continuation_exception_id` PK + raw_* + 도메인 필드만.
  2. `CS_継続名寄せ確認` 헤더에서 `exception_source_sheet`/`exception_source_row` 제거.
  3. `CS_CONTINUATION_ALIAS_REVIEW_HEADER`를 `views.ts`에 단일 export로 정의 — `csWriteback`이 local 복사본 대신 import. publish/writeback 양측 컬럼 순서 divergence 해소 (long-standing tech debt).
  4. `resolveContinuationCeId(row)` 단일 헬퍼: `continuation_exception_id` 우선, 빈 경우 `buildContinuationExceptionId(raw_name, raw_plan, raw_contract_date, raw_amount)`로 fly-recompute — 운영자 P1=10 기존 row는 raw_* 4 컬럼이 있어 자동 매칭.
  5. `continuationReviewKey*` 3 헬퍼 + dual-key 인덱싱 + evidence fallback 전부 제거. evidence는 `continuation_exception_id:{ce_id}` 한 형식만.
- 빌드 161.8kb (-1.5kb, dead code 제거 확인).

---

## 3. 운영자 검증 대기 (다음 `runFullRefresh` 시 확인)
- `Exceptions_ContinuationMatch`: `source_sheet` / `source_row` 컬럼 사라짐 + `continuation_exception_id` 컬럼 채워짐.
- `CS_継続名寄せ確認`: `exception_source_sheet` / `exception_source_row` 컬럼 사라짐 + `continuation_exception_id` 채워짐 + 컬럼 순서 깔끔 (publish/writeback 일치).
- P1=10 기존 operator input row: raw_* 4컬럼 fly-recompute로 정상 매칭, 운영자 입력값 (action_token 등) 보존 확인.
- `Sync_Log`: 첫 행 헤더 정착(`timestamp/job_name/status/stats`) + stats가 키 알파벳 정렬 + `key=value` 줄바꿈 형식.

---

## 4. 빌드 진행 흐름 (sanity check용)
158.2kb (D-003) → 161.0kb (D-004) → 160.0kb (D-005) → 161.4kb (P-012 1a) → 159.8kb (1b) → 160.7kb (2a) → 161.1kb (2b) → 159.8kb (2c) → 159.0kb (2d) → 160.0kb (post-cleanup) → 160.5kb (Sync_Log target) → 161.7kb (Sync_Log readability) → 162.6kb (P-007 step 1) → 163.3kb (step 2) → **161.8kb (step 3 final cut)**.

---

## 5. 현재 active / planned 백로그 (`docs/backlog.md` 기준)

### Active
- **P-006 Operator approval**: `CS_入金名寄せ確認` P1=39 + `CS_継続名寄せ確認` P1=10 — 운영팀 처리 대기. 코드/문서 게이트는 모두 열림.
- **P-010 Partner pipeline**: 운영팀 회답 대기 (Q1–Q7). 회답 전까지 코드 작업 금지.
- **P-012 Staging cutover**: Phase 1·2 완료. Phase 3 보류 (P-013), Phase 4 ownership matrix 대기.

### Planned
- **P-007 step 4**: exception 시계열 추적 (`Sync_Log` 누적 stats 활용한 trend view). **다음 작업 1순위 후보** — 운영자 대기 없이 즉시 착수 가능.
- **P-008**: 스케줄링/정기 refresh 자동화 재평가. P1 49건 처리 후 실데이터 기반.
- **P-012 Phase 4**: Customers cutover. `Customers` 컬럼 ownership matrix + `Customer_Edit_History` 설계 대기.
- **P-013**: 営業 자동화 + Staging_Payments cutover. 별도 plan 필요.

---

## 6. 표준 운영 원칙 (verbatim — 절대 위반 금지)
- 원본 4종 (`受講者管理` / `顧客満足度会議` / `月次振り返りアンケート（回答）` / `⭕️使用中｜POTEX数値管理`) 수정 금지 (구조 변경 / 탭 삭제 / 수동 정리 / GAS write 일체).
- POTEX DB만 canonical. 다른 워크북은 (a) 통계 표시 / (b) 필터 뷰 / (c) DB 갱신을 유발하는 트리거 입력만 수행.
- **DB에 중복/derive-only 데이터 저장 금지**. staging row에서 100% 추출 가능한 정규화 결과는 publish 시점 join으로 derive.
- publish 시트 수기 입력 금지. 입력은 `CS_別名解決入力` / `CS_更新アクション` 등 명시적 input 탭에서만.
- 확신 없는 이름 매칭을 alias map에 `approved` 처리 금지.
- alias 문제를 source-side naming으로 해결 금지.
- LStep / TimeRex 연동은 업무흐름 확정 전까지 보류.
- DB 전 시트에 `created_at` / `updated_at` 필수 (append-only `Sync_Log` 제외; `timestamp`가 created_at 역할).
- No git repo — 삭제는 되돌릴 수 없음. 모르는 파일은 먼저 조사.

---

## 7. 참고 문서
- `agents/session.md` (세션 시작 시 1순위 read)
- `docs/backlog.md` (task ledger, 2순위 read)
- `agents/workflow.md`
- `README.md` / `CLAUDE.md`
- `OPERATIONS_MANUAL.md` / `OPS_WORKBOOK_ARCHITECTURE.md`
- `PHASE1_CUTOVER_RUNBOOK.md` (historical)
- `FEEDBACK_PIPELINE_STATUS.md`
- `docs/db-schema.md` (DB 각 시트 컬럼/출처)
- `docs/domain/2026-05-19-post-contract-orientation-flow.md` (운영팀 PDF 도메인 노트)
- `docs/plans/2026-05-20-staging-cutover.md` (P-012 spec)
- `docs/plans/2026-05-19-partner-pipeline.md` + `docs/proposals/2026-05-19-partner-pipeline-*.md` (P-010)
