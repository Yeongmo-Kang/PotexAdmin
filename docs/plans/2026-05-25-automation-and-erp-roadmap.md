# Potex Automation / ERP Roadmap Plan

> **For Hermes:** Use this plan to execute the next PotexAdmin tranche in small verified slices. Prefer direct implementation for repo-side work, and keep operator-facing steps explicit when human action is still required.

**Goal:** Potex の現行 spreadsheet 運用を止めずに、自動化の強化と ERP 化しやすいモジュール分割を同時に前進させる。

**Architecture:** 既存の `POTEX DB` canonical workbook を中心に維持しつつ、`potex-gas/src/` を業務モジュール単位へ寄せていく。短期では publish / writeback / refresh の自動化・可観測性・operator UX を強化し、中期では feature ごとの契約を固定して web/API ベースの ERP ツールへ移しやすい境界を作る。

**Tech Stack:** Google Apps Script, TypeScript, clasp, Google Sheets, GitHub, cron-backed repo safeguards

---

## 現在の到達点
- Phase 1 cutover は完了済み
- live workbook は 6 系統で稼働中
  - `POTEX DB`
  - `Potex CS`
  - `Potex Executive`
  - `Potex Concierge`
  - `Potex Sales`
  - `Potex Coaches`
- trigger cadence は稼働中
  - publish: 1時間ごと
  - writeback: 30分ごと
  - full refresh: 毎日 07:00 JST
- GitHub `origin/main` を一次基準化済み
- bare mirror / bundle backup / 6時間ごとの repo backup cron は整備済み
- `main.ts` の orchestration 重複は縮小済み
- アーキテクチャガードレールに、ERP モジュール化原則と operator UX 原則を反映済み
- workbook 側 import は `publish/views/` の feature facade へ分離済み
- writeback input contract は `potex-gas/src/contracts/` に集約済み

## いま残っている本質課題
1. **運用承認キューの処理はまだ人手依存が大きい**
   - `CS_入金名寄せ確認`
   - `CS_継続名寄せ確認`
2. **`publish/views.ts` が大きく、ERP 的モジュール境界を壊しやすい**
3. **Customers cutover / customer ownership / edit history が未定義で、ERP 主体の顧客管理へ進みにくい**
4. **営業自動化は意義が大きいが、優先順位と前提整理が未完了**

---

## 優先順位

### Priority 0 — いま止めないための自動化・運用安定化
**目的:** 既存運用の詰まりと属人化を減らす。

#### Task 0-1: approval queue の実運用フローを短縮する
**Objective:** operator が最小手数で P1 を処理できる状態を作る。

**Files:**
- Modify: `OPERATIONS_MANUAL.md`
- Modify: `docs/backlog.md`
- Optional follow-up: `potex-gas/src/publish/views.ts`

**Deliverables:**
- P1 優先処理ルールの明文化
- `decided_waiting_sync` / `invalid_open` が増えたときの確認順序を固定
- 必要なら approval summary view をさらに短く読みやすくする改善案を追加

**Verification:**
- operator が `CS_承認進捗` → review タブの順で迷わず動ける
- runbook だけで「何を見て、何を入れ、何を待つか」が分かる

#### Task 0-2: 自動化の inspectability を増やす
**Objective:** publish / writeback / full refresh の異常を運用側が早く見つけられるようにする。

**Files:**
- Modify: `potex-gas/src/publish/views.ts` または分割後の `publish/views/*.ts`
- Modify: `OPERATIONS_MANUAL.md`
- Optional new script: `potex-gas/scripts/`

**Deliverables:**
- stale / omission / queue growth を見つけやすい monitor の追加
- 必要なら deterministic な inspection script を追加

**Verification:**
- 「止まっているのか」「人入力待ちなのか」「source 更新待ちなのか」を 1〜2 タブで切り分けられる

---

### Priority 1 — ERP へ進むためのモジュール分割（完了）
**目的:** 今後の機能追加を spreadsheet 固有ロジックから切り離しやすくする。

#### Task 1-1: `publish/views.ts` の public surface を feature 単位に分割する（完了）
**Result:** workbook 側 import を `publish/views/` の feature facade に切り替えた。

**Files:**
- Created: `potex-gas/src/publish/views/cs.ts`
- Created: `potex-gas/src/publish/views/executive.ts`
- Created: `potex-gas/src/publish/views/sales.ts`
- Created: `potex-gas/src/publish/views/coach.ts`
- Created: `potex-gas/src/publish/views/concierge.ts`
- Created: `potex-gas/src/publish/views/partner.ts`
- Created: `potex-gas/src/publish/views/shared.ts`
- Modified: importer files under `potex-gas/src/publish/`
- Modified: `potex-gas/src/publish/views.ts`

**Delivered:**
- workbook / feature ごとの import 境界を明確化
- 今後の ERP module 切り出し時に、feature 単位の entry point を使える状態にした
- giant file への直接依存を workbook 層から外した

#### Task 1-2: writeback 契約を feature ごとに見直す（完了）
**Result:** input contract を `potex-gas/src/contracts/` へ集約し、required columns を検証するようにした。

**Files:**
- Created: `potex-gas/src/contracts/cs.ts`
- Created: `potex-gas/src/contracts/partner.ts`
- Created: `potex-gas/src/contracts/shared.ts`
- Modified: `potex-gas/src/writeback/csWriteback.ts`
- Modified: `potex-gas/src/writeback/partnerStatusWriteback.ts`
- Modified: `docs/architecture-guardrails.md`

**Delivered:**
- editable / reference の契約を feature ごとに定義
- writeback 処理前に required columns を検証
- rewrite 時も contract header に投影して accidental drift を抑止

**Verification:**
- `npm run typecheck`
- `npm run build`

---

### Priority 2 — ERP ツールの基礎設計
**目的:** spreadsheet から web/API 中心運用へ移るための最小単位を定める。

#### Task 2-1: customer ownership matrix を確定する
**Objective:** 顧客ごとに誰が更新責任を持つかを固定する。

**Files:**
- Create: `docs/plans/customer-ownership-matrix.md` または同等の日本語文書
- Modify: `docs/backlog.md`
- Modify: `agents/session.md`

**Deliverables:**
- customer field ごとの owner（営業 / CS / コーチ / 自動取込）
- overwrite rules / merge rules / review rules

**Verification:**
- `Customers` cutover 着手条件が曖昧でなくなる
- `Customer_Edit_History` の設計入力になる

#### Task 2-2: `Customer_Edit_History` の最小設計を確定する
**Objective:** 将来の ERP UI / API で変更履歴を追える前提を作る。

**Files:**
- Modify: `docs/database-overview.md`
- Create: `docs/plans/customer-edit-history-design.md` または同等文書
- Optional code follow-up: `potex-gas/src/constants.ts`, `potex-gas/src/bootstrap.ts`

**Deliverables:**
- 保存したい event 粒度
- actor / source / before / after / approved_by の定義
- spreadsheet での暫定保存方式と将来 DB テーブル像の両方

**Verification:**
- 人手更新と自動更新を同じ枠組みで説明できる
- ERP 化時に audit trail 要件へそのまま繋がる

#### Task 2-3: ERP 候補モジュール一覧と API 候補境界を作る
**Objective:** 何を先に web/API 化すべきかを順序づける。

**Files:**
- Create: `docs/plans/erp-module-map.md` または統合ロードマップ文書
- Modify: `docs/architecture-guardrails.md`

**Deliverables:**
- 候補 module: customers, assignments, feedback, continuation, payments, partner pipeline, executive reporting
- 各 module の inputs / outputs / operators / spreadsheet dependencies
- 「先に API 化」「最後まで spreadsheet でよい」を分けた優先表

**Verification:**
- 次に作る ERP ツールが思いつきではなく、既存 canonical 境界に沿って選べる

---

### Priority 3 — 営業自動化 / commercial flow 拡張
**目的:** 売上・契約・入金まわりの入力遅延と手戻りを減らす。

#### Task 3-1: `P-013` 営業自動化の前提整理
**Objective:** 何を source のまま残し、何を Potex 側で持つか整理する。

**Files:**
- Modify: `docs/backlog.md`
- Modify: `OPERATIONS_MANUAL.md`
- Create or update: commercial automation plan doc

**Deliverables:**
- LStep / Slack / spreadsheet / Potex DB の責務線引き
- `Staging_Payments` cutover 条件
- 営業 operator UX 要件

**Verification:**
- 実装前に workflow の責任分界が確定している

---

## Blocked / 人入力が必要なもの
- approval queue の実処理そのものは operator 入力が必要
- customer ownership matrix は業務側判断が必要
- LStep / Slack / TimeRex 連携の本格変更は業務運用条件の確定待ち

## いま repo 側で先に進められるもの
1. `publish/views.ts` 分割
2. writeback input contract の明文化
3. ERP module map 文書化
4. monitor / inspectability の改善

## 推奨実行順
1. `publish/views.ts` 分割
2. writeback 契約整理
3. ERP module map / ownership matrix たたき台作成
4. 営業自動化の前提整理

## 完了条件
- backlog / session / roadmap が同じ優先順位を向いている
- 次の実装 tranche が迷いなく `publish/views.ts` 分割に着手できる
- automation と ERP 化が別テーマではなく、同じ段階設計として扱われている
