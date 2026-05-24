# POTEX DB 스키마

업데이트: 2026-05-20

## 이 문서가 답하는 것
"POTEX DB 안에 어떤 표가 있고, 각 표가 무엇을 의미하고, 어떤 컬럼을 가지는가?"

운영팀이 일상에서 보는 것은 5개 publish 워크북(`Potex CS` / `Executive` / `Concierge` / `Sales` / `Coaches`)이다. 그 워크북들은 모두 이 DB의 표를 읽어 만든다. **DB는 회사의 단일 사실 원본(canonical)이다.**

## 공통 규칙
- **모든 표는 `created_at`, `updated_at` 두 컬럼을 끝에 가진다.**
  - `created_at`: 그 행이 처음 생긴 시점. 가능하면 도메인 시점(`submitted_at` / `contract_date` / `registered_at` 등), 없으면 그 refresh의 `syncedAt`.
  - `updated_at`: 그 행을 마지막으로 다시 쓴 시점 (`syncedAt`).
- `syncedAt`은 한 refresh 동안 단 한 번 만들어져 모든 build 함수에 전달된다.
- pipeline이 매번 새로 쓰는 표(`clearAndRewrite`)는 코드의 header 상수가 truth다. 시트에서 수동으로 컬럼을 더해도 다음 refresh에서 사라진다.
- 수동/외부 ingest 표는 `ensureAuditColumns()` (`canonical/ingest.ts`)이 idempotent하게 `created_at` / `updated_at` 컬럼을 보장하고 빈 셀을 backfill한다.
- **derive 가능한 값은 DB에 저장하지 않는다.** 다른 컬럼/표에서 100% 재계산할 수 있으면 publish 시점 join으로 만든다 (예: attribution channel breakdown).

## 표 일람 (역할 기준)

| 표 이름                                | 역할                                                                                | 누가 쓰나                    |
| ----------------------------------- | --------------------------------------------------------------------------------- | ------------------------ |
| `Customers`                         | 고객 1행. 회사가 인식하는 모든 고객의 master                                                     | 모든 워크북                   |
| `Coaches`                           | 코치 1행. 사내 코치 master                                                               | Coaches / Executive      |
| `Sessions`                          | (예약) 세션 단위 fact table. 현재 비어 있음                                                   | 미사용                      |
| `Feedback`                          | 월차/최종 만족도 응답 1행. 고객·코치에 join된 상태                                                  | CS / Coaches / Executive |
| `Plans`                             | 고객이 가진 코칭/계속 플랜 1행 (1고객 N플랜)                                                      | Sales / Executive        |
| `Payments`                          | 결제(成約/着金) 1행. plan에 link                                                          | Sales / Executive        |
| `ConversionHistory`                 | 고객 상태 변화 이력 (line_registered → lead_created → contracted → paid → completed/lost) | Sales / Executive        |
| `Customer_Coach_Assignments`        | 고객 ↔ 담당 코치/partner 매핑. active/unresolved + post-assignment status 포함                      | Coaches / partner views |
| `Customer_Channel_Links`            | 고객 ↔ 외부 채널(현재 LINE만) ID 매핑                                                        | 내부 join용                 |
| `Line_Registrations`                | LINE 친구추가 1행 (LStep CSV ingest target)                                            | 내부 join용                 |
| `Customer_Alias_Map`                | 비정규 고객명 → canonical customer_id                                                   | 모든 매칭                    |
| `Coach_Alias_Map`                   | 비정규 코치명 → canonical coach_id                                                      | 매칭                       |
| `Exceptions_FeedbackMatch`          | 매칭 실패한 피드백 응답 큐                                                                   | CS 운영자                   |
| `Exceptions_ContinuationMatch`      | 매칭 실패한dws 계속 플랜 큐                                                                 | CS 운영자                   |
| `Ops_Feedback_Review`               | publish-ready feedback review row                                                 | Concierge / CS           |
| `Ops_Followup_Queue`                | publish-ready followup 큐                                                          | CS / Concierge           |
| `Ops_コーチ_担当負荷`                    | publish-ready 코치 부하 요약                                                            | Executive / Coaches      |
| `Ops_Continuation_Targets`          | publish-ready 계속 권유 대상                                                            | CS                       |
| `Ops_ZeroSession_Review`            | 주간 QA: 0-session 가능성 검토                                                           | CS                       |
| `Sync_Log`                          | refresh / publish / writeback 실행 기록 (append-only)                                 | 시스템                      |
| `Sync_Control` / `Publish_Manifest` | 시스템 토글/매니페스트                                                                      | 시스템                      |

내부 mirror(`Staging_Customers` / `Staging_Payments`)는 외부 워크북 ingest 직후의 raw 거울이다. 운영자가 직접 볼 일은 없고, 점진적으로 ingest를 DB 직접 작성으로 옮기면서 제거 예정 (P-012). `Staging_LineRegistration`은 P-012 Phase 1로 `Line_Registrations`에 흡수됨. `Staging_Feedback`은 P-012 Phase 2 step 2d (2026-05-20)로 흡수됨 — 이제 ingest가 `Feedback` / `Exceptions_FeedbackMatch`에 직접 적재한다. 본 문서는 canonical 표만 설명한다.

---

## 1. 고객·코치 master

### 1.1 `Customers` — 고객 1행
회사가 인식하는 모든 고객의 단일 master. 모든 다른 표의 customer_id가 여기를 가리킨다.

핵심 컬럼:
| column | 설명 |
|---|---|
| `customer_id` | primary key |
| `customer_name` | 본명. publish/매칭의 기준 이름 |
| `email` / `phone` | 연락처 |
| `line_registration_id` | `Line_Registrations.line_registration_id` (pipeline이 채움) |
| `assigned_coach_name` / `course_name` | 현재 담당 코치명 / 코스명 |
| `current_status` | `active` / `completed` 등 lifecycle 상태 |
| `continuation_tag` | 계속 권유 시나리오 태그 |
| `program_completed_flag` | 受講終了 boolean |
| `created_at` / `updated_at` | 행 생성/수정 시점 |

추가 운영 컬럼은 시트 header를 그대로 따른다 (read by header name이라 순서 무관).

### 1.2 `Coaches` — 코치 1행
사내 코치 master. `coach_id` primary key, `coach_name`, 그리고 운영팀이 시트에서 직접 추가한 메타데이터(전문 분야, 가용도 등). `created_at` / `updated_at` 보장.

> 설계 메모 (2026-05-21): partner 역할(예: 稲井 / 佐藤)을 별도 canonical table로 두기보다 이 `Coaches` 표에 `assignee_kind=coach|partner`, `assignee_scope` 같은 컬럼을 추가해 흡수하는 방향이 현재 우선안이다.

### 1.3 `Sessions` — 세션 fact (현재 비어 있음)
향후 1세션 = 1행 형태의 fact table 자리. 아직 ingest 미구현. `session_id` / `created_at` / `updated_at`만 정의.

---

## 2. 만족도 / 피드백

### 2.1 `Feedback` — 월차/최종 만족도 응답
고객·코치에 매칭된 피드백만 들어온다. 매칭 안 된 행은 `Exceptions_FeedbackMatch`에 머문다.

| column | 설명 |
|---|---|
| `feedback_id` | `FDBK-####` |
| `response_id` | `resp_{12hex}` SHA-256 hash. dedupe 키. (`source_sheet`+`submitted_at`+`respondent_email`+`raw_coach_name`로 계산) |
| `session_id` | (예약) 향후 `Sessions` 결합 시 사용 |
| `customer_id` / `customer_name` | matched customer |
| `coach_id` | matched coach |
| `feedback_date` | 응답 시각 |
| `feedback_type` | `monthly` / `final` |
| `rating` | 만족도 점수 |
| `nps_score` / `nps_category` | NPS 점수 / promoter·passive·detractor |
| `progress_score` / `expectation_score` / `community_score` | 항목별 점수 |
| `comment` | 자유 응답 |
| `followup_needed` | 후속 필요 여부 |
| `note` | 매칭 경로 trace (`resolved_by_customer_alias_map` 등) |
| `respondent_name` / `respondent_email` | 응답자 식별용 |
| `created_at` / `updated_at` | 응답 시점 / 최종 갱신 |

> P-012 Phase 2 step 2c (2026-05-20)에서 `source_sheet` / `source_row` 컬럼 제거됨. dedupe는 `response_id` hash 단독.

### 2.2 `Ops_Feedback_Review` — publish-ready 검토 행
csWriteback이 만든다. `コンシェルジュ_フォロー一覧`, CS 검토 뷰의 직접 소스. dedupe 키는 `feedback_id`.

주요 컬럼: `feedback_id` / `feedback_date` / `feedback_type` / `customer_id` / `customer_name` / `coach_id` / `coach_name` / `satisfaction_score` / `nps_score` / `nps_category` / `progress_score` / `expectation_score` / `low_satisfaction_flag` / `needs_followup_flag` / `followup_reason` / `comment` / `gap_comment` / `created_at` / `updated_at`.

---

## 3. 영업 / 결제

### 3.1 `Plans` — 고객 플랜 1행
한 고객이 base 코칭 + 계속 플랜 등 여러 행을 가질 수 있다.

| column | 설명 |
|---|---|
| `plan_id` | `PLAN-####` |
| `customer_id` | 1:N |
| `plan_name` | 최신 결제 plan name 우선, 없으면 customer course_name |
| `plan_type` | `coaching` (base) / `continuation` |
| `sessions_included` | `6か月` → 24 등 plan name에서 추출 |
| `contract_date` | 성약일 |
| `start_date` | matching_contact_date + 3일, 또는 첫 세션 |
| `end_date` | `completed`일 때만 마지막 세션/after-follow 일자 |
| `amount_tax_included` | 최신 결제 금액 |
| `status` | 고객 lifecycle 정규화 |
| `note` | sales_owner / segment / 메모 등 |
| `created_at` / `updated_at` | contract_date / syncedAt |

### 3.2 `Payments` — 결제 1행
`Staging_Payments` 1행 = `Payments` 1행. customer_id가 비면 unmatched 큐 처리.

| column | 설명 |
|---|---|
| `payment_id` | `PAY-####` |
| `customer_id` | matched customer |
| `plan_id` | 같은 고객의 첫 plan_id |
| `payment_date` | paid_date → contract_date → experience_date |
| `amount` | 금액 (숫자) |
| `payment_method` | (현재 빈 값) |
| `payment_status` | `paid` / `pending` |
| `invoice_number` | (현재 빈 값) |
| `note` | sales_owner / segment / plan_name / 메모 |
| `created_at` / `updated_at` | payment_date / syncedAt |

### 3.3 `ConversionHistory` — 고객 상태 변화 이력
한 고객의 lifecycle event를 시간순으로 적재.

| column                      | 설명                                                                                                         |
| --------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `event_id`                  | `EVT-####`                                                                                                 |
| `customer_id`               | 주체                                                                                                         |
| `event_date`                | yyyy-mm-dd                                                                                                 |
| `from_status` / `to_status` | 직전 to_status → 이번 to_status                                                                                |
| `event_type`                | `line_registered` / `lead_created` / `experience_scheduled` / `contracted` / `paid` / `completed` / `lost` |
| `changed_by`                | 어떤 도메인에서 발생했는지 (`顧客管理` / `体験者一覧` / `着金管理マスター` / `lstep_ryu` 등)                                             |
| `note`                      | 보조 메타 (대부분 빈 값)                                                                                            |
| `created_at` / `updated_at` | event_date / syncedAt                                                                                      |

dedupe key: `customer_id || event_date || event_type || note`. 같은 고객·날짜·이벤트가 여러 도메인에서 보고되면 한 행으로 합쳐진다.

---

## 4. 고객 ↔ 코치 / 채널

### 4.1 `Customer_Coach_Assignments` — 담당 매핑
한 customer × assignee 조합 = 1행. 코치뿐 아니라 partner assignment도 이 표 하나로 관리한다.

| column | 설명 |
|---|---|
| `assignment_id` | `assign_{customer_id or lead_id}_{coach_id 또는 normalized name}` |
| `lead_id` | form respondent 단계까지 포함하는 상위 식별자. customer 전환 전에는 provisional id 가능 |
| `customer_id` / `coach_id` | join key. coach_id 없으면 `unresolved` |
| `lead_display_name` / `respondent_email` / `phone` / `age` | lead/customer 표시 및 partner workbook 표시용 snapshot |
| `source_sheet` / `source_row` | form 응답 trace (lead-only row audit용) |
| `role` | 현재 `primary` / `partner` 중심 |
| `assignee_kind` | `coach` / `partner` |
| `assignee_scope` | `core_coaching` / `student` / `career_change_and_job_hunt` 등 |
| `assignment_status` | `active` / `unresolved` |
| `assigned_at` | matching_contact_date → customer created_at 또는 CS writeback 시점 |
| `assignment_source` | `source_customer_snapshot` / `cs_assignment_input` 등 |
| `meeting_status` / `meeting_done_at` | partner post-assignment 진행 상태 |
| `potex_sale_status` | `none` / `introduced` / `in_discussion` / `lost` |
| `recruitment_status` | `none` / `intern_intro` / `intern_active` / `selection` / `closed` / `lost` / `unreachable` |
| `partner_status_note` | partner/CS가 남긴 진행 메모 |
| `last_partner_update_at` / `last_partner_updated_by` | partner status 최신 갱신 audit |
| `ended_at` | (예약) 종료 시점 |
| `note` | raw coach 이름 / assignment note 등 |
| `created_at` / `updated_at` | assigned_at / syncedAt |

### 4.2 `Customer_Channel_Links` — 외부 채널 ID 매핑
"이 고객의 LINE/IG/... user ID는 무엇인가?" 만 답한다. **유입 채널 (yt/ig/tt/...) 통계와 혼동 금지** — 유입은 DB에 저장하지 않고 publish 시점 `tokenizeAttributionTags()`로 derive.

| column | 설명 |
|---|---|
| `channel_link_id` | `link_{customer_id}_{line_registration_id}` |
| `customer_id` | join key |
| `channel_type` | 현재 `line` |
| `channel_user_id` | LStep `line_user_id` |
| `channel_record_id` | `Line_Registrations.line_registration_id` |
| `is_primary` | 최신 registered_at row만 `TRUE` |
| `link_status` | 현재 `active` |
| `registered_at` | LINE 친구추가 시점 |
| `note` | `segment=...`, `line_name=...` 메타 |
| `created_at` / `updated_at` | registered_at / syncedAt |

### 4.3 `Line_Registrations` — LINE 친구추가 1행 (canonical)
LStep CSV (`csvA` / `csv_potex`)에서 ingest되는 LINE 등록 master. `Customer_Channel_Links.channel_record_id`의 join target. P-012 Phase 1로 도입 (2026-05-20). `Staging_LineRegistration`은 흡수 완료 (해당 시트는 orphan).

| column | 설명 |
|---|---|
| `line_registration_id` | PK. `line_{segment}_{line_user_id}` (line_user_id 없는 행 0건 확인) |
| `segment` | `ryu` / `potex` |
| `line_user_id` | LStep `ID` |
| `display_name` / `line_registration_name` / `real_name` | LINE 표시명/등록명/본명 |
| `registered_at` | 友だち追加日時 (yyyy-mm-dd) |
| `gender` / `age` / `occupation` / `income` / `goal` | LStep 응답 컬럼 |
| `attribution_tags` | `YT_/PT_/IG_/TT_/TIK_/LP_/SDP_/【流入】` prefix 컬럼이 truthy인 컬럼명을 `;`로 join. publish 시 `tokenizeAttributionTags()`로 token 변환 |
| `customer_id` / `customer_match_method` | `Customers` + alias 매칭 |
| `created_at` / `updated_at` | registered_at / syncedAt |

⚠ source 좌표 (source_sheet / source_row) 컬럼은 가지지 않음. CSV 재import 시에도 `line_registration_id`로 안정 식별.

---

## 5. Alias 매핑 (이름 → ID)

### 5.1 `Customer_Alias_Map`
"`着金管理マスター`에 '田中(山田)' 라고 적힌 사람이 누구인가" 같은 비정규 이름을 canonical customer_id로 연결한다. 운영자가 alias review 입력 시트(`CS_別名解決入力` / `CS_入金名寄せ確認` / `CS_継続名寄せ確認`)에서 승인하면 writeback이 여기에 쓴다.

| column | 설명 |
|---|---|
| `alias_name` | 비정규 이름 (시트에 나타난 그대로) |
| `canonical_customer_id` | 매핑 대상 |
| `canonical_customer_name` | 참고용 (refresh 시 customer 표가 truth) |
| `status` | `approved` / `active` / `resolved` 중 하나면 활성 |
| `confidence` | `operator_review` 등 |
| `source` | 어느 입력 시트에서 승인됐는지 |
| `respondent_email` / `related_coach_name` | feedback alias에서 유효 |
| `evidence` | feedback 승인은 `response:{response_id}`, payment/continuation 승인은 `{source_sheet} row {source_row}` |
| `note` | operator note 합본 |
| `created_at` / `updated_at` | 첫 승인 시점 / 마지막 갱신 |

⚠ alias 승인은 audit이 중요하다. `evidence` + `updated_at` + `source`로 누가 언제 무엇을 근거로 승인했는지 추적.

### 5.2 `Coach_Alias_Map`
코치명에 대한 동일한 매핑. 수동 maintained. `ensureAuditColumns`이 audit 컬럼 보장.

---

## 6. 매칭 실패 큐 (Exceptions)

매칭이 안 된 행은 canonical에 들어가지 않고 여기에 쌓인다. 운영자가 alias 승인하면 다음 refresh에 canonical로 promote되고 큐에서 빠진다.

### 6.1 `Exceptions_FeedbackMatch`
피드백 응답 중 coach_id 또는 customer_id가 비어 있는 행. ingest가 raw 응답을 여기 직접 적재(2d). alias 승인 후 다음 refresh에 `Feedback`으로 promote.

| column | 설명 |
|---|---|
| `response_id` | `resp_{12hex}` SHA-256 hash. alias 승인 후 canonical Feedback dedupe 키 |
| `submitted_at` | 응답 시각 |
| `respondent_name` / `respondent_email` | 응답자 |
| `raw_coach_name` | 시트에 적힌 코치명 |
| `canonical_coach_name` | matched 코치 (있으면) |
| `coach_id` | matched 코치 id (있으면) |
| `feedback_type` | `monthly` / `final` |
| `satisfaction_score` / `nps_score` / `nps_category` | 만족도/NPS |
| `progress_score` / `expectation_score` / `community_score` | 항목별 점수 |
| `q_gap` / `free_comment` | 자유 응답 |
| `issue` | `coach_unmatched` / `customer_unmatched` |
| `note` | 보조 설명 |
| `created_at` / `updated_at` | submitted_at / syncedAt |

### 6.2 `Exceptions_ContinuationMatch`
`継続プラン管理` 행 중 customer 매칭 실패.

| column | 설명 |
|---|---|
| `raw_name` / `cleaned_name` | 시트에 적힌 이름 / 정규화 |
| `raw_plan` / `raw_contract_date` / `raw_amount` | 시트 원문 |
| `issue` | `continuation_customer_unmatched` |
| `note` | 보조 설명 |
| `source_sheet` / `source_row` | alias 승인 후 dedupe에 필요 |
| `created_at` / `updated_at` | contract_date 정규화 / syncedAt |

---

## 7. 운영 derived

운영자가 직접 보지는 않고 publish 워크북의 직접 source가 되는 표들. 현재 일부는 운영팀이 외부 도구로 build해 DB에 적재한다 (Phase 1 verdict: accept). 모두 `ensureAuditColumns`로 audit 컬럼 보장.

| 표 | upstream / 용도 |
|---|---|
| `Ops_Followup_Queue` | CS / Concierge follow-up 큐의 원본 |
| `Ops_コーチ_担当負荷` | Executive·Coaches의 코치 부하 요약 원본 |
| `Ops_Continuation_Targets` | CS 계속 권유 대상 큐 원본 |
| `Ops_ZeroSession_Review` | 주간 0-session 가능성 검토 |

핵심 컬럼은 각 publish 뷰에서 그대로 가져다 쓰는 형태 (`priority`, `customer_id`, `customer_name`, `assigned_coach_name`, `followup_reason`, `owner` 등).

---

## 8. 시스템

### 8.1 `Sync_Log` (append-only)
| column | 설명 |
|---|---|
| `timestamp` | 실행 시각 (`new Date().toISOString()`) |
| `job_name` | `runFullRefresh` / `runPublishAll` / `runWritebackCollection` 등 |
| `status` | `success` / `error` |
| `stats` | key-value 통계 dump (`key=value` 줄바꿈) |

⚠ append-only라서 `updated_at`은 의미가 없다 — 추가하지 않음.

### 8.2 `Sync_Control` / `Publish_Manifest`
시스템 토글/매니페스트. 운영자 직접 사용 대상 아님.

---

## 9. 컬럼 추가/변경 가이드
1. pipeline-written 표 (`Plans` / `Payments` / `Feedback` / `ConversionHistory` / `Customer_Coach_Assignments` / `Customer_Channel_Links` / `Exceptions_*` / `Ops_Feedback_Review`): 코드 header 상수 수정 후 row builder에서 값 emit.
2. 수동 maintained 표 (`Customers` / `Coaches` / `Sessions` / `Coach_Alias_Map` / `Customer_Alias_Map` / `Ops_Followup_Queue` / `Ops_コーチ_担当負荷` / `Ops_Continuation_Targets`): 시트 header에 직접 추가. pipeline은 read by header name이라 순서 무관.
3. publish 시 join이 필요한 컬럼이면 `publish/*.ts`에서 read header 추가.
4. **`created_at` / `updated_at`은 새 표에도 무조건 끝에 둔다.** `Sync_Log`만 예외.
5. DB에 derive-only 컬럼 추가 금지. 다른 컬럼에서 계산 가능하면 publish 시점 join.
