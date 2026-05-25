# Potex ERP Module Map

> **For Hermes:** Use this as the default decomposition map when turning spreadsheet-first workflows into web/API modules. Prefer these module boundaries over ad-hoc feature slices.

**Goal:** Potex の今の spreadsheet 運用を、将来 web/API ベース ERP へ移すときの **業務モジュール境界 / 優先順位 / 依存関係** を明確にする。

**Architecture:** `POTEX DB` canonical を中心に、operator-facing workbook は module-specific UI とみなす。ERP 化では canonical tables / event tables / review queues をそのまま module contract に読み替え、まず review-heavy workflows から安全に API 化できるようにする。

**Tech Stack:** Google Sheets, Google Apps Script, TypeScript, future web/API ERP, canonical workbook design

---

## 1. モジュール化の基本方針

1. **業務責務で切る**
   - workbook 名や source シート名ではなく、業務行為ごとに切る
2. **review queue を module boundary として扱う**
   - `CS_別名解決入力`, `CS_入金名寄せ確認`, `CS_継続名寄せ確認` は将来そのまま review UI module になる
3. **derive-only data を module の保存対象にしない**
   - join で再計算できる display-only 値は API response で返し、永続化を増やさない
4. **spreadsheet を全部置き換えず、module 単位で置き換える**
   - 最初は “operator UI replacement” と “canonical workflow stabilization” を同時に進める

---

## 2. Candidate modules overview

## 2.1 Customers / Identity

- Purpose:
  - 顧客の canonical identity 管理
  - alias resolution
  - email / phone / LINE linkage の基準化
- Main canonical tables:
  - `Customers`
  - `Customer_Alias_Map`
  - `Customer_Channel_Links`
  - `Line_Registrations`
- Current workbook surfaces:
  - `CS_別名解決入力`
  - `CS_入金名寄せ確認`
  - `CS_継続名寄せ確認`
  - `CS_例外確認`
- Main operators:
  - CS
  - sales (supporting)
- Typical API candidates:
  - search customers
  - approve alias match
  - merge candidate preview
  - link/unlink line registration
- Migration priority:
  - **high**
- Why high:
  - 現在すでに review queue が明確で、web UI 化メリットが大きい

## 2.2 Assignments

- Purpose:
  - 顧客とコーチ/パートナーの担当関係管理
- Main canonical tables:
  - `Customer_Coach_Assignments`
  - `Coaches`
- Current workbook surfaces:
  - `CS_担当割当入力`
  - partner workbooks
  - `経営_コーチ負荷`
- Main operators:
  - CS
  - partner operators
- Typical API candidates:
  - assign coach
  - reassign owner
  - partner status update
  - active assignment timeline
- Migration priority:
  - **high**
- Why high:
  - relation model がすでに canonical 化されており、writeback contract も比較的明確

## 2.3 Feedback / Follow-up

- Purpose:
  - 満足度 / リスク / 要フォロー案件の確認と後続対応
- Main canonical tables:
  - `Feedback`
  - `Ops_Followup_Queue`
  - `Exceptions_FeedbackMatch`
- Current workbook surfaces:
  - `CS_要フォロー一覧`
  - `コンシェルジュ_フォロー一覧`
  - `経営_顧客リスク`
- Main operators:
  - CS
  - concierge
  - executive viewers
- Typical API candidates:
  - follow-up queue list
  - customer risk profile
  - feedback review history
- Migration priority:
  - **medium-high**
- Why not first:
  - read-heavy value is high, but write path is lighter than identity/assignment review

## 2.4 Continuation / Renewal

- Purpose:
  - 継続提案対象管理と continuation matching review
- Main canonical tables:
  - `Ops_Continuation_Targets`
  - `Exceptions_ContinuationMatch`
  - `Plans`
- Current workbook surfaces:
  - `CS_継続対象一覧`
  - `CS_継続名寄せ確認`
- Main operators:
  - CS
- Typical API candidates:
  - continuation target queue
  - continuation review approval
  - continuation stage tracking
- Migration priority:
  - **high**
- Why high:
  - renewal timing is business-critical and current queue is already explicit

## 2.5 Payments / Commercial

- Purpose:
  - 契約 / 入金 / 未入金 / payment matching の管理
- Main canonical tables:
  - `Payments`
  - `Plans`
  - `Staging_Payments`
  - `ConversionHistory`
- Current workbook surfaces:
  - `営業_契約一覧`
  - `営業_未入金一覧`
  - `CS_入金名寄せ確認`
- Main operators:
  - sales
  - CS
- Typical API candidates:
  - unpaid contracts view
  - payment review queue
  - contract timeline
- Migration priority:
  - **medium**
- Why medium:
  - business impact is large, but ownership split and upstream responsibility lines still need clarification

## 2.6 Partner Pipeline

- Purpose:
  - partner-assigned leads の進捗管理
- Main canonical tables:
  - `Customer_Coach_Assignments`
  - partner-related status fields inside assignment rows
- Current workbook surfaces:
  - `パートナー_担当リード`
  - `パートナー_状況入力`
  - `CS_承認進捗` (status throughput visibility only)
- Main operators:
  - partner operators
  - CS
- Typical API candidates:
  - partner lead inbox
  - partner status update form
  - stale pipeline monitor
- Migration priority:
  - **medium**
- Why medium:
  - operator workflow is clear, but independent partner portal can wait until core customer/assignment workflows stabilize

## 2.7 Executive Reporting / Data Health

- Purpose:
  - 会議判断用の freshness / trust / issue visibility
- Main canonical/system tables:
  - `Sync_Log`
  - derived health snapshots from canonical tables
- Current workbook surfaces:
  - `経営_会議前チェック`
  - `経営_更新状況`
  - `経営_データ状況`
  - `経営_例外推移`
- Main operators:
  - executive viewers
  - CS lead
- Typical API candidates:
  - dashboard health summary
  - stale-domain drilldown
  - queue bottleneck explanation
- Migration priority:
  - **medium-low**
- Why later:
  - これは下位 module が安定してから作る方が良い。先に根本 workflow を API 化した方が ROI が高い

---

## 3. Module dependency order

Recommended dependency graph:

1. **Customers / Identity**
2. **Assignments**
3. **Continuation / Renewal**
4. **Feedback / Follow-up**
5. **Payments / Commercial**
6. **Partner Pipeline**
7. **Executive Reporting**

理由:
- identity と assignment が他 module の join key / owner context を決める
- continuation / feedback は CS operator value が高く、今の queue/ops surfaces と整合する
- payments は重要だが ownership ambiguity を先に整理したい
- executive reporting は最後に aggregated UI として作ればよい

---

## 4. API boundary candidates

## 4.1 Query-first APIs

先に API 化しやすい読み取り系:
- customer search
- review queue listing
- assignment inbox
- follow-up queue listing
- executive health summary

## 4.2 Action-first APIs

次に API 化しやすい操作系:
- approve alias resolution
- approve continuation/payment match
- assign or reassign coach
- update partner status
- append operator note

## 4.3 Wait on policy first

以下は policy 先行:
- direct customer master edit form
- contract/payment manual correction UI
- cross-team permission-sensitive fields
- bulk overwrite workflows

---

## 5. Spreadsheet dependency by module

- Customers / Identity
  - Depends heavily on: `受講者管理`, `月次振り返りアンケート （回答）`, payment/continuation sources
  - Spreadsheet can be reduced after review UI stabilization

- Assignments
  - Depends on: form/application ingest, coach roster, partner workbooks
  - Spreadsheet can be replaced relatively early

- Feedback / Follow-up
  - Depends on: feedback source imports
  - Read surfaces may remain spreadsheet longer if operator UX is already sufficient

- Continuation / Renewal
  - Depends on: continuation source workbook and plan data
  - Review queue API gives strong early value

- Payments / Commercial
  - Depends on: commercial source workbook, Slack/LStep business flow
  - Spreadsheet likely remains partially in loop until upstream authority clarified

- Partner Pipeline
  - Depends on: assignment + partner input workflow
  - Can become a small portal/module after assignment stabilization

- Executive Reporting
  - Depends on all other modules being trustworthy
  - Spreadsheet may remain acceptable for a long time if health views are already clear

---

## 6. What should become API first vs stay spreadsheet longer

### API first

- alias / identity review
- continuation review
- assignment actions
- partner status form
- operator note / review decision actions

### spreadsheet acceptable longer

- executive aggregate summaries
- some read-only sales summaries
- concierge read-only follow-up context
- low-change operational readme/help tabs

---

## 7. Thin-slice ERP roadmap

### Slice A: Review inbox UI
- customer/alias review list
- approve/reject/hold actions
- note entry
- audit log append

### Slice B: Assignment UI
- current assignment panel
- reassign flow
- partner status update flow

### Slice C: Continuation / follow-up cockpit
- CS dashboard integrating continuation + follow-up + review queues

### Slice D: Commercial cockpit
- unpaid / contracted / payment matching views
- only after ownership and upstream policy fixed

### Slice E: Executive dashboard
- cross-module health and issue summary

---

## 8. Open decisions still needed

- direct `Customers` editing policy
- field-level permissions across sales / CS / coach / partner
- payment/commercial upstream authority split
- whether executive dashboard should remain spreadsheet-first even after ERP rollout
- how far note/history should be centralized before broader ERP UI is built

---

## 9. Immediate usage rule

新しい改善案を考えるときは、まず次のどれに属するかを決める:
- Customers / Identity
- Assignments
- Feedback / Follow-up
- Continuation / Renewal
- Payments / Commercial
- Partner Pipeline
- Executive Reporting

この分類が曖昧なら、実装前にこの文書へ境界を追記する。
