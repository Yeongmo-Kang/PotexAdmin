# Potex データベース概要

## 1. この文書の目的
この文書は、Potex データベースが **どの workbook で構成されているか**、**どこが source / reference でどこが運用用か**、**どのシートを残し、どのシートを削除したか** を素早く理解するための基準文書です。

この文書を先に読むと、次の点をまとめて把握できます。
- 日常運用で直接編集しない source / reference workbook が何か
- なぜ `POTEX DB` が中心ハブなのか
- `Potex CS`、`Potex Executive`、`Potex Concierge`、`Potex Sales`、`Potex Coaches`、`Potex Sato`、`Potex Inai` が何を見るための workbook か
- 現在 live の運用対象シートが何か

---

## 2. 一言で言うと
Potex のデータ構造は、次の原則で運用します。

1. **source / reference spreadsheet は日常運用の編集対象ではなく、読み取り専用で扱う。**
2. **`POTEX DB` だけが canonical database の役割を持つ。**
3. **運用担当者は DB ではなく役割別 workbook（`Potex CS`、`Potex Executive`、`Potex Concierge`、`Potex Sales`、`Potex Coaches`、`Potex Sato`、`Potex Inai`）を見る。**
4. **人の入力は publish シートではなく、専用の input / writeback シートでのみ行う。**

---

## 3. 修正禁止対象: 現在運用中の source / reference workbook
以下のシートは **現在運用中の実運用 source** のため、修正 / 削除は禁止です。

### Upstream operational systems
- `LStep`: 公式 LINE 友だち追加、LINE タグ、`LStep` 内部の顧客情報を管理する実際の upstream 運用システム
- `Slack`: 営業が顧客面談結果を報告し、CS がそれを見て `LStep` を更新するための業務連絡チャネル

現在把握している手動フロー:
1. ユーザーが公式 LINE を友だち追加する。
2. LINE / `LStep` 内でタグと顧客情報が管理される。
3. 営業が顧客面談結果を Slack に報告する。
4. CS がその Slack 報告を見て `LStep` のタグ / 顧客情報を更新する。
5. `LStep` / 関連画面からフォーマット別 CSV を手動ダウンロードする。
6. その CSV を運用 spreadsheet に手動 import する。
7. GAS がその spreadsheet データを読み取り、dashboard / managed workbook を refresh する。

### Source / reference workbooks
- `受講者管理`
- `顧客満足度会議`
- `月次振り返りアンケート （回答）`
- `⭕️使用中｜POTEX数値管理` — `LStep` CSV import 結果（`csvA`、`csv_potex`）とダッシュボード更新フローを含む短期 ingest / reference source

### 原則
- 構造変更禁止
- タブ削除禁止
- 手動整理禁止
- これらのシートは **読み取り専用の source / reference** としてのみ扱う
- ただし長期的には、spreadsheet 自体が原本ではなく **`LStep` / Slack 業務フローから来る export / import の経由地点** である前提で、reader だけ差し替えられる構成を維持する

---

## 4. 現在の管理対象 workbook

### 4.1 `POTEX DB`
役割:
- 唯一の canonical database
- staging / canonical / mapping / exception / system タブを保持
- 他の運用 workbook はすべてここから publish を受ける

この workbook で行うこと:
- source データの取り込み
- 正規化
- canonical row の作成
- alias / exception の管理
- downstream publish source の提供

### 4.2 `Potex CS`
役割:
- CS 運用担当者が実務を処理する workbook
- follow-up / continuation / exception review / alias resolution を実施する

この workbook で行うこと:
- follow-up queue の確認
- continuation 対象の確認
- alias resolution の入力
- その後 writeback で DB に反映

### 4.3 `Potex Executive`
役割:
- 要約 / モニタリング専用 workbook
- KPI とデータ状態を確認する workbook

この workbook で行うこと:
- コーチ負荷の確認
- 顧客リスク要約の確認
- データ整合性 / 健全性の確認

### 4.4 `Potex Concierge`
役割:
- concierge follow-up を読み取り専用で確認する workbook

この workbook で行うこと:
- follow-up queue の確認
- concierge 観点でのデータ状態確認

### 4.5 `Potex Sales`
役割:
- 契約、未入金、パイプライン変化を読み取り専用で確認する workbook

この workbook で行うこと:
- 契約一覧の確認
- 未入金 queue の確認
- 直近 funnel event 推移と data health の確認

### 4.6 `Potex Coaches`
役割:
- コーチ担当負荷と要フォロー顧客を読み取り専用で確認する workbook

この workbook で行うこと:
- コーチごとの担当負荷確認
- 要フォロー顧客確認
- コーチ観点でのデータ状態確認

### 4.7 `Potex Sato` / `Potex Inai`
役割:
- partner ごとの担当 lead / customer 進捗を確認し、status update を writeback する workbook

この workbook で行うこと:
- `パートナー_担当リード` で現在担当案件を確認する
- `パートナー_状況入力` で meeting / sale / recruitment status を更新する
- `パートナー_データ状況` で freshness と件数異常を確認する

---

## 5. 現在 live のシート構成

### `POTEX DB`
#### Staging layer（legacy、段階的に削減中 — P-012）
- `Staging_Customers`
- `Staging_Payments`
- ~~`Staging_LineRegistration`~~ — Phase 1 で `Line_Registrations` に吸収（2026-05-20）
- ~~`Staging_Feedback`~~ — Phase 2 step 2d で削除。ingest は `Feedback` / `Exceptions_FeedbackMatch` に直接書き込む（2026-05-20）

#### Canonical layer
- `Customers`
- `Coaches`
- `Sessions`
- `Feedback`
- `Plans`
- `Payments`
- `ConversionHistory`
- `Line_Registrations`
<!-- attribution channel は別 canonical シートとして永続化しない。Line_Registrations.attribution_tags の原本を保持し、`経営_データ状況` / `コンシェルジュ_データ状況` の publish 時に `tokenizeAttributionTags()` で (`YT_/IG_/TIK_/TT_/PT_/LP_/SDP_/【流入】` → `yt/ig/tik/tt/pt/lp/sdp/inflow`) へ変換し、分布だけを表示する。重複データ回避 + publish-time join 原則。 -->

> 現在の live commercial first-pass 状態: `Staging_Payments` 136 行、`Plans` 228 行、`Payments` 136 行、`ConversionHistory` 543 行。

#### Mapping / exception layer
- `Coach_Name_Map`
- `Coach_Alias_Map`
- `Customer_Alias_Map`
- `Exceptions_FeedbackMatch`
- `Exceptions_ContinuationMatch` — `継続プラン管理` 由来の continuation plan row のうち canonical customer にマッチしなかったもの。黙って落とさずに公開し、運用担当者が名前ゆれ確認や alias 追加を行えるようにする。`runCanonicalRefresh()` / `runFullRefresh()` が `buildCommercialOutputs()` 経由で refresh する。

#### DB 内の運用 derived view
- `Ops_Feedback_Review`
- `Ops_Followup_Queue`
- `Ops_コーチ_担当負荷`
- `Ops_ZeroSession_Review`
- `Ops_Continuation_Targets`

#### System layer
- `Sync_Log`
- `Sync_Control`
- `Publish_Manifest`

### `Potex CS`
- `CS_使い方`
- `CS_承認診断`
- `CS_承認進捗`
- `CS_入金名寄せ確認`
- `CS_継続名寄せ確認`
- `CS_担当割当入力`
- `CS_要フォロー一覧`
- `CS_継続対象一覧`
- `CS_例外確認`
- `CS_更新アクション`
- `CS_別名解決入力`

### `Potex Executive`
- `経営_使い方`
- `経営_会議前チェック`
- `経営_更新状況`
- `経営_データ状況`
- `経営_例外推移`
- `経営_顧客リスク`
- `経営_コーチ負荷`

### `Potex Concierge`
- `コンシェルジュ_使い方`
- `コンシェルジュ_フォロー一覧`
- `コンシェルジュ_データ状況`

### `Potex Sales`
- `営業_使い方`
- `営業_契約一覧`
- `営業_未入金一覧`
- `営業_データ状況`
- `営業_ファネル推移`

### `Potex Coaches`
- `コーチ_使い方`
- `コーチ_要フォロー一覧`
- `コーチ_担当負荷`
- `コーチ_データ状況`

### `Potex Sato` / `Potex Inai`
- `パートナー_使い方`
- `パートナー_担当リード`
- `パートナー_状況入力`
- `パートナー_データ状況`

---

## 6. 今回の整理で削除したシート
以下のシートは `POTEX DB` から削除しました。
- `MasterData`
- `Dashboard`

削除理由:
- 現在の GAS / manifest ベース運用構造に含まれていない
- 役割が曖昧、または stale 状態だった
- Executive workbook と明示的な運用シート構造へ移行する方向と衝突する
- シート数を減らし、運用担当者の混乱余地を減らすほうが安全

重要:
- 削除は **管理対象 workbook（`POTEX DB`）** でのみ実施した
- **現在運用中の source / reference workbook には一切手を加えていない**

---

## 7. データ所有権ルール

### DB が所有するもの
- すべての canonical row
- すべての ID
- mapping tables
- exception tables
- publish source data

### 運用 workbook が所有するもの
- operator decision
- 後続対応メモ
- input / writeback row

### 禁止事項
- 運用 workbook から canonical row を直接修正する
- source / reference workbook を直接整理して問題を解決する
- publish シートへ手入力する

---

## 8. 文書を読む順番

### 最初に読む文書
1. `README.md`
2. `docs/database-overview.md`
3. `docs/sheet-reference.md`
4. `OPERATIONS_MANUAL.md`

### 実行 / 配備が必要なとき
5. `PHASE1_CUTOVER_RUNBOOK.md`
6. `OPS_WORKBOOK_ARCHITECTURE.md`
7. `docs/backlog.md`

---

## 9. 運用担当者への最重要メッセージ
- source / reference workbook は日常運用で触らない
- DB は直接の運用画面ではない
- 日常作業は役割別 workbook（CS / Executive / Concierge / Sales / Coaches / Sato / Inai）で行う
- publish タブは読み取り専用
- 人が入力してよいのは `CS_別名解決入力` のような input タブだけ
