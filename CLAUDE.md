# CLAUDE.md — Potex Project Guardrails

## Architectural principle (2026-05-18)
- **POTEX DB만 canonical database.** 모든 staging / canonical / mapping / exception / system 시트는 여기서만 관리된다.
- **DB에 중복/derive-only 데이터 저장 금지.** staging에서 100% derive 가능한 정규화 결과는 sheet으로 영속화하지 말고 publish 시점 join으로 계산한다.
- 다른 워크북의 역할은 세 가지 중 하나:
  1. **통계 표시** (DB 참조해서 read-only summary 노출)
  2. **필터링 뷰** (특정 user list + 특정 columns만 노출)
  3. **트리거 입력** (operator 입력이 writeback collection으로 DB에 반영)
- **publish 시트에 수기 입력 금지.** 입력은 명시적 input 탭 (`CS_別名解決入力`, `CS_更新アクション`)에서만 한다.

## Workbook map
| 역할 | 이름 | spreadsheet_id |
|---|---|---|
| Canonical DB | `POTEX DB` | `1sJuEM1RXn5zVeBj6dVTujnf0P2m-CweLPbt_gpcxFFs` |
| CS 운영 | `Potex CS` | `1KFRLdsT2-LlhSA0YLkXuV3Oh76yxnhL_6tvmOdvv4yg` |
| Executive 모니터링 | `Potex Executive` | `1pnEWHFdGHY6Er3aAXuvAz-H1MwgQcvrEZq_Z5oqdwuY` |
| Concierge read-only | `Potex Concierge` | `1c-Ie03M619iMqhwqV1jHPSYDVPTMHPPKs6zhSr8QPr8` |

## Source workbooks (수정 금지, 정착 후 deprecation 예정)
신규 시트 구조가 정착하면 사용을 끊을 예정이지만, 현재는 업무 흐름 파악용 reference이자 단기 ingest source이다. **읽기 전용으로만 다룬다.**

| 시트 | spreadsheet_id | 현재 역할 |
|---|---|---|
| `受講者管理` | `17fkrUdf-vS7tQ06lzR3LDp-PPsWSwajqPcB0vyRXOk4` | customer master + 신청 form |
| `顧客満足度会議` | (확인 필요) | 운영 회의용 |
| `月次振り返りアンケート（回答）` | `1hl2JVJ_DSvjtk8axnZWJ8TTwOIMECfkREg7rN6tbDH8` | feedback Form 응답 |
| `⭕️使用中｜POTEX数値管理` | `1arXU3lqzY8c7-mYY7CnDlxEpr5ar68Q2m4h4HEwLYC8` | 매출/체험/실주 + LStep CSV import 경유지 (`csvA`/`csv_potex`) |

원본 시트에 대한 금지:
- 구조 변경 / 탭 삭제 / 수동 정리 / GAS write
- alias 문제를 source-side naming으로 해결
- "확신 없는 이름 매칭"을 alias map에 `approved` 처리

## Upstream operational flow (2026-05-18 확인)
- 공식 LINE 친구추가와 LINE 태그/고객정보의 실제 upstream은 `LStep`이다.
- 영업은 고객 면담 결과를 Slack에 보고하고, CS가 그 보고를 보고 LStep 태그/고객정보를 갱신한다.
- 이후 LStep/관련 화면에서 포맷별 CSV를 다운로드하고, 운영 spreadsheet에 수동 import한다.
- GAS는 그 spreadsheet import 결과를 읽어 dashboard / managed workbook을 refresh한다.
- 따라서 현재 spreadsheet reader는 단기 경유지용으로 얇게 유지하고, 장기적으로 LStep export/API 또는 Slack→LStep 업무흐름으로 교체 가능해야 한다.
- **보류 원칙:** LStep API/writeback, TimeRex 연계, 마케팅-CS workflow 변경은 플랜/옵션/API/업무 기준 확인 전까지 구현하지 않는다. 그동안은 LStep/TimeRex에 의존하지 않는 Phase 1 hardening을 우선한다.

## Current verdicts (2026-05-19)
- customer ingest: `raw_source_configured_and_named_rows_aligned`
- ops view 3종 (`Ops_コーチ_担当負荷`, `Ops_Followup_Queue`, `Ops_Continuation_Targets`): **accept**
- CS_要フォロー一覧 publish contract bug: 수정 완료
- commercial first-pass: live `Staging_Payments` 136 / `Plans` 228 / `Payments` 136 / `ConversionHistory` 543+
- LINE registration ingest: live (`Staging_LineRegistration=10693`)
- attribution normalization: publish-time `tokenizeAttributionTags()` join 정상 (`acquisition_with_channel_count=4622`, `acquisition_top_channels=yt=4524; inflow=126`)
- `CS_入金名寄せ確認`: header 29 columns 정상, `P1=39`, operator approval ready
- `CS_継続名寄せ確認`: header 26 columns 정상, `P1=10`, operator approval ready
- `clasp push` 복구됨 (`y.kang@potex.jp` 계정)
- cold-start defense: `Customer_Coach_Assignments` / `Customer_Channel_Links` 누락 시 ingest throw 안 함
- `clearAndRewrite` merged-cell 방어: `breakApart()` 적용
- 4개 verdict (`inspect_post_refresh_state.py`) 모두 green

## Tab inventory (POTEX DB)
- Staging mirror (legacy): `Staging_Customers`, `Staging_Payments` — 점진 제거 중 (P-012). `Staging_LineRegistration` / `Staging_Feedback`는 흡수 완료.
- Canonical: `Customers`, `Coaches`, `Sessions`, `Feedback`, `Plans`, `Payments`, `ConversionHistory`, `Customer_Coach_Assignments`, `Customer_Channel_Links`, `Line_Registrations`
- Mapping/Exception: `Coach_Name_Map`, `Coach_Alias_Map`, `Customer_Alias_Map`, `Exceptions_FeedbackMatch`, `Exceptions_ContinuationMatch`
- Ops views: `Ops_Feedback_Review`, `Ops_Followup_Queue`, `Ops_コーチ_担当負荷`, `Ops_ZeroSession_Review`, `Ops_Continuation_Targets`
- System: `Sync_Log`, `Sync_Control`, `Publish_Manifest`

## ConversionHistory event types (in chronological order)
`line_registered` → `lead_created` → `experience_scheduled` → `contracted` → `paid` → `completed` / `lost`

## Trigger cadence
- publish: 1h
- writeback collection: 30m
- full refresh: daily 07:00

## Key paths
- GAS code: `potex-gas/src/`
- Manifest: `workbook_manifest.json`
- Backlog: `docs/backlog.md`
- Session checkpoint: `agents/session.md`
- Operations: `OPERATIONS_MANUAL.md`, `PHASE1_CUTOVER_RUNBOOK.md`

## Working order for any task
1. `agents/session.md` 먼저 확인
2. `docs/backlog.md`로 active / next / blocked 상태 확인
3. 요청이 문서 / 운영 / 구현 중 무엇인지 분류
4. 구현이면 source workbook은 read-only만, write는 POTEX DB로
5. 결과 검증 후 backlog + session.md 갱신
