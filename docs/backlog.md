# Potex Backlog

更新: 2026-05-25T09:45:00+09:00

## 目的
Potex プロジェクトの「今やること」と「後でやること」を、次の担当者がすぐ再開できる形で残す。

## 基本ルール
- GitHub repo `origin` (`Yeongmo-Kang/PotexAdmin`, branch `main`) を文書・コードの一次基準にする
- ローカル workspace (`/home/ubuntu/.hermes/projects/PotexAdmin`) は作業コピー兼バックアップ
- source/reference workbook 4種は read-only
- `POTEX DB` だけを canonical database とみなす
- operator-facing の表示は日本語、内部キーは英語 snake_case のまま維持する
- 直近の設計原則は `docs/architecture-guardrails.md` を見る

---

## 現在の要約
- Phase 1 cutover は完了済み
- live workbook 8 系統は稼働中
  - `POTEX DB`
  - `Potex CS`
  - `Potex Executive`
  - `Potex Concierge`
  - `Potex Sales`
  - `Potex Coaches`
  - `Potex Sato`
  - `Potex Inai`
- trigger cadence は稼働中
  - publish: 1時間ごと
  - writeback: 30分ごと
  - full refresh: 毎日 07:00 JST
- GitHub `main`、ローカル bare mirror、bundle backup、repo backup cron は整備済み
- orchestration 重複縮小、ERP モジュール化原則、operator UX 原則を docs に反映済み
- `publish/views/` feature facade と `contracts/` 契約定義を追加し、publish / writeback の境界を明文化済み
- approval queue には `CS_承認診断` / 拡張 `CS_承認進捗` / read-only inspect script を追加済み
- live verify で `CS_承認診断` / `CS_承認進捗` 反映を確認済み
- ERP foundation 文書として `docs/plans/customer-ownership-matrix.md` と `docs/plans/erp-module-map.md` を追加済み
- 次の焦点は `Customer_Edit_History` 設計と facade 内 helper の段階移管

---

## 今やること（優先順）

### 1. `Customer_Edit_History` の最小設計を文書化する
- 目的:
  - customer ownership matrix と ERP module map の次に、変更履歴の canonical ルールを固定する
- 必要なもの:
  - actor / source / before / after / approved_by の定義
  - event 粒度
  - spreadsheet 暫定保存方式と future DB table 像
- 完了条件:
  - customer master edit を web/API 化するとき audit trail の前提がぶれない

### 2. feature facade の内側を段階的に整理する
- 現状:
  - workbook 側 import は `publish/views/` の feature 単位へ分離済み
  - writeback contract も `contracts/` に集約済み
  - approval queue の operator 導線は `CS_承認診断` / `CS_承認進捗` / inspect script まで整備済み
  - ERP foundation として ownership / module map 文書も追加済み
- 次にやること:
  - 必要に応じて `publish/views.ts` 内部 helper を feature file 側へ段階移管する
  - facade の裏側でも責務の塊を小さくする
- 完了条件:
  - 新規機能追加時に巨大単一ファイルへ追記しなくても済む

### 3. approval queue の operator 実処理を前に進める
- 背景:
  - live workbook には `CS_承認診断` / `CS_承認進捗` が反映済み
- 進めること:
  - `CS_承認診断` を起点に payment / continuation の P1 を処理する
  - invalid / sync wait / source wait が出た場合だけ例外対応に分岐する
- 完了条件:
  - open P1 が実運用で減り、diagnosis が `operator_decision_required` 以外へ移る

---

## 次にやる候補（急ぎではない）

### P-013. 営業自動化 + `Staging_Payments` cutover
- 重要度は高いが、今すぐ最優先ではない
- 先に必要な整理:
  - LStep / Slack / spreadsheet / Potex DB の責務分界
  - 営業 operator UX 要件
  - payment / contract / continuation の canonical ownership

### Executive / operator monitor の追加改善
- freshness / trust は強化済み
- 次は「止まっている理由が一目で分かる」導線改善が中心

### partner assignment 最終整理
- partner 独立 canonical ではなく、`Coaches` / `Customer_Coach_Assignments` に吸収する方針を維持
- 実装・文書・運用説明のズレが残っていないか継続確認する

---

## 今回までに完了したもの

### 基盤・運用ガードレール
- GitHub `main` 一次基準化
- bare mirror / bundle backup / repo backup cron 整備
- Windows 側 auto-update scripts 追加
- `main.ts` orchestration 重複縮小
- `docs/architecture-guardrails.md` 追加
- ERP モジュール化原則 / operator UX 原則を反映

### workbook / operator UX
- Executive workbook の freshness / trust 強化
- operator-facing 主要文書の日本語化
- 残留韓国語文書の整理

### live 運用状態
- 8 workbook 運用継続中
- trigger cadence 稼働中
- build / deploy / live verify / GitHub 反映の流れは安定

---

## Blocked / 要入力

### 人の入力待ち
- approval queue の実処理そのものは operator 実行が必要
- customer ownership matrix は業務判断が必要

### 前提確定待ち
- LStep / Slack / TimeRex を含む本格的な営業・CS workflow 変更
- ERP 本格実装前の authority / edit policy 決定

---

## 参考文書
- `agents/session.md`
- `docs/architecture-guardrails.md`
- `docs/plans/2026-05-25-automation-and-erp-roadmap.md`
- `OPERATIONS_MANUAL.md`
- `docs/repo-resilience.md`
