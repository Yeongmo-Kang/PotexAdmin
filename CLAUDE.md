# CLAUDE.md — Potex プロジェクト運用ガードレール

## アーキテクチャ原則 (2026-05-18)
- **canonical database は `POTEX DB` のみ。** staging / canonical / mapping / exception / system シートは、すべてここで管理する。
- **DB に重複データや derive-only データを保存しない。** staging から 100% 導ける正規化結果は、シートに永続化せず publish 時の join で計算する。
- 他の workbook の役割は次の 3 つだけ。
  1. **集計表示**: DB を参照する read-only の要約表示
  2. **絞り込みビュー**: 特定ユーザーと必要な列だけを表示
  3. **トリガー入力**: operator の入力を writeback collection で DB に反映
- **publish シートへ手入力しない。** 入力は明示された input タブ (`CS_別名解決入力`, `CS_担当割当入力`, `CS_更新アクション`, `パートナー_状況入力`) のみで行う。

## Workbook map
| 役割 | 名前 | spreadsheet_id |
|---|---|---|
| Canonical DB | `POTEX DB` | `1sJuEM1RXn5zVeBj6dVTujnf0P2m-CweLPbt_gpcxFFs` |
| CS 運用 | `Potex CS` | `1KFRLdsT2-LlhSA0YLkXuV3Oh76yxnhL_6tvmOdvv4yg` |
| Executive モニタリング | `Potex Executive` | `1pnEWHFdGHY6Er3aAXuvAz-H1MwgQcvrEZq_Z5oqdwuY` |
| Concierge read-only | `Potex Concierge` | `1c-Ie03M619iMqhwqV1jHPSYDVPTMHPPKs6zhSr8QPr8` |
| Sales read-only | `Potex Sales` | `1i5uxVG9IUu0PTPSy9MqWMHcmNDNk3LDJwZo7nqT_Xao` |
| Coaches read-only | `Potex Coaches` | `19jpwf97PwDj93bVB3WJdhXhtT-vo8YmNGA6T0eEigUc` |
| Partner status input | `Potex Sato` | auto-provisioned / script property (`SATO_SPREADSHEET_ID`) |
| Partner status input | `Potex Inai` | auto-provisioned / script property (`INAI_SPREADSHEET_ID`) |

## Source workbooks（編集禁止・定着後に廃止予定）
新しいシート構成が定着したら利用を止める予定だが、現時点では業務フロー確認用の reference 兼、短期 ingest source である。**read-only で扱う。**

| シート | spreadsheet_id | 現在の役割 |
|---|---|---|
| `受講者管理` | `17fkrUdf-vS7tQ06lzR3LDp-PPsWSwajqPcB0vyRXOk4` | customer master + 申込 form |
| `顧客満足度会議` | (要確認) | 運用会議用 |
| `月次振り返りアンケート（回答）` | `1hl2JVJ_DSvjtk8axnZWJ8TTwOIMECfkREg7rN6tbDH8` | feedback Form 応答 |
| `⭕️使用中｜POTEX数値管理` | `1arXU3lqzY8c7-mYY7CnDlxEpr5ar68Q2m4h4HEwLYC8` | 売上 / 体験 / 実需 + `LStep` CSV import の中継 (`csvA`/`csv_potex`) |

source / reference workbook で禁止すること:
- 構造変更 / タブ削除 / 手作業の整理 / GAS write
- alias 問題を source 側の命名変更で解決すること
- 「確信のない名前マッチ」を alias map に `approved` で入れること

## Upstream operational flow (2026-05-18 確認)
- 公式 LINE 友だち追加と LINE タグ / 顧客情報の実 upstream は `LStep`。
- 営業は面談結果を Slack に報告し、CS はその報告を見て `LStep` のタグ / 顧客情報を更新する。
- その後、`LStep` や関連画面から形式別 CSV をダウンロードし、運用 spreadsheet へ手動 import する。
- GAS は、その spreadsheet import 結果を読んで dashboard / managed workbook を refresh する。
- そのため現在の spreadsheet reader は、短期の中継用として薄く保ち、長期では `LStep` export/API または Slack→`LStep` 業務フローへ置き換えられる形にしておく。
- **保留原則:** `LStep` API/writeback、TimeRex 連携、marketing-CS workflow 変更は、プラン / オプション / API / 業務基準の確認が終わるまで実装しない。その間は `LStep` / TimeRex に依存しない Phase 1 hardening を優先する。

## 現在の判定状況（2026-05-19）
- customer ingest: `raw_source_configured_and_named_rows_aligned`
- ops view 3種 (`Ops_コーチ_担当負荷`, `Ops_Followup_Queue`, `Ops_Continuation_Targets`): **accept**
- `CS_要フォロー一覧` publish contract bug: 修正済み
- commercial first-pass: live `Staging_Payments` 136 / `Plans` 228 / `Payments` 136 / `ConversionHistory` 543+
- LINE registration ingest: live (`Staging_LineRegistration=10693`)
- attribution normalization: publish-time `tokenizeAttributionTags()` join 正常 (`acquisition_with_channel_count=4622`, `acquisition_top_channels=yt=4524; inflow=126`)
- `CS_入金名寄せ確認`: header 29 columns 正常, `P1=39`, operator approval ready
- `CS_継続名寄せ確認`: header 26 columns 正常, `P1=10`, operator approval ready
- `clasp push` 復旧済み (`y.kang@potex.jp` アカウント)
- cold-start defense: `Customer_Coach_Assignments` / `Customer_Channel_Links` がなくても ingest は throw しない
- `clearAndRewrite` merged-cell 防御: `breakApart()` 適用済み
- 4 verdict (`inspect_post_refresh_state.py`) はすべて green

## Tab inventory (`POTEX DB`)
- Staging mirror (legacy): `Staging_Customers`, `Staging_Payments` — 段階的に廃止中 (P-012)。`Staging_LineRegistration` / `Staging_Feedback` は吸収済み。
- Canonical: `Customers`, `Coaches`, `Sessions`, `Feedback`, `Plans`, `Payments`, `ConversionHistory`, `Customer_Coach_Assignments`, `Customer_Channel_Links`, `Line_Registrations`
- Mapping/Exception: `Coach_Name_Map`, `Coach_Alias_Map`, `Customer_Alias_Map`, `Exceptions_FeedbackMatch`, `Exceptions_ContinuationMatch`
- Ops views: `Ops_Feedback_Review`, `Ops_Followup_Queue`, `Ops_コーチ_担当負荷`, `Ops_ZeroSession_Review`, `Ops_Continuation_Targets`
- System: `Sync_Log`, `Sync_Control`, `Publish_Manifest`

## ConversionHistory event types（時系列順）
`line_registered` → `lead_created` → `experience_scheduled` → `contracted` → `paid` → `completed` / `lost`

## Trigger cadence
- publish: 1時間ごと
- writeback collection: 30分ごと
- full refresh: 毎日 07:00

## Key paths
- GAS code: `potex-gas/src/`
- Manifest: `workbook_manifest.json`
- Backlog: `docs/backlog.md`
- Session checkpoint: `agents/session.md`
- Operations: `OPERATIONS_MANUAL.md`, `PHASE1_CUTOVER_RUNBOOK.md`

## どの作業でも最初に行う順番
1. `agents/session.md` を最初に確認する
2. `docs/backlog.md` で active / next / blocked を確認する
3. 依頼が文書 / 運用 / 実装のどれかを分類する
4. 実装の場合、source workbook は read-only のまま、write は `POTEX DB` のみへ行う
5. 結果を検証したら `docs/backlog.md` と `agents/session.md` を更新する
