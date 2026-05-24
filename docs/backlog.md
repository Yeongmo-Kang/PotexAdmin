# Potex Backlog

更新: 2026-05-24T23:24:13+09:00

## 目的
Potex プロジェクトの「今やること」と「後でやること」を、次の担当者がすぐ再開できる形で残す。

## 基本ルール
- GitHub repo `origin` (`Yeongmo-Kang/PotexAdmin`, branch `main`) を文書・コードの一次基準にする
- ローカル workspace (`/home/ubuntu/.hermes/projects/PotexAdmin`) は作業コピー兼バックアップ
- source/reference workbook 4種は read-only
- `POTEX DB` だけを canonical database とみなす
- operator-facing の表示は日本語、内部キーは英語 snake_case のまま維持する

---

## 現在の要約
- Phase 1 cutover は完了済み
- 6 workbook (`POTEX DB`, `Potex CS`, `Potex Executive`, `Potex Concierge`, `Potex Sales`, `Potex Coaches`) は live 運用中
- trigger cadence は稼働中
  - publish: 1時間ごと
  - writeback: 30分ごと
  - full refresh: 毎日 07:00 JST
- 2026-05-24 時点の直近確認では、Executive workbook の freshness / trust 系タブ追加と live 反映まで完了済み
- GitHub `main` とローカル backup mirror の両方に最新 commit を保持している

---

## 今やること（優先順）

### 1. 運用側の承認キューを進める
- 対象:
  - `CS_入金名寄せ確認` P1 = 39
  - `CS_継続名寄せ確認` P1 = 10
- 目的:
  - 未解決 alias / continuation の運用滞留を減らす
- 流れ:
  1. input タブで確認・承認
  2. `runWritebackCollection()`
  3. `Customer_Alias_Map` 反映
  4. canonical refresh
  5. 各 workbook 再 publish
- 備考:
  - これはコード作業というより、運用実行待ちの項目

### 2. Partner assignment 方針を最終形に揃える
- 背景:
  - partner を別 canonical に分ける案から、`Coaches` / `Customer_Coach_Assignments` に吸収する案へ寄せている
- 次に確認すること:
  - 現在の live 挙動が最終方針とズレていないか
  - transitional な partner scaffold の説明が文書上で誤解を生まないか
- 完了条件:
  - 実装・文書・運用説明が同じ方針を向くこと

### 3. `P-012 Phase 4` の着手条件を整理する
- テーマ:
  - Customers cutover
- 先に必要なもの:
  - `Customers` の ownership matrix
  - `Customer_Edit_History` の設計
- 現状:
  - 実装着手前の前提整理フェーズ

---

## 次にやる候補（急ぎではない）

### P-007. 例外 / データ品質の運用ループ改善
- 例外シートの見方や unresolved count の運用ガイドをさらに分かりやすくする
- コードよりも runbook / operator guide 側の改善が中心

### P-008. cadence 再評価
- いまの trigger cadence は安定している
- 承認キューの実運用件数がもう少し溜まってから再評価する

### P-013. 営業自動化 + `Staging_Payments` cutover
- 優先度はまだ低め
- 営業運用フローの自動化設計が固まってから着手する

### ERP 方向の整理
- 現在の構造は proto-ERP に近い
- すぐ実装する項目ではないが、今後は
  - domain 境界
  - API 化候補
  - spreadsheet から web / DB 中心運用へ移る単位
  を別紙で整理すると良い

---

## 今回までに完了したもの

### Executive workbook の trust / freshness 強化（完了）
- 追加済み:
  - `経営_会議前チェック`
  - `経営_更新状況`
- `経営_データ状況` に freshness / stale-domain / human-update-omission 指標を追加
- stale / omission の見え方を改善し、live workbook で `GO` 状態を確認済み
- build / deploy / live verify / GitHub 反映まで完了

### 2次 UX polish / 残留英語の整理（主要部分は完了）
- operator-facing header の日本語化
- README / guide の日本語トーン調整
- display-safe な英語残り値の整理
- workbook の live spot-check 実施済み

### GitHub 一次基準化 + repo 復旧導線整備（完了）
- GitHub `main` を一次基準として明文化
- ローカル bare mirror / bundle backup を整備
- 復旧手順を `docs/repo-resilience.md` に記録

---

## Blocked / 要入力

### 人の入力待ち
- `P-012 Phase 4` は ownership matrix が必要
- 運用承認キューは operator 実行待ち

### 今は blocked ではないが、急いでいないもの
- `P-013` 営業自動化
- ERP 本格移行設計

---

## 次のセッションで最初に見る文書
1. `agents/session.md`
2. `docs/backlog.md`
3. `OPERATIONS_MANUAL.md`
4. 必要なら関連 plan 文書
