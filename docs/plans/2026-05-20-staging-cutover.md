# Staging Cutover Plan (P-012)

> **Status:** 운영팀 회답 완료 (2026-05-20). Phase 1·2·4 착수 가능, Phase 3 보류. 코드 작업은 phase별 분리 착수.

**Goal:** "DB가 원본"이라는 원칙을 staging layer까지 관통시킨다. 외부 워크북은 input 통로로만 남기고, 모든 canonical 데이터는 POTEX DB 안에 직접 적재·보존한다. raw mirror(`Staging_*` 4종)는 단계적으로 제거한다.

**Non-goal:** 단일 cutover. 4개 staging은 의존도와 위험도가 달라 표별로 (a) 새 canonical 정의 → (b) parallel write → (c) verify → (d) staging 제거 순서로 진행.

---

## 1. 배경

### 1.1. 현재 staging 4종
| staging | source workbook | 규모 | 핵심 의존 |
|---|---|---|---|
| `Staging_Customers` | `受講者管理.顧客管理` + `申し込み一覧` | 224 | canonical `Customers`와 컬럼 겹침. assigned_coach / course_name는 derive. |
| `Staging_Feedback` | `月次振り返りアンケート（回答）` | 58 | csWriteback `feedbackKey()` dedupe가 source_sheet/source_row에 의존 |
| `Staging_Payments` | `着金管理マスター` | 136 | unmatched 39건 → `CS_入金名寄せ確認` 큐. payment_id는 매 refresh 재생성 |
| `Staging_LineRegistration` | `⭕️使用中｜POTEX数値管理` (`csvA` / `csv_potex`) | 10,675 | LStep CSV 수동 import. customer_id matching pipeline |

### 1.2. 왜 staging이 문제인가
- canonical 데이터가 두 군데에 존재 (source workbook + staging mirror). "원본이 어디인가" 모호.
- source_sheet/source_row가 dedupe / evidence 키로 노출 → source workbook 행 위치가 changes하면 ID semantic이 깨짐.
- 매 refresh `clearAndRewrite` 비용. 10k+ row staging은 publish latency의 큰 비중.
- 운영팀 입장: source workbook을 수정해야 데이터가 바뀐다고 인식 → DB가 source of truth라는 모델과 충돌.

### 1.3. 이미 정리된 것 (D-005)
- pipeline-written canonical 표 (`Plans` / `Payments` / `ConversionHistory` / `Customer_Coach_Assignments` / `Customer_Channel_Links`)의 source 좌표 trace 제거.
- staging 4종은 **여전히 mirror로 남아 있음** — 본 plan이 다룬다.

---

## 2. Out of scope (intentional)

- LStep / TimeRex API 직접 연동 (CLAUDE.md 보류 원칙).
- partner pipeline cutover (별도 P-010).
- 운영자 manual edit workflow 자동화 (수동 input은 그대로 둠).

---

## 3. 표별 cutover 설계

### 3.1. `Staging_LineRegistration` → `Line_Registrations` (canonical)

**Why first:** 격리도 최고. canonical `Customers`는 `line_registration_id`만 참조하므로 표 이름 변경 + 영구화 수준의 작업.

**문제점:**
- 원천 데이터가 LStep CSV 수동 export → source 워크북 paste. 즉 외부 시스템이 truth.
- `staging_line_id = line_{segment}_{line_user_id}`는 line_user_id 있으면 안정. 없는 행 (희소)은 sheet+row hash → CSV 재import 시 ID 불안정.

**Cutover:**
1. 새 canonical 표 `Line_Registrations` 정의. 현재 staging 컬럼 그대로 + `created_at`/`updated_at`.
2. ingest 변경: source 워크북 read → 직접 `Line_Registrations` upsert (line_user_id 있는 행만, 즉 stable ID 보유 행만).
3. line_user_id 없는 행은 별도 `Line_Registrations_Unstable` 또는 단순 drop (수량 확인 후 결정).
4. `Customers.line_registration_id` join target을 staging → `Line_Registrations`로 변경.
5. parallel write 1주 운영 후 `Staging_LineRegistration` 시트 제거.

**Open questions:**
- Q-LR-1: line_user_id 없는 row는 몇 건? drop해도 운영상 손실 없는가?
- Q-LR-2: 향후 LStep API 도입 시 source 워크북 paste 흐름을 제거할 수 있는가? 그 결정 전까지 source 워크북은 input 통로로 유지.

---

### 3.2. `Staging_Feedback` → `Feedback` 직접 (canonical)

**가장 위험. dedupe 키 재설계 필요.**

**문제점:**
- csWriteback `feedbackKey()`가 `source_sheet`/`source_row`로 dedupe. 같은 응답이 두 번 이벤트되면 중복 방지를 시트 좌표에 의존.
- form 응답이 form sheet에 append되는 한 row 위치는 안정 (form은 새 행을 추가만 함). 즉 현재는 사실상 안정.
- 그러나 alias `evidence` 문자열에 `{source_sheet} row {source_row}` 노출 → 운영자가 시트를 직접 보면서 검증하는 model.

**Cutover:**
1. 응답 stable ID 정의: `response_id = hash(source_sheet + submitted_at + respondent_email + raw_coach_name)`. 8-12자 hash.
2. `Feedback` 표 + `Exceptions_FeedbackMatch`에 `response_id` 컬럼 추가, `source_sheet`/`source_row` 보존 (전환 기간).
3. csWriteback `feedbackKey()`를 response_id 기반으로 전환.
4. `Customer_Alias_Map.evidence`를 `response:{response_id}` 형식으로 (기존 evidence는 read-only 유지).
5. ingest 변경: form sheet read → 직접 `Feedback` / `Exceptions_FeedbackMatch` upsert (`Staging_Feedback` 경유 안 함).
6. parallel write 2주 운영 + dedupe drift 0 확인 후 `Staging_Feedback` 제거 + Feedback에서 source_sheet/source_row 제거.

**Open questions:**
- Q-FB-1: 운영자가 alias 승인 시 시트 행 좌표가 evidence로 필요한가, 아니면 응답 본문 (raw_coach_name + submitted_at + email)이면 충분한가?
- Q-FB-2: form 응답 sheet가 일정 주기로 archive(다른 시트로 잘라낼)될 가능성이 있는가? 있다면 source_sheet 보존이 더 중요.

---

### 3.3. `Staging_Payments` → `Payments` 직접 (canonical)

**문제점:**
- `Staging_Payments`는 unmatched 큐 (39건)의 원천. customer alias 승인 시 staging에서 다시 read → canonical promote.
- `payment_id = PAY-####` sequential, 매 refresh 재생성 (즉 ID는 안정 X). 외부 invoice 시스템과 link되어 있지 않으므로 ID 안정성에 대한 요구는 약함.
- source 워크북(`着金管理マスター`)이 영업팀 active 입력 시트. 수동 편집 빈도 높음.

**Cutover:**
1. payment stable ID 정의: `payment_id = hash(source_sheet + customer_name + contract_date + amount_text)`. 8-12자 hash.
2. `Payments` 표에 stable payment_id 도입 (기존 `PAY-####`는 deprecated).
3. ingest 변경: 着金管理マスター read → 직접 `Payments` upsert. unmatched는 customer_id 빈 행으로 `Payments`에 그대로 유지 (현재 staging에 있는 39건과 동치).
4. `CS_入金名寄せ確認` 큐 source를 `Staging_Payments` → `Payments`(customer_id 빈 행)로 전환.
5. parallel write 2주 + unmatched count 동치 확인 후 `Staging_Payments` 제거.

**Open questions:**
- Q-PY-1: 영업팀이 着金管理マスター 행을 수정/삭제하면 어떻게 처리? (a) hash 기반 ID는 컬럼 값 바뀌면 다른 ID로 인식 → 새 row 생성 + 옛 row stale. (b) source row를 stable ID 발급 후 source 워크북에 ID 컬럼 적어두기? (운영팀 합의 필요)

---

### 3.4. `Staging_Customers` → `Customers` 직접 (canonical)

**가장 큰 변화. 운영팀 manual ownership과 충돌 가능.**

**문제점:**
- `Customers`는 현재 수동 maintained. operator가 컬럼을 직접 편집.
- `Staging_Customers`는 source `受講者管理` enrichment + 다른 canonical (`Customer_Coach_Assignments`, `Plans`)로부터 derive.
- 즉 Customers ⊂ Staging_Customers (필드 차원). cutover하려면 어느 필드가 pipeline-managed이고 어느 필드가 operator-managed인지 명시적 경계 필요.

**Cutover:**
1. `Customers` 컬럼별 ownership matrix 작성 (각 컬럼: `pipeline` / `operator` / `pipeline_seed_operator_override`).
   - pipeline: 매 refresh 덮어씀 (예: `line_registration_id`, `course_name`, `assigned_coach_name`)
   - operator: pipeline 절대 건들지 않음 (예: `continuation_tag`, after-follow notes)
   - seed+override: 처음 ingest 시 seed하고 그 이후 operator 값 보존 (예: `email`, `phone`)
2. ingest 변경: 受講者管理 read → ownership matrix 따라 `Customers` upsert. 새 고객은 row append, 기존 고객은 pipeline 컬럼만 갱신.
3. `Staging_Customers`는 사실상 publish view (CS / Concierge / Sales가 read하는 형태) → publish 시점 join으로 대체 가능한지 확인. 가능하면 `Staging_Customers` 시트 제거.
4. operator 검증 1주 + diff 확인 후 cutover 완료.

**Open questions:**
- Q-CU-1: ownership matrix 초안 작성 권한 누구에게? (운영팀 + 코드 양쪽 검토 필요)
- Q-CU-2: pipeline overwrite가 operator 수동 입력을 덮어쓴 사고를 회복할 수 있어야 함. `Sync_Log` 또는 별도 `Customer_Edit_History` 도입?

---

## 4. 단계 (운영팀 회답 반영, 2026-05-20)

| Phase | 범위 | 상태 | 비고 |
|---|---|---|---|
| 1 | Staging_LineRegistration → Line_Registrations | **완료 (2026-05-20)** | `Line_Registrations` canonical 신설, reader 4종 전환, `Staging_LineRegistration` write 제거 + clasp push. orphan 시트 운영자 confirm 후 수동 삭제 안내. |
| 2 | Staging_Feedback → Feedback 직접 | **완료 (2026-05-20)** | step 2a~2d 모두 완료. response_id hash로 dedupe 전환, source_sheet/source_row 제거, Staging_Feedback 시트 제거. orphan 시트 운영자 confirm 후 수동 삭제 안내. |
| 3 | Staging_Payments → Payments 직접 | **보류** | 영업팀이 着金管理マスター를 자주 수정 + 향후 자동화 예정. 자동화 도입과 함께 cutover하는 게 합리적. 단기엔 현 staging 구조 유지 |
| 4 | Staging_Customers → Customers 직접 | **ownership matrix 대기** | 사용자가 직접 matrix 작성. matrix 도착 후 착수. Customer_Edit_History 표 동시 도입 (Q-CU-2 응답) |

각 phase 종료 시 `agents/session.md` / `docs/backlog.md` 갱신, build green + 1주 parallel write zero drift 확인.

### 4.1. Phase 1 착수 노트 (Line_Registrations)
- 새 canonical 표명: `Line_Registrations` (rename, 컬럼 그대로).
- ingest path 변경: source 워크북 read → 직접 `Line_Registrations` upsert by `staging_line_id` (= `line_{segment}_{line_user_id}`).
- `Customers.line_registration_id` join target만 staging → canonical로 교체.
- parallel write 1주 후 `Staging_LineRegistration` 시트 제거.

### 4.2. Phase 2 착수 노트 (Feedback)
- `response_id = hash(source_sheet + submitted_at + respondent_email + raw_coach_name)` (8-12자).
- `Feedback` / `Exceptions_FeedbackMatch`에 `response_id` 컬럼 추가, source_sheet/source_row는 전환 기간 보존.
- csWriteback `feedbackKey()` → response_id 기반.
- `Customer_Alias_Map.evidence` → `response:{hash}` 형식 (기존 evidence는 read-only 유지).
- parallel write 2주 + dedupe drift 0 확인 후 source coord 컬럼 제거 + `Staging_Feedback` 시트 제거.

**Step 2a 완료 (2026-05-20):** additive `response_id` 컬럼 + `buildResponseId()` SHA-256 hash (`resp_{12hex}`) 도입. `Feedback` / `Staging_Feedback` / `Exceptions_FeedbackMatch` 헤더에 컬럼 추가, ingest 모든 path에서 채움. source_sheet/source_row + feedbackKey() + evidence 의미는 변경 없음. clasp push 완료.

**Step 2b 완료 (2026-05-20):** `feedbackKey(responseId, sourceSheet, sourceRow, respondentEmail)` 시그니처 변경 — response_id가 있으면 `rid::{response_id}`, 없으면 legacy fallback. 4 call sites 전환. `buildFeedbackRow`가 response_id 통과. `Customer_Alias_Map.evidence`는 alias resolution input 경로에서 `response:{response_id}` 형식. `dropOrphanStagingLineRegistration()` 헬퍼 추가 후 운영자 실행 완료. clasp push. 빌드 161.1kb.

**Step 2c 완료 (2026-05-20):** canonical cutover. `Feedback` / `Exceptions_FeedbackMatch` 헤더에서 `source_sheet` / `source_row` 컬럼 제거. `feedbackKey()` → 1-arg (response_id only). `opsKey()` 제거, Ops_Feedback_Review dedupe는 `feedback_id` 기반. `CS_別名解決入力` 뷰 헤더에서도 source 좌표 컬럼 제거, `aliasInputKey()` → `(response_id, alias_name)`. `buildFeedbackRow` / `buildOpsFeedbackRow` 출력에서 source 좌표 제거. evidence는 항상 `response:{response_id}` (실데이터는 항상 채워짐). dead helper `normalizeEmail` 2곳 정리. 빌드 159.8kb (-1.8kb). clasp push.

**Step 2d 완료 (2026-05-20):** Staging_Feedback 시트 자체 제거 + ingest 직접 `Exceptions_FeedbackMatch` 적재. `Exceptions_FeedbackMatch` 헤더에 `coach_id` / `feedback_type` / `satisfaction_score` / `nps_score` / `nps_category` / `progress_score` / `expectation_score` / `community_score` / `q_gap` / `free_comment` 컬럼 추가 — alias 승인 시 csWriteback이 exception row만으로 `Feedback`/`Ops_Feedback_Review` row를 build할 수 있게 모든 raw 필드 포함. `staging_feedback_id` 키 제거. csWriteback에서 `stagingRows` / `stagingById` 룩업 블록 전체 삭제, `buildFeedbackRow` / `buildOpsFeedbackRow` 파라미터 `staging` → `exc`로 이름 변경. `STAGING_FEEDBACK_HEADER` 상수 / `STAGING_FEEDBACK` SHEETS 키 삭제. `dropOrphanStagingFeedback()` 헬퍼 추가 (gas-entry + build-gas 등록). 빌드 159.0kb. clasp push 완료. 운영자가 `dropOrphanStagingFeedback` 1회 실행해 orphan 시트 제거 필요.

### 4.3. Phase 3 보류 사유
- 영업팀이 着金管理マスター를 자주 수정 → hash 기반 stable payment_id는 매번 바뀌어 stale row 양산.
- source 워크북에 payment_id 컬럼 write-back은 가능하나, 운영팀이 시트 직접 수정 → 자동화 전환 예정인 상황에서 단기 투자가 무의미.
- 자동화 (영업 자동 입력 → DB 직접 적재) 도입 시점에 한 번에 cutover하는 게 합리적. P-012 Phase 3은 그 자동화 design과 묶어서 재론.

### 4.4. Phase 4 착수 전 필요사항
- 사용자가 `Customers` 컬럼별 ownership matrix 제출 (pipeline 덮어쓰기 / operator-only / seed+override).
- `Customer_Edit_History` 표 신설 (변경 전/후 값 + 변경자 + 시각). Q-CU-2 응답에 따라 가장 가벼운 안전망 (Sync_Log dump)보다 한 단계 위 안전망 채택.

---

## 5. Open question (회답 완료, 2026-05-20)

**운영팀 회답 요약 (full text는 각 항목 하단 RESOLVED 블록)**
- Q-LR-1 — line_user_id 빈 행 0건. 분기 불필요.
- Q-LR-2 — LStep API 보류, 현재 CSV paste 유지.
- Q-FB-1 — 시트 행번호 불필요. response_id hash로 단순화.
- Q-FB-2 — 응답 시트 archive 안 함.
- Q-PY-1 — 자주 수정 + 향후 자동화 예정. Phase 3 보류.
- Q-CU-1 — 사용자가 ownership matrix 직접 작성.
- Q-CU-2 — 복구 mechanism 필요 → `Customer_Edit_History` 표 신설.

각 질문에 대해 **무엇을 묻는가 / 왜 묻나 / 답이 결정하는 것** 순서로 정리.

---

### Q-LR-1. line_user_id 없는 LINE 등록 행은 어떻게 처리할까

**무엇을 묻나**
현재 `Staging_LineRegistration` 10,675행 중 `line_user_id`(LStep ID) 컬럼이 비어 있는 행이 몇 건인지, 그리고 그 행이 무엇인지.

**왜 묻나**
canonical로 옮기려면 모든 행에 안정 ID가 필요하다. `staging_line_id`는 line_user_id가 있을 땐 `line_{segment}_{line_user_id}`로 안정적이지만, 없으면 sheet+row 위치 hash로 fallback한다 → CSV 재import 시 같은 행도 다른 ID로 인식된다.

**답이 결정하는 것**
- 0건 또는 무시 가능한 수 → 그냥 line_user_id 있는 행만 canonical로 옮기고 끝. 가장 단순.
- 의미 있는 수 (예: 100건↑) → 어떤 데이터인지 확인 후 (a) 별도 unstable 표로 분리, (b) 영구 ID 부여 방식 설계, (c) drop 중 선택.

(GAS에서 한 줄로 카운트 가능 — 운영팀 회답 없이 즉시 답 만들 수 있음.)

**RESOLVED (2026-05-20):** line_user_id 빈 행 0건. 가장 단순 경로로 진행 (line_user_id 있는 행 전부 → `Line_Registrations` upsert).

---

### Q-LR-2. LStep API 직접 연동을 향후 도입할 의향이 있는가

**무엇을 묻나**
지금은 LStep CSV를 수동 export → source 워크북 paste 흐름인데, 향후 LStep API를 직접 호출해 DB에 적재할 계획이 있는가.

**왜 묻나**
"있다"면 source 워크북 paste 흐름 자체를 없애는 게 목표가 된다. "없다(보류)"면 source 워크북은 input 통로로 영구히 남기고, DB는 그 paste를 ingest해서 canonical로 들고만 있는다.

**답이 결정하는 것**
- 도입 의향 있음 → `Line_Registrations`를 LStep API의 destination으로 설계 (외부 시스템에서 push 받는 형태).
- 보류 (CLAUDE.md 기본 stance) → 현재 paste 흐름 유지, 단 canonical 표 자체는 그대로 만들고 ingest만 paste 기반.

**RESOLVED (2026-05-20):** 보류. CSV paste 흐름 유지. `Line_Registrations` 표는 paste를 ingest받는 destination 역할.

---

### Q-FB-1. feedback alias 승인 시, 시트 좌표가 운영자에게 필요한가

**무엇을 묻나**
운영자가 `CS_別名解決入力`에서 "이 응답자는 이 고객이다"라고 승인할 때, 판단 근거로 `月次振り返りアンケート` 시트의 행번호를 직접 보러 가는가, 아니면 응답 본문(`작성일` + `이메일` + `raw_coach_name` + `자유 응답`)만 보면 충분한가.

**왜 묻나**
현재 `Customer_Alias_Map.evidence`는 `{source_sheet} row {source_row}` 문자열이다. 운영자가 행번호를 보고 시트로 직접 점프하는 흐름이라면 좌표가 evidence로 의미 있다. 응답 본문만 보고 판단한다면 좌표는 죽은 컬럼이고, response_id hash로 갈아끼우면 끝.

**답이 결정하는 것**
- 좌표 봄 → evidence 필드에 좌표를 계속 노출 (response_id와 좌표 둘 다 보존), 또는 좌표를 응답 본문 일부로 대체할 방법 설계.
- 응답 본문만 봄 → evidence를 `response:{hash}` 형식으로 단순화, source_sheet/source_row는 Feedback 표에서 완전 제거.

**RESOLVED (2026-05-20):** 행번호 불필요. evidence를 `response:{hash}` 형식으로 단순화, source 좌표는 Feedback 표에서 제거.

---

### Q-FB-2. form 응답 시트가 잘려나갈 가능성이 있는가

**무엇을 묻나**
`月次振り返りアンケート（回答）` 워크북 안의 응답 시트(`monthly_xxxx` / `final_xxxx` 등)가 일정 주기로 archive(다른 시트로 이동, 행 삭제)되는 운영이 있는가, 아니면 영원히 append-only인가.

**왜 묻나**
append-only면 source 좌표는 영원히 안정 → 좌표를 dedupe key로 계속 써도 안전. archive가 있으면 같은 응답이 다른 좌표로 다시 등장할 수 있어 dedupe가 깨진다 → response_id hash 이외엔 답이 없다.

**답이 결정하는 것**
- archive 없음 → 전환 우선순위 낮춤 (현재 dedupe도 잘 작동 중). 그래도 response_id로 옮기는 게 깨끗하지만 긴급은 아님.
- archive 있음 → response_id hash가 필수. 전환 우선순위 올림.

**RESOLVED (2026-05-20):** archive 안 함 방침. dedupe 안정 보장. 전환은 깨끗함이 동기지 긴급은 아님 — 단, Q-FB-1과 함께 묶어 Phase 2 일괄 진행.

---

### Q-PY-1. 着金管理マスター 행이 영업팀에 의해 편집/삭제될 때 어떻게 처리할까

**무엇을 묻나**
영업팀이 着金管理マスター에서 (a) 기존 행의 contract_date / amount 등을 수정, (b) 행을 삭제하는 빈도가 어느 정도인가. 그리고 수정/삭제가 일어났을 때 canonical `Payments`에선 (i) 같이 수정·삭제, (ii) 이전 값 보존 + 새 값 추가 중 어느 쪽이 맞는가.

**왜 묻나**
stable payment_id를 hash로 잡으면, 영업팀이 contract_date를 고치는 순간 hash가 달라져 "다른 payment"가 된다. 옛 payment_id는 stale로 남고 새 payment_id가 추가된다. 이게 운영상 받아들일 수 있는지, 아니면 source 워크북에 payment_id 컬럼을 만들어 영업팀이 그걸 들고 다니게 할지 결정이 필요.

**답이 결정하는 것**
- 수정/삭제 거의 없음 → hash 기반 ID + stale 검출 큐로 충분.
- 수정 자주, 삭제 가끔 → 着金管理マスター에 `payment_id` 컬럼 추가 (pipeline이 hash 생성 후 source 워크북에 다시 적어주는 방식). 영업팀이 한 번 받은 ID는 행 편집해도 유지. (write-back to source — 현재까지 안 하던 방향)
- 빈번한 삭제까지 → soft-delete 표 / Payments archive 메커니즘 추가.

**RESOLVED (2026-05-20):** 자주 수정. 향후 시트 직접 수정이 아닌 자동화 입력으로 전환 예정. → 단기 Phase 3 cutover 무의미. 자동화 design과 함께 묶어 후속 plan으로 분리. 현재 `Staging_Payments` 구조 유지.

---

### Q-CU-1. Customers 컬럼별 ownership을 누가 명세하나

**무엇을 묻나**
`Customers` 표 각 컬럼이 (a) pipeline이 매 refresh 덮어쓰는 컬럼, (b) operator만 건드리는 컬럼, (c) 처음만 pipeline이 seed하고 그 뒤엔 operator 우선 — 중 어느 쪽인지 결정하는 작업. 이걸 누가 만드는가.

**왜 묻나**
Customers는 지금 운영팀이 손으로 편집하는 표. 여기로 ingest를 옮기면 ingest가 operator 입력을 덮어쓸 위험이 생긴다. 컬럼별 경계가 명확해야 cutover 코드를 짤 수 있다. 경계는 운영적 판단(누가 이 값을 책임지는가)이라 운영팀 input 없이는 못 정한다.

**답이 결정하는 것**
- 운영팀이 직접 matrix 초안 → 그대로 구현.
- 코드 쪽이 초안 → 운영팀 검토 → 합의 후 구현.
- 누구도 못 만듦 → Phase 4 무기한 보류, Customers는 현 구조 유지.

**RESOLVED (2026-05-20):** 사용자가 직접 matrix 작성. matrix 제출 후 Phase 4 착수.

---

### Q-CU-2. pipeline이 operator 입력을 잘못 덮어썼을 때 어떻게 복구하나

**무엇을 묻나**
Phase 4 cutover 후, 코드 버그나 ownership matrix 누락으로 ingest가 operator의 수동 입력을 덮어쓰는 사고가 났다고 가정. 그 입력을 복구할 mechanism이 필요한가, 필요하면 어디까지인가.

**왜 묻나**
지금은 Customers를 사람이 직접 입력하므로 잘못 덮어쓸 일이 없다. cutover 후엔 가능해지므로 안전망이 필요. 안전망의 강도에 따라 cutover 비용이 크게 달라진다.

**답이 결정하는 것**
- `Sync_Log`에 어떤 컬럼이 어떻게 바뀌었는지 dump만 → 가장 가볍지만 복구는 수동.
- 별도 `Customer_Edit_History` 표 (변경 전/후 값 보존) → 자동 복구 가능, 표 하나 추가 비용.
- 매 refresh 전 Customers snapshot을 별도 시트에 저장 → 가장 안전하지만 시트 부풀음 비용.

**RESOLVED (2026-05-20):** 복구 필요. → 중간 옵션 (`Customer_Edit_History` 표 신설) 채택. 변경 전/후 값 + 변경자 (`pipeline` / `operator:{email}`) + 시각 보존.

---

## 6. 참고
- `docs/db-schema.md` — 현재 표 일람
- `docs/plans/2026-05-17-p006-commercial-model-ingest-slice.md` — 이전 staging 신설 시 결정 맥락
- `CLAUDE.md` / `agents/workflow.md` — 운영 원칙
