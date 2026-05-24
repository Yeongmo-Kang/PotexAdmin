# Partner Pipeline（Inai / Sato）仕様計画

> **Status:** Q1–Q7 は 2026-05-21 に回答済み。**Phase A**（canonical schema の土台整備）は実装着手可能。

**Goal:** フォーム予約段階以降の student 領域（稲井）および career-change/job-hunt 領域（佐藤）の partner pipeline を、partner 自身による meeting / recruitment / POTEX-sale status 入力も含めて、構造化かつ継続的に追跡できるようにする。現在は Slack / LStep の free-text にしか存在しない面談後 status の、最初の canonical 管理先にする。

**Architecture:** canonical database は `POTEX DB` のみを維持する。LStep / TimeRex / Slack は読み取らない。**partner 専用の別 canonical model は作成しない。** 既存の coach canonical を拡張し、partner assignee も `Coaches` / `Customer_Coach_Assignments` で role/scope column により表現する。違いは assignment 後の workflow / view のみとする。

**Tech Stack:** Google Sheets、Apps Script（`potex-gas`）、既存の writeback collection trigger（30 分間隔）。

---

## 1. 背景

### 1.1. 運用チームの要望（要約）
- 稲井 = 人材会社の社長。担当領域は学生。長期インターン紹介から就職まで伴走する授業を運営している。POTEX 商品を学生に代理販売する構造で、インターン収入によりコーチング支払い能力が高まる funnel を持つ。
- 佐藤 = 転職希望者および大学 3〜4 年生の就活生を担当。人材紹介と POTEX 商品の両方を扱う。
- 共通で追跡したい column: 誰が誰を assigned したか / POTEX 商品の紹介・販売状況 / 領域別の進行 status / 最終更新日。
- 追跡開始時点: **顧客化前（面談実施段階）から。** LINE 登録 → 佐藤・稲井へ直接 assign → コーチング販売を試行 → 成否に関係なくインターン・転職相談の再面談へ進む。
- partner 本人が定期的に入力できる必要がある。

### 1.2. 確認済み upstream flow（運用チーム回答、2026-05-19）
1. YouTube 流入
2. LINE 登録
3. Form 予約（ここで学生かどうかを判定） ← **この段階から list 追加を開始**
4. 佐藤 / 稲井 assignment → **カレンダーに入る。assign の主体は CS**
5. 初回面談実施 → **面談中に使用する専用ツールはない**
6. 結果記録 → **営業が Slack に報告し、CS が LStep に記入**（free-text）

### 1.3. これがアーキテクチャ上重要な理由
- ステップ 6 の成果物（インターン接続の有無、POTEX 商品 sale の有無、recruitment の進行状況）が、**構造化された形で system に存在していない。**
- ステップ 4 の assignment trigger は calendar（TimeRex 想定）。CLAUDE.md の TimeRex 保留原則により、calendar API の直接読取は不可。
- 結論: **partner canonical は別に作らない。** CS の assignment 入力は coach / partner を分けず 1 回で統合し、canonical も `Coaches` / `Customer_Coach_Assignments` を拡張して `assignee_kind` / `assignee_scope` などの column で partner を表現する。つまり、データ model も運用 UX も単一 assignment 軸で維持し、配属後の workflow / view のみ分岐させる。

---

## 2. 対象外（意図的に除外）

- LStep API / webhook / writeback
- TimeRex API / calendar 自動読取
- Slack 報告の自動 ingest
- 営業が Slack に書く free-text の構造化 parser
- 稲井 / 佐藤以外の partner への拡張（学生以外の領域で他営業 member を assign するケースなどは、同一 pattern の後続対応とする）

---

## 3. 提案する canonical DB 追加

すべての新規シートは `POTEX DB` に追加する。他 workbook は read-only 表示 / filtered view / writeback input のみとする。

### 3.1. `Coaches` の拡張（partner を含める）
partner roster を `Coaches` に統合する。

| column | type | note |
|---|---|---|
| `partner_id` | string | `PART-XXXX` |
| `partner_name` | string | 正規化された名前（例: `稲井`, `佐藤` — customer `佐藤知子` との同名に注意し、alias を分離） |
| `partner_scope` | enum | `student` / `career_change_and_job_hunt` / `other` |
| `external_role` | string | `稲井: 人材会社社長 + 長期インターン伴走授業` などの free-text |
| `is_active` | bool |  |
| `created_at` | iso8601 |  |
| `last_updated_at` | iso8601 |  |

### 3.2. `Coach_Alias_Map` の拡張（partner alias を含める）
`Coach_Alias_Map` を拡張し、営業報告や form 応答から入る名前ゆれを吸収する。

| column | note |
|---|---|
| `raw_name` |  |
| `canonical_partner_id` |  |
| `source` | `cs_partner_assignment_input` / `seed` など |
| `approved_at` |  |

### 3.3. `Customer_Coach_Assignments` の拡張（partner assignment を含める）
既存の `Customer_Coach_Assignments` を再利用しつつ、**customer 化前の段階（form respondent）も含められるよう** `lead_id` 概念を拡張する。さらに `assignee_kind=coach|partner`、`assignee_scope=student|career_change_and_job_hunt|core_coaching` などの区分 column を持たせる。

| column | note |
|---|---|
| `assignment_id` | `PA-XXXX` |
| `lead_id` | `customer_id` があればそれを使い、なければ form 起点の lead-only id（`LEAD-XXXX`） |
| `customer_id` | nullable。customer へ昇格した時点で埋める |
| `partner_id` |  |
| `assigned_at` |  |
| `assignment_source` | `cs_partner_assignment_input` / `customer_form_default` など |
| `is_active` | bool。解除時は false |
| `assignment_note` | free-text |

> **要判断:** `Leads` を別 table にするか、`Customers` シートに `is_lead_only=true` column を追加するか（Section 7 参照）。

### 3.4. post-assignment status 表（必要なら別表、owner は coach/partner 共通）
partner self-input の結果を蓄積する canonical status snapshot。1 lead × 1 partner あたり 1 行（assignment と 1:1）。

| column | type | note |
|---|---|---|
| `status_id` | string | `PS-XXXX` |
| `assignment_id` | string | 拡張済み `Customer_Coach_Assignments` への FK |
| `lead_id` | string | query を速くするための denormalized column |
| `partner_id` | string | denormalized |
| `meeting_status` | enum | `scheduled` / `done` / `no_show` / `cancelled` |
| `meeting_done_at` | iso8601 | nullable |
| `potex_intro_status` | enum | `not_introduced` / `introduced` / `declined` |
| `potex_sale_status` | enum | `none` / `in_discussion` / `contracted` / `paid` / `lost` |
| `recruitment_status` | enum | `none` / `intern_intro` / `intern_active` / `selection` / `closed` / `lost` / `unreachable` |
| `current_state_label` | string | partner が自由入力する 1 行要約（UI 表示用） |
| `partner_note` | free-text |  |
| `last_updated_at` | iso8601 | partner が入力したタイミングで更新 |
| `last_updated_by` | enum | `partner` / `cs` / `system` |

> **要判断:** `potex_sale_status` が `contracted` / `paid` の場合に、canonical `Plans` / `Payments` とどう整合させるか（Section 7 参照）。

### 3.5. `ConversionHistory` event の拡張（検討事項）
現在: `line_registered` → `lead_created` → `experience_scheduled` → `contracted` → `paid` → `completed` / `lost`

追加候補:
- `partner_assigned` — 拡張 `Customer_Coach_Assignments` の `assignee_kind=partner` row の `assigned_at` を基準に event 発行
- `partner_meeting_done` — Partner_Pipeline_Status.meeting_done_at を基準
- `intern_placed` — recruitment_status が `intern_active` に遷移したとき
- `career_consultation_started` — recruitment_status が `selection` に入ったとき

> **原則衝突に注意:** DB の derive-only 重複禁止原則に従うと、`Partner_Pipeline_Status` が既に存在するなら `ConversionHistory` の追加は publish 時 derive で足りる可能性がある。追加するかどうかは dashboard 要件確定後に決める。

---

## 4. 新しい role workbook

### 4.1. `Potex Inai`（学生領域 assignee workbook/view）
役割: 表示 + partner 入力。

タブ:
- `Inai_README` — 利用方法（入力すべき column、入力頻度、迷った場合の問い合わせ先）
- `Inai_Assigned_Leads`（read-only）— 現在の active assignment 一覧。partner_id=稲井 の row を表示。公開 column は次の通り:
  - `lead_id`, `display_name`, `assigned_at`, `meeting_status`, `current_state_label`, `recruitment_status`, `potex_intro_status`, `potex_sale_status`, `last_updated_at`
- `Inai_Status_Input`（partner write）— `assignment_id` 基準で status を更新。入力 column:
  - `assignment_id`（drop-down または lookup）, `meeting_status`, `meeting_done_at`, `potex_intro_status`, `potex_sale_status`, `recruitment_status`, `current_state_label`, `partner_note`, `submit=TRUE` チェック
- `Inai_Data_Health`（read-only）— assignment 数、`last_updated_at` 分布（例: 30 日以上未更新 N 件）、state 分布

### 4.2. `Potex Sato`（転職・就活領域 assignee workbook/view）
同一構成。partner_id=佐藤 で filter する。

### 4.3. 代替案: 単一 `Potex Partners` workbook の 2-tab 構成
運用を簡素化するため、単一 workbook の中に `Inai_*` / `Sato_*` タブを置く案。欠点: 2 人の partner が互いの status を閲覧できる（情報分離要件があるかは Section 7 の質問で確認）。

---

## 5. CS 側入力

### 5.1. `CS_担当割当入力`（統合案、Potex CS workbook）
CS が form respondent / customer を **担当者として 1 回だけ割り当てる**ための入力。ここでの担当者は coach または partner のいずれでもよい。運用工数削減のため `CS_別名解決入力` と同様の input pattern を使い、**coach 割当と partner 割当を別タブ・別行にはしない。**

| column | note |
|---|---|
| `lead_id` または `form_response_row_ref` |  |
| `assignee_type` | `coach` / `partner` |
| `assignee_name` | coach 名、または `稲井` / `佐藤` |
| `assignment_note` |  |
| `operator_decision_status` | `approve` / `discard` |
| `operator_decision_at` |  |
| `sync_status` | `pending` / `processed` / `error_*`（system） |

writeback collection（30 分間隔）がこれを取り込み、常に **拡張済み `Customer_Coach_Assignments`** へ upsert する。downstream view の分岐は `assignee_type` / `assignee_scope` の値で行う。

**運用原則:** CS は割当事実を 1 回だけ入力する。partner が関与する lead でも、別個の partner-assignment canonical は作成しない。

### 5.2. Form respondent → lead seed
- `フォームの回答` ingest で学生かどうかを判定し、`is_lead_only=true` の Customer（または Lead）を自動生成
- `CS_Partner_Assignment_Input` で CS が partner を割り当て
- partner workbook に row が表示される

---

## 6. Writeback chain

`CS_Partner_Assignment_Input` の処理（既存 pattern）:
1. 30 分 writeback trigger → `collectCsWritebackRows`
2. `approve` の場合、拡張済み `Customer_Coach_Assignments` を upsert し、必要なら `Coach_Alias_Map` を更新
3. `Customer_Alias_Map` と同様に assignment source を記録
4. canonical refresh → publish all（5-workbook）

`*_Status_Input`（partner workbook）の処理（新規 writeback path）:
1. 30 分 writeback trigger → 新規 `collectPartnerStatusWritebackRows`
2. `submit=TRUE` row のみ処理。partner_id は workbook 自体に固定 binding し、入力者の偽装を防ぐ
3. post-assignment status 表（または同じ表の status columns）を upsert し、`last_updated_by=partner`、`last_updated_at=now` を設定
4. `sync_status=processed` を付与
5. canonical refresh + republish（chain は既存 `runWritebackCollection` に統合）

---

## 7. 決定事項（運用チーム回答反映）

### Q1. Lead 識別単位 — **確定**
- **運用決定:** 追跡開始は **form 予約から**。ただし将来的な LINE linkage の可能性は残す。
- **設計反映:** Phase A/B では LINE 登録全体を partner pipeline に含めない。`フォームの回答` を基準に lead seed を生成し、後から必要になれば `lead_id -> line_registration_id` の接続 column / lookup を additive に追加できる設計にする。
- **実装決定:** まだ別 `Leads` table は作らず、`Customer_Partner_Assignments.lead_id` に `customer_id` または form 起点の provisional id を入れる方式で開始する。customer-only surface に `is_lead_only` filter を強制する全面 cutover は現時点では scope 外。

### Q2. POTEX 商品 sale status の整合性 — **確定**
- **運用決定:** 契約 / 入金の正本は既存の `Plans` / `Payments`。
- **設計反映:** partner 側 status は partner 視点の進捗までに限定する。canonical sale fact の正本として partner workbook 入力を使わない。
- **実装決定:** `potex_sale_status` enum は `none` / `introduced` / `in_discussion` / `lost` などの lightweight 状態で開始し、`contracted` / `paid` は partner 入力 enum から除外する。必要なら publish view で `Plans` / `Payments` の join 結果を別の read-only column として表示する。

### Q3. Recruitment status enum 合意 — **確定**
- **運用決定:** まず実装し、後で修正可能にする。
- **設計反映:** enum は初期段階では最小集合で開始するが、sheets validation / publish mapping / writeback parser が additive change に強いように設計する。
- **初期 enum 提案:** `none`, `intern_intro`, `intern_active`, `selection`, `closed`, `lost`, `unreachable`。
- **実装原則:** enum 変更が必要になっても、DB migration なしで dropdown / validation / display label だけを追加・修正できる構成にする。

### Q4. Partner 情報分離 — **確定**
- **運用決定:** workbook を分離する。
- **設計反映:** partner 専用 canonical は廃止するが、partner-facing workbook / view は維持できる。つまり canonical は `Coaches` 軸に統合し、publish surface のみ `Potex Inai` / `Potex Sato` に分ける。

### Q5. CS 報告 / LStep 記入と partner self-input の責務分岐 — **確定**
- **運用決定:** partner 主入力 + CS が例外的に補完。
- **設計反映:** 基本 write path は partner-facing workbook / view の status input とする。ただし canonical owner table は `Coaches` 軸の単一 model を維持する。
- **実装順序:** 最初の slice では `last_updated_by` に `partner` / `cs` を記録できるようにし、CS override 専用タブは後続 Phase C+ で追加要否を判断する。

### Q6. CS assignment の運用方式 — **修正決定**
- **運用決定:** CS から見れば、coach 割当と partner 割当は **同じ assignment 行為**。したがって入力 layer は統合し、担当者タイプだけを区別する。
- **意味:** calendar / Slack / LStep を見ながら CS が構造化入力を残す際、同じ lead に対して coach と partner を別管理すると二重工数になる。これを避けるため、CS は **1 回の担当者割当入力**だけを行い、その結果が downstream で coach canonical / partner canonical に分岐する。
- **設計反映:** `CS_Partner_Assignment_Input` 単独運用は廃止方向。最終運用案は `CS_担当割当入力` の統合 surface + `Coaches` 軸の単一 canonical。最小 column は `lead_id(or response key)`, `assignee_type`, `assignee_name`, `assignment_note`, `operator_decision_status`, `sync_status`。

### Q7. 入力頻度 / SLA — **確定**
- **運用決定:** stale / no-update 警告は **CS と partner 本人**の双方に見えるようにする。
- **設計反映:** `Inai_Data_Health` / `Sato_Data_Health` と `Potex CS` 側 monitor の両方に stale count を表示する。
- **保留:** 正確な SLA 文言（例: 週 1 回 / 面談直後）は後続の運用文言で確定するが、構造としては `30日以上未更新` warning をすぐに入れられるようにする。

---

## 8. 実装フェーズ（open question 解消後）

### Phase A: canonical schema のみ（UI なし）
- `Coaches` schema 拡張（`assignee_kind`, `assignee_scope`, `external_role` など）
- `Customer_Coach_Assignments` schema 拡張（`lead_id`, partner 互換 metadata）
- 稲井 / 佐藤 を `Coaches` の seed row に追加
- 既存 `canonical/partners.ts` は削除、または `coaches` 側の migration helper として吸収

### Phase B: CS assignment input
- `CS_担当割当入力` 統合タブ
- writeback は常に拡張済み `Customer_Coach_Assignments` へ upsert
- form respondent → lead seed flow

### Phase C: partner-facing workbooks/views
- `Potex Inai` / `Potex Sato` の provisioning
- publish（`Inai_Assigned_Leads`, `Inai_Status_Input`, `Inai_Data_Health`）
- status writeback は assignee_kind=partner の row を対象に動作

### Phase D: dashboard / event 拡張
- `ConversionHistory` に partner 関連 event を追加（Q2 の決定に応じて）
- `経営_データ状況` / `コンシェルジュ_データ状況` に partner pipeline 指標を表示

各 phase の最後に inspect script で verdict を取得し、backlog を更新する。

---

## 9. リスク

- **partner 入力漏れ** → status が永続的に stale になる。Q5 / Q7 の合意で緩和。
- **lead と customer の model 分岐** → 設計を誤ると `Customers` query 全体に filter 負荷がかかる。Q1 の決定が重要。
- **名前衝突** → 既存 customer `佐藤知子` と assignee `佐藤` の同名リスク。ただし別 partner table を作らず `Coaches` 内で `coach_id` / `assignee_kind` により識別すれば衝突なく運用可能。
- **TimeRex / LStep を迂回する限界** — CS が assignment 情報をどこで見て input シートに記入するのか（form 応答を直接見るのか、Slack なのか、LStep なのか）。もし LStep を見ながら入力するなら、新たな LStep 依存が生じる。Q5 と合わせて確認が必要。

---

## 10. Owner / next action

- **Owner:** Hermes（orchestration）+ Claude（spec drafting、合意後の実装）
- **Next action:** 別 partner canonical の導入を中止し、`Coaches` / `Customer_Coach_Assignments` 拡張案へ spec / code を再整理する
- **Coding gate:** ユーザーの設計決定反映完了後、migration / refactor slice に進行可能。
