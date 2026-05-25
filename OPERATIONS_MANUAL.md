# Potex 運用マニュアル

## 1. この文書の対象
この文書は、Potex の運用担当者が **どこを見ればよいか**、**どこを触ってはいけないか**、**問題が起きたときにどの順番で確認するか** を素早く把握するための実務向けガイドです。

技術仕様書ではなく、**日々の運用手順書**として読んでください。

---

## 2. 最初に覚える 5 つの原則

1. **原本シートは修正しない。**
2. **`POTEX DB` は運用担当者が日常的に直接編集する画面ではない。**
3. **日常運用は `Potex CS`、`Potex Executive`、`Potex Concierge` で行う。**
4. **publish シートは読み取り専用である。**
5. **人が入力してよいのは input / writeback シートだけである。**

---

## 3. どこを見ればよいか

### 3.1 原本シートと upstream の流れ
次のシートは **閲覧のみ** とし、修正しません。
- `受講者管理`
- `顧客満足度会議`
- `月次振り返りアンケート （回答）`
- `⭕️使用中｜POTEX数値管理`

ただし、実際の LINE / 顧客タグの upstream は spreadsheet ではなく `LStep` です。
現在の運用フローは次のとおりです。
1. ユーザーが公式 LINE を友だち追加する。
2. `LStep` で LINE タグと顧客情報を管理する。
3. 営業が顧客面談の結果を Slack に報告する。
4. CS がその Slack 報告を見て `LStep` を更新する。
5. `LStep` / 関連画面から用途別の CSV をダウンロードする。
6. CSV を spreadsheet に手動 import する。
7. GAS がそのデータを読み取り、ダッシュボード / 運用 workbook を更新する。

そのため、source spreadsheet は現在 ingest の経由地点ですが、長期的には `LStep` export / API または Slack → `LStep` の業務フローに直接つなげられる構成を前提とします。

### 3.2 実際に使う運用 workbook
#### `Potex CS`
CS 担当者が主に確認する workbook
- `CS_要フォロー一覧`
- `CS_継続対象一覧`
- `CS_例外確認`
- `CS_別名解決入力`
- `CS_承認診断`
- `CS_承認進捗`
- `CS_入金名寄せ確認`
- `CS_継続名寄せ確認`
- `CS_更新アクション` （今後 / 限定的な writeback 入力用）

#### `Potex Executive`
運用リーダー / マネージャーが確認する workbook
- `経営_会議前チェック`
- `経営_更新状況`
- `経営_コーチ負荷`
- `経営_顧客リスク`
- `経営_データ状況`
- `経営_例外推移`

#### `Potex Concierge`
concierge が follow-up の文脈を読み取り専用で確認する workbook
- `コンシェルジュ_使い方`
- `コンシェルジュ_フォロー一覧`
- `コンシェルジュ_データ状況`

### 3.3 DB workbook
#### `POTEX DB`
- canonical database
- 運用担当者が日常的に直接修正する場所ではない
- 管理者 / 自動化の基準 workbook

### 3.4 その日の最初の確認順
#### CS 担当者
1. `CS_承認診断`
2. `CS_承認進捗`
3. `CS_入金名寄せ確認` / `CS_継続名寄せ確認` の該当 P1
4. `CS_要フォロー一覧`
5. `CS_継続対象一覧`

#### 管理者 / 自動化担当
1. `経営_会議前チェック`
2. `経営_更新状況`
3. 必要なら `POTEX DB > Sync_Log`
4. CLI が使える場合は read-only inspect script
   - `python inspect_post_refresh_state.py`
   - `python inspect_approval_queue_state.py`

---

## 4. シートごとの役割

### `CS_要フォロー一覧`
何を見るか:
- follow-up が必要な顧客
- 優先度が高い feedback

運用担当者が行うこと:
- どの顧客から対応するかを判断する
- コーチ / 顧客の課題を確認する
- `coach_name`、`followup_reason`、コメントを合わせて確認し、誰がどの後続対応を持つべきか判断する

修正してよいか:
- 原則として不可

### `CS_継続対象一覧`
何を見るか:
- 延長 / 継続提案が必要な顧客

運用担当者が行うこと:
- タイミングを確認する
- 後続アクションが必要か判断する

修正してよいか:
- 原則として不可

### `CS_例外確認`
何を見るか:
- 例外状況の要約
- unmatched / review が必要なケース

運用担当者が行うこと:
- どの例外が、なぜ発生しているかを確認する

修正してよいか:
- 不可

### `CS_別名解決入力`
何を見るか:
- 顧客名 alias の不一致を解消する必要がある案件

運用担当者が行うこと:
- 同一人物かどうかを判断する
- 正しい customer ID を選択する
- メモを残す

修正可能なカラム:
- `operator_decision_status`
- `operator_selected_customer_id`
- `operator_selected_customer_name`
- `operator_note`

修正してはいけないもの:
- alias / source / current 状態に関する publish カラム

注意:
- このシートでシステムが実際に反映する状態値は `approved` / `active` / `resolved` 系のみです。
- 判断を保留するときは status を無理に入れず、空欄のままにします。

### `CS_承認診断`
何を見るか:
- `CS_入金名寄せ確認` / `CS_継続名寄せ確認` を **いま誰が動かすべきか** を 1 行で判定したタブ
- `queue_status`、`primary_bottleneck`、`next_action_owner`、`recommended_next_action` により、
  - 人が今すぐ判断すべきか
  - 入力修正が必要か
  - 次回 writeback 待ちか
  - writeback 自体が stale で点検が必要か
  を最短で切り分ける
- live 反映済みの現在は、まずこのタブだけで **operator action / system wait / automation check** を見分けられる

運用担当者が行うこと:
- 最初にこのタブを見る
- `queue_status=要修正` なら review タブで invalid 行を修正する
- `queue_status=P1優先処理` なら該当 review タブで P1 を先に判断する
- `queue_status=同期待ち` なら review タブを触り直さず、次回 writeback まで待つ
- `queue_status=要点検` なら `POTEX DB > Sync_Log` の `runWritebackCollection` 最新成功を確認し、自動化担当へ連携する
- `queue_status=候補/取込待ち` なら status は空欄のまま note を残し、次回 ingest / 顧客調査を待つ

### `CS_承認進捗`
何を見るか:
- `CS_承認診断` の判断根拠になっている件数・時刻・throughput の詳細
- `CS_入金名寄せ確認` / `CS_継続名寄せ確認` の **現在の open queue** と、直近 7 日の writeback 処理量を 1 か所にまとめた運用モニタリングタブ
- `open_p1`、`p1_undecided`、`decided_waiting_sync`、`invalid_open`、`source_wait_open`、`last_writeback_age` により、どこが実際のボトルネックかを素早く確認する
- live workbook では `queue_status` / `recommended_next_action` も出ているため、件数モニタと次アクション確認を同じタブで補助できる

運用担当者が行うこと:
- `CS_承認診断` で `recommended_next_action` を確認してから、このタブで件数と時刻の裏取りをする
- `open_p1` と `p1_undecided` が多いものから優先して処理する
- `decided_waiting_sync` が溜まっている場合は、`last_writeback_age` を見て
  - cadence 内なら待機
  - cadence から大きく外れていれば writeback 実行異常を確認する
- `invalid_open` が増えた場合は、該当 review タブで operator 入力ミスを先に修正する
- `source_wait_open` が多い場合は、P2 / P3 を無理に承認せず note のみ残して次回取込や顧客調査を待つ
- `processed_last_7d` が 0 に近く、open queue が減らない場合は、運用ルーティンが実際に回っているか確認する

### `CS_入金名寄せ確認`
何を見るか:
- payment row が canonical customer にまだ接続されていない案件
- line registration の候補と suggested customer が付与された review queue

優先度 (`priority` カラム) の意味:
- `P1`: システムが候補 line registration 行から **すでに canonical customer ID を見つけている** ケース。`suggested_action` は `approve_if_context_matches`。最も安全に承認しやすいランク。
- `P2`: 候補 line registration 行は見つかったが、その行がまだ canonical customer と接続されていないケース。customer ingest の補強または operator 調査が先に必要。
- `P3`: 一致しうる候補 line registration 行自体が存在しないケース。保留 (`hold_no_candidate_found`)。

`suggested_action` の意味:
- `approve_if_context_matches`: 文脈（名前 / 金額 / `contract_date` / segment など publish カラム）を見て同一人物なら承認する
- `search_customer_or_wait_for_customer_ingest`: 候補はあるが canonical 接続がないため保留する
- `hold_no_candidate_found`: 候補自体がないため保留する

運用担当者が行うこと:
- P1 から優先処理する。行の publish カラム（特に `payment_customer_name`、`payment_line_name`、`candidate_display_name`、`candidate_line_registration_name`、`candidate_real_name`、`contract_date`、`amount`、`suggestion_basis`）を確認して同一人物か判断する
- 一致していれば `operator_decision_status = approved` を入力する。`current_canonical_customer_id` / `current_canonical_customer_name` はすでに入っているためそのままでよく、別の customer に訂正したい場合のみ `operator_selected_customer_id` / `operator_selected_customer_name` を上書きする
- 必要に応じて `operator_note` に判断根拠を残す
- P2 / P3 は status を空欄のままにし、note のみ残す

修正可能なカラム:
- `operator_decision_status`
- `operator_selected_customer_id`
- `operator_selected_customer_name`
- `operator_note`

修正してはいけないもの:
- payment / candidate / suggestion / current 状態に関する publish カラム
- 特に `writeback_alias_name` は、システムが writeback 対象 alias を固定した値なので修正しない

注意:
- このシートでも、システムが実際に反映する状態値は `approved` / `active` / `resolved` 系のみです。
- 保留や追加調査が必要な場合は status を空欄のままにし、note のみ残します。
- 承認後、次の writeback + refresh + republish で row が queue から消えることがありますが、それが正常動作です。
- header が空、または priority count が stale に見える場合は承認せず、GAS publish 経路の点検を依頼してください（`inspect_post_refresh_state.py` verdict の `cs_payment_alias_review_safe_for_operator_approval` が `true` である必要があります）。

### `CS_継続名寄せ確認`
何を見るか:
- `継続プラン管理` から入った row が canonical customer と接続されず `Exceptions_ContinuationMatch` に入った案件
- line registration の候補と suggested customer が付与された review queue

優先度 (`priority` カラム) の意味:
- `P1`: システムが候補 line registration 行から **すでに canonical customer ID を見つけている** ケース。`suggested_action` は `approve_if_context_matches`。優先承認対象。
- `P2`: 候補は見つかったが canonical 接続がないケース。保留。
- `P3`: 候補なし。保留。

`suggested_action` の意味: `CS_入金名寄せ確認` と同じです。

運用担当者が行うこと:
- P1 から優先処理する。行の publish カラム（`raw_name`、`cleaned_name`、`raw_plan`、`raw_contract_date`、`raw_amount`、`candidate_display_name`、`candidate_line_registration_name`、`candidate_real_name`、`suggestion_basis`）を見て同一人物か判断する
- 一致していれば `operator_decision_status = approved` を入力する。別の customer に訂正したい場合のみ `operator_selected_customer_id` / `operator_selected_customer_name` を上書きする
- 必要に応じて `operator_note` を残す
- P2 / P3 は status を空欄のままにし、note のみ残す

修正可能なカラム:
- `operator_decision_status`
- `operator_selected_customer_id`
- `operator_selected_customer_name`
- `operator_note`

修正してはいけないもの:
- exception / candidate / suggestion / current 状態に関する publish カラム
- 特に `writeback_alias_name` はシステムが固定した値

注意:
- 承認内容は `Customer_Alias_Map` に `source=cs_continuation_alias_review` として反映されます。
- 承認後、次の refresh + republish で row が queue から消えれば正常です。
- タブ自体がない場合は、まず publish / runtime 経路を確認してください（`inspect_post_refresh_state.py` verdict の `cs_continuation_alias_review_present` が `true` である必要があります）。

### `経営_会議前チェック`
何を見るか:
- 今日の経営会議を **そのまま進めてよいか** を素早く判断するタブ
- `publish freshness`、`full refresh freshness`、`writeback freshness`、stale domain 数、human update omission の可能性、重要案件数を 1 行ずつ確認する
- 最終行 `overall meeting risk` は `GO` / `GO_WITH_CAUTION` / `CHECK_BEFORE_MEETING` のいずれかを返す

運用担当者が行うこと:
- 会議開始前に最初にこのタブを開く
- `CHECK_BEFORE_MEETING` の場合は、すぐ次の `経営_更新状況` に移動し、どの domain が stale か確認する
- `critical team issues in meeting scope` が大きい場合は、クレーム / 要フォロー / 未マッチ案件が会議論点から漏れていないか確認する

### `経営_更新状況`
何を見るか:
- domain ごとの freshness / stale / 更新漏れリスク
- 主なカラム:
  - `domain`
  - `status`
  - `last_effective_update_at_jst`
  - `expected_cadence`
  - `stale_threshold`
  - `stale_by`
  - `likely_issue_type`
  - `likely_decision_risk`
  - `recommended_check`

運用担当者が行うこと:
- `status` が `高リスク（会議前に確認推奨）` の domain から確認する
- `likely_issue_type` で、自動化未実行なのか、原データ更新漏れなのかを切り分ける
- `likely_decision_risk` を見て、数値がどの方向に、なぜ歪む可能性があるかを会議前に共有する
- `recommended_check` に従い、どのチーム / どのシートを先に確認するか決める

### `経営_コーチ負荷`
何を見るか:
- コーチごとの顧客数 / 負荷
- follow-up の集中度

運用担当者が行うこと:
- 特定のコーチに負担が偏っていないか確認する

### `経営_顧客リスク`
何を見るか:
- 満足度低下、follow-up 必要、例外件数などのリスク要約

運用担当者が行うこと:
- 今週 / 今月のリスク水準を確認する

### `経営_データ状況`
何を見るか（`metric` / `value` / `note`）:
- **会議信頼性メトリクス**:
  - `last_publish_success_at_jst` — 最新の `runPublishAll` 成功時刻
  - `last_full_refresh_success_at_jst` — 最新の `runFullRefresh` 成功時刻
  - `last_writeback_success_at_jst` — 最新の `runWritebackCollection` 成功時刻
  - `stale_domain_count` — `経営_更新状況` で stale 判定された domain 数
  - `stale_high_risk_domain_count` — 会議前に確認優先の domain 数
  - `likely_human_update_omission_count` — 自動化は動いたが原データ更新漏れが疑われる domain 数
  - `domains_with_likely_human_update_omission` — 該当 domain の一覧
  - `meeting_risk_status` — `経営_会議前チェック` と同じ最終会議状態
  - `critical_team_issue_count` — 会議論点になりやすい要フォロー / 例外 / クレーム候補の件数
- **件数メトリクス**: canonical row 数（customers / coaches / sessions / feedback / plans / payments / conversion_events / line_registrations / followup_queue / continuation_targets）
- **例外 / 未マッチメトリクス**（0 に近いほど望ましい）:
  - `feedback_match_exception_count` — `Exceptions_FeedbackMatch` の行数。対応先: `CS_別名解決入力`
  - `payment_unmatched_count` — `Staging_Payments` で canonical customer に接続されていない payment 件数。対応先: `CS_入金名寄せ確認`
  - `continuation_unmatched_count` — `Exceptions_ContinuationMatch` の行数。対応先: `CS_継続名寄せ確認`
  - `line_registration_unmatched_count` — `Line_Registrations` で customer に接続されていない LINE 登録件数。専用の解消キューはなく、customer ingest 補強後に自動解消される
- **データ完全性メトリクス**:
  - `feedback_response_id_collision_count` — `Feedback` で同じ `response_id` を持つ行数。**常に 0 であるべき**。1 以上なら SHA-256 hash collision のため即時調査が必要
- **acquisition メトリクス**: LINE 登録の channel token 分布（`acquisition_with_channel_count` / `acquisition_without_channel_count` / `acquisition_top_channels`）
- `経営_例外推移` は上記の例外 / 未マッチメトリクスの **時系列 companion view** です。現在の基本設定は **JST 日次 / 直近 30 日 / 各日の最後の successful `Sync_Log` snapshot** です。

運用担当者が行うこと:
- まず `meeting_risk_status` と最新 publish / refresh / writeback 時刻が妥当か確認する
- stale / high-risk count が 0 でない場合は `経営_更新状況` に移動する
- `critical_team_issue_count` が大きい場合は、チームの重要案件（クレームを含む）が会議資料に十分反映されているか確認する
- データが異常に減っていないか、空になっていないか確認する
- refresh 後に数値が妥当か sanity check する
- 例外 / 未マッチメトリクスが急増した場合は、該当 review シート（`CS_*_Review` / `CS_別名解決入力`）から先に確認する
- `feedback_response_id_collision_count` が 0 でない場合は、他の作業より優先して報告する

### `経営_例外推移`
何を見るか:
- `Sync_Log` の successful row のうち、例外 / 未マッチ stats を持つ行だけを取り出し、**JST 日次の最終 snapshot** にまとめた trend view
- カラムの `_delta` は直前表示日との差分。正なら増加、負なら減少
- 運用担当者が「直近 7 日で payment / continuation unmatched が増えたか」をすぐ確認するためのビュー

運用担当者が行うこと:
- `payment_unmatched_count_delta`、`continuation_unmatched_count_delta`、`feedback_match_exception_count_delta` が繰り返し正になっていないか確認する
- 増加している場合は、該当 review / input タブ（`CS_入金名寄せ確認`、`CS_継続名寄せ確認`、`CS_別名解決入力`）を先に確認する
- `feedback_response_id_collision_count` またはその delta が 0 より大きい場合は即時 escalate する

### `Sync_Log` (`POTEX DB`)
何を見るか:
- 自動化 job 1 回の実行ごとに追加される 1 行。カラムは `timestamp`（ISO）、`job_name`、`status`（`success` / `error`）、`stats`（`key=value` 改行形式）
- 主な `job_name`: `runCanonicalRefresh` / `runPublishAll` / `runFullRefresh` / `runWritebackCollection` / `dropOrphanStagingFeedback` / `dropOrphanStagingLineRegistration` など
- `経営_例外推移` は、ここに蓄積された successful stats を読み取って作る Executive 向けの時系列ビュー

運用担当者が行うこと:
- 毎日 07:00 JST の `full refresh` 直後に row が追加されているか確認する（`runFullRefresh=success`）
- 30 分 cadence の `runWritebackCollection` が正常に append されているか確認する
- `status=error` の行を見つけた場合は、`stats` の `error=...` メッセージで一次切り分けし、管理者へ escalate する
- `stats` の `feedbackResponseIdCollisions` が 0 か毎回確認する（`経営_データ状況` の collision count と同値）

修正してよいか:
- 不可。append-only ログ。

### `Staging_Customers` raw ingest の見方に関する注意
運用担当者が直接使うシートではありませんが、現在 `SOURCE_CUSTOMERS_WORKBOOK_ID` は設定済みで、`顧客管理` 原本を基準に staging の並びが検証済みです。

意味:
- raw source の総行数と staging 行数は一致しないことがある
- 特に `顧客管理` で名前が空の行は staging refresh で skip される
- 最終 cutover 直前は full refresh をもう一度回し、件数だけ再確認すればよい

---

## 5. 日次運用ルーティン

### Step 1. `CS_要フォロー一覧` を確認
確認ポイント:
- 新しい `P1` 案件があるか
- 特定のコーチに問題が集中していないか
- 強い不満や長文コメントがあるか

### Step 2. `CS_継続対象一覧` を確認
確認ポイント:
- 延長タイミングに入った顧客がいるか
- 後続イベント後に未完了の案件があるか

### Step 3. `CS_例外確認` を確認
確認ポイント:
- 新しい unmatched / review 必要案件があるか
- feedback source に異常がないか

### Step 4. 必要に応じて `CS_別名解決入力`、`CS_入金名寄せ確認`、`CS_継続名寄せ確認` を処理
確認ポイント:
- `P1` 行から優先処理しているか
- 名前表記の揺れかどうか
- email / コーチ / payment / continuation の文脈が一致しているか
- `suggested_action` が `approve_if_context_matches` の行のみを承認対象として見ているか（`search_customer_or_wait_for_customer_ingest` / `hold_no_candidate_found` は保留）
- system suggestion があっても、曖昧なら承認していないか
- `CS_入金名寄せ確認` の header が空、または priority count が stale に見える場合に approval を保留しているか（点検は `inspect_post_refresh_state.py`）
- `CS_継続名寄せ確認` は full refresh / publish 後に `Exceptions_ContinuationMatch` と合わせて確認しているか
- 承認後は手動で次工程を呼ばず、writeback collection（30 分ごと）→ canonical refresh → republish の自動フローを待っているか
- `CS_承認進捗` で `decided_waiting_sync` / `invalid_open` が溜まっていないか

### Step 5. `経営_会議前チェック` → `経営_更新状況` → `経営_データ状況` の順で確認
確認ポイント:
- `overall meeting risk` が `GO` / `GO_WITH_CAUTION` / `CHECK_BEFORE_MEETING` のどれか
- stale / high-risk domain がどのチーム課題か見えているか
- human update omission の可能性があるか
- `critical team issues in meeting scope` が増えている場合、クレーム / 重要案件の漏れがないか
- 値が突然 0 になっていないか
- exception 件数が急増していないか
- follow-up / continuation の数値が不自然に変化していないか
- 特に `followup_queue_count` が 0 なのに DB 側で follow-up 課題が見えている場合は、まず publish 異常を疑う

### Step 6. `Potex Concierge` を開いている場合は `コンシェルジュ_データ状況` を確認
確認ポイント:
- `customer_ingest_mode` が想定どおりか
- `コンシェルジュ_フォロー一覧` の行数が CS follow-up queue と大きくずれていないか
- この workbook が読み取り専用であることを再確認したか

---

## 6. Alias 問題の処理方法

### いつ処理するか
- `CS_例外確認` または `CS_別名解決入力` に unmatched の顧客名が見えるとき
- `CS_入金名寄せ確認` に unmatched payment row が見えるとき
- `CS_継続名寄せ確認` に unmatched continuation row が見えるとき

### 優先順位
1. `CS_入金名寄せ確認` / `CS_継続名寄せ確認` の `P1` から処理する。
   - `P1` は、システムが候補 line registration 行から canonical customer ID をすでに見つけているケースです。
   - `suggested_action` が `approve_if_context_matches` なので、publish カラムの文脈だけ確認して承認できます。
2. 次に `CS_別名解決入力` の明示的な review 行を処理する。
3. `P2` は customer ingest 補強または operator 調査が必要なことが多いため後回しにする。
4. `P3`（`hold_no_candidate_found`）は一致候補自体がないため保留する。

### 処理手順
1. 対象 row を見つける。
2. publish カラム（特に `suggestion_basis`、`candidate_*`、`current_canonical_customer_*`）を確認し、同一人物か判断する。
3. 次の 4 カラムだけ入力する。
   - `operator_decision_status`
   - `operator_selected_customer_id`
   - `operator_selected_customer_name`
   - `operator_note`
4. システムが入れている `current_canonical_customer_id` / `current_canonical_customer_name` をそのまま使う場合、`operator_selected_*` は空欄でもよい（writeback collection 時に fallback される）。
5. 判断が曖昧な場合は status を空欄にし、note のみ残す。
6. writeback / refresh / republish 実行後に結果を再確認する。

### 推奨 status 値
- `approved`: 同一人物として確定
- `active`: 運用上、承認と同義ですでに使っている場合のみ使用
- `resolved`: すでに反映済みの案件を再確認した場合

### 承認後の自動トリガーフロー
運用担当者が status に `approved` などを入力した後は、追加操作なしでシステムが次の cadence で処理します。
1. **writeback collection（30 分ごと）**: operator 入力を読み取り、`Customer_Alias_Map` に `source=cs_payment_alias_review` または `source=cs_continuation_alias_review` として alias 行を追加 / 更新する。
2. **canonical refresh**: `Staging_Customers` / `Staging_Payments` などを alias-aware に再マッチし、canonical シートを更新する。
3. **5-workbook republish**: `POTEX DB` → CS / Executive / Concierge / Sales へ再 publish する。対象 row は review queue から消え、マッチ済み件数は health metric に反映される。
4. **full refresh（毎日 07:00 JST）**: 上記フロー全体を日次で再実行する。

operator が直接 GAS 関数を実行する必要はありません。すぐ反映を確認したい場合のみ、管理者が Apps Script UI から `runWritebackCollect` → `runFullRefresh` を手動実行できます。

### 処理後に確認すること
- 対象の alias / payment / continuation row が review queue から消えたか
- `inspect_post_refresh_state.py`（または同等の点検）で row count が減ったか
- 新しい例外が追加発生していないか
- `経営_データ状況` / `コンシェルジュ_データ状況` の `payment_unmatched_count` / `continuation_unmatched_count` が変化したか

---

## 7. 週次運用ルーティン

### `経営_コーチ負荷` を確認
- コーチごとの active 顧客数に偏りがないか
- follow-up 過多になっていないか

### `経営_顧客リスク` を確認
- 低満足 feedback が増えていないか
- follow-up 必要件数が増えていないか
- 例外件数が増えていないか

### `経営_データ状況` を確認
- row count が極端に減っていないか
- source ingest 失敗と思われる異常がないか

---

## 8. やってはいけないこと
- source workbook を直接修正する
- `POTEX DB` の canonical シートを日常運用画面のように使う
- publish シートに手入力する
- alias 問題を DB 上で直接修正する
- 確信のない名前マッチを `approved` として処理する

---

## 9. 問題が起きたときに見る場所

### 構造を理解したいとき
- `docs/database-overview.md`
- `docs/sheet-reference.md`

### 配備 / 自動化の実行順を確認したいとき
- `PHASE1_CUTOVER_RUNBOOK.md`

### 現在の作業状況を確認したいとき
- `docs/backlog.md`
- `agents/session.md`

---

## 10. 最重要の運用原則
**原本は触らず、運用は役割別 workbook で行い、人が入力するのは input / writeback シートだけにする。**
