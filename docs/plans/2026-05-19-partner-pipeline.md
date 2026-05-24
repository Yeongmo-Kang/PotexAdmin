# Partner Pipeline (Inai / Sato) Spec Plan

> **Status:** Q1–Q7 answered on 2026-05-21. **Implementation-ready for Phase A** (canonical schema groundwork).

**Goal:** Provide structured, systematic tracking of the student-domain (稲井) and career-change/job-hunt-domain (佐藤) partner pipelines from the form-reservation stage onward, including partner-self-input of meeting / recruitment / POTEX-sale status. Make this the first canonical home for post-meeting partner status, which today exists only as free-text in Slack / LStep.

**Architecture:** Keep `POTEX DB` as the only canonical database. LStep / TimeRex / Slack are NOT read. **Do not create a separate partner canonical model**; instead, extend the existing coach canonical so partner-assignees are represented in `Coaches` / `Customer_Coach_Assignments` with role/scope columns, and only the post-assignment workflow/views differ.

**Tech Stack:** Google Sheets, Apps Script (`potex-gas`), existing writeback collection trigger (30m).

---

## 1. Background

### 1.1. Operational team request (paraphrased)
- 稲井 = 인재회사 사장. 담당: 학생. 장기 인턴 소개 → 취직까지 동반하는 수업 운영. POTEX 상품을 학생에게 대리 판매하는 구조 (인턴 수입 → 코칭 지불 능력 향상 funnel).
- 佐藤 = 담당: 전직 희망자 + 대학 3-4학년 취준생. 인재 소개 + POTEX 상품 양쪽 다 다룸.
- 추적 컬럼 공통: 누가 누구에게 assigned / POTEX 상품 소개·판매 여부 / 영역별 진행 상태 / 최종 갱신일.
- 추적 시작 시점: **고객 전(面談 실시 단계)부터.** LINE 등록 → 직접 佐藤·稲井 assign → 코칭 판매 시도 → (성·불성 무관) 인턴·전직 상담 재면담.
- 파트너 본인이 정기적으로 입력 가능해야 함.

### 1.2. Verified upstream flow (운영팀 답변, 2026-05-19)
1. YouTube 유입
2. LINE 등록
3. Form 예약 (여기서 학생 여부 판별) ← **여기부터 list 추가 시작**
4. 佐藤 / 稲井 assignment → **카렌더에 들어감, assign 주체는 CS**
5. 초회 면담 실시 → **면담 중 사용 도구 없음**
6. 결과 기록 → **영업이 Slack 보고 → CS가 LStep 기재** (free-text)

### 1.3. Why this matters architecturally
- 단계 6의 산출물(인턴 연결 여부, POTEX 상품 sale 여부, recruitment 진행 상태)이 **시스템에 구조화돼 존재하지 않음**.
- 단계 4의 assignment trigger는 캘린더(TimeRex 추정). CLAUDE.md TimeRex 보류 원칙에 따라 캘린더 API 직접 읽기는 막혀 있음.
- 결론: **partner canonical은 별도로 만들지 않는다.** CS의 assignment 입력은 coach/partner를 나누지 않고 1회로 통합하고, canonical도 `Coaches` / `Customer_Coach_Assignments`를 확장해 `assignee_kind` / `assignee_scope` 같은 컬럼으로 partner 여부를 표현한다. 즉 데이터 모델도 운영 UX도 모두 단일 assignment 축으로 유지하고, 배정 이후의 workflow/view만 분기한다.

---

## 2. Out of scope (intentional)

- LStep API / webhook / writeback
- TimeRex API / 캘린더 자동 읽기
- Slack 보고 자동 ingest
- 영업이 Slack에 적는 free-text를 구조화 파싱
- 稲井/佐藤 외 partner 확장 (학생 이외 영역 다른 영업멤버 assign 등은 동일 패턴 재사용으로 후속)

---

## 3. Proposed canonical DB additions

모든 신규 시트는 `POTEX DB` 에 추가. 다른 워크북은 read-only 표시 / filtered view / writeback input 만.

### 3.1. `Coaches` 확장 (partner 포함)
Partner roster. `Coaches`와 평행 구조.

| column | type | note |
|---|---|---|
| `partner_id` | string | `PART-XXXX` |
| `partner_name` | string | 정규화된 이름 (예: `稲井`, `佐藤` — customer `佐藤知子` 와 동명이인 주의, alias 분리) |
| `partner_scope` | enum | `student` / `career_change_and_job_hunt` / `other` |
| `external_role` | string | `稲井: 人材会社社長 + 長期インターン伴走授業` 등 free-text |
| `is_active` | bool | |
| `created_at` | iso8601 | |
| `last_updated_at` | iso8601 | |

### 3.2. `Coach_Alias_Map` 확장 (partner alias 포함)
`Coach_Alias_Map`과 평행. 영업 보고 / form 응답에서 들어오는 이름 변형 흡수.

| column | note |
|---|---|
| `raw_name` | |
| `canonical_partner_id` | |
| `source` | `cs_partner_assignment_input` / `seed` 등 |
| `approved_at` | |

### 3.3. `Customer_Coach_Assignments` 확장 (partner assignment 포함)
기존 `Customer_Coach_Assignments`를 재사용하되, **customer 이전 단계(form respondent)도 포함**할 수 있게 `lead_id` 개념을 확장한다. 추가로 `assignee_kind=coach|partner`, `assignee_scope=student|career_change_and_job_hunt|core_coaching` 같은 구분 컬럼을 둔다.

| column | note |
|---|---|
| `assignment_id` | `PA-XXXX` |
| `lead_id` | customer_id가 있으면 customer_id, 없으면 form-seeded lead-only id (`LEAD-XXXX`) |
| `customer_id` | nullable. customer 승격 시 채워짐 |
| `partner_id` | |
| `assigned_at` | |
| `assignment_source` | `cs_partner_assignment_input` / `customer_form_default` 등 |
| `is_active` | bool. 해제 시 false |
| `assignment_note` | free-text |

> **결정 필요:** `Leads` 별도 테이블을 만들지, 아니면 `Customers` 시트에 `is_lead_only=true` 컬럼을 추가할지 (Section 7 참고).

### 3.4. post-assignment status 표 (필요 시 별도, owner는 coach/partner 공용)
Partner self-input의 결과가 누적되는 canonical status snapshot. 1 lead × 1 partner 당 1행 (assignment과 1:1).

| column | type | note |
|---|---|---|
| `status_id` | string | `PS-XXXX` |
| `assignment_id` | string | FK to extended `Customer_Coach_Assignments` |
| `lead_id` | string | denormalized for query speed |
| `partner_id` | string | denormalized |
| `meeting_status` | enum | `scheduled` / `done` / `no_show` / `cancelled` |
| `meeting_done_at` | iso8601 | nullable |
| `potex_intro_status` | enum | `not_introduced` / `introduced` / `declined` |
| `potex_sale_status` | enum | `none` / `in_discussion` / `contracted` / `paid` / `lost` |
| `recruitment_status` | enum | `none` / `intern_intro` / `intern_active` / `selection` / `closed` / `lost` / `unreachable` |
| `current_state_label` | string | partner가 자유롭게 적는 한 줄 요약 (UI 표시용) |
| `partner_note` | free-text | |
| `last_updated_at` | iso8601 | partner가 입력할 때 갱신 |
| `last_updated_by` | enum | `partner` / `cs` / `system` |

> **결정 필요:** `potex_sale_status`가 `contracted`/`paid` 인 경우 canonical `Plans`/`Payments`와 어떻게 정합 맞출지 (Section 7 참고).

### 3.5. `ConversionHistory` event 확장 (검토)
현재: `line_registered` → `lead_created` → `experience_scheduled` → `contracted` → `paid` → `completed` / `lost`

추가 검토:
- `partner_assigned` — extended `Customer_Coach_Assignments`에서 `assignee_kind=partner` row의 assigned_at 기준 event 발행
- `partner_meeting_done` — Partner_Pipeline_Status.meeting_done_at 기준
- `intern_placed` — recruitment_status가 `intern_active`로 전이될 때
- `career_consultation_started` — recruitment_status가 `selection` 진입 시

> **원칙 충돌 주의:** DB 중복 derive-only 금지 원칙상, `Partner_Pipeline_Status`가 이미 있다면 `ConversionHistory` 추가는 publish 시점 derive로 충분할 수 있음. 굳이 추가할지는 dashboard 요구사항 확정 후 결정.

---

## 4. New role workbooks

### 4.1. `Potex Inai` (학생 영역 assignee workbook/view)
역할: 표시 + partner 입력.

탭:
- `Inai_README` — 사용법 (입력해야 할 컬럼, 입력 주기, 헷갈리면 누구에게 물어볼지)
- `Inai_Assigned_Leads` (read-only) — 현재 active assignment 목록. partner_id=稲井 인 row. 다음 컬럼 노출:
  - `lead_id`, `display_name`, `assigned_at`, `meeting_status`, `current_state_label`, `recruitment_status`, `potex_intro_status`, `potex_sale_status`, `last_updated_at`
- `Inai_Status_Input` (partner write) — assignment_id 기준 status 갱신. 입력 컬럼:
  - `assignment_id` (drop-down or lookup), `meeting_status`, `meeting_done_at`, `potex_intro_status`, `potex_sale_status`, `recruitment_status`, `current_state_label`, `partner_note`, `submit=TRUE` 체크
- `Inai_Data_Health` (read-only) — assignment 수, last_updated_at 분포 (예: 30일 이상 미갱신 N건), state 분포

### 4.2. `Potex Sato` (전직·취준 영역 assignee workbook/view)
동일 구조. partner_id=佐藤 필터.

### 4.3. 대안: 단일 `Potex Partners` workbook 2-tab 구조
운영 단순화 측면에서 단일 workbook 안에 `Inai_*` / `Sato_*` 탭을 두는 안. 단점: 두 파트너가 서로의 status를 볼 수 있음 (정보 격리 요구가 있는지 Section 7 질문).

---

## 5. CS-side input

### 5.1. `CS_担当割当入力` (통합안, Potex CS workbook)
CS가 form respondent / customer를 **담당자 1회 배정**하는 입력. 여기서 담당자는 coach 또는 partner일 수 있다. 운영 공수 절감을 위해 `CS_別名解決入力`와 같은 input 패턴을 쓰되, **coach 배정과 partner 배정을 별도 탭/별도 행으로 두지 않는다.**

| column | note |
|---|---|
| `lead_id` 또는 `form_response_row_ref` | |
| `assignee_type` | `coach` / `partner` |
| `assignee_name` | coach 이름 또는 `稲井` / `佐藤` |
| `assignment_note` | |
| `operator_decision_status` | `approve` / `discard` |
| `operator_decision_at` | |
| `sync_status` | `pending` / `processed` / `error_*` (system) |

writeback collection (30m 주기)이 picks up → 항상 **확장된 `Customer_Coach_Assignments`** 로 upsert하고, `assignee_type`/`assignee_scope` 값으로 downstream view를 나눈다.

**운영 원칙:** CS는 배정 사실을 한 번만 입력한다. partner 관여 lead라도 별도 partner-assignment canonical을 만들지 않는다.

### 5.2. Form respondent → lead 시드
- `フォームの回答` ingest에서 학생 여부 판별 → `is_lead_only=true` Customer (or Lead) 자동 생성
- `CS_Partner_Assignment_Input`에서 CS가 partner 할당
- partner workbook에 row 등장

---

## 6. Writeback chain

`CS_Partner_Assignment_Input` 처리 (기존 patterns):
1. 30m writeback trigger → `collectCsWritebackRows`
2. approve이면 extended `Customer_Coach_Assignments` upsert + 필요 시 `Coach_Alias_Map` 갱신
3. `Customer_Alias_Map` 패턴과 동일하게 assignment source 기록
4. canonical refresh → publish all (5-workbook)

`*_Status_Input` (partner workbook) 처리 (신규 writeback path):
1. 30m writeback trigger → 신규 `collectPartnerStatusWritebackRows`
2. submit=TRUE row 만 처리. partner_id는 workbook 자체에 고정 binding (입력자 위조 방지)
3. post-assignment status 표(또는 같은 표의 status columns) upsert, `last_updated_by=partner`, `last_updated_at=now`
4. sync_status=`processed` 마킹
5. canonical refresh + republish (chain은 기존 `runWritebackCollection`에 통합)

---

## 7. Decisions captured (운영팀 답변 반영)

### Q1. Lead 식별 단위 — **답변 확정**
- **운영 결정:** 추적 시작은 **form 예약부터**. 다만 향후 LINE linkage 가능성은 열어둔다.
- **설계 반영:** Phase A/B에서는 LINE 등록 전체를 partner pipeline에 넣지 않는다. `フォームの回答` 기준 lead seed를 생성하고, 나중에 필요 시 `lead_id -> line_registration_id` 연결 컬럼/lookup을 additive하게 붙일 수 있게 설계한다.
- **구현 결정:** 별도 `Leads` 테이블까지는 아직 가지 않고, `Customer_Partner_Assignments.lead_id`는 `customer_id` 또는 form-seeded provisional id를 담는 방식으로 시작한다. customer-only surface에 `is_lead_only` 필터를 강제하는 전면 cutover는 현 시점 scope 밖.

### Q2. POTEX 상품 sale status 정합 — **답변 확정**
- **운영 결정:** 계약/입금의 정본은 기존 `Plans` / `Payments`.
- **설계 반영:** partner 쪽 status는 partner-perspective progress까지만 담는다. canonical sale fact는 절대 partner workbook 입력을 정본으로 삼지 않는다.
- **구현 결정:** `potex_sale_status` enum은 `none` / `introduced` / `in_discussion` / `lost` 정도의 lightweight 상태로 시작하고, `contracted` / `paid`는 partner 입력 enum에서 제외한다. 필요하면 publish view에서 `Plans` / `Payments` join 결과를 별도 read-only 컬럼으로 노출한다.

### Q3. Recruitment status enum 합의 — **답변 확정**
- **운영 결정:** 우선 구현하고, 나중에 수정 가능하게 한다.
- **설계 반영:** enum은 초기에 최소 집합으로 시작하되, sheets validation / publish mapping / writeback parser가 additive change에 강하도록 만든다.
- **초기 enum 제안:** `none`, `intern_intro`, `intern_active`, `selection`, `closed`, `lost`, `unreachable`.
- **구현 원칙:** enum 변경이 필요할 때 DB migration 없이 dropdown / validation / display label만 추가 수정하면 되도록 설계한다.

### Q4. Partner 정보 격리 — **답변 확정**
- **운영 결정:** workbook 분리.
- **설계 반영:** partner 전용 canonical은 폐기하되, partner-facing workbook/view는 유지 가능하다. 즉 canonical은 `Coaches` 축으로 통합하고, publish surface만 `Potex Inai` / `Potex Sato`로 분리한다.

### Q5. CS 보고/LStep 기재와 partner self-input 책임 분기 — **답변 확정**
- **운영 결정:** partner 주입력 + CS 예외적 보완.
- **설계 반영:** 기본 write path는 partner-facing workbook/view의 status input. 다만 canonical owner table은 `Coaches` 축 단일 모델을 유지한다.
- **구현 순서:** 첫 슬라이스에서는 `last_updated_by`에 `partner` / `cs`를 남길 수 있게 하고, CS override 전용 탭은 후속 Phase C+에서 추가 여부를 결정한다.

### Q6. CS assignment 운영 방식 — **수정 결정**
- **운영 결정:** CS 입장에서는 coach 배정과 partner 배정을 **같은 assignment 행위**로 본다. 따라서 입력 레이어는 통합하고, 담당자 유형만 구분한다.
- **의미:** 캘린더/Slack/LStep를 보며 CS가 구조화 입력을 남길 때, 같은 lead에 대해 coach와 partner를 따로 관리하면 이중 공수가 발생한다. 이를 피하기 위해 CS는 **한 번의 담당자 배정 입력**만 남기고, 그 결과가 downstream에서 coach canonical / partner canonical로 갈라진다.
- **설계 반영:** `CS_Partner_Assignment_Input` 단독 운영은 폐기 방향. 최종 운영안은 `CS_担当割当入力` 통합 surface + `Coaches` 축 단일 canonical이다. 최소 컬럼은 `lead_id(or response key)`, `assignee_type`, `assignee_name`, `assignment_note`, `operator_decision_status`, `sync_status`.

### Q7. 입력 빈도 / SLA — **답변 확정**
- **운영 결정:** stale/no-update 경고는 **CS + partner 본인**에게 보이게 한다.
- **설계 반영:** `Inai_Data_Health` / `Sato_Data_Health`와 `Potex CS` 쪽 monitor 양쪽에 stale count를 노출한다.
- **보류:** 정확한 SLA 문구(예: 주1회 / 면담 직후)는 후속 운영 문구에서 확정하되, 구조상 `30일 이상 미갱신` warning은 바로 넣을 수 있게 한다.

---

## 8. Implementation phasing (open questions 닫힌 후)

### Phase A: canonical 스키마만 (no UI)
- `Coaches` schema 확장 (`assignee_kind`, `assignee_scope`, `external_role` 등)
- `Customer_Coach_Assignments` schema 확장 (`lead_id`, partner-compatible metadata)
- 稲井 / 佐藤를 `Coaches` seed row로 편입
- 기존 `canonical/partners.ts`는 제거 또는 `coaches` 쪽 migration helper로 흡수

### Phase B: CS assignment input
- `CS_担当割当入力` 통합 탭
- writeback은 항상 extended `Customer_Coach_Assignments`로 upsert
- form respondent → lead seed flow

### Phase C: partner-facing workbooks/views
- `Potex Inai` / `Potex Sato` provisioning
- publish (`Inai_Assigned_Leads`, `Inai_Status_Input`, `Inai_Data_Health`)
- status writeback은 assignee_kind=partner row를 대상으로 동작

### Phase D: dashboard / event 확장
- `ConversionHistory` partner-related event 추가 (Q2 결정 따라)
- `経営_データ状況` / `コンシェルジュ_データ状況`에 partner pipeline 지표 노출

각 phase 끝에 inspect script로 verdict 확보 → backlog 갱신.

---

## 9. Risks

- **partner 입력 누락** → status 영원히 stale. Q5 / Q7 합의로 완화.
- **lead vs customer 모델 분기** → 잘못 설계하면 `Customers` 쿼리 전체에 필터 부담. Q1 결정 중요.
- **이름 충돌** → 기존 customer `佐藤知子` 와 assignee `佐藤` 동명이인 위험. 그러나 별도 partner table 대신 `Coaches` 내부에서 `coach_id`/`assignee_kind`로 식별하면 충돌 없이 운영 가능.
- **TimeRex / LStep 우회의 한계** — CS가 어디서 assignment 정보를 보고 input 시트에 적는지 (form 응답 직접 보고? Slack? LStep?). 만약 LStep을 보면서 적는다면 LStep 의존이 새는 거임. Q5와 함께 확인.

---

## 10. Owner / next action

- **Owner:** Hermes (orchestration) + Claude (spec drafting, post-합의 구현)
- **Next action:** 별도 partner canonical 도입을 중단하고, `Coaches` / `Customer_Coach_Assignments` 확장안으로 spec/code를 재정렬
- **Coding gate:** 사용자 설계 결정 반영 완료 후 migration/refactor 슬라이스로 진행 가능.
