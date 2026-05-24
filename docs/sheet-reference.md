# Potex Sheet Reference

## 읽는 법
각 시트마다 아래 네 가지만 본다.
- **위치**: 어느 workbook에 있는가
- **역할**: 왜 존재하는가
- **누가 수정하는가**: 사람 / GAS / 둘 다 아님
- **주의사항**: 헷갈리기 쉬운 점

---

## 1. Source / Reference workbooks
이 섹션의 시트들은 **모두 수정 금지**다.

### `受講者管理`
- 위치: source workbook
- 역할: 고객/수강생 관련 원본 데이터
- 수정 주체: 현업 source 운영팀
- Potex 프로젝트 관점: 읽기 전용 source

### `顧客満足度会議`
- 위치: source workbook
- 역할: 만족도/지표 관련 운영 원본
- 수정 주체: 현업 source 운영팀
- Potex 프로젝트 관점: 읽기 전용 source

### `月次振り返りアンケート （回答）`
- 위치: source workbook
- 역할: 피드백 원본 응답
- 수정 주체: Google Form 응답 시스템
- Potex 프로젝트 관점: 읽기 전용 source

### `⭕️使用中｜POTEX数値管理`
- 위치: live operational reference workbook
- 역할: 실운영에서 검증된 workbook 구조 참고 자산
- 수정 주체: 현업 운영팀
- Potex 프로젝트 관점: 구조 참고용, 수정/삭제 금지

---

## 2. POTEX DB workbook

### `Staging_Customers`
- 역할: 고객 source를 정규화 전 임시 적재
- 수정 주체: GAS / 스크립트
- 사람이 직접 수정?: 아니오
- 주의: source ingest 품질 확인용 중간층
- 현재 상태: `SOURCE_CUSTOMERS_WORKBOOK_ID`는 설정되어 있고, `顧客管理`의 named rows 기준으로 staging 정렬이 검증됨. blank-name rows는 staging refresh에서 스킵된다.

### `Staging_Coaches`
- 역할: 코치 source 임시 적재
- 수정 주체: GAS / 스크립트
- 사람이 직접 수정?: 아니오
- 주의: canonical `Coaches` 생성 전 단계

### `Staging_Sessions`
- 역할: 세션 원본 임시 적재
- 수정 주체: GAS / 스크립트
- 사람이 직접 수정?: 아니오
- 주의: 세션 누락/파싱 문제 추적용

### `Staging_Feedback` *(제거됨, P-012 Phase 2 step 2d, 2026-05-20)*
ingest가 이제 raw 응답을 `Feedback` / `Exceptions_FeedbackMatch`에 직접 적재한다. feedback matching 문제는 `Exceptions_FeedbackMatch` 부터 본다 (`response_id`, `coach_id`, raw 점수 컬럼 포함).

### `Line_Registrations` *(P-012 Phase 1로 `Staging_LineRegistration` 흡수, 2026-05-20)*
- 역할: LINE friend-add canonical (csvA + csv_potex 통합)
- 수정 주체: GAS / LINE ingest
- 사람이 직접 수정?: 아니오
- 주의: PK는 `line_registration_id = line_{segment}_{line_user_id}`. 매칭된 행만 `ConversionHistory.line_registered` event로 발행. `attribution_tags`는 publish 시점에 `tokenizeAttributionTags()`로 정규화

### `Staging_Payments`
- 역할: `着金管理マスター` raw ingest 보관 + customer match 가시화
- 수정 주체: GAS / 스크립트
- 사람이 직접 수정?: 아니오
- 주의: current GAS path에서는 canonical 연결키를 `customer_id`로 둔다. `customer_id`가 비어 있는 행이 현재 commercial data quality queue다. 오래된 Python/generated report의 `matched_customer_id` 표기는 legacy로 취급한다.

### `Customers`
- 역할: 고객 canonical master
- 수정 주체: GAS / 정규화 로직
- 사람이 직접 수정?: 원칙적으로 아니오
- 주의: 고객 단위 truth table

### `Coaches`
- 역할: 코치 canonical master
- 수정 주체: GAS / 정규화 로직
- 사람이 직접 수정?: 원칙적으로 아니오
- 주의: 코치명 canonical 기준은 가능하면 풀네임

### `Sessions`
- 역할: 세션 canonical fact table
- 수정 주체: GAS / 정규화 로직
- 사람이 직접 수정?: 아니오
- 주의: 고객/코치 연결의 핵심 근거

### `Feedback`
- 역할: 피드백 canonical fact table
- 수정 주체: GAS / alias writeback 반영
- 사람이 직접 수정?: 아니오
- 주의: unmatched 해결 전후 상태가 바뀔 수 있음

### `Plans`
- 역할: 상품/플랜 정보 canonical 보관
- 수정 주체: GAS / commercial sync script
- 사람이 직접 수정?: 가급적 아니오
- 주의: 현재는 `顧客管理`.`コース` 기반 base plan + `継続プラン管理` matched continuation row를 함께 담는다

### `Payments`
- 역할: 결제 정보 canonical 보관
- 수정 주체: GAS / commercial sync script
- 사람이 직접 수정?: 가급적 아니오
- 주의: `着金管理マスター` 기준 first-pass canonicalization이며 unmatched payment는 `Staging_Payments`에서 추적한다

### `ConversionHistory`
- 역할: 전환/상태 변화 기록
- 수정 주체: 스크립트 또는 후속 운영 흐름
- 사람이 직접 수정?: 가급적 아니오
- 주의: 현재는 customer lifecycle + `体験者一覧` + `着金管理マスター` 기반 최소 backfill이 live 반영되어 있다

### `Customer_Coach_Assignments`
- 역할: customer ↔ coach 할당 관계 canonical 보관
- 수정 주체: GAS (`Staging_Customers.assigned_coach_name` + `Coaches` + `Coach_Alias_Map` 기반 derive)
- 사람이 직접 수정?: 아니오
- 주의: publish 시 assigned coach name resolution은 이 시트를 우선 참조하고 `Customers.assigned_coach_name`은 fallback. cold-start (시트 없음) 시에도 ingest는 throw하지 않고 빈 상태로 진행

### `Customer_Channel_Links`
- 역할: customer ↔ cross-channel ID 자리표 (LINE/IG 등 stable ID)
- 수정 주체: GAS
- 사람이 직접 수정?: 아니오
- 주의: `Customer_Acquisition_Source`와 혼동 금지. 후자는 DB-no-duplicate 원칙에 따라 제거됐고 attribution은 publish 시점 join으로만 표시. `Customer_Channel_Links`는 향후 cross-channel 확장 자리표 의미로 유지

### `Coach_Name_Map`
- 역할: 코치명 canonical 매핑
- 수정 주체: 스크립트 + 필요 시 관리용 정리
- 사람이 직접 수정?: 제한적으로 가능
- 주의: short name보다 full name 우선

### `Coach_Alias_Map`
- 역할: 코치 alias 보정 테이블
- 수정 주체: 스크립트 + 제한적 수동 정리
- 사람이 직접 수정?: 가능하지만 신중히
- 주의: 운영 source에 반복 등장하는 실명은 provisional entity 허용

### `Customer_Alias_Map`
- 역할: 고객 alias 보정 테이블
- 수정 주체: 기본적으로 CS workbook writeback
- 사람이 직접 수정?: **DB에서 직접 수정하지 않는 것이 원칙**
- 주의: 일상 운영은 `CS_別名解決入力`에서 한다

### `Exceptions_FeedbackMatch`
- 역할: feedback와 customer 매칭 예외 보관
- 수정 주체: GAS / writeback 결과
- 사람이 직접 수정?: 아니오
- 주의: unresolved 건의 공식 예외 큐

### `Exceptions_ContinuationMatch`
- 역할: 継続プラン管理 ingest에서 canonical customer 매칭 실패한 row 보관
- 수정 주체: GAS
- 사람이 직접 수정?: 아니오
- 주의: `continuation_unmatched_count` metric의 source. `CS_継続名寄せ確認`로 publish되어 operator가 line registration 후보와 매칭 검토

### `Ops_Feedback_Review`
- 역할: feedback 기반 운영 검토용 파생 시트
- 수정 주체: GAS
- 사람이 직접 수정?: 아니오
- 주의: publish source 역할도 겸함

### `Ops_Followup_Queue`
- 역할: follow-up이 필요한 고객 큐
- 수정 주체: GAS
- 사람이 직접 수정?: 아니오
- 주의: CS workbook `CS_要フォロー一覧`의 upstream source
- Phase 1 verdict: **accept**
- 현재 계약: `priority`, `customer/customer_id`, `assigned_coach_name`, `feedback_coach_name`, `followup_reason`, `owner`, `queue_status`, `source_ref`를 담는 action-oriented queue

### `Ops_コーチ_担当負荷`
- 역할: 코치별 부하/위험 신호 집계
- 수정 주체: GAS
- 사람이 직접 수정?: 아니오
- 주의: Executive summary의 upstream source
- Phase 1 verdict: **accept**
- 현재 계약: active customer 수, session 수, follow-up 고객 수, low-satisfaction count, remaining capacity를 코치 단위로 본다

### `Ops_ZeroSession_Review`
- 역할: 세션 이력 누락/이상 후보 확인
- 수정 주체: GAS
- 사람이 직접 수정?: 아니오
- 주의: weekly QA 성격이 강함

### `Ops_Continuation_Targets`
- 역할: 연장/후속관리 대상 파생 시트
- 수정 주체: GAS
- 사람이 직접 수정?: 아니오
- 주의: CS workbook `CS_継続対象一覧`의 upstream source
- Phase 1 verdict: **accept**
- 현재 계약: `priority`, `continuation_tag`, `after_follow_progress`, `next_action`, `reason` 중심의 후속관리 queue로 본다

### `Sync_Log`
- 역할: 동기화 로그 저장용
- 수정 주체: GAS
- 사람이 직접 수정?: 아니오
- 주의: append-only 시스템 로그. 현재 헤더는 `timestamp / job_name / status / stats`, `stats`는 `key=value` 줄바꿈 형식.

### `Sync_Control`
- 역할: 동기화 제어/토글용 시스템 시트
- 수정 주체: GAS / 관리자
- 사람이 직접 수정?: 필요 시 관리자만
- 주의: 일반 운영자 대상 아님

### `Publish_Manifest`
- 역할: 어떤 시트를 어디로 publish하는지 관리하는 시스템 시트
- 수정 주체: GAS / 관리자
- 사람이 직접 수정?: 필요 시 관리자만
- 주의: 일반 운영자 대상 아님

---

## 3. Potex CS workbook

### `CS_要フォロー一覧`
- 역할: CS가 실제로 따라가야 할 follow-up 대상
- 수정 주체: GAS publish
- 사람이 직접 수정?: 원칙적으로 아니오
- 주의: 읽기/업무 확인용 queue
- 검증 메모: 2026-05-17 기준 live row 18건 확인, `coach_name`은 upstream `feedback_coach_name`/`assigned_coach_name`에서 채워지도록 보정됨

### `CS_継続対象一覧`
- 역할: 연장/후속관리 확인용 queue
- 수정 주체: GAS publish
- 사람이 직접 수정?: 원칙적으로 아니오
- 주의: 읽기/업무 확인용 queue

### `CS_例外確認`
- 역할: exception review용 요약 화면
- 수정 주체: GAS publish
- 사람이 직접 수정?: 아니오
- 주의: unresolved 원인 파악용

### `CS_更新アクション`
- 역할: 향후 CS 수기 action writeback 입력용
- 수정 주체: 사람 입력 가능
- 사람이 직접 수정?: 예
- 주의: canonical table 직접 수정 대신 여기서 입력

### `CS_別名解決入力`
- 역할: 고객 alias 해결용 공식 입력 화면
- 수정 주체: 사람 입력 + GAS writeback 결과 반영
- 사람이 직접 수정?: 예, 하지만 아래 4개만
- 수정 가능한 핵심 컬럼:
  - `operator_decision_status`
  - `operator_selected_customer_id`
  - `operator_selected_customer_name`
  - `operator_note`
- 주의: 나머지 컬럼은 publish 결과이므로 직접 건드리지 않음

### `CS_承認進捗`
- 역할: payment/continuation alias review의 open queue와 최근 writeback 처리량 요약 + partner status pipeline 모니터링
- 수정 주체: GAS publish
- 사람이 직접 수정?: 아니오
- 주의: operator queue 자체를 대체하지 않고, 어디부터 처리할지 우선순위를 보여주는 monitoring 탭
- 현재 partner 핵심 metric: `open_total`, `waiting_first_update`, `stale_30d`, `meeting_completed`, `potex_in_progress`, `processed_last_7d`

### `CS_入金名寄せ確認`
- 역할: 결제 row가 canonical customer와 아직 연결되지 않은 건을 operator가 검토하는 queue
- 수정 주체: GAS publish + 사람 입력 + GAS writeback 결과 반영
- 사람이 직접 수정?: 예, 하지만 아래 4개만
- 수정 가능한 핵심 컬럼:
  - `operator_decision_status`
  - `operator_selected_customer_id`
  - `operator_selected_customer_name`
  - `operator_note`
- 수정 금지: `priority`, payment/candidate/source/suggestion/current 상태 컬럼, `writeback_alias_name`, `sync_status`, `last_collected_at`
- 주의: header가 비어 있거나 P1/P2/P3 count가 stale처럼 보이면 승인하지 않는다. fresh publish 검증 후 `approve_if_context_matches` 대상만 승인한다.

### `CS_継続名寄せ確認`
- 역할: `Exceptions_ContinuationMatch`의 `continuation_customer_unmatched` 건을 operator가 검토하는 queue
- 수정 주체: GAS publish + 사람 입력 + GAS writeback 결과 반영
- 사람이 직접 수정?: 예, 하지만 아래 4개만
- 수정 가능한 핵심 컬럼:
  - `operator_decision_status`
  - `operator_selected_customer_id`
  - `operator_selected_customer_name`
  - `operator_note`
- 수정 금지: exception/candidate/source/suggestion/current 상태 컬럼, `writeback_alias_name`, `sync_status`, `last_collected_at`
- 주의: 탭이 없거나 0건이면 즉시 오류로 보지 말고, full refresh/publish 후 `Exceptions_ContinuationMatch` row 수와 함께 확인한다.

---

## 4. Potex Executive workbook

### `経営_コーチ負荷`
- 역할: 코치 부하 요약
- 수정 주체: GAS publish
- 사람이 직접 수정?: 아니오
- 주의: 운영용 dashboard 성격

### `経営_顧客リスク`
- 역할: 고객 리스크/feedback 위험 요약
- 수정 주체: GAS publish
- 사람이 직접 수정?: 아니오
- 주의: high-level summary view
- 현재 핵심 metric: `low_satisfaction_feedback_count`, `followup_feedback_count`, `feedback_match_exception_count`

### `経営_データ状況`
- 역할: 데이터 정합성/건강 상태 점검
- 수정 주체: GAS publish
- 사람이 직접 수정?: 아니오
- companion: `経営_例外推移`가 동일 예외/미매칭 메트릭의 시계열을 제공
- 주의: `数値整合性チェック`에 해당하는 최소 버전
- 현재 핵심 metric: `customers_count`, `coaches_count`, `sessions_count`, `feedback_count`, `followup_queue_count`, `continuation_targets_count`, `feedback_match_exception_count`, `partner_assignment_count`, `partner_status_updated_count`, `partner_stale_30d_count`

### `経営_例外推移`
- 역할: `Sync_Log` 기반 예외/미매칭 시계열 모니터링
- 수정 주체: GAS publish
- 사람이 직접 수정?: 아니오
- 기본 튜닝: JST 일별 / 최근 30일 / 각 날짜 마지막 successful snapshot
- 현재 핵심 metric: `feedback_match_exception_count`, `payment_unmatched_count`, `continuation_unmatched_count`, `line_registration_unmatched_count`, `feedback_response_id_collision_count`

---

## 5. Potex Concierge workbook

### `コンシェルジュ_使い方`
- 역할: concierge 운영자에게 이 workbook이 read-only임을 명시
- 수정 주체: GAS publish / 스크립트
- 사람이 직접 수정?: 아니오
- 주의: 사용 가능한 탭, ingest 상태, escalation 규칙을 설명하는 안내 탭

### `コンシェルジュ_フォロー一覧`
- 역할: concierge가 follow-up 건을 한 화면에서 읽기 전용으로 보는 queue
- 수정 주체: GAS publish / 스크립트
- 사람이 직접 수정?: 아니오
- 주의: `POTEX DB > Ops_Followup_Queue`를 richer shape로 노출한 파생 뷰
- 현재 검증 메모: 2026-05-17 기준 live row 18건 확인

### `コンシェルジュ_データ状況`
- 역할: concierge workbook 내부에서 ingest 상태와 핵심 건수를 확인
- 수정 주체: GAS publish / 스크립트
- 사람이 직접 수정?: 아니오
- 주의: 최소 metric은 `customer_ingest_mode`, `followup_queue_count`, `continuation_targets_count`, `feedback_match_exception_count`

---

## 6. Potex Sales workbook

### `営業_使い方`
- 역할: sales 운영자에게 이 workbook이 read-only임을 명시
- 수정 주체: GAS publish / 스크립트
- 사람이 직접 수정?: 아니오
- 주의: 읽는 순서, 수정 금지 범위, escalation 규칙을 설명하는 안내 탭

### `営業_契約一覧`
- 역할: 계약/착금 기준 전체 상업 row를 최신순으로 보는 publish 뷰
- 수정 주체: GAS publish / 스크립트
- 사람이 직접 수정?: 아니오
- 주의: unmatched row도 의도적으로 숨기지 않고 그대로 노출

### `営業_未入金一覧`
- 역할: 미입금 row 전용 큐
- 수정 주체: GAS publish / 스크립트
- 사람이 직접 수정?: 아니오
- 주의: 영업과 CS가 고객 특정/입금 추적에 쓰는 read-only 뷰

### `営業_データ状況`
- 역할: payments / plans / conversion / unmatched counts 요약
- 수정 주체: GAS publish / 스크립트
- 사람이 직접 수정?: 아니오
- 주의: signal-style health 요약 탭

### `営業_ファネル推移`
- 역할: canonical `ConversionHistory` 기반 최근 funnel event 뷰
- 수정 주체: GAS publish / 스크립트
- 사람이 직접 수정?: 아니오
- 주의: 이벤트 시퀀스와 최근 추이를 읽는 용도

---

## 7. Potex Coaches workbook

### `コーチ_使い方`
- 역할: coach 운영자에게 이 workbook이 read-only임을 명시
- 수정 주체: GAS publish / 스크립트
- 사람이 직접 수정?: 아니오
- 주의: 읽는 순서, 수정 금지 범위, escalation 규칙을 설명하는 안내 탭

### `コーチ_要フォロー一覧`
- 역할: 코치 관점 follow-up alerts를 읽기 전용으로 보는 queue
- 수정 주체: GAS publish / 스크립트
- 사람이 직접 수정?: 아니오
- 주의: 장문 comment / gap comment 가독성을 우선한 publish 뷰

### `コーチ_担当負荷`
- 역할: 코치별 담당 고객 수와 부하/경고 신호 요약
- 수정 주체: GAS publish / 스크립트
- 사람이 직접 수정?: 아니오
- 주의: remaining capacity / overload 신호를 보는 요약 탭

### `コーチ_データ状況`
- 역할: 코치 workbook 내부에서 핵심 건수와 health 상태를 확인
- 수정 주체: GAS publish / 스크립트
- 사람이 직접 수정?: 아니오
- 주의: manager-friendly health block

---

## 8. 삭제한 시트
### `MasterData`
- 이전 위치: POTEX DB
- 삭제 이유: 현재 운영 구조와 연결되지 않는 legacy sheet

### `Dashboard`
- 이전 위치: POTEX DB
- 삭제 이유: stale 상태였고 Executive workbook summary로 역할 이관

주의:
- 이 삭제는 **POTEX DB**에서만 수행했다.
- **현재 운영 중인 source/reference workbook은 수정/삭제하지 않았다.**
