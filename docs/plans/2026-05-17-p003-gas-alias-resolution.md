# P-003 GAS 顧客別名解決 実装計画

> **Hermes 向け:** 実行が委譲された場合は、この計画を subagent-driven-development スキルでタスクごとに実装すること。

**Goal:** 顧客 alias resolution が、CS workbook + GAS writeback flow を通じた日常運用の標準プロセスとして機能する状態にする。

**Architecture:** DB workbook は canonical のまま維持する。未一致の feedback row を `CS_別名解決入力` に publish し、CS operator がそこで判断を入力し、`runWritebackCollection()` が承認済み結果を `Customer_Alias_Map` に書き戻す。その writeback flow により `Feedback`、`Ops_Feedback_Review`、`Exceptions_FeedbackMatch` も更新される。Python bridge は fallback としてのみ残す。

**Tech Stack:** Google Apps Script TypeScript, Google Sheets, clasp, 既存の `potex-gas/` build flow.

---

## Scope summary

### すでに存在しているもの
- CS workbook の publish path はすでに `CS_別名解決入力` を生成する
- GAS はすでに `runWritebackCollection()` を公開している
- `collectCsWritebackRows()` はすでに alias decision を DB 側 sheet に書き戻す
- 現在文書化されている unresolved case: `知子佐藤`

### まだ不足しているもの
- operator workflow が、日常利用にはまだ十分 harden / documented されていない
- idempotency と overwrite behavior を慎重に検証する必要がある
- writeback 後の publish-after-writeback loop を明示し、検証すべき
- operator 向けの manual QA checklist が、具体的な execution plan としてまだ記録されていない

---

## Task 1: 現在の interface contract を固定する

**Objective:** alias-resolution workflow を定義する正確な column と sheet を確認し、後続変更で operator 利用が壊れないようにする。

**Files:**
- Inspect: `potex-gas/src/publish/views.ts`
- Inspect: `potex-gas/src/publish/csWorkbook.ts`
- Inspect: `potex-gas/src/writeback/csWriteback.ts`
- Update: `docs/plans/2026-05-17-p003-gas-alias-resolution.md`
- Optional update: `OPERATIONS_MANUAL.md`

**Step 1: CS input sheet contract を確認する**

`CS_別名解決入力` の contract が次の column であることを確認する:
- `alias_name`
- `respondent_email`
- `related_coach_name`
- `source_sheet`
- `source_row`
- `current_status`
- `current_canonical_customer_id`
- `current_canonical_customer_name`
- `operator_decision_status`
- `operator_selected_customer_id`
- `operator_selected_customer_name`
- `operator_note`
- `sync_status`
- `last_collected_at`

**Step 2: DB 側 writeback target を確認する**

writeback path が次を更新することを確認する:
- `Customer_Alias_Map`
- `Feedback`
- `Ops_Feedback_Review`
- `Exceptions_FeedbackMatch`

**Step 3: 自明でない behavior を記録する**

次の実装上の事実を文書化する:
- `operator_decision_status` があり、かつ `processed` ではない sync state の row だけが actionable
- approval 系 status は `approved`, `active`, `resolved`
- feedback row の uniqueness は `source_sheet + source_row + respondent_email` を使う
- ops row の uniqueness は `source_sheet + source_row` を使う

**Step 4: Verification**

Run:
```bash
cd /mnt/c/Users/zerom/Desktop/DevZero/projects/potex/potex-gas && npm run build
```

Expected: TypeScript build が成功する。

---

## Task 2: publish → operator input → writeback → republish を明示化する

**Objective:** 実行順序を運用上わかりやすくし、次にどの function を実行すべきかを人が推測しなくてよい状態にする。

**Files:**
- Modify: `OPERATIONS_MANUAL.md`
- Modify: `PHASE1_CUTOVER_RUNBOOK.md`
- Optional modify: `README.md`

**Step 1: operator loop を追加する**

正確な sequence を文書化する:
1. `runPublishAll()` が unresolved alias row を CS workbook に publish する
2. CS operator が `CS_別名解決入力` の decision column を入力する
3. `runWritebackCollection()` が decision を DB workbook に書き戻す
4. `runPublishAll()` を再実行し、CS workbook に resolved state を反映させる

**Step 2: operator が編集してよい項目を追加する**

日常運用の operator は次だけを編集すべきことを明示する:
- `operator_decision_status`
- `operator_selected_customer_id`
- `operator_selected_customer_name`
- `operator_note`

**Step 3: status semantics を追加する**

推奨値を文書化する:
- `review`
- `approved`
- `resolved`
- それぞれを使うタイミング

**Step 4: Verification**

更新後の docs を見直し、実際の GAS code path と一致していることを確認する:
- `publishCsWorkbook()`
- `runWritebackCollection()`

---

## Task 3: writeback behavior を operator の誤操作に対して harden する

**Objective:** 不完全または不正な operator input が、誤った canonical data を書き込む可能性を減らす。

**Files:**
- Modify: `potex-gas/src/writeback/csWriteback.ts`
- Optional modify: `potex-gas/src/guards.ts`
- Optional modify: `potex-gas/src/logging.ts`

**Step 1: 明示的な validation rule を追加する**

alias row を書き込む前に、次を要求する:
- `operator_decision_status` が存在する
- status が approval 系なら `operator_selected_customer_id` が必須
- status が approval 系なら `operator_selected_customer_name` が存在するか、`Customers` から復元可能であること

**Step 2: 黙って失敗させず、安全側に倒す**

無効 row に対しては:
- `sync_status=processed` にしない
- row は CS workbook に残す
- row を debug するのに十分な log detail を追記する

**Step 3: 既存の良い alias row を保護する**

workflow が明示的に reset を意図していない限り、空の operator field によって既存の承認済み canonical mapping が消えないようにする。

**Step 4: Verification**

Run:
```bash
cd /mnt/c/Users/zerom/Desktop/DevZero/projects/potex/potex-gas && npm run build
```

Expected: validation logic 変更後も build が成功する。

---

## Task 4: alias writeback 後の republish behavior を deterministic にする

**Objective:** writeback と republish の後、resolved alias が exception-driven operator queue から視覚的に消えることを保証する。

**Files:**
- Inspect/modify: `potex-gas/src/publish/csWorkbook.ts`
- Inspect/modify: `potex-gas/src/publish/views.ts`
- Inspect/modify: `potex-gas/src/writeback/csWriteback.ts`

**Step 1: exception removal path を確認する**

`collectCsWritebackRows()` が、resolved した `customer_unmatched` row を `Exceptions_FeedbackMatch` から除去することを確認する。

**Step 2: republish effect を確認する**

`publishCsWorkbook()` が次を rebuild していることを確認する:
- `CS_例外確認`
- `CS_別名解決入力`

そして、その rebuild が exception 除去後の DB state に基づいていることを確認する。

**Step 3: processed row を表示し続けるかどうか決める**

次のどちらか 1 つを明示的な behavior として選び、文書化する:
- resolved row は `CS_別名解決入力` から消える
- resolved row は `sync_status=processed` の audit 用として残る

現在の実装に基づく既定の期待値は、次のとおり: unresolved exception から input sheet を再生成するため、resolved exception row は republish 時に消える。

**Step 4: Verification**

1 件の alias resolution が成功した後の期待結果:
- `Customer_Alias_Map` に alias が含まれる
- `Feedback` に resolved 済み feedback row が含まれる
- `Ops_Feedback_Review` に resolved 済み operational row が含まれる
- `Exceptions_FeedbackMatch` から当該 unresolved case が消える
- republish 後の `CS_別名解決入力` に当該 row が表示されない

---

## Task 5: 既知の unresolved customer で単一ケース受け入れ試験を行う

**Objective:** このプロセスを production-ready とみなす前に、既知の未一致 row を使って full workflow を実証する。

**Files:**
- Use existing sheets/workbooks
- Update: `FEEDBACK_PIPELINE_STATUS.md`
- Update: `agents/session.md`
- Update: `docs/backlog.md`

**Step 1: test case を準備する**

文書化済みの unresolved row を使う:
- alias: `知子佐藤`
- email: `cerena999@yahoo.co.jp`
- coach: `稲川コーチ`

**Step 2: workflow を実行する**

運用 sequence:
1. publish flow を実行
2. CS workbook で operator decision を入力
3. writeback flow を実行
4. publish flow を再実行

**Step 3: evidence を記録する**

次を記録する:
- 選択した canonical customer ID/name
- `Customer_Alias_Map` が更新されたか
- `Feedback` に row が追加 / 解決されたか
- `Exceptions_FeedbackMatch` が 1 件減ったか

**Step 4: status docs を更新する**

成功後、次を更新する:
- `FEEDBACK_PIPELINE_STATUS.md`
- `docs/backlog.md`
- `agents/session.md`

Expected status change:
- P-003 は Next Up から completed または near-complete に移動する
- mapping が妥当なら unmatched feedback count が減少する

---

## Task 6: fallback policy を明確に定義する

**Objective:** Python bridge を利用可能なまま残しつつ、それが標準運用経路にならないようにする。

**Files:**
- Modify: `FEEDBACK_PIPELINE_STATUS.md`
- Modify: `OPERATIONS_MANUAL.md`
- Optional modify: `README.md`

**Step 1: primary path を明示する**

Primary path:
- CS workbook input
- GAS writeback
- GAS republish

**Step 2: fallback path を明示する**

Fallback only:
```bash
python /mnt/c/Users/zerom/Desktop/DevZero/projects/potex/reconcile_feedback_aliases.py --apply
```

Fallback を使うのは次の場合のみ:
- GAS が利用不能
- 緊急リカバリが必要
- Apps Script 外で manual reconciliation を再適用しなければならない

**Step 3: Verification**

すべての docs が同じ hierarchy を説明していることを確認する:
- GAS-first
- Python bridge second

---

## Final verification checklist

Run:
```bash
cd /mnt/c/Users/zerom/Desktop/DevZero/projects/potex/potex-gas && npm run build
```

Manual acceptance checklist:
- `CS_別名解決入力` には unresolved customer row のみが表示される
- operator-editable column が明確に文書化されている
- `runWritebackCollection()` は妥当な decision だけを処理する
- resolved 済み alias decision が DB 側 sheet を正しく更新する
- republish により resolved queue row が一貫して除去またはクリアされる
- docs が正確な operator loop を説明している

---

## Suggested execution order
1. Task 1 — interface contract を固定する
2. Task 2 — operator loop を文書化する
3. Task 3 — validation を harden する
4. Task 4 — republish behavior を検証する
5. Task 5 — 実データで 1 件の acceptance test を行う
6. Task 6 — fallback policy を固定する

## Definition of done
P-003 が done になる条件:
- CS operator が spreadsheet input だけで unmatched customer を解決できる
- GAS がその結果を安全に書き戻す
- republish 後に DB と CS sheet の状態が収束する
- 属人的な知識なしで再実行できる程度に十分文書化されている
