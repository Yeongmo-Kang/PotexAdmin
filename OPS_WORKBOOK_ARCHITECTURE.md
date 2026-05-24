# Potex 運用 workbook 分離アーキテクチャ

## 1. 目的
Potex は **DB workbook 1 つ + 役割別の運用 workbook 複数** という構成で運用します。

中核原則:
- `POTEX DB` のみが canonical ownership を持つ
- 運用 workbook は read-model と input / writeback inbox の役割だけを持つ
- 運用 workbook 同士は直接同期しない
- すべての同期は DB ハブを経由する

---

## 2. 現在の Phase 1 構成

### 2.1 `POTEX DB`
役割:
- source / staging / canonical / mapping / exception / system シートを保持する
- 唯一の ID 発行地点
- 唯一の canonical 確定地点
- CS / Executive / Concierge / Sales / Coaches 向け publish source を提供する

現在維持するタブ:
- `Staging_Customers`
- `Staging_Payments`
- `Line_Registrations` （P-012 Phase 1 で `Staging_LineRegistration` を吸収）
- `Customers`
- `Coaches`
- `Sessions`
- `Feedback`
- `Plans`
- `Payments`
- `ConversionHistory`
- `Coach_Name_Map`
- `Coach_Alias_Map`
- `Customer_Alias_Map`
- `Exceptions_FeedbackMatch`
- `Ops_Feedback_Review`
- `Ops_Followup_Queue`
- `Ops_コーチ_担当負荷`
- `Ops_ZeroSession_Review`
- `Ops_Continuation_Targets`
- `Sync_Log`
- `Sync_Control`
- `Publish_Manifest`

整理完了:
- legacy `MasterData` を削除
- stale `Dashboard` を削除

削除理由:
- 現在の GAS / manifest ベース構成では使われていない
- 役割別 workbook 分離構造と整合しない
- 運用担当者にとってシート数が少ないほうが分かりやすい

### 2.2 `Potex CS`
役割:
- follow-up、continuation、exception review、alias resolution、assignment input を扱う

現在のタブ:
- `CS_使い方`
- `CS_承認進捗`
- `CS_入金名寄せ確認`
- `CS_継続名寄せ確認`
- `CS_担当割当入力`
- `CS_要フォロー一覧`
- `CS_継続対象一覧`
- `CS_別名解決入力`
- `CS_例外確認`
- `CS_更新アクション`

運用ルール:
- queue / review シートは publish 結果なので読み取り専用として扱う
- 人が直接入力する代表的なシートは `CS_別名解決入力`、`CS_担当割当入力`、`CS_更新アクション`
- canonical の修正は CS workbook で直接行わず、writeback 経由でのみ反映する

### 2.3 `Potex Executive`
役割:
- KPI、リスク、データ状態の確認

現在のタブ:
- `経営_使い方`
- `経営_データ状況`
- `経営_例外推移`
- `経営_顧客リスク`
- `経営_コーチ負荷`

運用ルール:
- すべて publish シートのため読み取り専用
- `経営_データ状況` は live reference workbook の `数値整合性チェック` を最小構成で反映したシート
- `経営_例外推移` は `Sync_Log` ベースの例外 / 未マッチ時系列タブ（基本設定: JST 日次 / 直近 30 日 / 日ごとの最後の successful snapshot）

### 2.4 `Potex Concierge`
役割:
- concierge follow-up の read model 確認

現在のタブ:
- `コンシェルジュ_使い方`
- `コンシェルジュ_フォロー一覧`
- `コンシェルジュ_データ状況`

運用ルール:
- すべて publish シートのため読み取り専用
- 手作業の修正が必要な場合は DB / CS 側フローで処理する

### 2.5 `Potex Sales`
役割:
- 契約、未入金、パイプライン推移の確認

現在のタブ:
- `営業_使い方`
- `営業_契約一覧`
- `営業_未入金一覧`
- `営業_データ状況`
- `営業_ファネル推移`

運用ルール:
- すべて publish シートのため読み取り専用
- 未マッチ / 修正は DB / CS 側フローで処理する

### 2.6 `Potex Coaches`
役割:
- コーチ担当負荷と要フォロー顧客の確認

現在のタブ:
- `コーチ_使い方`
- `コーチ_要フォロー一覧`
- `コーチ_担当負荷`
- `コーチ_データ状況`

運用ルール:
- すべて publish シートのため読み取り専用
- 手作業の修正が必要な場合は DB / CS 側フローで処理する

---

## 3. Source workbook と managed workbook の区別

### 修正禁止: 現在運用中の source / reference workbook
- `受講者管理`
- `顧客満足度会議`
- `月次振り返りアンケート （回答）`
- `⭕️使用中｜POTEX数値管理`

### 修正可能: Potex が直接管理する workbook
- `POTEX DB`
- `Potex CS`
- `Potex Executive`
- `Potex Concierge`
- `Potex Sales`
- `Potex Coaches`

原則:
- source は読み取り専用
- managed workbook のみを構造整理 / 自動化の対象とする

---

## 4. データ所有権

### DB が所有するもの
- すべての ID
- canonical entity / event
- mapping tables
- exception tables
- 公式 lifecycle / status
- downstream publish source

### 運用 workbook が所有するもの
- 業務入力値のみ
- canonical row の直接修正は禁止

例:
- CS: alias resolution、assignment input、後続対応入力
- Executive: 読み取り専用の要約 / 検証
- Concierge / Sales / Coaches: 各役割向け read-only publish surface

---

## 5. 同期方向

### Downstream publish
- `DB -> 運用 workbook`
- 例: `Ops_Followup_Queue` -> `CS_要フォロー一覧`
- 例: `Ops_コーチ_担当負荷` -> `経営_コーチ負荷`

### Upstream writeback
- `運用 workbook -> DB`
- 例: `CS_別名解決入力` -> `Customer_Alias_Map`

### 禁止事項
- 運用 workbook 同士の直接 sync 禁止
- 運用 workbook で canonical ID を生成しない
- source workbook を直接修正して問題を解決しない

---

## 6. 運用上もっとも重要な設計ルール
- publish シートと manual input シートを分離する
- publish シートは overwrite 可能な構造にする
- 人の入力は常に別の input / writeback シートにのみ残す
- 運用担当者が日常的に修正する canonical DB 画面は作らない

---

## 7. 現在 live の役割別 publish surface

現在 live の managed workbooks:
- `POTEX DB`
- `Potex CS`
- `Potex Executive`
- `Potex Concierge`
- `Potex Sales`
- `Potex Coaches`

役割別 workbook の operator-facing タブは日本語タブ名で維持し、canonical DB のシート名 / カラム名は英語 snake_case を維持します.
