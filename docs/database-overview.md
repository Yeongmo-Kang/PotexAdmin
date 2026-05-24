# Potex Database Overview

## 1. 이 문서의 목적
이 문서는 Potex 데이터베이스가 **어떤 워크북들로 구성되어 있는지**, **어디가 원본이고 어디가 운영용인지**, **어떤 시트를 남기고 어떤 시트를 없앴는지**를 빠르게 이해하기 위한 기준 문서다.

이 문서를 먼저 읽으면 아래가 한 번에 정리된다.
- 수정하면 안 되는 원본 시트가 무엇인지
- `POTEX DB`가 왜 중심 허브인지
- `Potex CS`, `Potex Executive`, `Potex Concierge`, `Potex Sales`, `Potex Coaches`가 무엇을 보는 용도인지
- 현재 live 운영 대상으로 보는 시트가 무엇인지

---

## 2. 한 줄 요약
Potex 데이터 구조는 다음 원칙으로 운영한다.

1. **원본(Source) 스프레드시트는 읽기 전용이다.**
2. **`POTEX DB`만 canonical database 역할을 한다.**
3. **운영자는 DB 대신 역할별 워크북(`Potex CS`, `Potex Executive`, `Potex Concierge`, `Potex Sales`, `Potex Coaches`)을 본다.**
4. **사람 입력은 publish 시트가 아니라 별도 input / writeback 시트에서만 한다.**

---

## 3. 수정 금지 대상: 현재 운영 중인 원본 시트
아래 시트들은 **현재 운영 중인 실사용 source**이므로 수정/삭제 금지다.

### Upstream operational systems
- `LStep`: 공식 LINE 친구추가, LINE 태그, LStep 내부 고객정보를 관리하는 실제 upstream 운영 시스템
- `Slack`: 영업이 고객 면담 결과를 보고하고, CS가 이를 보고 LStep을 갱신하는 업무 전달 채널

현재 알려진 수동 흐름:
1. 유저가 공식 LINE을 친구추가한다.
2. LINE/LStep 내부에서 태그와 고객정보가 관리된다.
3. 영업이 고객 면담 결과를 Slack에 보고한다.
4. CS가 Slack 보고를 보고 LStep의 태그/고객정보를 갱신한다.
5. LStep/관련 화면에서 포맷별 CSV를 수동 다운로드한다.
6. 해당 CSV를 운영 스프레드시트에 수동 import한다.
7. GAS가 그 spreadsheet 데이터를 읽어 dashboard / managed workbook을 refresh한다.

### Source / reference workbooks
- `受講者管理`
- `顧客満足度会議`
- `月次振り返りアンケート （回答）`
- `⭕️使用中｜POTEX数値管理` — LStep CSV import 결과(`csvA`, `csv_potex`)와 대시보드 갱신 흐름을 포함하는 단기 ingest/reference source

### 원칙
- 구조 변경 금지
- 탭 삭제 금지
- 수동 정리 금지
- 이 시트들은 **읽기 전용 source / reference**로만 취급
- 단, 장기적으로는 spreadsheet가 원천이 아니라 **LStep/Slack 업무흐름에서 내려온 export/import 경유지**라는 점을 전제로 reader만 교체할 수 있게 유지한다.

---

## 4. 현재 관리 대상 워크북

### 4.1 POTEX DB
역할:
- 유일한 canonical database
- staging / canonical / mapping / exception / system 탭 보관
- 다른 운영 workbook이 모두 여기서 publish 받음

이 워크북에서 하는 일:
- source 데이터 적재
- 정규화
- canonical row 생성
- alias / exception 관리
- downstream publish source 제공

### 4.2 Potex CS
역할:
- CS 운영자가 실제 업무를 처리하는 workbook
- follow-up / continuation / exception review / alias resolution 수행

이 워크북에서 하는 일:
- follow-up queue 확인
- continuation 대상 확인
- alias resolution 입력
- 이후 writeback으로 DB에 반영

### 4.3 Potex Executive
역할:
- 요약/모니터링 전용 workbook
- KPI와 데이터 상태를 확인하는 workbook

이 워크북에서 하는 일:
- 코치 부하 확인
- 고객 리스크 요약 확인
- 데이터 정합성/건강상태 확인

### 4.4 Potex Concierge
역할:
- concierge follow-up을 읽기 전용으로 확인하는 workbook

이 워크북에서 하는 일:
- follow-up queue 확인
- concierge 관점 데이터 상태 확인

### 4.5 Potex Sales
역할:
- 계약, 미입금, 파이프라인 변화를 읽기 전용으로 확인하는 workbook

이 워크북에서 하는 일:
- 계약 목록 확인
- 미입금 큐 확인
- 최근 funnel event 추이와 data health 확인

### 4.6 Potex Coaches
역할:
- 코치 담당 부하와 요フォロー 고객을 읽기 전용으로 확인하는 workbook

이 워크북에서 하는 일:
- 코치별 담당 부하 확인
- 요フォロー 고객 확인
- 코치 관점 데이터 상태 확인

---

## 5. 현재 live sheet 구조

### POTEX DB
#### Staging layer (legacy, 점진 제거 중 — P-012)
- `Staging_Customers`
- `Staging_Payments`
- ~~`Staging_LineRegistration`~~ — Phase 1로 `Line_Registrations`에 흡수 (2026-05-20)
- ~~`Staging_Feedback`~~ — Phase 2 step 2d로 제거, ingest가 `Feedback` / `Exceptions_FeedbackMatch`에 직접 적재 (2026-05-20)

#### Canonical layer
- `Customers`
- `Coaches`
- `Sessions`
- `Feedback`
- `Plans`
- `Payments`
- `ConversionHistory`
- `Line_Registrations`
<!-- attribution channel은 별도 canonical 시트로 영속화하지 않는다. Line_Registrations.attribution_tags 원본을 두고, `経営_データ状況` / `コンシェルジュ_データ状況` publish 시점에 `tokenizeAttributionTags()` 로 (`YT_/IG_/TIK_/TT_/PT_/LP_/SDP_/【流入】` → `yt/ig/tik/tt/pt/lp/sdp/inflow`) 변환해 분포만 노출한다. 중복 데이터 회피 + publish-time join 원칙. -->


> 현재 live commercial first-pass 상태: `Staging_Payments` 136행, `Plans` 228행, `Payments` 136행, `ConversionHistory` 543행.

#### Mapping / exception layer
- `Coach_Name_Map`
- `Coach_Alias_Map`
- `Customer_Alias_Map`
- `Exceptions_FeedbackMatch`
- `Exceptions_ContinuationMatch` — continuation plan rows from `継続プラン管理` that could not be matched to a canonical customer; surfaced (instead of silently dropped) so operators can review name variants or add aliases. Refreshed by `runCanonicalRefresh()` / `runFullRefresh()` via `buildCommercialOutputs()`.

#### Operational derived views in DB
- `Ops_Feedback_Review`
- `Ops_Followup_Queue`
- `Ops_コーチ_担当負荷`
- `Ops_ZeroSession_Review`
- `Ops_Continuation_Targets`

#### System layer
- `Sync_Log`
- `Sync_Control`
- `Publish_Manifest`

### Potex CS
- `CS_使い方`
- `CS_承認進捗`
- `CS_入金名寄せ確認`
- `CS_継続名寄せ確認`
- `CS_担当割当入力`
- `CS_要フォロー一覧`
- `CS_継続対象一覧`
- `CS_例外確認`
- `CS_更新アクション`
- `CS_別名解決入力`

### Potex Executive
- `経営_使い方`
- `経営_データ状況`
- `経営_例外推移`
- `経営_顧客リスク`
- `経営_コーチ負荷`

### Potex Concierge
- `コンシェルジュ_使い方`
- `コンシェルジュ_フォロー一覧`
- `コンシェルジュ_データ状況`

### Potex Sales
- `営業_使い方`
- `営業_契約一覧`
- `営業_未入金一覧`
- `営業_データ状況`
- `営業_ファネル推移`

### Potex Coaches
- `コーチ_使い方`
- `コーチ_要フォロー一覧`
- `コーチ_担当負荷`
- `コーチ_データ状況`

---

## 6. 이번 정리에서 삭제한 시트
아래 시트는 `POTEX DB`에서 제거했다.
- `MasterData`
- `Dashboard`

삭제 이유:
- 현재 GAS/manifest 기준 운영 구조에 포함되지 않음
- 역할이 애매하거나 stale 상태였음
- Executive workbook 및 명시적 운영 시트 구조로 대체되는 방향과 충돌함
- 시트 수를 줄여 운영자가 헷갈릴 여지를 줄이는 편이 더 안전함

중요:
- 삭제는 **관리 대상 workbook (`POTEX DB`)** 에서만 수행했다.
- **현재 운영 중인 source/reference workbook은 전혀 수정하지 않았다.**

---

## 7. 데이터 소유권 규칙

### DB가 소유하는 것
- 모든 canonical row
- 모든 ID
- mapping tables
- exception tables
- publish source data

### 운영 workbook이 소유하는 것
- operator decision
- 후속조치 메모
- input / writeback row

### 금지
- 운영 workbook에서 canonical row 직접 수정
- source workbook 직접 정리해서 문제 해결
- publish 시트에 수기 수정

---

## 8. 문서 읽는 순서

### 가장 먼저 볼 문서
1. `README.md`
2. `docs/database-overview.md`
3. `docs/sheet-reference.md`
4. `OPERATIONS_MANUAL.md`

### 실행/배포가 필요할 때
5. `PHASE1_CUTOVER_RUNBOOK.md`
6. `OPS_WORKBOOK_ARCHITECTURE.md`
7. `docs/backlog.md`

---

## 9. 운영자에게 가장 중요한 메시지
- 원본 시트는 건드리지 않는다.
- DB는 직접 운영 화면이 아니다.
- 실제 일상 작업은 역할별 workbook(CS / Executive / Concierge / Sales / Coaches)에서 한다.
- publish 탭은 읽기 전용이다.
- 사람이 입력하는 곳은 `CS_別名解決入力` 같은 input 탭뿐이다.
