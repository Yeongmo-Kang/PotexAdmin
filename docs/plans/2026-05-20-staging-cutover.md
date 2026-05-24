# Staging Cutover 計画（P-012）

> **状態:** 2026-05-20 に運用側回答を反映済み。Phase 1・2 は完了、Phase 3 は保留、Phase 4 は前提条件待ち。

## この計画の目的
`POTEX DB` を唯一の正本とする方針を staging layer まで徹底し、外部 workbook は input 通路としてのみ残す。

対象の staging:
- `Staging_Customers`
- `Staging_Feedback`
- `Staging_Payments`
- `Staging_LineRegistration`

## 目的（Goal）
- canonical データを `POTEX DB` に直接保持する
- source workbook の行位置や手作業レイアウトに依存する設計を減らす
- `clearAndRewrite` の負荷と staging 重複管理を減らす

## 対象外（Non-goal）
- LStep / TimeRex API 直接連携
- partner pipeline cutover（別途 P-010）
- source workbook の manual input フローそのものの再設計

---

## 背景
現行 staging は、外部 workbook の raw mirror として機能していたが、次の問題があった。

- canonical と staging の二重保持で「どこが原本か」が分かりにくい
- `source_sheet` / `source_row` のような位置依存情報が dedupe や evidence に混じる
- 大きい staging が refresh 負荷を増やす
- 運用側が「元シートを直せば正本が変わる」と誤認しやすい

---

## Phase 別の整理

### Phase 1. `Staging_LineRegistration` → `Line_Registrations`
**状態:** 完了

実施済み:
- canonical 表 `Line_Registrations` を新設
- reader 4 系統を `Line_Registrations` 参照へ切替
- `Staging_LineRegistration` への write を停止
- `line_registration_id = line_{segment}_{line_user_id}` を PK として安定化

判断メモ:
- `line_user_id` が空の行は 0 件だったため、追加の unstable 退避は不要
- LStep API 直接連携は保留のため、CSV paste → ingest の流れは当面維持

### Phase 2. `Staging_Feedback` → `Feedback` / `Exceptions_FeedbackMatch` 直行
**状態:** 完了

実施済み:
- `response_id = resp_{12hex}` を導入し、dedupe を source 座標依存から脱却
- `feedbackKey()` を `response_id` ベースへ移行
- `Customer_Alias_Map.evidence` を `response:{response_id}` 形式へ整理
- ingest が `Staging_Feedback` を経由せず、`Feedback` / `Exceptions_FeedbackMatch` へ直接書き込む形へ変更
- `Staging_Feedback` シートを廃止

判断メモ:
- 運用側は行番号よりも回答内容で判断するため、source 座標維持の優先度は低い
- 応答シートは archive しない方針のため、hash ベースで十分

### Phase 3. `Staging_Payments` → `Payments` 直行
**状態:** 保留

保留理由:
- `着金管理マスター` は営業側の手修正が多い
- hash 型 stable ID を導入しても、元行編集で別 ID とみなされやすい
- 今後、営業入力を自動化へ寄せる予定があるため、その設計と一緒に cutover した方が安全

現時点の方針:
- `Staging_Payments` は当面維持
- Payment cutover は営業自動化（P-013）とセットで再設計する

### Phase 4. `Staging_Customers` → `Customers` 直行
**状態:** 前提条件待ち

着手前に必要なもの:
- `Customers` の ownership matrix
  - pipeline overwrite
  - operator only
  - seed then operator override
- `Customer_Edit_History` 設計

理由:
- `Customers` は現在も運用側が直接扱う項目を含む
- どの列を pipeline が更新し、どの列を人が保持するかを先に決めないと事故が起きやすい

---

## 現在の結論
- `Staging_LineRegistration` と `Staging_Feedback` は cutover 完了
- `Staging_Payments` は営業自動化設計まで保留
- `Staging_Customers` は ownership matrix 待ち

## 次に見るべき文書
- `docs/backlog.md`
- `docs/db-schema.md`
- `docs/plans/2026-05-17-p006-commercial-model-ingest-slice.md`
- `CLAUDE.md`
- `agents/session.md`
