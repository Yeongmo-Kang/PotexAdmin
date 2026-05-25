# POTEX DB スキーマ

更新: 2026-05-20

## この文書で分かること
「`POTEX DB` の中にどの表があり、各表が何を意味し、どのカラムを持つのか」を説明します。

運用チームが日常的に見るのは 7 つの role workbook（`Potex CS` / `Executive` / `Concierge` / `Sales` / `Coaches` / `Sato` / `Inai`）です。これらの workbook はすべて、この DB の表を読んで構築されます。**DB は会社の単一の事実原本（canonical）です。**

## 共通ルール
- **すべての表は末尾に `created_at`、`updated_at` の 2 カラムを持つ。**
  - `created_at`: その行が最初に作られた時点。可能であればドメイン時刻（`submitted_at` / `contract_date` / `registered_at` など）、なければその refresh の `syncedAt`
  - `updated_at`: その行を最後に書き直した時点（`syncedAt`）
- `syncedAt` は 1 回の refresh で 1 度だけ生成され、すべての build 関数に渡される
- pipeline が毎回書き直す表（`clearAndRewrite`）では、コード内の header 定数が truth である。シートに手動でカラムを追加しても次の refresh で消える
- 手動 / 外部 ingest 表では `ensureAuditColumns()`（`canonical/ingest.ts`）が idempotent に `created_at` / `updated_at` を保証し、空セルを backfill する
- **derive 可能な値は DB に保存しない。** 他カラム / 他表から 100% 再計算できるなら、publish 時 join で作る（例: attribution channel breakdown）

## 表一覧（役割ベース）

| 表名 | 役割 | 利用先 |
| --- | --- | --- |
| `Customers` | 顧客 1 行。会社が認識する全顧客の master | すべての workbook |
| `Coaches` | コーチ 1 行。社内コーチ master | Coaches / Executive |
| `Sessions` | セッション単位の fact table 予定地。現在は空 | 未使用 |
| `Feedback` | 月次 / 最終満足度回答 1 行。顧客 / コーチに join 済み | CS / Coaches / Executive |
| `Plans` | 顧客が持つ coaching / continuation plan 1 行（1 顧客 N plan） | Sales / Executive |
| `Payments` | payment（成約 / 着金）1 行。plan に link | Sales / Executive |
| `ConversionHistory` | 顧客状態変化履歴（`line_registered` → `lead_created` → `contracted` → `paid` → `completed` / `lost`） | Sales / Executive |
| `Customer_Coach_Assignments` | 顧客 ↔ 担当 coach / partner の対応。`active` / `unresolved` と post-assignment status を含む | Coaches / partner views |
| `Customer_Channel_Links` | 顧客 ↔ 外部チャネル（現状は LINE）の ID 対応 | 内部 join 用 |
| `Line_Registrations` | LINE 友だち追加 1 行（`LStep` CSV ingest target） | 内部 join 用 |
| `Customer_Alias_Map` | 非正規顧客名 → canonical `customer_id` | すべての matching |
| `Coach_Alias_Map` | 非正規コーチ名 → canonical `coach_id` | matching |
| `Exceptions_FeedbackMatch` | マッチ失敗した feedback 応答キュー | CS 運用担当者 |
| `Exceptions_ContinuationMatch` | マッチ失敗した continuation plan キュー | CS 運用担当者 |
| `Ops_Feedback_Review` | publish-ready feedback review row | Concierge / CS |
| `Ops_Followup_Queue` | publish-ready follow-up queue | CS / Concierge |
| `Ops_コーチ_担当負荷` | publish-ready コーチ負荷要約 | Executive / Coaches |
| `Ops_Continuation_Targets` | publish-ready 継続提案対象 | CS |
| `Ops_ZeroSession_Review` | 週次 QA: 0-session 可能性の確認 | CS |
| `Sync_Log` | refresh / publish / writeback の実行ログ（append-only） | システム |
| `Sync_Control` / `Publish_Manifest` | システムトグル / マニフェスト | システム |

内部 mirror（`Staging_Customers` / `Staging_Payments`）は、外部 workbook ingest 直後の raw ミラーです。運用担当者が直接見る想定はなく、ingest を DB 直接書き込みへ段階移行しながら削除予定です（P-012）。`Staging_LineRegistration` は P-012 Phase 1 で `Line_Registrations` に吸収済みです。`Staging_Feedback` は P-012 Phase 2 step 2d（2026-05-20）で吸収済みで、現在は ingest が `Feedback` / `Exceptions_FeedbackMatch` に直接書き込みます。本書では canonical 表を中心に説明します。

---

## 1. 顧客 / コーチ master

### 1.1 `Customers` — 顧客 1 行
会社が認識する全顧客の単一 master。ほかの表の `customer_id` はすべてここを参照します。

主要カラム:
| column | 説明 |
| --- | --- |
| `customer_id` | primary key |
| `customer_name` | 本名。publish / matching の基準名 |
| `email` / `phone` | 連絡先 |
| `line_registration_id` | `Line_Registrations.line_registration_id`（pipeline が設定） |
| `assigned_coach_name` / `course_name` | 現在の担当コーチ名 / コース名 |
| `current_status` | `active` / `completed` などの lifecycle 状態 |
| `continuation_tag` | 継続提案シナリオタグ |
| `program_completed_flag` | 受講終了 boolean |
| `created_at` / `updated_at` | 行の生成 / 更新時刻 |

追加の運用カラムはシート header をそのまま使います（header 名で読むため順序は不問）。

### 1.2 `Coaches` — コーチ 1 行
社内コーチ master。`coach_id` を primary key とし、`coach_name` と、運用チームがシートで追加したメタデータ（専門分野、稼働状況など）を持ちます。`created_at` / `updated_at` を保証します。

> 設計メモ（2026-05-21）: partner 役割（例: 稲井 / 佐藤）は別 canonical table に分けるより、この `Coaches` 表に `assignee_kind=coach|partner`、`assignee_scope` などのカラムを追加して吸収する方針が現時点の第一案です。

### 1.3 `Sessions` — セッション fact（現在空）
将来的な 1 セッション = 1 行の fact table 用領域です。ingest は未実装で、現時点では `session_id` / `created_at` / `updated_at` のみ定義されています。

---

## 2. 満足度 / feedback

### 2.1 `Feedback` — 月次 / 最終満足度回答
顧客 / コーチにマッチした feedback のみが入ります。マッチしない行は `Exceptions_FeedbackMatch` に残ります。

| column | 説明 |
| --- | --- |
| `feedback_id` | `FDBK-####` |
| `response_id` | `resp_{12hex}` SHA-256 hash。dedupe key。`source_sheet` + `submitted_at` + `respondent_email` + `raw_coach_name` から計算 |
| `session_id` | 将来 `Sessions` と結合するための予約カラム |
| `customer_id` / `customer_name` | matched customer |
| `coach_id` | matched coach |
| `feedback_date` | 回答時刻 |
| `feedback_type` | `monthly` / `final` |
| `rating` | 満足度スコア |
| `nps_score` / `nps_category` | NPS スコア / promoter・passive・detractor |
| `progress_score` / `expectation_score` / `community_score` | 項目別スコア |
| `comment` | 自由記述 |
| `followup_needed` | follow-up が必要かどうか |
| `note` | matching 経路 trace（`resolved_by_customer_alias_map` など） |
| `respondent_name` / `respondent_email` | 回答者識別用 |
| `created_at` / `updated_at` | 回答時刻 / 最終更新時刻 |

> P-012 Phase 2 step 2c（2026-05-20）で `source_sheet` / `source_row` カラムは削除されました。dedupe は `response_id` hash 単独です。

### 2.2 `Ops_Feedback_Review` — publish-ready review 行
`csWriteback` が作成します。`コンシェルジュ_フォロー一覧` と CS review view の直接 source です。dedupe key は `feedback_id` です。

主要カラム: `feedback_id` / `feedback_date` / `feedback_type` / `customer_id` / `customer_name` / `coach_id` / `coach_name` / `satisfaction_score` / `nps_score` / `nps_category` / `progress_score` / `expectation_score` / `low_satisfaction_flag` / `needs_followup_flag` / `followup_reason` / `comment` / `gap_comment` / `created_at` / `updated_at`

---

## 3. 営業 / payment

### 3.1 `Plans` — 顧客 plan 1 行
1 人の顧客が base coaching と continuation plan を含めて複数行を持つことがあります。

| column | 説明 |
| --- | --- |
| `plan_id` | `PLAN-####` |
| `customer_id` | 1:N |
| `plan_name` | 最新 payment の plan name を優先し、なければ customer `course_name` |
| `plan_type` | `coaching`（base） / `continuation` |
| `sessions_included` | `6か月` → 24 など、plan name から抽出 |
| `contract_date` | 成約日 |
| `start_date` | `matching_contact_date` + 3 日、または最初のセッション |
| `end_date` | `completed` のときのみ最終セッション / after-follow 日付 |
| `amount_tax_included` | 最新 payment 金額 |
| `status` | 顧客 lifecycle の正規化値 |
| `note` | `sales_owner` / segment / メモなど |
| `created_at` / `updated_at` | `contract_date` / `syncedAt` |

### 3.2 `Payments` — payment 1 行
`Staging_Payments` の 1 行 = `Payments` の 1 行です。`customer_id` が空の行は unmatched queue として扱います。

| column | 説明 |
| --- | --- |
| `payment_id` | `PAY-####` |
| `customer_id` | matched customer |
| `plan_id` | 同一 customer の最初の `plan_id` |
| `payment_date` | `paid_date` → `contract_date` → `experience_date` |
| `amount` | 金額（数値） |
| `payment_method` | 現在は空 |
| `payment_status` | `paid` / `pending` |
| `invoice_number` | 現在は空 |
| `note` | `sales_owner` / segment / `plan_name` / メモ |
| `created_at` / `updated_at` | `payment_date` / `syncedAt` |

### 3.3 `ConversionHistory` — 顧客状態変化履歴
顧客の lifecycle event を時系列で蓄積します。

| column | 説明 |
| --- | --- |
| `event_id` | `EVT-####` |
| `customer_id` | 対象顧客 |
| `event_date` | yyyy-mm-dd |
| `from_status` / `to_status` | 直前の `to_status` → 今回の `to_status` |
| `event_type` | `line_registered` / `lead_created` / `experience_scheduled` / `contracted` / `paid` / `completed` / `lost` |
| `changed_by` | どのドメインから発生したか（`顧客管理` / `体験者一覧` / `着金管理マスター` / `lstep_ryu` など） |
| `note` | 補助メタデータ（多くは空） |
| `created_at` / `updated_at` | `event_date` / `syncedAt` |

dedupe key: `customer_id || event_date || event_type || note`。同じ顧客・同じ日付・同じイベントが複数ドメインから報告された場合は 1 行にまとめます。

---

## 4. 顧客 ↔ コーチ / チャネル

### 4.1 `Customer_Coach_Assignments` — 担当割当マッピング
1 customer × 1 assignee の組み合わせ = 1 行です。コーチだけでなく partner assignment もこの表で扱います。

| column | 説明 |
| --- | --- |
| `assignment_id` | `assign_{customer_id or lead_id}_{coach_id または normalized name}` |
| `lead_id` | form respondent 段階も含む上位識別子。customer 変換前は provisional id の場合あり |
| `customer_id` / `coach_id` | join key。`coach_id` がない場合は `unresolved` |
| `lead_display_name` / `respondent_email` / `phone` / `age` | lead / customer 表示用、および partner workbook 表示用 snapshot |
| `source_sheet` / `source_row` | form response trace（lead-only row の audit 用） |
| `role` | 現状は `primary` / `partner` 中心 |
| `assignee_kind` | `coach` / `partner` |
| `assignee_scope` | `core_coaching` / `student` / `career_change_and_job_hunt` など |
| `assignment_status` | `active` / `unresolved` |
| `assigned_at` | `matching_contact_date` → customer `created_at`、または CS writeback 時刻 |
| `assignment_source` | `source_customer_snapshot` / `cs_assignment_input` など |
| `meeting_status` / `meeting_done_at` | partner の post-assignment 進行状況 |
| `potex_sale_status` | `none` / `introduced` / `in_discussion` / `lost` |
| `recruitment_status` | `none` / `intern_intro` / `intern_active` / `selection` / `closed` / `lost` / `unreachable` |
| `partner_status_note` | partner / CS が残した進行メモ |
| `last_partner_update_at` / `last_partner_updated_by` | partner status 最新更新の audit |
| `ended_at` | 予約カラム。終了時刻 |
| `note` | raw coach 名 / assignment note など |
| `created_at` / `updated_at` | `assigned_at` / `syncedAt` |

### 4.2 `Customer_Channel_Links` — 外部チャネル ID マッピング
「この顧客の LINE / IG / ... の user ID は何か」にだけ答える表です。**流入チャネル（`yt` / `ig` / `tt` / ...）統計とは混同しないこと。** 流入情報は DB に保存せず、publish 時に `tokenizeAttributionTags()` で derive します。

| column | 説明 |
| --- | --- |
| `channel_link_id` | `link_{customer_id}_{line_registration_id}` |
| `customer_id` | join key |
| `channel_type` | 現在は `line` |
| `channel_user_id` | `LStep` の `line_user_id` |
| `channel_record_id` | `Line_Registrations.line_registration_id` |
| `is_primary` | 最新 `registered_at` row のみ `TRUE` |
| `link_status` | 現在は `active` |
| `registered_at` | LINE 友だち追加時刻 |
| `note` | `segment=...`、`line_name=...` などのメタデータ |
| `created_at` / `updated_at` | `registered_at` / `syncedAt` |

### 4.3 `Line_Registrations` — LINE 友だち追加 1 行（canonical）
`LStep` CSV（`csvA` / `csv_potex`）から ingest される LINE 登録 master です。`Customer_Channel_Links.channel_record_id` の join 先です。P-012 Phase 1 で導入されました（2026-05-20）。`Staging_LineRegistration` は吸収済みです。

| column | 説明 |
| --- | --- |
| `line_registration_id` | PK。`line_{segment}_{line_user_id}`（`line_user_id` が空の行は 0 件確認済み） |
| `segment` | `ryu` / `potex` |
| `line_user_id` | `LStep` の `ID` |
| `display_name` / `line_registration_name` / `real_name` | LINE 表示名 / 登録名 / 本名 |
| `registered_at` | 友だち追加日時（yyyy-mm-dd） |
| `gender` / `age` / `occupation` / `income` / `goal` | `LStep` 応答カラム |
| `attribution_tags` | `YT_` / `PT_` / `IG_` / `TT_` / `TIK_` / `LP_` / `SDP_` / `【流入】` prefix カラムのうち truthy なカラム名を `;` で連結。publish 時に `tokenizeAttributionTags()` で token 変換 |
| `customer_id` / `customer_match_method` | `Customers` + alias matching 結果 |
| `created_at` / `updated_at` | `registered_at` / `syncedAt` |

⚠ source 座標（`source_sheet` / `source_row`）カラムは持ちません。CSV を再 import しても `line_registration_id` で安定識別します。

---

## 5. Alias マッピング（名前 → ID）

### 5.1 `Customer_Alias_Map`
「`着金管理マスター` にある `田中(山田)` は誰か」のような非正規名を canonical `customer_id` に接続します。運用担当者が alias review 入力シート（`CS_別名解決入力` / `CS_入金名寄せ確認` / `CS_継続名寄せ確認`）で承認すると、writeback がここへ書き込みます。

| column | 説明 |
| --- | --- |
| `alias_name` | 非正規名（シートに出たままの文字列） |
| `canonical_customer_id` | マッピング先 |
| `canonical_customer_name` | 参照用（refresh 時は customer 表が truth） |
| `status` | `approved` / `active` / `resolved` のいずれかなら有効 |
| `confidence` | `operator_review` など |
| `source` | どの入力シートで承認されたか |
| `respondent_email` / `related_coach_name` | feedback alias の場合に有効 |
| `evidence` | feedback 承認は `response:{response_id}`、payment / continuation 承認は `{source_sheet} row {source_row}` |
| `note` | operator note の結合結果 |
| `created_at` / `updated_at` | 初回承認時刻 / 最終更新時刻 |

⚠ alias 承認では audit が重要です。`evidence` + `updated_at` + `source` により、誰がいつ何を根拠に承認したか追跡できます。

### 5.2 `Coach_Alias_Map`
コーチ名に対する同種のマッピングです。手動管理されます。`ensureAuditColumns` が audit カラムを保証します。

---

## 6. マッチ失敗キュー（Exceptions）

マッチできなかった行は canonical に入らず、ここに溜まります。運用担当者が alias を承認すると、次回 refresh で canonical に昇格し、キューから消えます。

### 6.1 `Exceptions_FeedbackMatch`
feedback 応答のうち `coach_id` または `customer_id` が空の行です。ingest が raw 応答をここへ直接書き込みます（2d）。alias 承認後、次回 refresh で `Feedback` に昇格します。

| column | 説明 |
| --- | --- |
| `response_id` | `resp_{12hex}` SHA-256 hash。alias 承認後の canonical `Feedback` dedupe key |
| `submitted_at` | 回答時刻 |
| `respondent_name` / `respondent_email` | 回答者 |
| `raw_coach_name` | シートに記載されたコーチ名 |
| `canonical_coach_name` | matched coach（あれば） |
| `coach_id` | matched coach id（あれば） |
| `feedback_type` | `monthly` / `final` |
| `satisfaction_score` / `nps_score` / `nps_category` | 満足度 / NPS |
| `progress_score` / `expectation_score` / `community_score` | 項目別スコア |
| `q_gap` / `free_comment` | 自由記述 |
| `issue` | `coach_unmatched` / `customer_unmatched` |
| `note` | 補足説明 |
| `created_at` / `updated_at` | `submitted_at` / `syncedAt` |

### 6.2 `Exceptions_ContinuationMatch`
`継続プラン管理` の行のうち customer matching に失敗したものです。

| column | 説明 |
| --- | --- |
| `raw_name` / `cleaned_name` | シート記載名 / 正規化後 |
| `raw_plan` / `raw_contract_date` / `raw_amount` | シート原文 |
| `issue` | `continuation_customer_unmatched` |
| `note` | 補足説明 |
| `source_sheet` / `source_row` | alias 承認後の dedupe に必要 |
| `created_at` / `updated_at` | 正規化した `contract_date` / `syncedAt` |

---

## 7. 運用 derived 表

運用担当者が直接見るための表ではなく、publish workbook の直接 source になる表群です。現在、一部は運用チームが外部ツールで build して DB に取り込んでいます（Phase 1 verdict: accept）。すべて `ensureAuditColumns` で audit カラムを保証します。

| 表 | upstream / 用途 |
| --- | --- |
| `Ops_Followup_Queue` | CS / Concierge follow-up queue の原本 |
| `Ops_コーチ_担当負荷` | Executive・Coaches 向けコーチ負荷要約の原本 |
| `Ops_Continuation_Targets` | CS 継続提案 queue の原本 |
| `Ops_ZeroSession_Review` | 週次の 0-session 可能性確認 |

主要カラムは各 publish view にそのまま渡されます（`priority`、`customer_id`、`customer_name`、`assigned_coach_name`、`followup_reason`、`owner` など）。

---

## 8. システム表

### 8.1 `Sync_Log`（append-only）
| column | 説明 |
| --- | --- |
| `timestamp` | 実行時刻（`new Date().toISOString()`） |
| `job_name` | `runFullRefresh` / `runPublishAll` / `runWritebackCollection` など |
| `status` | `success` / `error` |
| `stats` | key-value 形式の統計 dump（`key=value` 改行形式） |

⚠ append-only のため `updated_at` は意味を持たず、追加しません。

### 8.2 `Sync_Control` / `Publish_Manifest`
システムトグル / マニフェストです。一般運用担当者が直接使う対象ではありません。

---

## 9. カラム追加 / 変更ガイド
1. pipeline が書き込む表（`Plans` / `Payments` / `Feedback` / `ConversionHistory` / `Customer_Coach_Assignments` / `Customer_Channel_Links` / `Exceptions_*` / `Ops_Feedback_Review`）は、コードの header 定数を修正し、row builder で値を emit する
2. 手動管理表（`Customers` / `Coaches` / `Sessions` / `Coach_Alias_Map` / `Customer_Alias_Map` / `Ops_Followup_Queue` / `Ops_コーチ_担当負荷` / `Ops_Continuation_Targets`）は、シート header に直接追加する。pipeline は header 名で読むため順序は不問
3. publish 時 join が必要なカラムなら `publish/*.ts` で read header を追加する
4. **`created_at` / `updated_at` は新しい表でも必ず末尾に置く。** 例外は `Sync_Log` のみ
5. DB に derive-only カラムを追加しない。他カラムから計算可能なら publish 時 join で表現する
