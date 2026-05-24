# Potex Orchestrator Session Checkpoint

업데이트: 2026-05-24T20:20:00+09:00

## 운영 원칙
- GitHub repo `origin` (`Yeongmo-Kang/PotexAdmin`, branch `main`)를 문서/코드/계획의 1차 기준으로 사용.
- 로컬 workspace(`/home/ubuntu/.hermes/projects/PotexAdmin`)는 작업 복사본이자 백업이다.
- 상태 추적의 기준 문서는 `docs/backlog.md` + 이 파일.
- 원본 4종 (`受講者管理`, `顧客満足度会議`, `月次振り返りアンケート（回答）`, `⭕️使用中｜POTEX数値管理`)은 read-only reference. 직접 수정/구조변경/탭삭제 금지.
- POTEX DB만 canonical. 다른 워크북은 (a) 통계 표시, (b) 필터 뷰, (c) DB 갱신을 유발하는 트리거 입력만 수행.
- **DB에 중복/derive-only 데이터 저장 금지**. staging row에서 100% 추출 가능한 정규화 결과는 publish 시점 join으로 derive.
- publish 시트 수기 입력 금지. 입력은 `CS_別名解決入力` / `CS_更新アクション` 등 명시적 input 탭에서만.
- 확신 없는 이름 매칭을 alias map에 `approved` 처리 금지.
- LStep/TimeRex 연동은 업무흐름 확정 전까지 보류.

## 현재 상태 (2026-05-20)
- Phase 1 cutover 종료. 5개 publish workbook 모두 live:
  - `POTEX DB`, `Potex CS`, `Potex Executive`, `Potex Concierge`, `Potex Sales`, `Potex Coaches`.
- 자동화 trigger 활성: publish 1h / writeback 30m / full refresh 매일 07:00 JST.
- 통합 데이터 (POTEX DB):
  - Customers 224 / Coaches 38 / Feedback 58 (coach 58/58, customer 58/58) / Plans 228 / Payments 136 (unmatched 39) / ConversionHistory 660 / Line_Registrations 10,675.
- Sales view 행수: Contracts 136 / Pending 85 / Funnel 660 / Health 8.
- Coach view 행수: Load 38 / Followup 18 / Health 6.
- Operator approval 큐 대기:
  - `CS_入金名寄せ確認` P1=39 (앞에서부터)
  - `CS_継続名寄せ確認` P1=10
- (2026-05-20) operator-facing 11 view header `priority → action context → input → source/audit` 패턴으로 재배열. DB canonical 시트 7종에 `created_at` / `updated_at` 우측 끝 추가. 다음 publish/refresh cycle부터 신규 컬럼 순서로 덮어쓰기 (clearAndRewrite). GAS push 미실행 — 운영자 합의 후 push.
- (2026-05-20) DB 전체 `created_at` / `updated_at` 강제. `Customer_Alias_Map` / `Ops_Feedback_Review` schema 보강, 수동 maintained 시트 8종에는 `ensureAuditColumns()` migration (`refreshCanonicalStaging` 진입 시 idempotent하게 컬럼 보장 + 빈 셀 `syncedAt` backfill). DB schema doc 신설: `docs/db-schema.md`. 빌드 161.0kb.
- (2026-05-20) "DB가 원본" 1차 cleanup. canonical 표에서 raw source 좌표 trace 제거 — `Customer_Coach_Assignments` / `Customer_Channel_Links` 헤더에서 `source_sheet`/`source_row` 삭제, `Plans` / `Payments` `note`에서 `source=...` 제거, `ConversionHistory.note` 9곳 `source=...` 제거. `Feedback` / `Exceptions_*`의 source 좌표는 dedupe/evidence 키로 필요해 보존 (P-012에서 재설계). `docs/db-schema.md` 전면 재작성 (role-centric, plain language). staging cutover (staging 시트 제거 + ingest DB 직접쓰기 전환)는 P-012로 분리. 빌드 160.0kb. **clasp push 완료 + 운영자 runFullRefresh 실행 완료.**
- (2026-05-20) P-012 spec 작성: `docs/plans/2026-05-20-staging-cutover.md`. 4종 staging을 4단계 phase로 분리.
- (2026-05-20) **P-012 Phase 1a 코드 완료** — `Line_Registrations` 캐노니컬 표 신설 (source 좌표 컬럼 제거, line_registration_id PK 안정). `Staging_LineRegistration`과 parallel write. line_registration event note의 `source=...` trace 제거. reader 전환은 Phase 1b. 빌드 161.4kb. clasp push 대기.
- (2026-05-20) **P-012 Phase 1b 완료 + clasp push** — reader 4종 (`csWorkbook` / `conciergeWorkbook` / `managementWorkbook` / `views.ts`) `LINE_REGISTRATIONS`로 전환. `STAGING_LINE_REGISTRATION` constant / `STAGING_LINE_REGISTRATION_HEADER` export / `stagingLineRegistrations` LineOutputs 필드 / ingest staging 쓰기 전부 제거. `scoreLineCandidate` / `buildLineRegistrationLookup` / `buildCustomerChannelLinks` 모두 새 필드명(`line_registration_id` / `segment`)으로 갱신. publish header `candidate_source_segment`/`candidate_source_sheet`/`candidate_source_row` → `candidate_segment` / `candidate_line_registration_id`로 재명명 (writeback header 동기). 빌드 159.8kb. 운영자 `runFullRefresh` 후 `Staging_LineRegistration` 시트 orphan → 수동 삭제 안내.
- (2026-05-20) **P-012 Phase 2 step 2a 완료 + clasp push** — `Feedback` / `Staging_Feedback` / `Exceptions_FeedbackMatch` 헤더에 `response_id` 컬럼 추가 (additive). `buildResponseId(sourceSheet, submittedAt, respondentEmail, rawCoachName)` SHA-256 해시 → `resp_{12자hex}`. ingest 모든 path에서 채움. source_sheet/source_row 보존, `feedbackKey()`/evidence 의미 미변경 (step 2b 분리). 빌드 160.7kb.
- (2026-05-20) **P-012 Phase 2 step 2b 완료 + clasp push** — `feedbackKey(responseId, sourceSheet, sourceRow, respondentEmail)` 시그니처 변경, response_id 비어있을 때만 legacy source-coord fallback. 4 call sites 전환. `buildFeedbackRow`에 `response_id` 통과. `Customer_Alias_Map.evidence` alias resolution input 경로에서 `response:{response_id}` 형식. `dropOrphanStagingLineRegistration()` 헬퍼 추가. **운영자 dropOrphanStagingLineRegistration 1회 실행 완료** — orphan Staging_LineRegistration 시트 제거됨. 빌드 161.1kb.
- (2026-05-20) **P-012 Phase 2 step 2c 완료 + clasp push** — canonical cutover 단계. `Feedback` 헤더에서 `source_sheet` / `source_row` 제거 (그러나 staging_feedback_id PK는 staging→exception 룩업 위해 Exception에 남김). `Exceptions_FeedbackMatch` 헤더에서도 `source_sheet` / `source_row` 제거. `feedbackKey()` → 1-arg `(responseId)` only — legacy fallback 제거. `opsKey()` 함수 삭제 — Ops_Feedback_Review dedupe는 `feedback_id` 직접 비교. `CS_別名解決入力` 뷰 헤더에서 `source_sheet` / `source_row` 컬럼 제거, `aliasInputKey()` → `(response_id, alias_name)`. `buildFeedbackRow` / `buildOpsFeedbackRow`에서 source 좌표 emit 제거. csWriteback의 `normalizeEmail`, views.ts의 `normalizeEmail` dead helper 정리. 빌드 159.8kb (1.8kb ↓).
- (2026-05-20) **P-012 Phase 2 step 2d 완료 + clasp push** — Staging_Feedback 시트 전체 제거. ingest가 raw 응답을 `Exceptions_FeedbackMatch`에 직접 적재. exception header 확장: `coach_id`, `feedback_type`, `satisfaction_score`, `nps_score`, `nps_category`, `progress_score`, `expectation_score`, `community_score`, `q_gap`, `free_comment` 추가 — alias 승인 시 csWriteback이 exception row만으로 `Feedback`/`Ops_Feedback_Review`를 build할 수 있도록. `staging_feedback_id` 키 / `STAGING_FEEDBACK_HEADER` 상수 / `SHEETS.STAGING_FEEDBACK` 키 / `Staging_Feedback` 시트 write 전부 삭제. csWriteback의 `stagingRows`/`stagingById` 룩업 블록 제거, `buildFeedbackRow`/`buildOpsFeedbackRow` 파라미터 `staging` → `exc`. ingest in-memory builder에서 죽은 source 좌표/staging_feedback_id 필드 정리. `dropOrphanStagingFeedback()` 헬퍼 추가 (gas-entry + build-gas 등록). 빌드 159.0kb (-0.8kb). **운영자 dropOrphanStagingFeedback 실행 완료** — orphan 시트 제거됨.
- (2026-05-21) **P-010 Phase A scaffold 완료 + push** — partner pipeline Q1–Q7 답변을 spec에 반영해 implementation-ready로 전환. 이어서 canonical schema scaffolding 4종 `Partners`, `Partner_Alias_Map`, `Customer_Partner_Assignments`, `Partner_Pipeline_Status` 추가. `refreshCanonicalStaging()`가 시트를 auto-create/maintain하고 `Partners`에는 `PART-001 稲井`, `PART-002 佐藤` seed row를 보장. 반영: 신규 `potex-gas/src/canonical/partners.ts`, `canonical/ingest.ts`, `constants.ts`, `workbook_manifest.json`, partner spec/질문 문서. `npm run build` 성공, 번들 178.6kb. Windows-side `clasp.cmd push -f` 성공. 다음은 운영자 `runFullRefresh` 후 POTEX DB의 4개 신규 시트 + seed row live 확인.
- (2026-05-21) **P-006 monitoring helper push 완료** — CS 운영팀이 P1 처리 병목을 한눈에 보도록 `CS_承認進捗` 신규 publish 탭 추가. `CS_入金名寄せ確認` / `CS_継続名寄せ確認`의 현재 open queue를 요약하고, `Sync_Log`의 `runWritebackCollection` stats를 읽어 최근 7일 `processed*AliasRows` / `invalid*AliasRows` 처리량까지 함께 노출. 핵심 metric: `open_p1`, `p1_undecided`, `decided_waiting_sync`, `invalid_open`, `processed_last_7d`, `last_writeback_success_at_jst`. 반영: `potex-gas/src/publish/views.ts`, `csWorkbook.ts`, `constants.ts`, `workbook_manifest.json`, CS 운영 문서들. `npm run build` 성공, 번들 172.5kb. Windows-side `clasp.cmd push -f`로 push 성공. `clasp run runFullRefresh`는 project-local Execution API credential 부족으로 미실행.
- (2026-05-21) **P-007 step 4 push + live 검증 완료** — `Sync_Log` 누적 stats를 읽는 Executive 신규 publish 탭 `経営_例外推移` 추가. 기본 튜닝은 **JST 일별 / 최근 30일 / 날짜별 마지막 successful snapshot**. 추적 metric: `feedback_match_exception_count` (`feedbackExceptionRowsWritten`), `payment_unmatched_count`, `continuation_unmatched_count`, `line_registration_unmatched_count`, `feedback_response_id_collision_count`, 그리고 각 직전 표시일 대비 `_delta`. 반영: `potex-gas/src/publish/views.ts`, `managementWorkbook.ts`, `constants.ts`, `workbook_manifest.json`, 운영 문서들. `npm run build` 성공, 번들 165.8kb. **WSL `clasp`는 계속 `invalid_grant`였지만 Windows-side `node_modules\\.bin\\clasp.cmd push -f`로 push 성공**. 이후 live 탭 생성/숫자 검증까지 완료.
- (2026-05-20) **P-012 Phase 2 post-cleanup + clasp push** — `buildStagingFeedback` → `buildFeedbackResponses` 이름 정리 (이제 staging이 아니라 in-memory ingest pipeline). `Sync_Log` stats에 `feedbackResponseIdCollisions` 카운터 추가 (response_id SHA-256 hash dedupe 검증용 — 1 이상이면 hash 충돌 발생). 빌드 159.5kb.
- (2026-05-20) **経営_データ状況 + 활성 docs 정리 + clasp push** — `経営_データ状況`에 `feedback_response_id_collision_count` metric 추가 (canonical Feedback rows sharing response_id 카운트, expected 0). 활성 reference docs에서 `Staging_Feedback` 잔재 제거: `CLAUDE.md` tab inventory, `OPS_WORKBOOK_ARCHITECTURE.md` 유지 대상, `docs/sheet-reference.md` 섹션, `docs/database-overview.md` staging/canonical layer 리스트, `potex-gas/README.md` source→canonical 흐름 설명, `FEEDBACK_PIPELINE_STATUS.md` step 1 설명 모두 step 2d 결과 반영. 빌드 160.0kb.
- (2026-05-20) **Sync_Log target fix + clasp push** — 운영자 `runFullRefresh`/`runPublishAll` 성공했으나 `POTEX DB > Sync_Log`가 비어 있는 버그. 원인: `appendSyncLog`가 `SpreadsheetApp.getActiveSpreadsheet()`를 사용 → 트리거 컨테이너에 바인딩된 워크북(Potex CS 등)에 append되거나 unbound 시 null. 수정: `logging.ts` 재작성 — `PropertiesService.getScriptProperties().getProperty(PROPS.DB_SPREADSHEET_ID)`로 명시적 POTEX DB open, 실패 시 active fallback, try/catch best-effort (logging 실패가 메인 잡을 깨지 않도록). 빌드 160.5kb. **clasp 재로그인(invalid_grant) 후 push 완료.** 운영자 5종(CS/Executive/Concierge/Sales/Coaches)에 rogue `Sync_Log` 없음 확인.
- (2026-05-20) **Sync_Log readability fix + push** — append는 되지만 헤더가 없어 컬럼 의미 불명 + stats가 JSON blob 한 줄이라 가독성 낮음. 수정: `ensureSyncLogHeader()` 추가 — 시트가 존재하지만 첫 행이 `timestamp/job_name/status/stats`가 아니면 row 1을 insertRowBefore 후 헤더 setValue + freeze. stats는 `formatStats()`로 키 알파벳 정렬 + `key=value` 줄바꿈 join (셀 내 줄바꿈 표시) — JSON blob 가독성 ↑. 빌드 161.7kb. clasp push 완료. 운영자 `runFullRefresh` 1회 → `Sync_Log` 1행 헤더 + 신규 stats 형식 확인.
- (2026-05-20) **P-007 step 1 docs (`OPERATIONS_MANUAL`) + `continuation_exception_id` additive + push** — exception/health 인프라 polish. 두 가지 변경:
  1. **`OPERATIONS_MANUAL.md` 보강**: `経営_データ状況` 섹션을 카운트 / 예외-미매칭(4종) / 데이터 무결성(`feedback_response_id_collision_count`) / acquisition 으로 분류해 각 metric의 처리 시트 매핑 명시. `Sync_Log` 운영자 가이드 섹션 신설 (POTEX DB only — job_name 목록, error 대응 흐름, response_id collision 매 refresh 확인 가이드, 수정 금지).
  2. **`Exceptions_ContinuationMatch` additive cleanup**: `CONTINUATION_EXCEPTION_HEADER`에 `continuation_exception_id` (`ce_{12자hex}` SHA-256 of `raw_name+raw_plan+raw_contract_date+raw_amount`) 컬럼 추가. `buildContinuationExceptionId()` 헬퍼 `commercial.ts`에 추가. `CS_継続名寄せ確認` header에 동일 컬럼 우측 추가 (기존 `exception_source_sheet`/`exception_source_row` + `continuationReviewKey()` 룩업 보존 — P1=10 대기 큐 영향 없음). 추후 cutover 시 lookup을 ce_id 기준으로 전환할 수 있도록 발판 마련. 빌드 162.6kb. clasp push 완료. 운영자 다음 `runFullRefresh` 후 `Exceptions_ContinuationMatch` / `CS_継続名寄せ確認`에 `continuation_exception_id` 컬럼 정상 채워지는지 확인.
- (2026-05-20) **P-007 step 2 dual-key lookup + ce_id evidence + push** — `CS_継続名寄せ確認`의 `existingInputByKey`를 dual-key로 전환: `continuation_exception_id` 우선(`ce::{ce_id}`), 빈 경우 기존 `(exception_source_sheet, exception_source_row)` 튜플 fallback(`src::{sheet}||{row}`). 신규 row는 즉시 ce_id로 매칭되고 P1=10 운영자 대기 row는 기존 source-coord 키로 그대로 매칭 (양쪽 다 indexed). `continuationReviewKeyByCeId()` / `continuationReviewKeyBySource()` 헬퍼 추가. `csWriteback`의 continuation alias `evidence` 필드도 ce_id 우선 (`continuation_exception_id:{ce_id}`)으로 전환, 미존재 시 legacy `{sheet} row {row}` fallback. 빌드 163.3kb. 운영자 P1=10 처리 완료 후 step 3에서 source-coord 컬럼 + fallback 완전 제거 가능 (Phase 2c 패턴 마무리).
- (2026-05-20) **P-007 step 3 final cut + push** — Continuation exception 흐름의 source-coord 잔재 + dual-key transitional 코드 전체 제거. (a) `CONTINUATION_EXCEPTION_HEADER`에서 `source_sheet`/`source_row` 컬럼 삭제 + commercial.ts ingest emit에서 제거 — 이제 `Exceptions_ContinuationMatch`는 `continuation_exception_id` PK + raw_* + 도메인 필드만 갖는 깔끔한 표. (b) `CS_継続名寄せ確認` 헤더에서 `exception_source_sheet`/`exception_source_row` 제거. (c) `CS_CONTINUATION_ALIAS_REVIEW_HEADER`를 `views.ts`에 단일 export로 정의 — `csWriteback`이 local 복사본 대신 import. publish/writeback 양측 컬럼 순서 divergence 해소 (long-standing tech debt). (d) `resolveContinuationCeId(row)` 단일 헬퍼: `continuation_exception_id` 컬럼 우선, 빈 경우 `buildContinuationExceptionId(raw_name, raw_plan, raw_contract_date, raw_amount)`로 fly-recompute — 운영자 P1=10 기존 행은 raw_* 4 컬럼이 있으므로 자동 매칭. (e) `continuationReviewKey*` 3 헬퍼 + dual-key 인덱싱 + evidence fallback 전부 제거. evidence는 `continuation_exception_id:{ce_id}` 한 형식만. 빌드 161.8kb (-1.5kb). clasp push 완료. 운영자 다음 `runFullRefresh` → `Exceptions_ContinuationMatch` 컬럼 정리 + `CS_継続名寄せ確認` 컬럼 정리 + P1=10 기존 operator input 정상 매칭 (4 columns 보존) 확인 요청.
- (2026-05-20) P-012 운영팀 회답 7건 완료. 결정 사항:
  - Phase 1 (Line_Registrations) **착수 가능** — line_user_id 빈 행 0건 (Q-LR-1).
  - Phase 2 (Feedback) **착수 가능** — response_id hash 도입, source_sheet/source_row 완전 제거 (Q-FB-1/2: 행번호 불필요, archive 안 함).
  - Phase 3 (Payments) **보류** — 영업팀 자동화 도입과 묶음 (Q-PY-1). 별도 P-013로 분리.
  - Phase 4 (Customers) **matrix 대기** — 사용자가 ownership matrix 직접 작성 (Q-CU-1). `Customer_Edit_History` 표 신설 동반 (Q-CU-2).
  - LStep API 보류 유지 (Q-LR-2).

## 활성 작업
### Partner pipeline (P-010) — Phase A scaffold push 완료
- 운영팀 공유 자료: `docs/proposals/2026-05-19-partner-pipeline-overview-ja.md`
- 운영팀 회답 라운드 질문: `docs/proposals/2026-05-19-partner-pipeline-questions-ja.md` (Q1–Q7)
- 확정 답변: Q1 form 예약부터 시작 + 향후 LINE 연동 가능 / Q2 계약·입금 정본은 기존 `Plans`·`Payments` / Q3 status enum은 우선 구현 후 나중에 수정 가능 / Q4 partner workbook 분리 / Q5 partner 주입력 + CS 예외적 보완 / Q6 CS가 partner assign 시 `Potex CS` 신규 input 탭에 lead 1행 입력 / Q7 stale 경고는 CS + partner 본인.
- 코드 상태: **Phase A push 완료** — `refreshCanonicalStaging()`가 `Partners`, `Partner_Alias_Map`, `Customer_Partner_Assignments`, `Partner_Pipeline_Status`를 auto-create/maintain하고 `Partners` seed row 2개 (`PART-001 稲井`, `PART-002 佐藤`)를 보장.
- (2026-05-21) **P-010 Phase B 구현 완료 (build OK, push 진행 예정)** — `Potex CS`에 `CS_Partner_Assignment_Input` publish 탭 추가. source workbook `フォームの回答`를 직접 읽어 provisional `LEAD-FORM-xxxxx` lead seed를 만들고, canonical `Customers`와 이메일/이름 exact match 시 `customer_id`를 우선 `lead_id`로 승격. 기존 `Partners` / `Customer_Partner_Assignments`를 조인해 이미 배정된 lead는 queue에서 제외. heuristic (`학생` / `インターン` / `就活` / `転職`) 기반 `suggested_partner_id`/name 표시 추가. `collectCsWritebackRows()`는 partner assignment 입력을 읽어 `Customer_Partner_Assignments`에 upsert (`assignment_source=cs_partner_assignment_input`, id=`CPA-xxxx`)하고, `runWritebackCollection`/`runFullRefresh`의 canonical refresh 조건에도 partner assignment 처리량을 포함. `npm run build` 성공, 번들 192.9kb.
- 다음: Windows-side `clasp.cmd push -f` 후 운영자 `runFullRefresh`로 신규 CS 탭 생성 확인 + `runWritebackCollection` 1건 smoke test.
- (2026-05-21) **운영 설계 수정:** 사용자 피드백으로 CS는 coach 배정과 partner 배정을 별도 공수로 관리하지 않는 것이 낫다고 판단. 따라서 현재 `CS_Partner_Assignment_Input`는 transitional slice로 보고, 다음 리팩터에서 `CS_担当割当入力` 단일 input → `assignee_type` 기반 downstream coach/partner canonical fan-out 구조로 바꾸는 방향 확정.
- (2026-05-21) **모델 설계 재수정:** 사용자 판단으로 partner canonical도 과하다고 봄. 최종안은 별도 `Partners` 축이 아니라 `Coaches` 축에 partner를 흡수하고, `assignee_kind`/`assignee_scope` 같은 컬럼으로 partner 여부를 판별하는 구조. 따라서 이미 넣은 partner canonical 4종은 transitional scaffold이며, 다음 작업은 이를 coach canonical 확장안으로 접는 migration/refactor가 된다.
- (2026-05-21) **통합 리팩터 구현 완료 (build OK / 미배포):** `CS_Partner_Assignment_Input` → `CS_担当割当入力` 통합 리네임. `Customer_Coach_Assignments`를 `lead_id` / `assignee_kind` / `assignee_scope` / `assignment_source` 포함 스키마로 확장했고, partner assignment writeback도 별도 `Customer_Partner_Assignments`가 아니라 여기로 upsert되도록 변경. 또한 `refreshCanonicalStaging()`가 legacy `Partners`를 읽어 `Coaches`에 `COACH-PARTNER-001/002` mirror seed를 자동 보장한다. `npm run build` 성공 (196.8kb). 남은 일은 push + live workbook smoke test + partner canonical 4종 read-path 제거.
- (2026-05-23) **publish UX localization live 반영 완료** — dual-header hotfix 후 `runPublishAll` 성공까지 확인. publish sheet의 operator-facing header는 일본어 라벨로 live 반영됐고, hidden machine-header / writeback 구조는 그대로 유지된다. README / data-health note / sales/coach/concierge/operator-facing copy도 일본어화된 상태로 배포 완료.
- (2026-05-23) **legacy workbook 실물 검토 완료** — `POTEX_顧客管理_v2 のコピーテスト用 のコピー` 실제 시트를 열어 확인. 탭 구조는 `__README` → role tabs (`商談リスト`, `コンシェルジュ業務`, `受講者管理`, `入金管理`, `コースマスター`, `コーチマスター`, `テンプレ`, `返金管理`, `0_集計用ビュー`, `債権履歴`, `債権サマリー` 등)로 되어 있고, `__README`는 일본어 운영 규칙/가이드 landing page 역할을 한다. 결론: 이 workbook은 **operator UX / naming / README 구조 참고용**으로는 강하게 유효하지만, **sheet-coupled formula architecture / version-offset branching / workbook-as-DB** 패턴은 채택하지 않는다.
- (2026-05-23) **계획 반영 완료** — `docs/plans/2026-05-22-workbook-ux-priority-plan.md`에 legacy workbook review 결과를 반영했다. 후속 second-pass에서는 `__README` 스타일 가이드, role-first Japanese wording, 잔여 영어 display value(`suggested_action` 등) 정리를 검토한다.
- (2026-05-24) **CS second-pass UX polish + live spot-check 완료** — `potex-gas/src/publish/views.ts`에서 `suggested_action`는 publish 생성 시점에만 채워지는 operator-facing 표시값이고 writeback branching에는 쓰이지 않음을 확인했다. 따라서 `CS_入金名寄せ確認` / `CS_継続名寄せ確認`의 표시값을 일본어(`候補に違和感がなければ承認` 등)로 직접 localize했다. `suggestion_basis`, alias/current status, followup reason, payment status, event type, assignment type 등 남아 있던 operator-facing English residuals도 read-only / display-safe 경로 중심으로 일본어화했다. `buildCsReadme` / `buildSalesReadme` / `buildCoachReadme` / `buildConciergeReadme` / `buildExecReadme`도 practical Japanese guide 중심 문구로 보강. `npm run build` 성공 (245.3kb), Windows-side `clasp.cmd push -f` 성공. `clasp run runPublishAll`은 여전히 Execution API scope auth 부족으로 로컬 즉시 실행은 못 했지만, live workbook 5종을 Sheets API로 spot-check한 결과 일본어 탭명과 README/guide 참조는 기대대로 유지되고 있었다.

### Operator approval 진행
- P1 row부터 검토. P2/P3는 customer ingest 보강이 더 필요한 경우가 많아 순차 검토. top-of-funnel 전체 매칭 시도는 금지.
- 승인 흐름: input 탭 → `runWritebackCollection()` → `Customer_Alias_Map` 반영 → canonical refresh → 5 워크북 republish (writeback에서 자동 chain).

## 다음 세션 시작 순서
1. 이 파일
2. `docs/backlog.md`
3. `agents/workflow.md`
4. 요청 분류 (문서/운영설계 vs 데이터정리 vs 구현)
5. 결과 검증 후 문서 갱신

## 참고 문서
- `README.md` / `CLAUDE.md`
- `agents/workflow.md`
- `docs/backlog.md`
- `docs/plans/2026-05-24-executive-data-trust-and-freshness-plan.md` (경영 회의용 freshness / stale-domain / human update omission visibility 계획)
- `OPERATIONS_MANUAL.md`
- `OPS_WORKBOOK_ARCHITECTURE.md`
- `PHASE1_CUTOVER_RUNBOOK.md`
- `FEEDBACK_PIPELINE_STATUS.md`
- `docs/domain/2026-05-19-post-contract-orientation-flow.md` (운영팀 PDF 도메인 노트)
- `docs/db-schema.md` (DB 각 시트 컬럼/출처 reference)
