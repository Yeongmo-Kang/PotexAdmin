# Potex Backlog

업데이트: 2026-05-24T08:52:06+09:00

## 목적
Potex 프로젝트의 현재 작업 상태를 재개 가능하게 유지하기 위한 경량 task ledger.

원칙:
- Potex 운영은 `c:\Users\zerom\Desktop\DevZero\projects\potex` 안에서만 추적.
- 비기술 운영팀이 실제로 쓰는 흐름과 직접 연결되는 일부터 우선.

---

## 현재 상태 (2026-05-20)
- Phase 1 cutover 종료. 5개 publish workbook (`POTEX DB` / `Potex CS` / `Potex Executive` / `Potex Concierge` / `Potex Sales` / `Potex Coaches`) 모두 live.
- 자동화 trigger: publish 1h / writeback 30m / full refresh 매일 07:00 JST.
- 통합 데이터 (POTEX DB): Customers 224 / Coaches 38 / Feedback 58 (58/58 matched) / Plans 228 / Payments 136 (unmatched 39) / ConversionHistory 660 / Line_Registrations 10,675.
- Sales view: Contracts 136 / Pending 85 / Funnel 660 / Health 8.
- Coach view: Load 38 / Followup 18 / Health 6.

---

## Active

### Operator approval (P-006)
- `CS_入金名寄せ確認` P1=39 / `CS_継続名寄せ確認` P1=10 — 운영팀 `approve_if_context_matches` 대상부터 처리.
- 승인 흐름: input 탭 → `runWritebackCollection()` (30m) → `Customer_Alias_Map` → canonical refresh → 5-workbook republish.
- **`CS_承認進捗` push 완료 (2026-05-21)**: P1 open 수, undecided 수, decided-but-unsynced 수, invalid_open, 최근 7일 writeback 처리량을 한 탭에서 확인 가능.
- 1건 e2e 검증 후 P-008 cadence 재평가.

### Partner pipeline (P-010) — Phase A push 완료, live scaffold 확인 대기
- spec: `docs/plans/2026-05-19-partner-pipeline.md`
- 全社共有 overview: `docs/proposals/2026-05-19-partner-pipeline-overview-ja.md`
- 질문 라운드 (Q1–Q7): `docs/proposals/2026-05-19-partner-pipeline-questions-ja.md`
- **회답 확정:** Q1 form 예약부터 시작 + 향후 LINE 연동 가능 / Q2 계약·입금 정본은 기존 `Plans`·`Payments` / Q3 status enum은 우선 가볍게 시작 후 변경 쉽게 / Q4 partner workbook 분리 / Q5 partner 주입력 + CS 예외적 보완 / Q6 CS가 partner assign 시 input 탭에 lead 1행 입력 / Q7 stale 경고는 CS + partner 본인.
- **Phase A 완료 (2026-05-21, push):** `Partners`, `Partner_Alias_Map`, `Customer_Partner_Assignments`, `Partner_Pipeline_Status` canonical scaffolding 추가. `refreshCanonicalStaging()`가 시트를 자동 생성/유지하고 `Partners`에는 `PART-001 稲井`, `PART-002 佐藤` seed row를 보장. 반영: `potex-gas/src/canonical/partners.ts`, `canonical/ingest.ts`, `constants.ts`, `workbook_manifest.json`, spec docs. `npm run build` 성공, 번들 178.6kb, Windows-side `clasp.cmd push -f` 성공.
- **Phase B 완료 (2026-05-21, build 완료 / push 진행 예정):** `Potex CS`에 `CS_Partner_Assignment_Input` 신규 publish 탭 추가. source `フォームの回答`를 읽어 provisional `LEAD-FORM-xxxxx` seed를 만들고, 이메일/이름 exact match 시 `customer_id`를 우선 사용. 기존 `Partners` / `Customer_Partner_Assignments`를 조인해 미배정 lead만 queue로 노출하고, 간단 heuristic(`学生`/`インターン`/`就活`/`転職`)으로 `suggested_partner_id`를 제안. `collectCsWritebackRows()`도 확장되어 operator가 partner 이름을 입력하면 `Customer_Partner_Assignments`에 upsert(writeback source=`cs_partner_assignment_input`)되고, 처리 후 canonical refresh + republish chain에 포함된다. 반영: `potex-gas/src/publish/views.ts`, `csWorkbook.ts`, `writeback/csWriteback.ts`, `constants.ts`, `main.ts`, `workbook_manifest.json`. `npm run build` 성공, 번들 192.9kb.
- **설계 수정 (2026-05-21):** 사용자 피드백에 따라 CS 운영은 coach/partner를 별도 배정 공수로 나누지 않고 **통합 assignment input 1회**로 가는 쪽으로 전환.
- **설계 재수정 (2026-05-21):** 더 단순한 운영/모델을 위해 partner canonical 자체를 폐기하고, `Coaches` / `Customer_Coach_Assignments`에 partner를 흡수하는 방향으로 전환. 즉 `Partners` / `Partner_Alias_Map` / `Customer_Partner_Assignments` / `Partner_Pipeline_Status`는 최종안이 아니라 되돌릴 transitional scaffold로 취급한다.
- **통합 리팩터 구현 완료 (2026-05-21, build OK / 미배포):** `CS_Partner_Assignment_Input`를 `CS_担当割当入力`로 통합 리네임하고, CS 입력 컬럼을 `suggested/current/operator_selected_assignee_*` 형태의 generic assignment surface로 변경. `Customer_Coach_Assignments` 헤더를 `lead_id`, `assignee_kind`, `assignee_scope`, `assignment_source` 포함 형태로 확장했고, partner assignment writeback도 이제 별도 `Customer_Partner_Assignments`가 아니라 **확장된 `Customer_Coach_Assignments`** 로 upsert된다. 또한 `refreshCanonicalStaging()`에 legacy `Partners` → `Coaches` mirror seed를 넣어 `COACH-PARTNER-001/002` 행과 `assignee_kind=partner`, `assignee_scope` 메타데이터를 자동 보장한다. 반영: `potex-gas/src/canonical/ingest.ts`, `publish/views.ts`, `publish/csWorkbook.ts`, `writeback/csWriteback.ts`, `constants.ts`, `workbook_manifest.json`. `npm run build` 성공, 번들 196.8kb.
- **후속 정리 (2026-05-22):** legacy partner canonical 4종(`Partners`/`Partner_Alias_Map`/`Customer_Partner_Assignments`/`Partner_Pipeline_Status`)은 더 이상 canonical refresh read/write path에 포함하지 않도록 정리했다. partner mirror seed는 이제 `Coaches`에 직접 보장되며, `refreshCanonicalStaging()`는 `Customer_Coach_Assignments`를 재생성할 때 `assignment_source != source_customer_snapshot` 인 writeback row(예: `cs_assignment_input`)를 보존해 full refresh가 partner assignment를 지우지 않게 수정했다.
- **partner monitoring 후속 (2026-05-22):** `CS_承認進捗`에 `partner_status_pipeline` scope를 추가해 `open_total`, `waiting_first_update`, `stale_30d`, `meeting_completed`, `potex_in_progress`, `processed_last_7d`, `invalid_last_7d`를 같이 보이게 했다. `経営_データ状況`에도 `partner_assignment_count`, `partner_status_updated_count`, `partner_stale_30d_count`, `partner_meeting_completed_count`, `partner_potex_in_progress_count`, `partner_recruitment_active_count`를 추가해 Executive가 partner pipeline 정체 여부를 별도 workbook 없이 볼 수 있게 했다. 변경본은 빌드 완료 후 Apps Script content API로 원격 배포까지 반영했다. live publish 반영은 다음 trigger 또는 수동 `runPublishAll`/`runFullRefresh`에서 적용된다.
- **publish UX localization (2026-05-23):** `potex-gas/src/sheets.ts`에 publish tabs용 dual-header 구조를 추가했다. row 1은 운영자용 표시 라벨, row 2는 hidden machine key라서 `readSheetAsObjects()` / writeback은 기존 snake_case 헤더를 계속 사용한다. `normalizeDateColumns()`도 hidden header를 인식하도록 수정. `csWriteback.ts`는 `approved/active/resolved`뿐 아니라 `승인/진행중/완료`, `承認/対応中/完了` 입력도 normalize 하도록 확장. 이후 Windows-side `clasp.cmd push -f`와 live publish 반영까지 완료됐다.
- **publish UX localization + live deploy 성공 (2026-05-23):** dual-header hotfix 이후 `runPublishAll` 성공까지 확인. 표시용 publish header는 일본어 operator-friendly 라벨로 반영됐고, machine key hidden row/writeback 구조는 유지된다. README / data-health note / sales/coach/concierge/operator-facing copy도 일본어화된 상태로 live 배포 완료.
- **legacy workbook UX reference review 완료 (2026-05-23):** 실제 시트 `POTEX_顧客管理_v2 のコピーテスト用 のコピー`를 열어 탭 구조와 `__README`를 직접 확인했다. 이 시트는 `README-first + role-tab + Japanese ops wording` 면에서 강한 참고 가치가 있으나, 시트간 수식 강결합 / 열 위치 분기 / workbook-as-DB 아키텍처는 채택하지 않기로 했다. 반영 결과는 `docs/plans/2026-05-22-workbook-ux-priority-plan.md`에 기록.
- **다음 UX 후속 방향:** untouched workbook parity 이후 second-pass에서 (a) `__README` 스타일의 일본어 가이드 정비, (b) role-first tab/copy consistency, (c) `suggested_action` 같은 잔여 영어 값의 display-localization을 검토한다.
- **CS second-pass UX polish + tab localization 정리 완료 (2026-05-24):** 실제 legacy workbook reference 확인 후 `potex-gas/src/publish/views.ts`를 추가 정리했다. `suggested_action`는 writeback branching에 쓰이지 않는 publish-only 표시값임을 확인했고, `CS_入金名寄せ確認` / `CS_継続名寄せ確認`에서 일본어 안내 문구로 직접 localize했다. `suggestion_basis`, alias/current status, followup reason, payment status, event type, assignment type 등 남아 있던 operator-facing English residuals도 display-safe 경로 위주로 일본어화했다. `buildCsReadme` / `buildSalesReadme` / `buildCoachReadme` / `buildConciergeReadme` / `buildExecReadme`도 practical Japanese guide 톤으로 보강했다. 이후 Windows-side `clasp.cmd push -f` 성공까지 확인했고, live workbook 5종을 Sheets API로 spot-check한 결과 일본어 탭명과 README/guide 참조가 기대대로 유지됨을 확인했다. 단, `clasp run runPublishAll` 자체는 여전히 Execution API scope auth 부족으로 로컬 직접 실행되지 않는다.

### Staging cutover Phase 1·2 (P-012)
- spec: `docs/plans/2026-05-20-staging-cutover.md` (운영팀 회답 완료, 2026-05-20)
- **Phase 1 완료 (코드+push)**: `Line_Registrations` 캐노니컬 표 신설 + reader 4곳 (`csWorkbook` / `conciergeWorkbook` / `managementWorkbook` / `views.ts`) 전환 + `Staging_LineRegistration` 쓰기 제거. csWriteback alias review header도 `candidate_segment` / `candidate_line_registration_id`로 갱신. 빌드 159.8kb. **clasp push 완료** — 운영자 `runFullRefresh` 실행 시 staging 시트 더 이상 갱신 안 됨 (orphan 상태). 운영자 confirm 후 시트 수동 삭제 요청.
- **Phase 2 step 2a 완료 (additive, push)**: `Feedback` / `Staging_Feedback` / `Exceptions_FeedbackMatch`에 `response_id` 컬럼 추가, SHA-256 hash (`resp_{12hex}`) 도입. source_sheet/source_row + feedbackKey() + evidence 의미 변경 없음.
- **Phase 2 step 2b 완료 (semantic, push)**: csWriteback `feedbackKey()` signature 변경 — response_id 우선 (`rid::{response_id}`), 빈 경우만 legacy source coord fallback. 4 callers 전환. `buildFeedbackRow`에 `response_id` 전달. `Customer_Alias_Map.evidence`는 alias resolution 경로에서 `response:{response_id}` 형식 emit (payment/continuation 경로는 그대로 source-coord). `dropOrphanStagingLineRegistration()` 헬퍼 추가 — 운영자 1회 실행해서 orphan 시트 제거 완료. 빌드 161.1kb.
- **Phase 2 step 2c 완료 (canonical cutover, push)**: `Feedback` / `Exceptions_FeedbackMatch` 헤더에서 `source_sheet` / `source_row` 컬럼 제거. `feedbackKey()` → 1-arg (response_id only, fallback 제거). `opsKey()` 제거 — Ops_Feedback_Review dedupe는 `feedback_id` 기준으로 전환. `CS_別名解決入力` 뷰 헤더에서 source 좌표 2 컬럼 제거, `aliasInputKey()`도 `(response_id, alias_name)`로 단순화. `buildFeedbackRow` / `buildOpsFeedbackRow`에서 source 좌표 필드 제거. evidence emission: feedback 경로는 response_id 없으면 빈 `response:`로 emit (실데이터는 항상 채워짐). 빌드 159.8kb (1.8kb 감량).
- **Phase 2 step 2d 완료 (Staging_Feedback 제거, push)**: ingest가 raw 응답을 `Exceptions_FeedbackMatch`에 직접 적재. `Exceptions_FeedbackMatch` 헤더 확장 (`coach_id`, `feedback_type`, `satisfaction_score`, `nps_score`, `nps_category`, `progress_score`, `expectation_score`, `community_score`, `q_gap`, `free_comment` 추가; `staging_feedback_id` 제거) — alias 승인 시 csWriteback이 exception row만으로 `Feedback`/`Ops_Feedback_Review`를 build할 수 있게 raw 필드 포함. csWriteback `stagingRows`/`stagingById` 룩업 블록 전체 삭제. `buildFeedbackRow`/`buildOpsFeedbackRow` 파라미터 `staging` → `exc`로 변경. `STAGING_FEEDBACK_HEADER` 상수 / `SHEETS.STAGING_FEEDBACK` 키 삭제. ingest의 in-memory 행 빌더에서 `staging_feedback_id` / `source_workbook` / `source_sheet` / `source_row` 죽은 필드 정리. `dropOrphanStagingFeedback()` 헬퍼 추가 (gas-entry + build-gas 등록). 빌드 159.0kb (-0.8kb). **운영자 dropOrphanStagingFeedback 실행 완료** — orphan `Staging_Feedback` 시트 제거됨.
- **Phase 2 post-cleanup (2026-05-20)**: `buildStagingFeedback` → `buildFeedbackResponses` rename, `buildFeedbackOutputs` 파라미터 `stagingRows` → `responseRows`. `Sync_Log` stats에 `feedbackResponseIdCollisions` 카운터 추가 — response_id SHA-256 hash 충돌 모니터링. 1 이상이면 즉시 조사 필요 (현재 0 예상). `経営_データ状況`에 `feedback_response_id_collision_count` 표시 metric 추가. 활성 docs (`CLAUDE.md` / `OPS_WORKBOOK_ARCHITECTURE.md` / `docs/sheet-reference.md` / `docs/database-overview.md` / `potex-gas/README.md` / `FEEDBACK_PIPELINE_STATUS.md`)에서 `Staging_Feedback` 잔재 정리. 빌드 160.0kb.
- **Sync_Log target fix (2026-05-20, push 완료)**: 운영자 검증에서 `POTEX DB > Sync_Log`가 비어 있는 버그 발견. 원인: `appendSyncLog`가 `SpreadsheetApp.getActiveSpreadsheet()`를 사용 — 트리거 컨테이너 바인딩에 따라 다른 워크북에 쓰거나 unbound 시 silent fail. 수정: `logging.ts` 재작성 — `PropertiesService.getScriptProperties().getProperty(PROPS.DB_SPREADSHEET_ID)` → `SpreadsheetApp.openById(dbId)`로 명시적 POTEX DB target. active fallback + try/catch best-effort (logging 실패가 메인 잡 break 금지). 빌드 160.5kb. clasp OAuth 만료 (`invalid_grant`) → 재로그인 후 push 완료. 5개 publish 워크북에 rogue `Sync_Log` 없음 확인 (운영자).
- **Sync_Log readability fix (2026-05-20, push 완료)**: 신규 append 확인되었으나 `Sync_Log`에 헤더 없어 컬럼 의미 불명 + stats가 JSON blob 한 줄이라 운영자가 읽기 어려움. `ensureSyncLogHeader()` 추가 — 시트의 첫 행이 `timestamp / job_name / status / stats`가 아니면 `insertRowBefore(1)` 후 setValues + `setFrozenRows(1)` (기존 데이터 행 보존). `formatStats()` — stats 키를 알파벳 정렬해 `key=value` 줄바꿈 join (Sheets 셀 내 줄바꿈 자동 표시). 빌드 161.7kb. 운영자 `runFullRefresh` 1회 후 신규 row 형식 + 헤더 정착 확인 요청.
- Phase 3 보류, Phase 4는 ownership matrix 대기.

---

## Planned

### P-007. 예외/데이터 품질 운영 루프 강화
- 우선순위: 중간
- 범위: exception sheet 체계 정리 / unresolved count 모니터링 / 운영자 runbook 보강.
- **step 1 완료 (2026-05-20, push)**: (a) `OPERATIONS_MANUAL.md`의 `経営_データ状況` 섹션을 카운트/예외-미매칭(4종 sheet 매핑)/데이터 무결성/acquisition으로 분류해 운영자 친화 형식으로 재작성, (b) `Sync_Log` (POTEX DB only) 운영자 가이드 섹션 신설 — job_name 목록, error 대응, response_id collision 확인 가이드, (c) `Exceptions_ContinuationMatch`에 `continuation_exception_id` (`ce_{12자hex}` SHA-256) 컬럼 additive 추가 + `CS_継続名寄せ確認`에도 동일 컬럼 추가 (기존 `exception_source_sheet`/`exception_source_row` lookup 유지 — P1=10 대기 큐 무영향). 빌드 162.6kb.
- **step 2 완료 (2026-05-20, push)**: `existingInputByKey`를 dual-key indexed로 전환 — `continuation_exception_id` 우선(`ce::{ce_id}`), 빈 경우 `(exception_source_sheet, exception_source_row)` 튜플 fallback(`src::...`). 신규 row는 ce_id로 매칭, 기존 P1=10 row는 source-coord로 매칭 (양쪽 다 indexed). `csWriteback`의 continuation alias `evidence` 필드도 ce_id 우선(`continuation_exception_id:{ce_id}`)으로 전환. 빌드 163.3kb.
- **step 3 완료 (2026-05-20, push) — final cut**: transitional 잔재 전부 제거. `CONTINUATION_EXCEPTION_HEADER`에서 `source_sheet`/`source_row` 삭제 (commercial.ts emit 동기). `CS_継続名寄せ確認` header에서 `exception_source_sheet`/`exception_source_row` 삭제. `CS_CONTINUATION_ALIAS_REVIEW_HEADER`를 `views.ts`에 export로 단일화 → `csWriteback`이 import (publish/writeback 컬럼 순서 divergence tech debt 해소). `resolveContinuationCeId(row)` 단일 헬퍼: `continuation_exception_id` 우선, 빈 경우 raw_* 4컬럼으로 fly-recompute (운영자 기존 P1=10 input rows도 raw_*로 자동 매칭). `continuationReviewKey*` 3 헬퍼 + dual-key 인덱싱 + evidence fallback 전부 제거 — evidence는 `continuation_exception_id:{ce_id}` 한 형식만. 빌드 161.8kb (-1.5kb). 운영자 다음 `runFullRefresh` → 컬럼 정리 + P1=10 input 정상 매칭 확인.
- **step 4 완료 + live 검증 완료 (2026-05-21, push)**: `経営_例外推移` 신규 탭 추가. `Sync_Log` successful stats를 **JST 일별 / 최근 30일 / 날짜별 마지막 snapshot** 기준으로 집계해 `feedback_match_exception_count`, `payment_unmatched_count`, `continuation_unmatched_count`, `line_registration_unmatched_count`, `feedback_response_id_collision_count`와 각 `_delta`를 노출. `npm run build` 성공, 번들 165.8kb. **WSL `clasp`는 `invalid_grant`였지만 Windows-side `node_modules\\.bin\\clasp.cmd push -f`로 push 성공**. 운영자 `runFullRefresh` 후 새 탭/숫자/delta 정상 확인 완료.

### P-008. 스케줄링/정기 refresh 자동화
- 우선순위: 중간
- 현재 cadence는 안정적. `CS_承認進捗`로 operator queue 처리량을 더 본 뒤 (P1 49건 처리 이후) 실데이터 기반 재평가.

### P-012 Phase 4. Customers cutover
- 우선순위: 중간
- 의존: 사용자 `Customers` 컬럼 ownership matrix 제출, `Customer_Edit_History` 표 설계.

### P-013. 営業 자동화 + Staging_Payments cutover (Phase 3 후속)
- 우선순위: 미정
- 영업팀 着金管理マスター 수동 입력을 자동화 입력으로 전환하면서 `Staging_Payments` → `Payments` 직접 적재. 자동화 design 미정 — 별도 plan 필요.

---

## Blocked / Needs Input
없음. P-006 operator approval은 운영팀 실행 대기지만 코드/문서 게이트는 모두 열려 있음.

---

## Completed / Established Baseline
- **P-001** Potex 운영 체계 경량화 (README / session.md / workflow.md / backlog).
- **P-002** Phase 1 cutover. 5-workbook 구조 live, trigger 활성.
- **P-003** Customer alias resolution을 GAS 운영 흐름으로 고정. `Customer_Alias_Map` writeback live; `CS_入金名寄せ確認` / `CS_継続名寄せ確認`로 패턴 확장됨.
- **P-004** Customer source ingest. `受講者管理` (`17fkrUdf-vS7tQ06lzR3LDp-PPsWSwajqPcB0vyRXOk4`) 기준 `Staging_Customers=224`.
- **P-005** 운영 뷰 3종 (`Ops_コーチ_担当負荷` / `Ops_Followup_Queue` / `Ops_Continuation_Targets`) accept verdict. canonical data에서 derive.
- **P-006 (1차)** Canonical commercial model (`Plans` 228 / `Payments` 136 / `ConversionHistory` 543→660). commercial metrics가 `経営_データ状況`에 노출. operator approval은 active로 남음.
- **P-009** LINE 등록 ingest. `Staging_LineRegistration=10,675`, attribution token (`yt/ig/tik/tt/pt/lp/sdp/inflow`)은 publish 시점 join으로 derive (DB에 중복 저장 금지 원칙). `Customer_Acquisition_Source` 잔존 탭 없음.
- **P-011** Sales / Coach workbook 활성화. 발견된 함정 2가지를 표준화:
  - PropertiesService stuck `'false'` 회피 — enable flag gating은 Concierge 패턴 (`asBool(getProp) || Boolean(spreadsheetId)`).
  - Sheets boolean auto-detection roundtrip — `paid_flag` 등 boolean-likely 컬럼 비교는 case-insensitive (`String(v).toUpperCase() === 'TRUE'`).
- **B-001** Customer source workbook ID 확보.
- **B-002** Concierge entry slice. `Potex Concierge` provisioned + read-only publish live. writeback 확장은 보류.
- **D-001** 入会後오리엔테이션 도메인 노트 (`docs/domain/2026-05-19-post-contract-orientation-flow.md`). 営業 / コンシェルジュ / コーチ 役割境界 + 사전ワーク + 플랜 구조 + コーチマッチング 입력원 정리. 즉시 변경 없음, 향후 참조용.
- **D-002 (2026-05-20)** Project cleanup. DEPRECATED Python 스크립트 10개 / 구식 root 문서 7개 / 빈 dir 5개 / handoff 8개 / .hermes/plans 2개 / generated 일회성 snapshot 10개 제거. `main.ts` publish-all 헬퍼 + `views.ts` `isPaid()` 헬퍼 추출로 중복 단순화. `constants.ts`의 미사용 `OPS_ZERO_SESSION_REVIEW` 제거. `PHASE1_CUTOVER_RUNBOOK.md`는 historical reference 형태로 대폭 축약.
- **D-003 (2026-05-20)** Operator-facing column reorder + DB audit columns. 11개 publish view (`CS_要フォロー一覧` / `CS_継続対象一覧` / `CS_別名解決入力` / `CS_入金名寄せ確認` / `CS_継続名寄せ確認` / `営業_契約一覧` / `営業_未入金一覧` / `営業_ファネル推移` / `経営_コーチ負荷` / `コーチ_担当負荷` / `コーチ_要フォロー一覧` / `コンシェルジュ_フォロー一覧`) header를 `priority → action context → input → source/audit at end` 패턴으로 재배열. DB canonical 시트 중 누락된 7종 (`Staging_Customers` / `Staging_Feedback` / `Staging_Payments` / `Staging_LineRegistration` / `Feedback` / `Exceptions_FeedbackMatch` / `Exceptions_ContinuationMatch`)에 `created_at` / `updated_at`을 우측 끝에 추가 (`syncedAt` 한 시점으로 thread). 빌드 158.2kb.
- **D-005 (2026-05-20)** "DB가 원본" 명문화 1차. canonical 표에서 raw source 좌표(`source_sheet` / `source_row`) trace 제거 — `Customer_Coach_Assignments` / `Customer_Channel_Links` 헤더에서 두 컬럼 삭제, `Plans` / `Payments` `note`에서 `source=...` 문자열 제거, `ConversionHistory.note`에서 `source=...` 9곳 제거 (`changed_by`가 도메인을 이미 전달). `Feedback` / `Exceptions_*` 의 source 좌표는 dedupe/evidence 키로 필요해 일단 보존 (P-012에서 재설계). `docs/db-schema.md` 전면 재작성 — table-list-as-roles, 각 표 1-2줄 역할 lead, staging은 "내부 mirror, 점진 제거 예정" 한 문단으로 축소. 빌드 160.0kb.

- **D-004 (2026-05-20)** DB 전체 `created_at` / `updated_at` 강제. pipeline-managed `Customer_Alias_Map` / `Ops_Feedback_Review`의 header 상수에 두 컬럼 추가하고 writeback에서 기존 row의 `created_at` 보존 / 신규 row는 `syncedAt`. 수동 maintained 시트 8종 (`Customers` / `Coaches` / `Sessions` / `Coach_Alias_Map` / `Customer_Alias_Map` / `Ops_Followup_Queue` / `Ops_コーチ_担当負荷` / `Ops_Continuation_Targets`)에는 `ensureAuditColumns()` migration 추가 — `refreshCanonicalStaging()` 진입 시 컬럼이 없으면 우측 끝에 append하고 빈 셀은 `syncedAt`으로 backfill (idempotent). `Sync_Log`은 append-only로 `timestamp`가 created_at 역할이므로 제외. DB schema 문서 신설: `docs/db-schema.md`. 빌드 161.0kb.

---

## Working Rule for Next Sessions
1. `agents/session.md` 먼저 확인
2. 본 backlog로 Active / Planned / Blocked 상태 확인
3. 요청을 문서/운영/구현 중 어디로 분류
4. 구현성 작업이면 워커 위임 범위를 먼저 자르고 진행
5. 결과 검증 후 문서 갱신
