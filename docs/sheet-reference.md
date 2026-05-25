# Potex シートリファレンス

## 読み方
各シートについて、次の 4 点だけ確認すれば十分です。
- **場所**: どの workbook にあるか
- **役割**: なぜ存在するか
- **誰が修正するか**: 人 / GAS / どちらでもない
- **注意点**: 混同しやすいポイント

---

## 1. Source / Reference workbooks
このセクションのシートは **すべて修正禁止** です。

### `受講者管理`
- 場所: source workbook
- 役割: 顧客 / 受講生に関する原本データ
- 修正主体: 現場の source 運用チーム
- Potex プロジェクト上の位置づけ: 読み取り専用 source

### `顧客満足度会議`
- 場所: source workbook
- 役割: 満足度 / 指標に関する運用原本
- 修正主体: 現場の source 運用チーム
- Potex プロジェクト上の位置づけ: 読み取り専用 source

### `月次振り返りアンケート （回答）`
- 場所: source workbook
- 役割: feedback 原本回答
- 修正主体: Google Form 回答システム
- Potex プロジェクト上の位置づけ: 読み取り専用 source

### `⭕️使用中｜POTEX数値管理`
- 場所: live operational reference workbook
- 役割: 実運用で検証済みの workbook 構造を参照するための資産
- 修正主体: 現場運用チーム
- Potex プロジェクト上の位置づけ: 構造参照用。修正 / 削除禁止

---

## 2. `POTEX DB` workbook

### `Staging_Customers`
- 役割: 顧客 source を正規化前に一時取り込みする
- 修正主体: GAS / script
- 人が直接修正するか: いいえ
- 注意: source ingest 品質確認用の中間層
- 現在の状態: `SOURCE_CUSTOMERS_WORKBOOK_ID` は設定済みで、`顧客管理` の named rows を基準に staging の並びは検証済み。blank-name rows は staging refresh で skip される

### `Staging_Coaches`
- 役割: コーチ source の一時取り込み
- 修正主体: GAS / script
- 人が直接修正するか: いいえ
- 注意: canonical `Coaches` 生成前の段階

### `Staging_Sessions`
- 役割: セッション原本の一時取り込み
- 修正主体: GAS / script
- 人が直接修正するか: いいえ
- 注意: セッション欠落 / parse 問題の追跡用

### `Staging_Feedback` *（削除済み, P-012 Phase 2 step 2d, 2026-05-20）*
ingest は現在、raw 応答を `Feedback` / `Exceptions_FeedbackMatch` に直接書き込みます。feedback matching 問題は `Exceptions_FeedbackMatch` から確認します（`response_id`、`coach_id`、raw score カラムを含む）。

### `Line_Registrations` *（P-012 Phase 1 で `Staging_LineRegistration` を吸収, 2026-05-20）*
- 役割: LINE friend-add canonical（`csvA` + `csv_potex` 統合）
- 修正主体: GAS / LINE ingest
- 人が直接修正するか: いいえ
- 注意: PK は `line_registration_id = line_{segment}_{line_user_id}`。matched 行のみ `ConversionHistory.line_registered` event を発行する。`attribution_tags` は publish 時に `tokenizeAttributionTags()` で正規化する

### `Staging_Payments`
- 役割: `着金管理マスター` raw ingest の保管 + customer matching の可視化
- 修正主体: GAS / script
- 人が直接修正するか: いいえ
- 注意: 現在の GAS path では canonical 接続キーは `customer_id`。`customer_id` が空の行が現在の commercial data quality queue。古い Python / generated report の `matched_customer_id` 表記は legacy 扱い

### `Customers`
- 役割: 顧客 canonical master
- 修正主体: GAS / 正規化ロジック
- 人が直接修正するか: 原則としていいえ
- 注意: 顧客単位の truth table

### `Coaches`
- 役割: コーチ canonical master
- 修正主体: GAS / 正規化ロジック
- 人が直接修正するか: 原則としていいえ
- 注意: コーチ名の canonical 基準は可能な限りフルネーム

### `Sessions`
- 役割: セッション canonical fact table
- 修正主体: GAS / 正規化ロジック
- 人が直接修正するか: いいえ
- 注意: 顧客 / コーチ接続の主要根拠

### `Feedback`
- 役割: feedback canonical fact table
- 修正主体: GAS / alias writeback 反映
- 人が直接修正するか: いいえ
- 注意: unmatched 解消前後で状態が変わることがある

### `Plans`
- 役割: 商品 / plan 情報の canonical 保管
- 修正主体: GAS / commercial sync script
- 人が直接修正するか: できるだけしない
- 注意: 現在は `顧客管理`.`コース` ベースの base plan と、`継続プラン管理` の matched continuation row を合わせて保持する

### `Payments`
- 役割: payment 情報の canonical 保管
- 修正主体: GAS / commercial sync script
- 人が直接修正するか: できるだけしない
- 注意: `着金管理マスター` ベースの first-pass canonicalization。unmatched payment は `Staging_Payments` で追跡する

### `ConversionHistory`
- 役割: 変換 / 状態変化の記録
- 修正主体: script または後続運用フロー
- 人が直接修正するか: できるだけしない
- 注意: 現在は customer lifecycle + `体験者一覧` + `着金管理マスター` ベースの最小 backfill が live 反映済み

### `Customer_Coach_Assignments`
- 役割: customer ↔ coach 割当関係の canonical 保管
- 修正主体: GAS（`Staging_Customers.assigned_coach_name` + `Coaches` + `Coach_Alias_Map` から derive）
- 人が直接修正するか: いいえ
- 注意: publish 時の担当 coach 名解決はこのシートを優先し、`Customers.assigned_coach_name` は fallback。cold-start（シート未作成）時でも ingest は throw せず空状態で進行する

### `Customer_Channel_Links`
- 役割: customer ↔ cross-channel ID のプレースホルダ（LINE / IG などの stable ID）
- 修正主体: GAS
- 人が直接修正するか: いいえ
- 注意: `Customer_Acquisition_Source` と混同しないこと。後者は DB-no-duplicate 原則により削除済みで、attribution は publish 時 join のみで表示する。`Customer_Channel_Links` は将来の cross-channel 拡張のために維持する

### `Coach_Name_Map`
- 役割: コーチ名 canonical mapping
- 修正主体: script + 必要時の管理作業
- 人が直接修正するか: 制限付きで可能
- 注意: short name より full name を優先

### `Coach_Alias_Map`
- 役割: コーチ alias 補正テーブル
- 修正主体: script + 制限付き手動整理
- 人が直接修正するか: 可能だが慎重に行う
- 注意: 運用 source に繰り返し登場する実名は provisional entity を許容する

### `Customer_Alias_Map`
- 役割: 顧客 alias 補正テーブル
- 修正主体: 基本は CS workbook writeback
- 人が直接修正するか: **DB 上で直接修正しないのが原則**
- 注意: 日常運用は `CS_別名解決入力` で行う

### `Exceptions_FeedbackMatch`
- 役割: feedback と customer matching の例外保管
- 修正主体: GAS / writeback 結果
- 人が直接修正するか: いいえ
- 注意: unresolved 案件の公式例外キュー

### `Exceptions_ContinuationMatch`
- 役割: `継続プラン管理` ingest で canonical customer matching に失敗した row の保管
- 修正主体: GAS
- 人が直接修正するか: いいえ
- 注意: `continuation_unmatched_count` metric の source。`CS_継続名寄せ確認` に publish され、operator が line registration 候補と照合する

### `Ops_Feedback_Review`
- 役割: feedback ベースの運用 review 用 derived シート
- 修正主体: GAS
- 人が直接修正するか: いいえ
- 注意: publish source も兼ねる

### `Ops_Followup_Queue`
- 役割: follow-up が必要な顧客 queue
- 修正主体: GAS
- 人が直接修正するか: いいえ
- 注意: CS workbook `CS_要フォロー一覧` の upstream source
- Phase 1 verdict: **accept**
- 現在の契約: `priority`、`customer` / `customer_id`、`assigned_coach_name`、`feedback_coach_name`、`followup_reason`、`owner`、`queue_status`、`source_ref` を持つ action-oriented queue

### `Ops_コーチ_担当負荷`
- 役割: コーチごとの負荷 / リスクシグナル集計
- 修正主体: GAS
- 人が直接修正するか: いいえ
- 注意: Executive summary の upstream source
- Phase 1 verdict: **accept**
- 現在の契約: active customer 数、session 数、follow-up customer 数、low-satisfaction count、remaining capacity をコーチ単位で表示する

### `Ops_ZeroSession_Review`
- 役割: セッション履歴欠落 / 異常候補の確認
- 修正主体: GAS
- 人が直接修正するか: いいえ
- 注意: 週次 QA の性格が強い

### `Ops_Continuation_Targets`
- 役割: 延長 / 後続管理対象の derived シート
- 修正主体: GAS
- 人が直接修正するか: いいえ
- 注意: CS workbook `CS_継続対象一覧` の upstream source
- Phase 1 verdict: **accept**
- 現在の契約: `priority`、`continuation_tag`、`after_follow_progress`、`next_action`、`reason` を中心にした後続管理 queue

### `Sync_Log`
- 役割: 同期ログ保管
- 修正主体: GAS
- 人が直接修正するか: いいえ
- 注意: append-only システムログ。現在の header は `timestamp / job_name / status / stats`。`stats` は `key=value` 改行形式

### `Sync_Control`
- 役割: 同期制御 / トグル用システムシート
- 修正主体: GAS / 管理者
- 人が直接修正するか: 必要時のみ管理者
- 注意: 一般運用担当者向けではない

### `Publish_Manifest`
- 役割: どのシートをどこへ publish するかを管理するシステムシート
- 修正主体: GAS / 管理者
- 人が直接修正するか: 必要時のみ管理者
- 注意: 一般運用担当者向けではない

---

## 3. `Potex CS` workbook

### `CS_要フォロー一覧`
- 役割: CS が実際に追うべき follow-up 対象
- 修正主体: GAS publish
- 人が直接修正するか: 原則としていいえ
- 注意: 閲覧 / 業務確認用 queue
- 検証メモ: 2026-05-17 時点で live row 18 件確認済み。`coach_name` は upstream の `feedback_coach_name` / `assigned_coach_name` から入るよう補正済み

### `CS_継続対象一覧`
- 役割: 延長 / 後続管理確認用 queue
- 修正主体: GAS publish
- 人が直接修正するか: 原則としていいえ
- 注意: 閲覧 / 業務確認用 queue

### `CS_使い方`
- 役割: CS operator 向けの利用案内 / 読む順番の README
- 修正主体: GAS publish / script
- 人が直接修正するか: いいえ
- 注意: workbook 全体の入口タブ

### `CS_例外確認`
- 役割: exception review 用の要約画面
- 修正主体: GAS publish
- 人が直接修正するか: いいえ
- 注意: unresolved 原因の把握用

### `CS_更新アクション`
- 役割: 将来の CS 手動 action writeback 入力用
- 修正主体: 人が入力可能
- 人が直接修正するか: はい
- 注意: canonical table を直接修正する代わりにここへ入力する

### `CS_別名解決入力`
- 役割: 顧客 alias 解決の公式入力画面
- 修正主体: 人の入力 + GAS writeback 結果反映
- 人が直接修正するか: はい。ただし以下 4 項目のみ
- 修正可能な主要カラム:
  - `operator_decision_status`
  - `operator_selected_customer_id`
  - `operator_selected_customer_name`
  - `operator_note`
- 注意: それ以外のカラムは publish 結果のため直接触らない

### `CS_承認診断`
- 役割: approval queue の次アクションを 1 行で切り分ける operator triage タブ
- 修正主体: GAS publish
- 人が直接修正するか: いいえ
- 注意: `queue_status` / `recommended_next_action` を最初に確認する

### `CS_承認進捗`
- 役割: payment / continuation alias review の open queue と最近の writeback 処理量要約 + partner status pipeline モニタリング
- 修正主体: GAS publish
- 人が直接修正するか: いいえ
- 注意: operator queue 自体を置き換えるものではなく、どこから処理すべきかの優先順位を示す monitoring タブ
- 現在の partner 主要 metric: `open_total`、`waiting_first_update`、`stale_30d`、`meeting_completed`、`potex_in_progress`、`processed_last_7d`

### `CS_入金名寄せ確認`
- 役割: payment row が canonical customer と未接続の案件を operator が review する queue
- 修正主体: GAS publish + 人の入力 + GAS writeback 結果反映
- 人が直接修正するか: はい。ただし以下 4 項目のみ
- 修正可能な主要カラム:
  - `operator_decision_status`
  - `operator_selected_customer_id`
  - `operator_selected_customer_name`
  - `operator_note`
- 修正禁止: `priority`、payment / candidate / source / suggestion / current 状態カラム、`writeback_alias_name`、`sync_status`、`last_collected_at`
- 注意: header が空、または P1 / P2 / P3 count が stale に見える場合は承認しない。fresh publish を確認したうえで `approve_if_context_matches` の対象だけを承認する

### `CS_継続名寄せ確認`
- 役割: `Exceptions_ContinuationMatch` の `continuation_customer_unmatched` 案件を operator が review する queue
- 修正主体: GAS publish + 人の入力 + GAS writeback 結果反映
- 人が直接修正するか: はい。ただし以下 4 項目のみ
- 修正可能な主要カラム:
  - `operator_decision_status`
  - `operator_selected_customer_id`
  - `operator_selected_customer_name`
  - `operator_note`
- 修正禁止: exception / candidate / source / suggestion / current 状態カラム、`writeback_alias_name`、`sync_status`、`last_collected_at`
- 注意: タブがない、または 0 件でも即エラーと決めつけず、full refresh / publish 後に `Exceptions_ContinuationMatch` の row 数と合わせて確認する

---

## 4. `Potex Executive` workbook

### `経営_使い方`
- 役割: Executive 向けの利用案内 / 読む順番の README
- 修正主体: GAS publish / script
- 人が直接修正するか: いいえ
- 注意: 会議前チェック → 更新状況 → データ状況の導線を説明する入口タブ

### `経営_会議前チェック`
- 役割: 経営会議をそのまま進めてよいかを即判定する overview
- 修正主体: GAS publish
- 人が直接修正するか: いいえ
- 注意: `overall meeting risk` を最初に見る

### `経営_更新状況`
- 役割: domain ごとの freshness / stale / 更新漏れリスク確認
- 修正主体: GAS publish
- 人が直接修正するか: いいえ
- 注意: stale domain の切り分けに使う

### `経営_コーチ負荷`
- 役割: コーチ負荷の要約
- 修正主体: GAS publish
- 人が直接修正するか: いいえ
- 注意: 運用 dashboard 的な要約ビュー

### `経営_顧客リスク`
- 役割: 顧客リスク / feedback リスクの要約
- 修正主体: GAS publish
- 人が直接修正するか: いいえ
- 注意: high-level summary view
- 現在の主要 metric: `low_satisfaction_feedback_count`、`followup_feedback_count`、`feedback_match_exception_count`

### `経営_データ状況`
- 役割: データ整合性 / 健全性の点検
- 修正主体: GAS publish
- 人が直接修正するか: いいえ
- companion: `経営_例外推移` が同じ例外 / 未マッチ metric の時系列を提供する
- 注意: `数値整合性チェック` に相当する最小版
- 現在の主要 metric: `customers_count`、`coaches_count`、`sessions_count`、`feedback_count`、`followup_queue_count`、`continuation_targets_count`、`feedback_match_exception_count`、`partner_assignment_count`、`partner_status_updated_count`、`partner_stale_30d_count`

### `経営_例外推移`
- 役割: `Sync_Log` ベースの例外 / 未マッチ時系列モニタリング
- 修正主体: GAS publish
- 人が直接修正するか: いいえ
- 基本設定: JST 日次 / 直近 30 日 / 各日の最後の successful snapshot
- 現在の主要 metric: `feedback_match_exception_count`、`payment_unmatched_count`、`continuation_unmatched_count`、`line_registration_unmatched_count`、`feedback_response_id_collision_count`

---

## 5. `Potex Concierge` workbook

### `コンシェルジュ_使い方`
- 役割: concierge 運用担当者に、この workbook が read-only であることを明示する
- 修正主体: GAS publish / script
- 人が直接修正するか: いいえ
- 注意: 使用可能タブ、ingest 状態、escalation ルールを説明する案内タブ

### `コンシェルジュ_フォロー一覧`
- 役割: concierge が follow-up 案件を 1 画面で読み取り専用確認する queue
- 修正主体: GAS publish / script
- 人が直接修正するか: いいえ
- 注意: `POTEX DB > Ops_Followup_Queue` を richer shape で表示した derived view
- 現在の検証メモ: 2026-05-17 時点で live row 18 件確認済み

### `コンシェルジュ_データ状況`
- 役割: concierge workbook 内で ingest 状態と主要件数を確認する
- 修正主体: GAS publish / script
- 人が直接修正するか: いいえ
- 注意: 最小 metric は `customer_ingest_mode`、`followup_queue_count`、`continuation_targets_count`、`feedback_match_exception_count`

---

## 6. `Potex Sales` workbook

### `営業_使い方`
- 役割: sales 運用担当者に、この workbook が read-only であることを明示する
- 修正主体: GAS publish / script
- 人が直接修正するか: いいえ
- 注意: 読む順番、修正禁止範囲、escalation ルールを説明する案内タブ

### `営業_契約一覧`
- 役割: 契約 / 着金ベースの商用 row 全体を新しい順で見る publish view
- 修正主体: GAS publish / script
- 人が直接修正するか: いいえ
- 注意: unmatched row も意図的に隠さずそのまま表示する

### `営業_未入金一覧`
- 役割: 未入金 row 専用 queue
- 修正主体: GAS publish / script
- 人が直接修正するか: いいえ
- 注意: 営業と CS が顧客特定 / 入金追跡に使う read-only view

### `営業_データ状況`
- 役割: payments / plans / conversion / unmatched counts の要約
- 修正主体: GAS publish / script
- 人が直接修正するか: いいえ
- 注意: signal-style の health 要約タブ

### `営業_ファネル推移`
- 役割: canonical `ConversionHistory` ベースの直近 funnel event view
- 修正主体: GAS publish / script
- 人が直接修正するか: いいえ
- 注意: event sequence と直近推移を読むためのビュー

---

## 7. `Potex Coaches` workbook

### `コーチ_使い方`
- 役割: coach 運用担当者に、この workbook が read-only であることを明示する
- 修正主体: GAS publish / script
- 人が直接修正するか: いいえ
- 注意: 読む順番、修正禁止範囲、escalation ルールを説明する案内タブ

### `コーチ_要フォロー一覧`
- 役割: コーチ視点の follow-up alerts を読み取り専用で確認する queue
- 修正主体: GAS publish / script
- 人が直接修正するか: いいえ
- 注意: 長文 comment / gap comment の可読性を優先した publish view

### `コーチ_担当負荷`
- 役割: コーチごとの担当顧客数と負荷 / 警告シグナルの要約
- 修正主体: GAS publish / script
- 人が直接修正するか: いいえ
- 注意: remaining capacity / overload シグナルを確認する要約タブ

### `コーチ_データ状況`
- 役割: coach workbook 内で主要件数と health 状態を確認する
- 修正主体: GAS publish / script
- 人が直接修正するか: いいえ
- 注意: manager-friendly health block

---

## 8. `Potex Sato` / `Potex Inai` workbook

### `パートナー_使い方`
- 役割: partner 向けの利用案内 / 読む順番の README
- 修正主体: GAS publish / script
- 人が直接修正するか: いいえ
- 注意: workbook 全体の入口タブ

### `パートナー_担当リード`
- 役割: partner ごとの active lead / customer assignment 一覧
- 修正主体: GAS publish / script
- 人が直接修正するか: いいえ
- 注意: `assigned_at`、meeting / sale / recruitment status の現況確認に使う

### `パートナー_状況入力`
- 役割: partner が meeting / sale / recruitment status を入力する writeback タブ
- 修正主体: GAS publish + 人の入力 + GAS writeback 結果反映
- 人が直接修正するか: はい。ただし operator status / note / submit 系のみ
- 修正禁止: lead/customer/coach ID、sync status、last collected など system 管理カラム
- 注意: assignment 自体の決定は `Potex CS > CS_担当割当入力` で行う

### `パートナー_データ状況`
- 役割: partner workbook 側の件数 / freshness / stale 状態の確認
- 修正主体: GAS publish / script
- 人が直接修正するか: いいえ
- 注意: status update の停滞や件数異常の確認用

---

## 9. 削除したシート
### `MasterData`
- 以前の場所: `POTEX DB`
- 削除理由: 現在の運用構造とつながらない legacy sheet

### `Dashboard`
- 以前の場所: `POTEX DB`
- 削除理由: stale 状態で、役割は Executive workbook の summary に移管済み

注意:
- この削除は **`POTEX DB`** でのみ実施した
- **現在運用中の source / reference workbook は修正 / 削除していない**
