# Potex Phase 1 Cutover Runbook

> **Status (2026-05-19):** Cutover は完了済み。全 8 workbook (`POTEX DB` / `Potex CS` / `Potex Executive` / `Potex Concierge` / `Potex Sales` / `Potex Coaches` / `Potex Sato` / `Potex Inai`) は live で、Apps Script trigger automation も稼働中。この文書は、今後の workbook 追加や再provision向けの setup / cutover 参考資料として残す。

## 1. Architecture
- `POTEX DB` が canonical data hub。source workbooks は read-only のまま使う。
- role workbooks (`Potex CS` / `Potex Executive` / `Potex Concierge` / `Potex Sales` / `Potex Coaches` / `Potex Sato` / `Potex Inai`) は publish target 専用。
- Apps Script project `Potex Automation Hub`（`y.kang@potex.jp` 配下）が canonical refresh → publish → writeback を動かす。

## 2. 新しい workbook を追加する手順
1. `workbook_manifest.json` に新しい workbook section を追加する。
2. `provision_phase1_workbooks.py` を実行する（idempotent。足りない tabs だけ作成）。
3. `potex-gas/src/config.ts` に新しい spreadsheet id を追加する（default 用）。override が必要なら script properties にも入れる。
4. GAS を rebuild + push する:
   ```bash
   cd potex-gas && npm install && npm run deploy
   ```
5. Apps Script UI で `bootstrapProject()`（初回のみ）と `installTriggers()` を実行する。

## 3. Trigger cadence（`installTriggers()` の既定値）
- `runPublishAll()` — 1時間ごと
- `runWritebackCollection()` — 30分ごと
- `runFullRefresh()` — 毎日 07:00 JST

## 4. Operator rules
- DB workbook を直接編集しない。
- publish surfaces を手で編集しない。
- 人の入力は writeback input tabs のみを通す:
  - `CS_別名解決入力` (alias decisions)
  - `CS_更新アクション` (other operator actions)
  - `CS_担当割当入力` (assignment decisions)
  - `パートナー_状況入力` (partner status updates in `Potex Sato` / `Potex Inai`)

## 5. Alias resolution loop
1. `runPublishAll()` が未解決 alias を `CS_別名解決入力` に publish する。
2. CS operator が `operator_decision_status` / `operator_selected_customer_id` / `operator_selected_customer_name` / `operator_note` を入力する。
3. `runWritebackCollection()` が内容を検証し、`Customer_Alias_Map` に merge する。無効な行は `sync_status=error_*` で戻る。
4. 次の `runPublishAll()` で解決済み行が review queue から消える。

## 6. Verification（read-only）
- `generated/inspect_sales_coach_provisioning.py` — Sales / Coaches publish surfaces の行数確認
- Apps Script UI execution log — trigger 実行状況の直接確認
- DB workbook health: `Staging_Customers` の行数と source named rows の比較
- Publish surface health: 各 `*_Data_Health` タブが急に 0 になっていないか確認

## 7. Known fragilities
- review tabs でセルを手動再結合すると `setValues` が効かなくなる。publisher (`potex-gas/src/sheets.ts > clearAndRewrite`) は書き込み前に `breakApart()` を呼んで防御している。review tab の header が空白なら、再結合を疑う。
- Sheets は文字列 `'TRUE'` / `'FALSE'` を往復時に boolean へ自動変換する。Sales views では case-insensitive 比較 (`String(v).toUpperCase() === 'TRUE'`) で対処している。新しい boolean 列でも同じ方式を使う。
- `PropertiesService` の値が残っていると default を上書きしてしまう。新しい `ENABLE_*` flag は Concierge pattern を使う: `asBool(getProp(...)) || Boolean(spreadsheetId)`。
