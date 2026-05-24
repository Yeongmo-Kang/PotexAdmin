# Potex 운영 워크북 분리 아키텍처

## 1. 목적
Potex는 **DB workbook 1개 + 역할별 운영 workbook 여러 개** 구조로 운영한다.

핵심 원칙:
- `POTEX DB`만 canonical ownership을 가진다.
- 운영 workbook은 read-model + input/writeback inbox 역할만 맡는다.
- 운영 workbook끼리는 직접 동기화하지 않는다.
- 모든 동기화는 DB 허브를 경유한다.

---

## 2. 현재 Phase 1 기준 구조

### 2.1 POTEX DB
역할:
- source/staging/canonical/mapping/exception/system 시트를 보유
- 유일한 ID 생성 지점
- 유일한 canonical 확정 지점
- CS / Executive / Concierge / Sales / Coaches publish source 제공

현재 유지 대상 탭:
- `Staging_Customers`
- `Staging_Payments`
- `Line_Registrations` (P-012 Phase 1로 Staging_LineRegistration 흡수)
- `Customers`
- `Coaches`
- `Sessions`
- `Feedback`
- `Plans`
- `Payments`
- `ConversionHistory`
- `Coach_Name_Map`
- `Coach_Alias_Map`
- `Customer_Alias_Map`
- `Exceptions_FeedbackMatch`
- `Ops_Feedback_Review`
- `Ops_Followup_Queue`
- `Ops_コーチ_担当負荷`
- `Ops_ZeroSession_Review`
- `Ops_Continuation_Targets`
- `Sync_Log`
- `Sync_Control`
- `Publish_Manifest`

정리 완료:
- legacy `MasterData` 삭제
- stale `Dashboard` 삭제

삭제 이유:
- 현재 GAS/manifest 기반 구조에서 사용되지 않음
- 역할별 workbook 분리 구조와 맞지 않음
- 운영자 입장에서 sheet 수를 줄이는 편이 더 명확함

### 2.2 Potex CS
역할:
- follow-up, continuation, exception review, alias resolution, assignment input 처리

현재 탭:
- `CS_使い方`
- `CS_承認進捗`
- `CS_入金名寄せ確認`
- `CS_継続名寄せ確認`
- `CS_担当割当入力`
- `CS_要フォロー一覧`
- `CS_継続対象一覧`
- `CS_別名解決入力`
- `CS_例外確認`
- `CS_更新アクション`

운영 규칙:
- queue/review 시트는 publish 결과이므로 읽기 전용으로 본다.
- 사람이 직접 입력하는 대표 시트는 `CS_別名解決入力`, `CS_担当割当入力`, `CS_更新アクション`이다.
- canonical 수정은 CS workbook에서 직접 하지 않고 writeback으로만 올린다.

### 2.3 Potex Executive
역할:
- KPI, 리스크, 데이터 상태 확인

현재 탭:
- `経営_使い方`
- `経営_データ状況`
- `経営_例外推移`
- `経営_顧客リスク`
- `経営_コーチ負荷`

운영 규칙:
- 모두 publish 시트이므로 읽기 전용이다.
- `経営_データ状況`는 live reference workbook의 `数値整合性チェック` 역할을 최소 버전으로 반영한 시트다.
- `経営_例外推移`는 `Sync_Log` 기반 예외/미매칭 시계열 탭이다 (기본 튜닝: JST 일별 / 최근 30일 / 일자별 마지막 successful snapshot).

### 2.4 Potex Concierge
역할:
- concierge follow-up read model 확인

현재 탭:
- `コンシェルジュ_使い方`
- `コンシェルジュ_フォロー一覧`
- `コンシェルジュ_データ状況`

운영 규칙:
- 모두 publish 시트이므로 읽기 전용이다.
- 수기 수정이 필요하면 DB / CS 측 플로우에서 처리한다.

### 2.5 Potex Sales
역할:
- 계약, 미입금, 파이프라인 추이 확인

현재 탭:
- `営業_使い方`
- `営業_契約一覧`
- `営業_未入金一覧`
- `営業_データ状況`
- `営業_ファネル推移`

운영 규칙:
- 모두 publish 시트이므로 읽기 전용이다.
- 미매칭/수정은 DB / CS 측 운영 플로우에서 처리한다.

### 2.6 Potex Coaches
역할:
- 코치 담당 부하와 요フォロー 고객 확인

현재 탭:
- `コーチ_使い方`
- `コーチ_要フォロー一覧`
- `コーチ_担当負荷`
- `コーチ_データ状況`

운영 규칙:
- 모두 publish 시트이므로 읽기 전용이다.
- 수기 수정이 필요하면 DB / CS 측 플로우에서 처리한다.

---

## 3. Source workbook과 managed workbook 구분

### 수정 금지: 현재 운영 중인 source/reference workbook
- `受講者管理`
- `顧客満足度会議`
- `月次振り返りアンケート （回答）`
- `⭕️使用中｜POTEX数値管理`

### 수정 가능: Potex가 직접 관리하는 workbook
- `POTEX DB`
- `Potex CS`
- `Potex Executive`
- `Potex Concierge`
- `Potex Sales`
- `Potex Coaches`

원칙:
- source는 읽기 전용
- managed workbook만 구조 정리/자동화 대상

---

## 4. 데이터 소유권

### DB 소유
- 모든 ID
- canonical entity/event
- mapping tables
- exception tables
- 공식 lifecycle/status
- downstream publish source

### 운영 workbook 소유
- 업무용 입력값만 소유
- canonical row 직접 수정 금지

예:
- CS: alias resolution, assignment input, 후속조치 입력
- Executive: 읽기 전용 요약/검증
- Concierge / Sales / Coaches: 각 역할용 read-only publish surface

---

## 5. 동기화 방향

### Downstream publish
- `DB -> 운영 workbook`
- 예: `Ops_Followup_Queue` -> `CS_要フォロー一覧`
- 예: `Ops_コーチ_担当負荷` -> `経営_コーチ負荷`

### Upstream writeback
- `운영 workbook -> DB`
- 예: `CS_別名解決入力` -> `Customer_Alias_Map`

### 금지
- 운영 workbook끼리 직접 sync 금지
- 운영 workbook에서 canonical ID 생성 금지
- source workbook 직접 수정으로 문제 해결 금지

---

## 6. 운영상 가장 중요한 설계 규칙
- publish 시트와 manual input 시트를 분리한다.
- publish 시트는 overwrite 가능한 구조여야 한다.
- 사람 입력은 항상 별도 input / writeback 시트에만 남긴다.
- 운영자가 일상적으로 수정하는 canonical DB 화면은 만들지 않는다.

---

## 7. 현재 live 역할별 publish surface

현재 live managed workbooks:
- `POTEX DB`
- `Potex CS`
- `Potex Executive`
- `Potex Concierge`
- `Potex Sales`
- `Potex Coaches`

역할별 workbook의 operator-facing 탭은 일본어 탭명 기준으로 유지하며, canonical DB 시트명/컬럼명은 영어 snake_case를 유지한다.
