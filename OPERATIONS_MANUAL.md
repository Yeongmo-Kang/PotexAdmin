# Potex 운영 매뉴얼

## 1. 이 문서는 누구를 위한 것인가
이 문서는 Potex 운영자가 **어디를 보고**, **어디는 건드리면 안 되고**, **문제가 생기면 어떤 순서로 확인해야 하는지**를 빠르게 이해하기 위한 사용 매뉴얼이다.

기술 문서가 아니라 **실제 운영용 안내서**로 읽으면 된다.

---

## 2. 먼저 기억할 5가지

1. **원본 시트는 수정하지 않는다.**
2. **`POTEX DB`는 운영자가 직접 만지는 화면이 아니다.**
3. **일상 운영은 `Potex CS`, `Potex Executive`, `Potex Concierge`에서 한다.**
4. **publish 시트는 읽기 전용이다.**
5. **사람이 입력하는 곳은 input / writeback 시트뿐이다.**

---

## 3. 어디를 보면 되는가

### 3.1 원본 시트와 upstream 흐름
다음 시트는 **읽기만 하고 수정하지 않는다.**
- `受講者管理`
- `顧客満足度会議`
- `月次振り返りアンケート （回答）`
- `⭕️使用中｜POTEX数値管理`

다만 실제 LINE/고객 태그의 upstream은 spreadsheet가 아니라 `LStep`이다.
현재 운영 흐름은 다음과 같이 이해한다.
1. 유저가 공식 LINE을 친구추가한다.
2. LStep에서 LINE 태그와 고객정보를 관리한다.
3. 영업이 고객 면담 결과를 Slack에 보고한다.
4. CS가 Slack 보고를 보고 LStep을 갱신한다.
5. LStep/관련 화면에서 CSV를 포맷별로 다운로드한다.
6. CSV를 스프레드시트에 수동 import한다.
7. GAS가 그 데이터를 읽어 대시보드/운영 workbook을 갱신한다.

따라서 source spreadsheet는 현재 ingest 경유지이지만, 장기적으로는 LStep export/API 또는 Slack→LStep 업무흐름과 직접 연결하는 방향으로 교체 가능해야 한다.

### 3.2 실제 운영 workbook
#### `Potex CS`
CS 담당자가 주로 보는 곳
- `CS_要フォロー一覧`
- `CS_継続対象一覧`
- `CS_例外確認`
- `CS_別名解決入力`
- `CS_承認進捗`
- `CS_入金名寄せ確認`
- `CS_継続名寄せ確認`
- `CS_更新アクション` (향후/제한적 writeback 입력용)

#### `Potex Executive`
운영 리더/매니저가 보는 곳
- `経営_会議前チェック`
- `経営_更新状況`
- `経営_コーチ負荷`
- `経営_顧客リスク`
- `経営_データ状況`
- `経営_例外推移`

#### `Potex Concierge`
concierge가 follow-up 맥락을 읽기 전용으로 보는 곳
- `コンシェルジュ_使い方`
- `コンシェルジュ_フォロー一覧`
- `コンシェルジュ_データ状況`

### 3.3 DB workbook
#### `POTEX DB`
- canonical database
- 운영자가 직접 일상 수정하는 곳이 아님
- 관리자/자동화 기준 workbook

---

## 4. 시트별로 무엇을 해야 하나

### `CS_要フォロー一覧`
무엇을 보는가:
- follow-up이 필요한 고객
- 우선순위가 높은 feedback

운영자가 하는 일:
- 어떤 고객부터 대응할지 판단
- 코치/고객 이슈를 확인
- `coach_name`, `followup_reason`, 코멘트를 같이 보고 누가 어떤 후속 대응을 잡아야 하는지 판단

수정해도 되는가:
- 원칙적으로 아니오

### `CS_継続対象一覧`
무엇을 보는가:
- 연장/후속 제안이 필요한 고객

운영자가 하는 일:
- timing 확인
- 후속 액션 필요 여부 판단

수정해도 되는가:
- 원칙적으로 아니오

### `CS_例外確認`
무엇을 보는가:
- 예외 상황 요약
- unmatched / review 필요 케이스

운영자가 하는 일:
- 어떤 예외가 왜 생겼는지 확인

수정해도 되는가:
- 아니오

### `CS_別名解決入力`
무엇을 보는가:
- 고객명 alias 불일치 해결이 필요한 건

운영자가 하는 일:
- 동일인인지 판단
- 올바른 customer ID를 선택
- 메모 남기기

수정 가능한 컬럼:
- `operator_decision_status`
- `operator_selected_customer_id`
- `operator_selected_customer_name`
- `operator_note`

수정하면 안 되는 것:
- alias/source/current 상태 관련 publish 컬럼

주의:
- 이 시트에서 시스템이 실제로 반영하는 상태값은 `approved` / `active` / `resolved` 계열뿐이다.
- 판단을 보류할 때는 status를 억지로 쓰지 말고 비워 둔다.

### `CS_承認進捗`
무엇을 보는가:
- `CS_入金名寄せ確認` / `CS_継続名寄せ確認`의 **현재 open queue**와 최근 7일 writeback 처리량을 한 곳에서 요약한 운영 모니터링 탭.
- `open_p1`, `p1_undecided`, `decided_waiting_sync`, `invalid_open`을 통해 어디가 실제 병목인지 빠르게 본다.

운영자가 하는 일:
- `open_p1`와 `p1_undecided`가 높은 쪽부터 먼저 처리한다.
- `decided_waiting_sync`가 쌓이면 writeback cadence/실행 이상 여부를 확인한다.
- `invalid_open`이 늘면 해당 review 탭에서 operator 입력 오류를 먼저 수정한다.
- `processed_last_7d`가 0에 가깝고 open queue가 줄지 않으면 운영 루틴이 실제로 돌고 있는지 점검한다.

### `CS_入金名寄せ確認`
무엇을 보는가:
- 결제 row가 canonical customer와 아직 연결되지 않은 건
- line registration 후보와 suggested customer가 함께 붙은 review queue

우선순위 (`priority` 컬럼) 의미:
- `P1`: 시스템이 후보 line registration 행에서 **이미 canonical customer ID를 찾은** 케이스. `suggested_action`이 `approve_if_context_matches`로 채워진다. 가장 안전하게 승인 가능한 등급.
- `P2`: 후보 line registration 행은 찾았지만 그 행이 아직 canonical customer와 연결되지 않은 케이스. customer ingest 보강 또는 operator research가 먼저 필요.
- `P3`: 매칭 가능한 후보 line registration 행 자체가 없는 케이스. 보류 (`hold_no_candidate_found`).

`suggested_action` 의미:
- `approve_if_context_matches`: 맥락(이름/금액/contract_date/segment 등 publish 컬럼)을 보고 동일인이면 그대로 승인.
- `search_customer_or_wait_for_customer_ingest`: 후보는 있지만 canonical 연결이 안 됐으므로 보류.
- `hold_no_candidate_found`: 후보 자체 없음. 보류.

운영자가 하는 일:
- P1부터 우선 처리. 행의 publish 컬럼 (특히 `payment_customer_name`, `payment_line_name`, `candidate_display_name`, `candidate_line_registration_name`, `candidate_real_name`, `contract_date`, `amount`, `suggestion_basis`)을 보고 동일인 여부 판단.
- 맞으면 `operator_decision_status = approved` 입력. `current_canonical_customer_id` / `current_canonical_customer_name`은 이미 채워져 있으므로 그대로 두면 되고, 다른 customer로 정정하고 싶으면 `operator_selected_customer_id` / `operator_selected_customer_name`만 덮어쓴다.
- 필요하면 `operator_note`에 판단 근거 메모.
- P2/P3는 status를 비워 두고 note만 남긴다.

수정 가능한 컬럼:
- `operator_decision_status`
- `operator_selected_customer_id`
- `operator_selected_customer_name`
- `operator_note`

수정하면 안 되는 것:
- payment / candidate / suggestion / current 상태 관련 publish 컬럼
- 특히 `writeback_alias_name`은 시스템이 writeback 대상 alias를 고정한 값이므로 수정하지 않는다

주의:
- 이 시트도 시스템이 실제로 반영하는 상태값은 `approved` / `active` / `resolved` 계열뿐이다.
- 보류/추가조사가 필요하면 status를 비워 두고 note만 남긴다.
- 승인 후에는 다음 writeback + refresh + republish에서 row가 queue에서 사라질 수 있는데, 그것이 정상 동작이다.
- header가 비어 있거나 priority count가 stale처럼 보이면 승인하지 말고 GAS publish 경로 점검을 요청한다 (`inspect_post_refresh_state.py` verdict의 `cs_payment_alias_review_safe_for_operator_approval`이 `true`여야 한다).

### `CS_継続名寄せ確認`
무엇을 보는가:
- 継続プラン 관리에서 들어온 row가 canonical customer와 연결되지 않아 `Exceptions_ContinuationMatch`에 떨어진 건
- line registration 후보와 suggested customer가 함께 붙은 review queue

우선순위 (`priority` 컬럼) 의미:
- `P1`: 시스템이 후보 line registration 행에서 **이미 canonical customer ID를 찾은** 케이스. `suggested_action`이 `approve_if_context_matches`로 채워진다. 우선 승인 대상.
- `P2`: 후보는 찾았지만 canonical 연결이 없음. 보류.
- `P3`: 후보 없음. 보류.

`suggested_action` 의미: `CS_入金名寄せ確認`와 동일.

운영자가 하는 일:
- P1부터 우선 처리. 행의 publish 컬럼 (`raw_name`, `cleaned_name`, `raw_plan`, `raw_contract_date`, `raw_amount`, `candidate_display_name`, `candidate_line_registration_name`, `candidate_real_name`, `suggestion_basis`)을 보고 동일인 여부 판단.
- 맞으면 `operator_decision_status = approved` 입력. 다른 customer로 정정하려면 `operator_selected_customer_id` / `operator_selected_customer_name`만 덮어쓴다.
- 필요하면 `operator_note` 메모.
- P2/P3는 status를 비워 두고 note만 남긴다.

수정 가능한 컬럼:
- `operator_decision_status`
- `operator_selected_customer_id`
- `operator_selected_customer_name`
- `operator_note`

수정하면 안 되는 것:
- exception / candidate / suggestion / current 상태 관련 publish 컬럼
- 특히 `writeback_alias_name`은 시스템이 고정한 값

주의:
- 승인은 `Customer_Alias_Map`에 `source=cs_continuation_alias_review`로 반영된다.
- 승인 후 다음 refresh + republish에서 row가 queue에서 사라지면 정상.
- 탭 자체가 없으면 publish/runtime path 점검이 먼저 (`inspect_post_refresh_state.py` verdict의 `cs_continuation_alias_review_present`가 `true`여야 한다).

### `経営_会議前チェック`
무엇을 보는가:
- 오늘 경영회의를 **그대로 진행해도 되는지** 빠르게 판단하는 탭
- `publish freshness`, `full refresh freshness`, `writeback freshness`, stale domain 수, human update omission 가능성, 중요안건 수를 한 줄씩 본다
- 마지막 줄 `overall meeting risk`는 `GO` / `GO_WITH_CAUTION` / `CHECK_BEFORE_MEETING` 중 하나를 준다

운영자가 하는 일:
- 회의 시작 전에 이 탭을 먼저 연다
- `CHECK_BEFORE_MEETING`이면 바로 다음 탭인 `経営_更新状況`로 이동해 어느 도메인이 stale인지 확인한다
- `critical team issues in meeting scope`가 크면 클레임/요포로우/미매칭이 회의 논점에서 누락되지 않았는지 확인한다

### `経営_更新状況`
무엇을 보는가:
- 도메인별 freshness / stale / 업데이트 누락 위험 현황
- 주요 컬럼:
  - `domain`
  - `status`
  - `last_effective_update_at_jst`
  - `expected_cadence`
  - `stale_threshold`
  - `stale_by`
  - `likely_issue_type`
  - `likely_decision_risk`
  - `recommended_check`

운영자가 하는 일:
- `status`가 `高リスク（会議前に確認推奨）`인 도메인부터 본다
- `likely_issue_type`로 이것이 자동화 미실행인지, 원데이터 업데이트 누락인지 구분한다
- `likely_decision_risk`를 보고 숫자가 어떤 방향으로 왜곡될 가능성이 있는지 회의에서 먼저 공유한다
- `recommended_check`를 따라 어느 팀/어느 시트를 먼저 확인할지 정한다

### `経営_コーチ負荷`
무엇을 보는가:
- 코치별 고객 수/부하
- follow-up 집중도

운영자가 하는 일:
- 특정 코치에 부담이 몰리는지 확인

### `経営_顧客リスク`
무엇을 보는가:
- 만족도 저하, follow-up 필요, 예외 건수 등 리스크 요약

운영자가 하는 일:
- 이번 주/이번 달 리스크 레벨 확인

### `経営_データ状況`
무엇을 보는가 (`metric` / `value` / `note`):
- **회의 신뢰도 메트릭**:
  - `last_publish_success_at_jst` — 최신 `runPublishAll` 성공 시각
  - `last_full_refresh_success_at_jst` — 최신 `runFullRefresh` 성공 시각
  - `last_writeback_success_at_jst` — 최신 `runWritebackCollection` 성공 시각
  - `stale_domain_count` — `経営_更新状況`에서 stale 판정된 도메인 수
  - `stale_high_risk_domain_count` — 회의 전 확인 우선 도메인 수
  - `likely_human_update_omission_count` — 자동화는 돌았지만 원데이터 업데이트 누락이 의심되는 도메인 수
  - `domains_with_likely_human_update_omission` — 해당 도메인 목록
  - `meeting_risk_status` — `経営_会議前チェック`와 같은 최종 회의 상태
  - `critical_team_issue_count` — 회의 안건이 되기 쉬운 요포로우 / 예외 / 클레임 후보성 이슈 수
- **카운트 메트릭**: canonical row 수치 (customers / coaches / sessions / feedback / plans / payments / conversion_events / line_registrations / followup_queue / continuation_targets).
- **예외/미매칭 메트릭** (값이 0에 가까울수록 좋음):
  - `feedback_match_exception_count` — `Exceptions_FeedbackMatch` 행 수. 처리: `CS_別名解決入力`.
  - `payment_unmatched_count` — `Staging_Payments`에서 canonical customer 연결 안 된 결제 수. 처리: `CS_入金名寄せ確認`.
  - `continuation_unmatched_count` — `Exceptions_ContinuationMatch` 행 수. 처리: `CS_継続名寄せ確認`.
  - `line_registration_unmatched_count` — `Line_Registrations`에서 customer 연결 안 된 LINE 등록 수. 자체 해소용 큐 없음 (운영자 customer ingest 보강 후 자동 해소).
- **데이터 무결성 메트릭**:
  - `feedback_response_id_collision_count` — `Feedback`에서 같은 `response_id`를 가진 행 수. **항상 0이어야 함**. 1 이상이면 SHA-256 해시 충돌이므로 즉시 조사 요청.
- **acquisition 메트릭**: LINE 등록의 채널 token 분포 (`acquisition_with_channel_count` / `acquisition_without_channel_count` / `acquisition_top_channels`).
- `経営_例外推移`는 위 예외/미매칭 메트릭의 **시계열 companion view**다. 현재 기본 튜닝은 **JST 일별 / 최근 30일 / 해당 날짜 마지막 successful Sync_Log snapshot**.

운영자가 하는 일:
- 우선 `meeting_risk_status`와 최신 publish/refresh/writeback 시각이 말이 되는지 확인한다
- stale/high-risk count가 0이 아니면 `経営_更新状況`로 이동한다
- `critical_team_issue_count`가 크면 팀 중요안건(클레임 포함)이 회의 자료에 충분히 반영됐는지 확인한다
- 데이터가 비정상적으로 줄거나 비어 있지 않은지 확인.
- refresh 후 숫자가 말이 되는지 sanity check.
- 예외/미매칭 메트릭이 갑자기 늘면 해당 review 시트(`CS_*_Review` / `CS_別名解決入力`)부터 확인.
- `feedback_response_id_collision_count`가 0이 아니면 다른 모든 작업보다 우선해서 보고.

### `経営_例外推移`
무엇을 보는가:
- `Sync_Log`의 successful row 중 예외/미매칭 stats가 있는 행만 골라 **JST 일별 마지막 snapshot**으로 묶은 trend view.
- 컬럼의 `_delta`는 직전 표시일 대비 변화량이다. 양수면 증가, 음수면 감소.
- 운영자가 "최근 7일 동안 payment/continuation unmatched가 늘었는가"를 바로 확인하는 용도다.

운영자가 하는 일:
- `payment_unmatched_count_delta`, `continuation_unmatched_count_delta`, `feedback_match_exception_count_delta`가 반복해서 양수인지 확인.
- 증가가 보이면 해당 review/input 탭 (`CS_入金名寄せ確認`, `CS_継続名寄せ確認`, `CS_別名解決入力`)을 먼저 본다.
- `feedback_response_id_collision_count` 또는 delta가 0보다 크면 즉시 escalate.

### `Sync_Log` (POTEX DB)
무엇을 보는가:
- 자동화 job 1회 실행마다 추가되는 한 줄. 컬럼: `timestamp` (ISO), `job_name`, `status` (`success` / `error`), `stats` (key=value 줄바꿈).
- 주요 `job_name`: `runCanonicalRefresh` / `runPublishAll` / `runFullRefresh` / `runWritebackCollection` / `dropOrphanStagingFeedback` / `dropOrphanStagingLineRegistration` 등.
- `経営_例外推移`는 여기 누적된 successful stats를 읽어 만든 Executive용 시계열 뷰다.

운영자가 하는 일:
- 매일 07:00 JST `full refresh` 직후 row가 들어왔는지 확인 (`runFullRefresh=success`).
- 30분 cadence의 `runWritebackCollection`이 정상적으로 append되는지 확인.
- `status=error` 행을 발견하면 `stats`의 `error=...` 메시지로 1차 진단, 관리자에게 escalate.
- `stats`의 `feedbackResponseIdCollisions`가 0인지 매번 확인 (経営_データ状況의 collision count와 동일 값).

수정해도 되는가:
- 아니오. append-only 로그.

### `Staging_Customers` raw ingest 해석 주의
운영자가 직접 쓰는 시트는 아니지만, 현재 `SOURCE_CUSTOMERS_WORKBOOK_ID`는 설정되어 있고 `顧客管理` 원본 기준으로 staging 정렬이 검증되었다.

의미:
- raw source 총행 수와 staging 행 수가 다를 수 있다.
- 특히 `顧客管理`에서 이름 없는 행은 staging refresh에서 스킵된다.
- 최종 컷오버 직전에는 full refresh를 한 번 더 돌리고 숫자만 다시 확인하면 된다.

---

## 5. 일일 운영 루틴

### Step 1. `CS_要フォロー一覧` 확인
체크 포인트:
- 새 `P1` 건이 있는가
- 특정 코치에 문제가 몰리는가
- 강한 불만/긴 코멘트가 있는가

### Step 2. `CS_継続対象一覧` 확인
체크 포인트:
- 연장 타이밍이 온 고객이 있는가
- 후속 이벤트 후 미종결 건이 있는가

### Step 3. `CS_例外確認` 확인
체크 포인트:
- 새 unmatched / review 필요 건이 있는가
- 피드백 source 이상이 있는가

### Step 4. 필요 시 `CS_別名解決入力`, `CS_入金名寄せ確認`, `CS_継続名寄せ確認` 처리
체크 포인트:
- `P1` 행부터 우선 처리하는가
- 이름 표기 흔들림인가
- 이메일/코치/결제/continuation 맥락이 일치하는가
- `suggested_action`이 `approve_if_context_matches`인 행만 승인 대상으로 보는가 (`search_customer_or_wait_for_customer_ingest` / `hold_no_candidate_found`는 보류)
- system suggestion이 붙어 있더라도 애매하면 승인하지 않는가
- `CS_入金名寄せ確認` header가 비어 있거나 priority count가 stale처럼 보이면 approval을 보류하는가 (점검은 `inspect_post_refresh_state.py`)
- `CS_継続名寄せ確認`는 full refresh/publish 후 `Exceptions_ContinuationMatch`와 함께 확인했는가
- 승인 후에는 직접 다음 단계를 호출하지 않고, writeback collection (매 30분) → canonical refresh → republish 자동 흐름을 기다리는가
- `CS_承認進捗`에서 `decided_waiting_sync` / `invalid_open`이 쌓이지 않는가

### Step 5. `経営_会議前チェック` → `経営_更新状況` → `経営_データ状況` 순서로 확인
체크 포인트:
- `overall meeting risk`가 `GO` / `GO_WITH_CAUTION` / `CHECK_BEFORE_MEETING` 중 무엇인가
- stale/high-risk domain이 어느 팀 이슈인지 보이는가
- human update omission 가능성이 있는가
- `critical team issues in meeting scope`가 커졌다면 클레임/중요안건 누락 가능성이 있는가
- 값이 갑자기 0이 되었는가
- exception 수가 갑자기 늘었는가
- follow-up / continuation 수치가 비정상적으로 바뀌었는가
- 특히 `followup_queue_count`가 0인데 DB 쪽 follow-up 이슈가 보인다면 publish 이상 여부를 먼저 의심한다

### Step 6. `Potex Concierge`가 열려 있다면 `コンシェルジュ_データ状況` 확인
체크 포인트:
- `customer_ingest_mode`가 예상과 맞는가
- `コンシェルジュ_フォロー一覧` row 수가 CS follow-up queue와 크게 다르지 않은가
- 이 workbook은 읽기 전용이라는 점을 다시 확인했는가

---

## 6. Alias 문제를 처리하는 방법

### 언제 처리하나
- `CS_例外確認` 또는 `CS_別名解決入力`에 unmatched 고객명이 보일 때
- `CS_入金名寄せ確認`에 unmatched payment row가 보일 때
- `CS_継続名寄せ確認`에 unmatched continuation row가 보일 때

### 처리 우선순위
1. `CS_入金名寄せ確認` / `CS_継続名寄せ確認`의 `P1` 부터.
   - `P1`은 시스템이 후보 line registration 행에서 canonical customer ID를 이미 찾은 케이스다.
   - `suggested_action`이 `approve_if_context_matches`로 채워져 있으므로 publish 컬럼의 맥락만 확인하고 승인하면 된다.
2. 그 다음 `CS_別名解決入力`의 명시적 review 행.
3. `P2`는 customer ingest 보강 또는 operator research가 필요한 경우가 많으므로 후순위.
4. `P3` (`hold_no_candidate_found`)는 매칭 가능한 후보 자체가 없으므로 보류.

### 처리 순서
1. 해당 row를 찾는다.
2. publish 컬럼 (특히 `suggestion_basis`, `candidate_*`, `current_canonical_customer_*`)을 보고 동일인 여부를 판단한다.
3. 아래 4개 컬럼만 입력한다.
   - `operator_decision_status`
   - `operator_selected_customer_id`
   - `operator_selected_customer_name`
   - `operator_note`
4. 시스템이 채워둔 `current_canonical_customer_id` / `current_canonical_customer_name`을 그대로 쓸 거면 `operator_selected_*`은 비워 둬도 된다 (writeback collection 시점에 fallback으로 들어간다).
5. 판단이 애매하면 status를 비워 두고 note만 남긴다.
6. writeback / refresh / republish가 실행된 뒤 결과를 다시 확인한다.

### 권장 상태값
- `approved`: 동일인으로 확정
- `active`: 운영상 승인과 같은 의미로 이미 쓰고 있는 경우만 사용
- `resolved`: 이미 반영된 건 재확인

### 승인 후 자동 트리거 흐름
운영자가 status를 `approved` 등으로 적은 후 별도 액션 없이 시스템이 다음 cadence에서 처리한다:
1. **writeback collection (매 30분)**: operator 입력을 읽어 `Customer_Alias_Map`에 `source=cs_payment_alias_review` 또는 `source=cs_continuation_alias_review`로 alias 행을 추가/갱신한다.
2. **canonical refresh**: `Staging_Customers` / `Staging_Payments` 등을 alias-aware로 재매칭해 canonical 시트를 갱신한다.
3. **5-workbook republish**: POTEX DB → CS / Executive / Concierge / Sales 시트 재발행. 해당 row는 review queue에서 사라지고, 매칭된 카운트는 health metric에 반영된다.
4. **full refresh (매일 07:00 JST)**: 위 흐름의 일별 전체 재실행.

operator가 직접 GAS 함수를 실행할 필요는 없다. 다만 즉시 반영을 확인하고 싶으면 관리자가 Apps Script UI에서 `runWritebackCollect` → `runFullRefresh`를 수동 실행할 수 있다.

### 처리 후 확인할 것
- 해당 alias / payment / continuation row가 review queue에서 사라졌는가
- `inspect_post_refresh_state.py` (또는 그에 준하는 점검)로 row count가 줄었는가
- 새 예외가 추가로 생기지 않았는가
- `経営_データ状況` / `コンシェルジュ_データ状況`의 `payment_unmatched_count` / `continuation_unmatched_count`가 변했는가

---

## 7. 주간 운영 루틴

### `経営_コーチ負荷` 점검
- 코치별 active 고객 수 편중 여부
- follow-up 과부하 여부

### `経営_顧客リスク` 점검
- 저만족 feedback 증가 여부
- follow-up 필요 건 증가 여부
- 예외 건 증가 여부

### `経営_データ状況` 점검
- row count가 지나치게 줄지 않았는가
- source ingest 실패로 보이는 이상이 없는가

---

## 8. 하면 안 되는 것
- source workbook에서 직접 값 고치기
- `POTEX DB` canonical 시트를 일상 운영 화면처럼 쓰기
- publish 시트에 수기 입력하기
- alias 문제를 DB에서 바로 고치기
- 확신 없는 이름 매칭을 `approved` 처리하기

---

## 9. 문제가 생기면 어디를 볼까

### 구조를 이해하고 싶을 때
- `docs/database-overview.md`
- `docs/sheet-reference.md`

### 배포/자동화 실행 순서를 보고 싶을 때
- `PHASE1_CUTOVER_RUNBOOK.md`

### 현재 작업 상태를 보고 싶을 때
- `docs/backlog.md`
- `agents/session.md`

---

## 10. 가장 중요한 운영 원칙 한 줄
**원본은 건드리지 말고, 운영은 역할별 workbook에서 하고, 사람 입력은 input/writeback 시트에서만 한다.**
