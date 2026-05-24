# Phase 1 受け入れチェックリスト

## 目的
Phase 1 cutover が「deploy 済み」だけでなく、非技術者の Potex 運用担当にとって実際に使える状態かを確認します。

## 現在 deploy 済みの assets
- Apps Script project: `Potex Automation Hub`
- DB workbook: `POTEX DB`
  - https://docs.google.com/spreadsheets/d/1sJuEM1RXn5zVeBj6dVTujnf0P2m-CweLPbt_gpcxFFs/edit?usp=drivesdk
- CS workbook: `Potex CS`
  - https://docs.google.com/spreadsheets/d/1KFRLdsT2-LlhSA0YLkXuV3Oh76yxnhL_6tvmOdvv4yg/edit?usp=drivesdk
- Executive workbook: `Potex Executive`
  - https://docs.google.com/spreadsheets/d/1pnEWHFdGHY6Er3aAXuvAz-H1MwgQcvrEZq_Z5oqdwuY/edit?usp=drivesdk

## すでに確認済みの deploy 状態
- `bootstrapProject()` 成功
- `installTriggers()` 成功
- `runCanonicalRefresh()` 成功
- `runPublishAll()` 成功

---

## 1. DB workbook の受け入れ
`POTEX DB` を開いて、次を確認します。
- `Staging_Customers` が存在し、空ではない
- `Staging_Feedback` が存在し、空ではない
- `Feedback` が存在し、行数が不自然ではない
- `Exceptions_FeedbackMatch` が存在する
- `Ops_Followup_Queue` が存在する
- `Ops_Continuation_Targets` が存在する
- `Ops_Feedback_Review` が存在する
- `Sync_Log` に、直近の GAS 成功実行に対応する新しい行がある

### 解釈メモ
- `SOURCE_CUSTOMERS_WORKBOOK_ID` は workbook `受講者管理` に設定されている想定です。
- 現在の staging 検証では、`Staging_Customers` は `顧客管理` の名前付き source row と整合しています。
- source 側の総行数が staging より多いことがあります。これは staging refresh 時に blank-name row を skip するためです。
- 最終 handoff 前には、最後にもう一度 full refresh を実行してください。

---

## 2. CS workbook の受け入れ
`Potex CS` を開いて、次を確認します。
- `CS_要フォロー一覧` があり、header + publish rows がある、または意図どおり空 queue になっている
- `CS_継続対象一覧` があり、header + publish rows がある、または意図どおり空 queue になっている
- `CS_例外確認` がある
- `CS_別名解決入力` がある
- `CS_別名解決入力` に、手入力用の operator 専用列が残っている
  - `operator_decision_status`
  - `operator_selected_customer_id`
  - `operator_selected_customer_name`
  - `operator_note`

### unmatched feedback row がある場合
低リスクの 1 行だけを使って writeback loop を確認します。
1. `CS_別名解決入力` に正しい alias 判断を入力
2. Apps Script で `runWritebackCollection()` を実行
3. もう一度 `runPublishAll()` を実行
4. 次を確認
   - alias が `Customer_Alias_Map` に追加または更新される
   - 対応する行が `Exceptions_FeedbackMatch` から消える、または減る
   - CS 側の alias-input 行が消える、または処理済み状態になる

---

## 3. Executive workbook の受け入れ
`Potex Executive` を開いて、次を確認します。
- `経営_コーチ負荷` があり、coach 単位の件数が不自然ではない
- `経営_顧客リスク` があり、件数が不自然ではない
- `経営_データ状況` があり、少なくとも次の指標を含む
  - `customers_count`
  - `coaches_count`
  - `sessions_count`
  - `feedback_count`
  - `followup_queue_count`
  - `continuation_targets_count`
  - `feedback_match_exception_count`

### 解釈ルール
初回 cutover で数値が 100% 完璧である必要はありません。
ここで見るのは、数値が **方向として妥当** で、operator の sanity check に使えるかどうかです。

---

## 4. Trigger の受け入れ
Apps Script で、次の trigger が存在することを確認します。
- publish refresh cadence
- writeback collection cadence
- daily full refresh cadence

必要なら Apps Script の `Triggers` UI で、次の handler 名が存在することを確認します。
- `handlePublishTrigger`
- `handleWritebackTrigger`
- `handleDailyRefreshTrigger`

---

## 5. 受け入れ後も残る既知の gap
この deploy は、**最終 cutover 時点で最新の customer source row が必ず取り込まれている** ことまでは保証しません。

最終 handoff 前にまだ必要なこと:
- 最後に 1 回 full refresh を実行する
- `顧客管理` / `フォームの回答` が `Staging_Customers` に引き続き正しく写っていることを確認する

現在の状態:
- source customer workbook は特定・設定済み
- staging alignment は名前付き source row と突き合わせて確認済み

---

## 6. 「Phase 1 operationally ready」の定義
次がすべて成り立ったら、Phase 1 を operationally ready とみなします。
- GAS deploy が live
- DB / CS / Executive の publish surface が正常に埋まる
- trigger が install 済み
- `経営_データ状況` が使える sanity-check surface になっている
- alias/writeback loop が少なくとも 1 件 end-to-end で確認済み
- operator が canonical DB sheet を直接編集せず、role-based workbook で業務できる
