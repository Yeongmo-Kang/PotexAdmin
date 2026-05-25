# Potex GAS スキャフォールド

このディレクトリは、`POTEX DB` を中心に role workbook へ publish / writeback するための Google Apps Script 一式を置く場所です。

## 目的
- canonical DB workbook を 1 つの hub として使う
- `Potex CS` / `Potex Concierge` / `Potex Sales` / `Potex Coaches` / `Potex Executive` / `Potex Sato` / `Potex Inai` に publish する
- operator が入力した writeback 内容を再び DB に戻す

## 推奨実行アカウント
trigger、publish、writeback collection は **共用 Workspace 実行アカウント 1 つ**に統一するのが安全です。

## ローカル準備
```bash
cd /mnt/c/Users/zerom/Desktop/DevZero/projects/potex/potex-gas
npm install
npm run build
clasp login
clasp create --type sheets --title "Potex Automation Hub" --rootDir ./dist
```

`.clasp.json` ができたら次を実行します。

```bash
npm run deploy
```

## Apps Script 側の初回実行順
1. `onOpen` または `bootstrapProject`
2. `setInitialScriptProperties`
3. `installTriggers`
4. `runPublishAll` を実行して確認

## Script Properties に入れるキー
- `DB_SPREADSHEET_ID`
- `CS_SPREADSHEET_ID`
- `CONCIERGE_SPREADSHEET_ID`
- `SALES_SPREADSHEET_ID`
- `COACHES_SPREADSHEET_ID`
- `EXEC_SPREADSHEET_ID`
- `INAI_SPREADSHEET_ID`
- `SATO_SPREADSHEET_ID`
- `ENABLE_CONCIERGE`
- `ENABLE_SALES`
- `ENABLE_COACHES`
- `ENABLE_EXEC`
- `SOURCE_FEEDBACK_WORKBOOK_ID`
- `SOURCE_FEEDBACK_SHEETS`
- `SOURCE_CUSTOMERS_WORKBOOK_ID`
- `SOURCE_CUSTOMERS_SHEET_NAME`
- `SOURCE_APPLICATIONS_SHEET_NAME`
- `SOURCE_CUSTOMERS_FALLBACK_TO_CANONICAL`

## 公開関数
- `bootstrapProject()`
- `validateEnvironment()`
- `runCanonicalRefresh()`
- `runPublishAll()`
- `runWritebackCollection()`
- `runFullRefresh()`
- `installTriggers()`
- `reinstallTriggers()`

## 現在含まれる Sales publish フロー
- `runPublishAll()` / `runFullRefresh()` / `runWritebackCollection()` は、`ENABLE_SALES=true` かつ `SALES_SPREADSHEET_ID` があると Sales workbook も publish する
- `営業_契約一覧`：契約 / 着金の全体行を新しい順に表示
- `営業_未入金一覧`：未入金キューを表示
- `営業_ファネル推移`：`ConversionHistory` を元に funnel event を表示
- `営業_データ状況`：payments / plans / conversion / unmatched count を要約


## 現在含まれる partner publish / writeback フロー
- `runPublishAll()` / `runFullRefresh()` / `runWritebackCollection()` は `Potex Sato` / `Potex Inai` の partner workbook も更新する
- `パートナー_担当リード`：partner ごとの active assignment 一覧
- `パートナー_状況入力`：meeting / sale / recruitment status を partner が入力する writeback タブ
- `パートナー_データ状況`：assignment count / freshness / stale status の要約

## 現在含まれる source → canonical feedback フロー
- `runCanonicalRefresh()` が `Feedback`、`Exceptions_FeedbackMatch`、`Line_Registrations` を再構成する
- feedback source は基本的に `月次振り返りアンケート （回答）` workbook の `通常月用`、`（最終月用）`
- dedupe key は `response_id = resp_{12hex}` SHA-256 hash
- `SOURCE_CUSTOMERS_WORKBOOK_ID` が未設定の間、`Staging_Customers` は一時的に canonical `Customers` を fallback source として使う
- `Line_Registrations` の PK は `line_registration_id = line_{segment}_{line_user_id}`
- `Staging_Payments` は raw の `customer_name` を保持し、canonical 側では `customer_id` を持つ
- DB の全表は基本的に `created_at` / `updated_at` を末尾に持つ（`Sync_Log` を除く）

## 現在含まれる CS alias 運用フロー
- `Exceptions_FeedbackMatch` と `Customer_Alias_Map` を読んで `CS_別名解決入力` を publish する
- CS operator は `operator_decision_status`、`operator_selected_customer_id`、`operator_selected_customer_name`、`operator_note` を入力する
- `runWritebackCollection()` がその内容を `Customer_Alias_Map` に反映する
- 承認済み alias は同じ実行で `Feedback`、`Ops_Feedback_Review`、`Exceptions_FeedbackMatch` にも反映される

## 現状の注意点
- 現在のコードは **scaffold + 実運用可能な feedback ingest / writeback フレーム** に相当する
- feedback ingest は GAS 側で運用可能だが、customer raw ingest は source workbook ID 設定など追加前提が残る
- そのため現段階では、feedback 系の自動運用を先に安定させ、customer source は段階的に移行する方針が適切

## ローカライゼーション方針
- DB / canonical シートの column 名は **英語 snake_case のまま維持**する
- operator-facing workbook の visible header、README/help、summary label、visible enum 値は日本語化する
- dual-header publish シートでは **1 行目 = 表示用日本語、2 行目 = machine header（英語）** を維持する
- hidden machine row の英語キーはそのままでよいが、operator に見えるセルには不要な英語を残さない
