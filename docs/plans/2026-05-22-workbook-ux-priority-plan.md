# Potex Workbook UX 優先度プラン

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Potex の管理 workbook 全体について、operator 影響・入力リスク・意思決定価値の高い順に usability を改善する。

**Architecture:** workbook を単なるデータ出力ではなく、役割別 UI として扱う。優先するのは、人が判断する・入力する・仕分けする sheet。次に manager dashboard。その後に read-only の参照面を整える。`POTEX DB` は daily operator surface ではないため、admin-safe readability を除いて優先度は低めにする。

**Tech Stack:** Google Sheets API via `googleapiclient`, 既存 Apps Script publish/writeback pipeline, Potex managed workbook (`Potex CS`, `Potex Executive`, `Potex Concierge`, `Potex Sales`, `Potex Coaches`, `POTEX DB`).

---

## Evidence Snapshot (2026-05-22)

### Legacy workbook の確認結果 (2026-05-23)
- Apps Script code だけでなく、live sheet `POTEX_顧客管理_v2 のコピーテスト用 のコピー` を実際に確認した
- README-first / role-tab 構成が、日本語 spreadsheet 中心の operator に合っていると確認した
  - `__README`
  - `商談リスト`
  - `コンシェルジュ業務`
  - `受講者管理`
  - `AFS面談管理`
  - `AFS受講管理`
  - `入金管理`
  - `コースマスター`
  - `コーチマスター`
  - `テンプレ`
  - `返金管理`
  - `0_集計用ビュー`
  - `債権履歴`
  - `債権サマリー`
- `__README` は operator 向け landing page として機能し、日本語ルール説明、色による強調、実務メモがある
- 結論: この workbook は **UX / 表現の見本** として使う。architecture の見本としては使わない。日本語 naming、README-first、role-tab の考え方は再利用するが、sheet 間 formula 依存や sheet-as-DB は持ち込まない

### すでに改善済み
- `Potex CS`: すべての tab に frozen headers, filters, tab colors を適用済み。input / review sheet の UX も強化済み
- `Potex Executive`: すべての tab に frozen headers, filters, tab colors を適用済み。主要 summary tab に signal 型 conditional formatting も適用済み

### まだ未着手 / 改善不足
- `Potex Concierge`: 3 tab すべて `frozenRows=0`, `hasFilter=false`, `conditionalRuleCount=0`
- `Potex Sales`: 5 tab すべて `frozenRows=0`, `hasFilter=false`, `conditionalRuleCount=0`
- `Potex Coaches`: 4 tab すべて `frozenRows=0`, `hasFilter=false`, `conditionalRuleCount=0`
- `POTEX DB`: ほぼ全 tab で filter / freeze / admin 向け視認性が弱い。短期的には許容可

### チーム影響の要約
- **CS**: 日次運用負荷が最も高く、入力ミスの危険も高い。大部分はすでに対応済み
- **Executive**: 意思決定価値が高い。入力リスクは低い。大部分は対応済み
- **Sales**: active queue + 契約 + 未入金があり、次に business leverage が高い
- **Coaches**: 日常的に follow-up 情報を読む面で、読みやすさが重要
- **Concierge**: read-only だが文脈確認に使うため、中程度の価値
- **DB/Admin**: frontline UX の優先度は低いが、後で admin/debug readability は上げたい
- **Cross-workbook consistency**: 未整備 workbook が baseline parity に達したら、README tone・tab naming・operator wording を legacy workbook に寄せる

---

## 優先度の考え方
各 workbook を次の 3 軸で見る。

1. **Human input risk** — UI が分かりにくいと誤入力や writeback failure が起きるか
2. **Decision urgency** — 今日どの行を動かすか判断する workbook か
3. **Business leverage** — 改善すると売上・継続・エスカレーションにすぐ効くか

### 最終優先順
1. **Potex Sales**
2. **Potex Coaches**
3. **Potex Concierge**
4. **POTEX DB**
5. **CS / Executive の second pass**

理由:
- CS / Executive は最優先で、すでにかなり改善済み
- Sales は未着手で、かつ business 影響が大きい
- Coaches は日常的に urgent follow-up を見るため次点
- Concierge は read-only で規模も小さいのでその後
- DB は admin-only のため role workbook より後
- CS / Executive は、他 workbook が最低ラインに揃ってから second pass を行う

---

## Workbook ごとのプラン

## Phase 1 — Sales

**Why first:**
- 売上・契約・未入金の active view を持つ
- baseline UX 改善がまだゼロ
- `pending` / `paid`、P0/P1、canonical linkage の読み違いが business に直撃する

### 対象 sheet
- `営業_契約一覧`
- `営業_未入金一覧`
- `営業_ファネル推移`
- `営業_データ状況`
- `営業_使い方`

### UX 目標
- すべて header freeze
- sheet ごとに重要な左列を 1〜2 列 freeze
- すべて filter 追加
- 行動優先度 queue に `P0`, `P1`, `P2`, `P3` 色分け
- payment state / canonical 未一致 / pending を強調
- `営業_データ状況` を `経営_データ状況` に近い signal 型 summary にする
- date / amount 列を読みやすく format
- note / status 列があれば広げる

### tab ごとの意図
- **`営業_契約一覧`**: `pending`、canonical customer 空欄、最優先行を強調
- **`営業_未入金一覧`**: `P0/P1`、canonical customer 未確定、owner 情報を見やすくする
- **`営業_ファネル推移`**: date / event / customer を読みやすくする
- **`営業_データ状況`**: problem 指標は赤、健全指標だけ必要に応じて緑
- **`営業_使い方`**: 色の意味と読み順を説明

---

## Phase 2 — Coaches

**Why second:**
- coach は urgent follow-up / customer-risk 情報を直接見る
- `コーチ_要フォロー一覧` は長文 comment と重い文脈を含むため、視認性が重要
- UX はまだ未着手

### 対象 sheet
- `コーチ_担当負荷`
- `コーチ_要フォロー一覧`
- `コーチ_データ状況`
- `コーチ_使い方`

### UX 目標
- header と識別列を freeze
- 全 tab に filter
- `P1` 行と低満足度 alert を強調
- comment / gap comment 列を広げて wrap
- `コーチ_担当負荷` で残 capacity マイナスを signal 化
- `コーチ_データ状況` を manager-friendly な health block にする

### tab ごとの意図
- **`コーチ_担当負荷`**: 余力不足と follow-up 負荷を強調
- **`コーチ_要フォロー一覧`**: 長文を読みやすくし、customer / coach 識別子を固定
- **`コーチ_データ状況`**: overload / problem は赤、capacity / coverage は neutral or green
- **`コーチ_使い方`**: 最初に見る場所と色の意味を説明

---

## Phase 3 — Concierge

**Why third:**
- read-only なので Sales / Coaches より入力リスクは低い
- ただし follow-up 文脈を素早く読む用途があり、改善価値はある
- workbook が小さいため短時間で成果が出やすい

### 対象 sheet
- `コンシェルジュ_フォロー一覧`
- `コンシェルジュ_データ状況`
- `コンシェルジュ_使い方`

### UX 目標
- header と識別列を freeze
- filter 追加
- `P1` follow-up 行と低満足度 / gap-comment を強調
- comment 列を広げる
- `コンシェルジュ_データ状況` を signal 型 monitor にする

---

## Phase 4 — `POTEX DB` の admin readability

**Why fourth:**
- frontline の daily workbook ではない
- ただし `Sync_Log`, `Sync_Control`, `Publish_Manifest`, staging, canonical map の見やすさは admin/debug に効く

### 対象領域
- `Sync_Log`
- `Sync_Control`
- `Publish_Manifest`
- `Customer_Coach_Assignments`
- `Exceptions_*`
- `Staging_*`
- admin 効果が大きい canonical table

### UX 目標
- header freeze
- admin/debug tab に filter
- status / error 強調で debug しやすくする
- automation や admin inspection を邪魔しない範囲で helper 列 hidden も検討

### 制約
- `POTEX DB` は非技術 operator 向けには最適化しない。あくまで admin / automation workbook とする

---

## Phase 5 — CS / Executive の second pass

**Why last:**
- baseline + advanced UX はすでにある
- 他 workbook の baseline parity の方が ROI が高い

### 候補改善
- CS review tab で安全な helper/source 列を hidden にする
- publish 前提を壊さない範囲で editable 列を左に寄せる
- 色の意味を legend / README / note で補足
- Executive に leadership 要望があれば summary block を追加
- operator-facing の英語っぽい値（例: `suggested_action`）を、安全なら日本語表示へ
- 各 role workbook の README tone を legacy `__README` に近づける

---

## Legacy workbook から取り入れる pattern

### Adopt
- `__README` を明確な入口にする
- role-first の tab naming
- developer 用語より日本語の業務表現
- workbook 全体の mental model を役割で整理
- daily work tab と reference/admin tab をはっきり分ける

### そのままは採用しない
- sheet 間 formula 網を system contract にすること
- 列位置ずれ前提の version branching (`v2.4`, `+2 shift` など)
- workbook 自体を source of truth にすること
- 単発 patch function を積み上げる保守モデル

### Potex managed-workbook model への置き換え
- canonical DB + publish/writeback architecture は維持
- workbook surface にだけ legacy 的な使いやすさを持ち込む
  - README-first
  - 日本語 wording
  - 役割別の明確な tab
  - 読み順が見えること
  - editable / read-only 境界が明確なこと

---

## 実行タスク

### Task 1: 未着手 workbook の parity gap を記録
**Objective:** Sales / Coaches / Concierge で、freeze / filter / conditional formatting が不足している sheet を短く整理する。

**Files:**
- Update: `docs/plans/2026-05-22-workbook-ux-priority-plan.md`
- Optional scratch: 必要なら inspection script

**Verification:**
- 未着手 sheet すべての baseline metadata が記録されている

### Task 2: Sales baseline UX 実装
**Objective:** Sales の全 tab を CS/Executive と同程度の baseline UX にする。

**Files:**
- 直打ちの Sheets API で済むなら repo code は不要
- 長期保守するなら後で helper 化

**Verification:**
- Sales 全 tab に frozen header, filter, tab color, 適切な列幅がある

### Task 3: Sales advanced signal formatting 実装
**Objective:** daily revenue operation で一目で読めるようにする。

**Verification:**
- `営業_未入金一覧` と `営業_契約一覧` で urgent / normal / resolved が視覚的に分かる
- `営業_データ状況` で unmatched / problem 指標が強調される

### Task 4: Coaches baseline UX 実装
**Objective:** Coach 全 tab を baseline parity にする。

**Verification:**
- Coach 全 tab に frozen header, filter, readable width がある

### Task 5: Coaches advanced readability 実装
**Objective:** 長い alert comment と workload signal を読みやすくする。

**Verification:**
- `コーチ_要フォロー一覧` の comment がきれいに wrap し、識別子が scroll 中も見える
- `コーチ_担当負荷` で overload / low-capacity が目立つ

### Task 6: Concierge baseline + advanced UX 実装
**Objective:** read-only follow-up 解釈面を改善する。

**Verification:**
- `コンシェルジュ_フォロー一覧` が読みやすく、優先度が分かる
- `コンシェルジュ_データ状況` が signal 型になる

### Task 7: DB admin readability pass
**Objective:** DB を operator UI にせず、admin/debug ergonomics だけ改善する。

**Verification:**
- `Sync_Log` / `Sync_Control` / `Publish_Manifest` / 主要 exception tab が見やすくなる

### Task 8: CS / Executive の second pass 再評価
**Objective:** 他 workbook が揃った後に、hidden / reorder が本当に必要か判断する。

**Verification:**
- 候補改善ごとに yes / no を明示できる

---

## 今すぐの推奨アクション
**`Potex Sales` から始める。**

理由:
- UX baseline が未着手
- revenue / payment 影響が大きい
- priority signal は既に data にある
- CS を再度いじるより structural risk が低い

---

## 成功条件
ある workbook を「UX として十分」とみなす条件:
- header が freeze されている
- 識別に必要な左列が freeze されている
- filter がある
- action が必要な行に明確な色 signal がある
- 長文が必要な場所で wrap される
- metric summary tab が red / green / neutral signal を持つ
- operator が **3 秒以内に最初に見る場所を判断できる**
