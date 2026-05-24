# P-003 Alias / Writeback 受け入れ runbook

## 目的
本 runbook の目的は、live の `Potex CS` workbook だけで、未一致の顧客 1 件を **canonical DB workbook を直接編集せずに** 最後まで解消できることを確認することです。

これは次の間にある受け入れゲートです。
- **Phase 1 deployed**
- **Phase 1 operationally ready**

---

## 重要な理由
非技術者の運用担当が日常的に使えると言うためには、次の流れが確実に動く必要があります。

1. GAS が未解決行を `CS_別名解決入力` に publish する
2. CS 担当者がその場で alias を解決する
3. GAS が判断結果を `Customer_Alias_Map` に writeback する
4. GAS が派生ビューを再 publish する
5. 未解決 exception が減る、または消える

この流れが壊れている場合、workbook 分割はまだ一部しか運用化できていません。

---

## 前提条件
以下がすでに成立していること。
- Apps Script project が deploy 済み
- `bootstrapProject()` が成功済み
- `installTriggers()` が成功済み
- `runCanonicalRefresh()` が成功済み
- `runPublishAll()` が成功済み
- `Potex CS` workbook に `CS_別名解決入力` がある
- `POTEX DB` workbook に `Customer_Alias_Map` と `Exceptions_FeedbackMatch` がある

---

## 対象 workbook
- `POTEX DB`
  - https://docs.google.com/spreadsheets/d/1sJuEM1RXn5zVeBj6dVTujnf0P2m-CweLPbt_gpcxFFs/edit?usp=drivesdk
- `Potex CS`
  - https://docs.google.com/spreadsheets/d/1KFRLdsT2-LlhSA0YLkXuV3Oh76yxnhL_6tvmOdvv4yg/edit?usp=drivesdk

---

## 推奨テスト範囲
最初の受け入れテストでは、**必ず 1 行だけ**、かつ低リスクのケースを使います。

ローカル workspace で現在の未解決候補を確認する方法:
```bash
cd /mnt/c/Users/zerom/Desktop/DevZero/projects/potex
python inspect_phase1_alias_candidates.py
```

この runbook 作成時点の live snapshot:
- `Potex CS` の unresolved alias count: `1`
- `POTEX DB` の unresolved exception count: `1`
- 現在の低リスク候補:
  - `alias_name`: `知子佐藤`
  - `respondent_email`: `cerena999@yahoo.co.jp`
  - `source_sheet`: `通常月用`
  - `source_row`: `35`
  - 候補 canonical customer: `CUST-0065 / 佐藤知子`
  - 推定理由: 同じ coach で、姓と名の入れ替わりの可能性が高い

`CS_別名解決入力` で選ぶ行の条件:
- 人が見て顧客がほぼ確実に分かる
- あいまいさが小さい
- 既存 canonical customer 1 件に自信を持って紐付けできる

最初の受け入れでは、判断が割れるケースや微妙なケースは使わないでください。

---

## 編集してよい列
`CS_別名解決入力` では、次の列だけ編集します。
- `operator_decision_status`
- `operator_selected_customer_id`
- `operator_selected_customer_name`
- `operator_note`

publish された元データ列や current-state 列は編集しません。

---

## 受け入れテスト手順

### Step 1. baseline を記録
編集前に、対象行について次を控えます。
- `alias_name`
- `respondent_email`
- `source_sheet`
- `source_row`
- 現在の `sync_status`
- `Exceptions_FeedbackMatch` に対応行があるか

見える場合は次も記録します。
- `Exceptions_FeedbackMatch` の行数
- この alias がすでに `Customer_Alias_Map` に存在するか

### Step 2. operator の判断を入力
`Potex CS` → `CS_別名解決入力` で次を入力します。
- `operator_decision_status` = `approved`
- `operator_selected_customer_id` = 正しい canonical customer ID
- `operator_selected_customer_name` = 正しい canonical customer 名
- `operator_note` = 短い理由。例: `phase1 acceptance test`

### Step 3. writeback を実行
Apps Script で次を実行します。
- `runWritebackCollection()`

期待結果:
- script が正常終了する
- customer ID / customer name 不足の validation error が出ない

### Step 4. 再 publish を実行
Apps Script で次を実行します。
- `runPublishAll()`

期待結果:
- script が正常終了する
- CS 側 publish view が DB の最新状態で更新される

### Step 5. DB 側 writeback を確認
`POTEX DB` を開き、次を確認します。
- `Customer_Alias_Map` に対象 alias の行がある
- その行に選択した canonical customer ID が入っている
- その行に選択した canonical customer 名が入っている
- 行の status が承認済み相当である（`approved` / `active` / `resolved` など flow に応じた値）

### Step 6. exception 解消を確認
`Exceptions_FeedbackMatch` を開き、次のどちらかを確認します。
- 対象の未解決行が消えた
- もしくは unresolved count が想定どおり減った

### Step 7. downstream への反映を確認
以前は止まっていたケースが、次に正しく現れるか確認します。
- `Feedback`
- `Ops_Feedback_Review`

期待結果:
- 対象ケースが canonical customer に紐付いた状態で反映される

### Step 8. CS 側の状態を確認
`Potex CS` → `CS_別名解決入力` に戻り、対象行が次のどちらかになっていることを確認します。
- 未解決 publish set から消えている
- もしくは flow の想定どおり処理済み状態になっている

---

## Pass / fail 基準

### PASS
次がすべて成立したら PASS とします。
- `runWritebackCollection()` が成功
- `runPublishAll()` が成功
- `Customer_Alias_Map` が正しく更新された
- 対象の unresolved exception が削除または減少した
- 関連する feedback / op-review が解決済み顧客に紐付いた
- operator が canonical DB workbook を手で直す必要がなかった

### FAIL
次のどれかが起きたら FAIL とします。
- writeback function が error になる
- alias 行が未解決のままで DB 更新もない
- 間違った customer に書き込まれる
- 再 publish 後も DB 変更が publish view に反映されない
- operator が canonical data を手修正しないと直らない

---

## 失敗したときに残す情報
次を記録して報告します。
- どの step で失敗したか
- Apps Script の正確な error text
- 対象行の `alias_name`
- 対象行の `source_sheet` と `source_row`
- `Customer_Alias_Map` が少しでも変わったか
- `Exceptions_FeedbackMatch` が少しでも変わったか

この情報があれば、広く推測せずに切り分けできます。

---

## これが通ると何が進められるか
この受け入れテストが通ったら、次に安全なのは次の順です。
1. Phase 1 を operationally ready と判断する
2. refresh 駆動の ops surface 拡張（P-005）を進める
3. その後で `Potex Concierge` を計画する
4. `Potex Sales` は commercial model 完成（`Plans`, `Payments`, `ConversionHistory`）の後に進める
