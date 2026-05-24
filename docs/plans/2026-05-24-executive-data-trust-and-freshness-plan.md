# Potex Executive データ信頼性・鮮度プラン

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** `Potex Executive` workbook を、日次の経営会議で安心して使える状態にする。単に現在値を見せるだけでなく、その数値が新しいか、どこで更新が止まっているか、どの業務領域にズレの危険があるかを見えるようにする。

**Architecture:** 既存の Potex canonical DB + publish model を維持する。Executive workbook を計算だらけの spreadsheet にはしない。信頼性・鮮度の指標は Apps Script の publish 時に計算し、経営向けの分かりやすい signal として表示する。既存 workbook の「日本語・役割別・読みやすい UX」は保つ。人の更新漏れで数値がズレる場合は、その更新漏れ自体を signal として表に出す。

**Tech Stack:** Google Apps Script (`potex-gas/src/`), 既存 publish pipeline (`publish/managementWorkbook.ts`, `publish/views.ts`), `Sync_Log`, `POTEX DB` の canonical tables, managed workbook manifest (`workbook_manifest.json`).

**Repo Rule:** この plan と後続実装の primary source of truth は GitHub `origin/main` とする。ローカル workspace は作業 tree / backup として扱う。

---

## この plan が必要な理由
ユーザー要件は次のとおり明確です。

1. workbook は、現場担当者にも経営にも読みやすい必要がある
2. 経営は **毎日の会議** でこの workbook を使う
3. 悪い意思決定の原因の 1 つは、**表示数値が実態と一致しないことがある** 点
4. もう 1 つの大きな原因は、**人の更新漏れ**
5. 会議の前や会議中に、次がすぐ分かる必要がある
   - 数値を信じてよい鮮度か
   - どの領域が古そうか
   - 更新漏れがあるなら、数値をどう解釈すべきか

つまり Executive workbook は、単なる KPI 表示ではなく **意思決定支援 + 信頼状態表示** に進む必要があります。

---

## 既存実装で活かせる土台
現在の code には、すでに再利用できる基盤があります。

- `potex-gas/src/publish/managementWorkbook.ts`
  - `経営_使い方`, `経営_コーチ負荷`, `経営_顧客リスク`, `経営_データ状況`, `経営_例外推移` を publish 済み
- `potex-gas/src/publish/views.ts`
  - `buildExecReadme()` に経営向けの読み順がある
  - `buildExecDataHealth()` に canonical / exception health 指標がある
  - `buildExecExceptionTrend()` に `Sync_Log` 由来の日次 trend がある
  - partner assignment で stale 判定の先例（`partner_stale_30d_count`）がある
- `potex-gas/src/logging.ts`
  - `Sync_Log` は存在し、operator が読める
  - publish / writeback / full refresh の成功時刻を取れる

この plan は、別の reporting system を作るのではなく、この土台を拡張します。

---

## 目指す成果
実装後、manager は 60 秒以内に次を答えられる状態を目指します。

1. **今日の数値は会議に使える鮮度か**
2. **だめなら、どの領域が古いか**
   - sales / payments / CS review / coach assignment / partner status / line registration / feedback / continuation
3. **原因は自動処理失敗か、sync lag か、人の更新漏れか**
4. **そのまま会議を進めると、どんな判断の偏りが起きそうか**
   - 例: 「payments が少なく見える可能性」「follow-up queue が少なく見える可能性」
5. **会議後に最初に何を確認すべきか**

---

## UX contract

### 維持するもの
- 日本語の role-based naming
- README-first の導線
- 一目で見やすいこと
- raw DB ではなく manager 向け summary を出すこと

### 追加するもの
- 会議前の信頼性を確認する最上位ビュー
- 鮮度 timestamp
- stale domain の警告
- 更新漏れの可能性を明示するヒント
- 経営向けの短い解釈メモ

### 追加しないもの
- 長い説明文の壁
- executive tab 上の技術的 debug 出力
- workbook 内の複雑な formula 網
- spreadsheet-as-database の挙動

---

## 新しく追加する Executive surface

### 1. `経営_更新状況`
目的: 会議前準備と会議中確認のための鮮度 panel。

想定列:
- `domain`
- `status`
- `last_effective_update_at_jst`
- `expected_cadence`
- `stale_threshold`
- `stale_by`
- `likely_issue_type`
- `likely_decision_risk`
- `recommended_check`

想定 domain:
- `commercial_payments`
- `sales_funnel`
- `cs_alias_review`
- `cs_continuation_review`
- `feedback_followup`
- `coach_assignment`
- `partner_status`
- `line_registration`
- `publish_pipeline`

### 2. `経営_会議前チェック`
目的: 会議責任者向けの短い red / orange / green checklist。

想定行:
- Executive publish freshness OK?
- Full refresh freshness OK?
- Writeback freshness OK?
- threshold 超えの stale domain はあるか?
- 未解消の mismatch-risk domain はあるか?
- 更新漏れが原因で過少表示の恐れがある domain はあるか?

### 3. `経営_データ状況` の拡張
目的: 既存の KPI / health summary は維持しつつ、信頼性指標を足す。

追加候補 metric:
- `last_publish_success_at_jst`
- `last_full_refresh_success_at_jst`
- `last_writeback_success_at_jst`
- `stale_domain_count`
- `stale_high_risk_domain_count`
- `meeting_risk_status`
- `domains_with_likely_human_update_omission`

---

## 鮮度モデル
暗黙の推測ではなく、明示的な鮮度 policy を持つ。

### Domain freshness policy
code 上に小さい config object を置き、domain ごとに次を定義する。
- anchor source(s)
- timestamp field(s)
- fallback timestamp field(s)
- expected update cadence
- stale threshold
- stale 時の risk note

例:
```ts
{
  commercial_payments: {
    expectedCadenceHours: 24,
    staleThresholdHours: 36,
    anchor: 'Payments.updated_at || latest successful payment-related writeback/full refresh',
    likelyDecisionRisk: '売上・入金進捗が実態より低く見える可能性',
  },
  cs_alias_review: {
    expectedCadenceHours: 24,
    staleThresholdHours: 36,
    anchor: 'latest open review row updated/collected timestamp + latest writeback success',
    likelyDecisionRisk: '未紐づけ件数や保留件数が古いまま会議に出る可能性',
  },
  partner_status: {
    expectedCadenceHours: 24,
    staleThresholdHours: 72,
    anchor: 'last_partner_update_at || updated_at || assigned_at',
    likelyDecisionRisk: 'パートナー進捗が遅れて見える/進んで見える可能性',
  }
}
```

### 区別すべき 3 つ
1. **Pipeline freshness**
   - publish / writeback / full refresh が動いたか
2. **Operational data freshness**
   - 人が元データを実際に更新したか
3. **Mismatch risk**
   - publish が動いていても、業務側更新が漏れていないか

ここがユーザー要件の核心です。

---

## 「人の更新漏れらしい」を判定する heuristic
完全証明は難しいので、明示的 heuristic として honest に出す。

### 表示ラベル語彙
経営に見せるラベルは短い日本語にする。
- `更新良好`
- `要確認（更新遅れの可能性）`
- `高リスク（会議前に確認推奨）`
- `自動更新は成功 / 元データ更新漏れの可能性`
- `自動更新自体が未実行の可能性`

### Omission heuristic
次のようなとき、その domain を「人の更新漏れの可能性あり」とする。
- publish は新しいのに domain anchor data が古い
- 件数や queue 状態が想定 cadence を超えて変化していない
- downstream summary は更新済みだが upstream action row が触られていない
- 「初回更新待ち」系の件が長く残っている
- unresolved/open review 件数が、成功 run を重ねても変わらない

### 意思決定支援の要件
stale と出すだけでなく、次も出す。
- **何が抜けていそうか**
- **そのせいで数値がどう偏るか**

例:
- payments stale → 売上 / 入金が過少表示の可能性
- partner stale → 進捗が止まって見える、または古い状態で固定される可能性
- CS review stale → 未解決 queue は見えている数より多い可能性

---

## 変更対象 file

### Primary code
- Modify: `potex-gas/src/constants.ts`
- Modify: `potex-gas/src/publish/views.ts`
- Modify: `potex-gas/src/publish/managementWorkbook.ts`
- Modify: `potex-gas/src/logging.ts`
- Modify: `workbook_manifest.json`

### Documentation
- Modify: `OPERATIONS_MANUAL.md`
- Modify: `docs/backlog.md`
- Modify: `agents/session.md`
- Create: `docs/plans/2026-05-24-executive-data-trust-and-freshness-plan.md`

### Optional
- Modify: `potex-gas/src/sheets.ts`

---

## 実装 phase

## Phase 0 — 用語と signal contract を固定

### Task 1: management trust の語彙を定義
**Objective:** 経営向け status と note の文言ぶれを防ぐ。

**Files:**
- Modify: `docs/plans/2026-05-24-executive-data-trust-and-freshness-plan.md`
- Modify later during implementation: `potex-gas/src/publish/views.ts`

**Steps:**
1. freshness card 用 `status` label を定義
2. `likely_issue_type` label を定義
3. `likely_decision_risk` note のパターンを定義
4. 短く、日本語で、経営が読める言葉にする

**Verification:**
- plan 内に安定した vocabulary list がある
- manager 向け表示に機械っぽい英語が混ざらない

### Task 2: domain freshness policy table を定義
**Objective:** `経営_更新状況` に出す domain と timestamp/threshold logic を決める。

**Files:**
- Modify later during implementation: `potex-gas/src/publish/views.ts`
- Reference: `potex-gas/src/publish/managementWorkbook.ts`

**Steps:**
1. Executive に必要な domain を列挙
2. 各 domain ごとに次を定義
   - source rows
   - primary timestamp fields
   - fallback timestamp fields
   - expected cadence
   - stale threshold
   - decision-risk note
3. policy を 1 つの定数に集約

**Verification:**
- 新ビューの各 domain に deterministic な source と threshold がある

---

## Phase 1 — freshness 計算 helper を追加

### Task 3: `views.ts` に date/freshness helper を追加
**Objective:** 「経過時間」「使える最新 timestamp」「freshness 判定」を汎用 helper 化する。

**Files:**
- Modify: `potex-gas/src/publish/views.ts`

**Steps:**
1. row field から安全に timestamp を読む helper を追加
2. 複数候補から最新値を選ぶ helper を追加
3. 次を返す helper を追加
   - latest timestamp
   - age
   - stale flag
   - stale severity
4. 可能なら既存の `daysSince` / date formatting pattern を再利用

**Verification:**
- `経営_更新状況` と `経営_会議前チェック` の両方で使える
- domain ごとのコピペ date logic が増えない

### Task 4: `Sync_Log` から最新成功 job timestamp を取る helper を追加
**Objective:** publish / full refresh / writeback の最新成功時刻をきれいに取り出す。

**Files:**
- Modify: `potex-gas/src/publish/views.ts`
- Reference: `potex-gas/src/logging.ts`

**Steps:**
1. `Sync_Log` を 1 回 parse して reusable な job summary にする
2. 次の helper を追加
   - latest `runPublishAll` success
   - latest `runFullRefresh` success
   - latest `runWritebackCollection` success
3. 表示用に JST string を返す

**Verification:**
- `buildExecExceptionTrend()` と同じ source of truth を使う
- 経営 tab で安定表示できる

---

## Phase 2 — 新しい Executive trust view を作る

### Task 5: view 定数を追加
**Objective:** 新 sheet を一か所で管理する。

**Files:**
- Modify: `potex-gas/src/constants.ts`
- Modify: `workbook_manifest.json`

**Steps:**
1. `VIEWS.EXEC_UPDATE_STATUS = '経営_更新状況'` を追加
2. `VIEWS.EXEC_MEETING_CHECK = '経営_会議前チェック'` を追加
3. manifest にも追加

**Verification:**
- publish 時に両 tab を自動生成できる

### Task 6: `buildExecUpdateStatus()` を実装
**Objective:** 経営向けの主要な鮮度 / 状態 table を作る。

**Files:**
- Modify: `potex-gas/src/publish/views.ts`

**Steps:**
1. header を作成
   - `domain`, `status`, `last_effective_update_at_jst`, `expected_cadence`, `stale_threshold`, `stale_by`, `likely_issue_type`, `likely_decision_risk`, `recommended_check`
2. freshness policy に従って domain ごとに 1 行作る
3. 次を区別する
   - publish stale
   - writeback stale
   - source-data stale
   - likely human omission
4. note は会議で読める自然な文にする

**Verification:**
- DB tab を開かなくても上から下へ読める
- 1 分以内に stale な領域を特定できる

### Task 7: `buildExecMeetingCheck()` を実装
**Objective:** 会議をそのまま始めてよいかを短く示す checklist を作る。

**Files:**
- Modify: `potex-gas/src/publish/views.ts`

**Steps:**
1. checklist 行を追加
   - publish freshness
   - full refresh freshness
   - writeback freshness
   - stale domains present?
   - high-risk stale domains present?
   - likely human-update omissions present?
2. 最終的な overall status を出す
   - `GO`
   - `GO_WITH_CAUTION`
   - `CHECK_BEFORE_MEETING`
3. 経営向けに短い interpretation line を 1 行足す

**Verification:**
- 会議責任者が、そのまま進めるか確認を先にするか判断できる

### Task 8: `buildExecDataHealth()` に trust metric を追加
**Objective:** 既存 KPI/health table を残しつつ、会議向け trust metric も載せる。

**Files:**
- Modify: `potex-gas/src/publish/views.ts`

**Steps:**
1. publish / writeback / full-refresh の最新成功時刻を追加
2. stale-domain count を追加
3. likely-human-omission count を追加
4. 要約 `meeting_risk_status` を追加

**Verification:**
- `経営_データ状況` が compact なまま、件数だけでなく trust 状態も伝える

---

## Phase 3 — publish flow に組み込む

### Task 9: `publishExecutiveWorkbook()` を更新
**Objective:** 新しい trust tab を既存 Executive tab と一緒に publish する。

**Files:**
- Modify: `potex-gas/src/publish/managementWorkbook.ts`

**Steps:**
1. 必要なら freshness heuristic 用 source row を追加で読む
2. 次を呼ぶ
   - `buildExecUpdateStatus(...)`
   - `buildExecMeetingCheck(...)`
3. Executive workbook に `clearAndRewrite()` する
4. 既存の publish 順を読みやすく保つ
   - `経営_使い方`
   - `経営_会議前チェック`
   - `経営_更新状況`
   - `経営_データ状況`
   - `経営_例外推移`
   - detail tabs

**Verification:**
- 1 回の publish で新 tab が作成・更新される
- README の読み順と一致する

### Task 10: `buildExecReadme()` の読み順を更新
**Objective:** まず trust/freshness を見る導線に変える。

**Files:**
- Modify: `potex-gas/src/publish/views.ts`

**Steps:**
1. `read_first` を次の順に変更
   - `経営_会議前チェック`
   - `経営_更新状況`
   - `経営_データ状況`
   - `経営_例外推移`
2. stale warning は automation failure だけでなく human update omission も含むと 1 行で説明

**Verification:**
- README が新しい会議フローを案内できる

---

## Phase 4 — 更新漏れリスクを解釈しやすくする

### Task 11: domain ごとの「判断の偏り」note を追加
**Objective:** 更新が抜けていても、経営が安全に解釈できるようにする。

**Files:**
- Modify: `potex-gas/src/publish/views.ts`

**Steps:**
1. stale domain ごとに短い bias note を出す
2. 抽象的ではなく実務的に書く

例:
- payments stale → `入金実績は実態より少なく見える可能性`
- partner stale → `進捗停滞に見えるが未更新の可能性`
- CS review stale → `未解決件数は見えている数より多い可能性`
- followup stale → `顧客リスクは実態より過少表示の可能性`

**Verification:**
- manager が「古い」だけでなく「どんな方向にずれるか」を理解できる

### Task 12: recommended check を追加
**Objective:** 次に誰がどこを見るべきかをすぐ分かるようにする。

**Files:**
- Modify: `potex-gas/src/publish/views.ts`

**Steps:**
1. domain ごとに `recommended_check` を出す
2. 技術内部ではなく workbook / tab ベースの案内にする

例:
- `Potex CS > CS_入金名寄せ確認 / writeback 実行履歴`
- `POTEX DB > Sync_Log`
- `担当者の元シート更新漏れ確認`
- `partner status 入力欄 / last_partner_update_at`

**Verification:**
- Executive workbook だけで次の確認先を切り分けられる

---

## Phase 5 — formatting と視認性

### Task 13: 新 tab に status-first formatting を追加
**Objective:** 日次会議で一目で使える見た目にする。

**Files:**
- Modify if needed: `potex-gas/src/sheets.ts`
- Modify if needed: Executive workbook 用 formatting helper

**Steps:**
1. header freeze
2. filter 追加
3. tab color 追加
4. conditional formatting 追加
   - 高リスク stale は赤
   - warning は橙
   - healthy は緑
5. note 列を広げる

**Verification:**
- 会議中に横スクロール地獄にならず読める

---

## Phase 6 — docs と rollout

### Task 14: `OPERATIONS_MANUAL.md` を更新
**Objective:** 鮮度 warning と更新漏れ signal の読み方を説明する。

**Files:**
- Modify: `OPERATIONS_MANUAL.md`

**Steps:**
1. `経営_会議前チェック` と `経営_更新状況` の説明を追加
2. 次の違いを説明
   - automation lag
   - sync lag
   - human update omission
3. 「会議前にすること」「会議後にすること」を追加

**Verification:**
- 非技術者でも stale warning の説明ができる

### Task 15: session / backlog を更新
**Objective:** workstream を再開しやすく残す。

**Files:**
- Modify: `docs/backlog.md`
- Modify: `agents/session.md`

**Steps:**
1. この施策を active または next-priority workstream として記録
2. 「会議前/会議中に更新漏れが見えること」が新要件だと明記
3. 対応する workbook surface を記録

**Verification:**
- 次の session が問題設定を掘り直さずに再開できる

---

## Acceptance checklist
実装完了条件:
- [ ] Executive workbook に `経営_会議前チェック` tab がある
- [ ] Executive workbook に `経営_更新状況` tab がある
- [ ] README の読み順が freshness/trust 優先になっている
- [ ] `経営_データ状況` に trust/freshness metric がある
- [ ] stale-domain 判定が pipeline freshness と human update omission を区別する
- [ ] 各 stale domain に decision-risk note がある
- [ ] 各 stale domain に recommended next check がある
- [ ] 新 tab が会議中に一目で読める
- [ ] runbook に warning の解釈方法がある

---

## Verification plan

### Functional verification
1. publish を実行
2. `Potex Executive` に新 tab ができることを確認
3. workbook 内 formula に頼らず値が入ることを確認
4. README が新 tab を案内していることを確認

### Behavior verification
1. stale publish / stale writeback / stale source update を疑似的に作る
2. status label が正しく変わることを確認
3. `likely_issue_type` が正しく変わることを確認
4. decision-risk note が domain と一致することを確認

### Meeting usability verification
1. Executive workbook だけを開く
2. 1 分以内に次へ答えられるか確認
   - 数値は信頼できるか
   - 何が stale か
   - どんな判断上の注意があるか
   - 次に何を確認すべきか

---

## 推奨実装順
1. Task 5 — constants / manifest 追加
2. Task 3 — freshness utility helper
3. Task 4 — `Sync_Log` timestamp helper
4. Task 6 — `buildExecUpdateStatus()`
5. Task 7 — `buildExecMeetingCheck()`
6. Task 8 — `buildExecDataHealth()` 拡張
7. Task 9 — publish flow 組み込み
8. Task 10 — README 読み順更新
9. Task 11 — decision-bias note
10. Task 12 — recommended check hint
11. Task 13 — formatting
12. Task 14/15 — docs / state 更新

---

## 最後の実装メモ
この機能は、見栄え改善ではなく **意思決定の安全装置** として扱うべきです。ユーザーの本当の懸念は「dashboard UX を少し良くしたい」ではなく、次の理由で manager が誤判断しないようにすることです。

- 表示数値が stale
- automation は動いたが担当者の更新が抜けた
- workbook がその抜けを隠してしまう

この要件は、すべての実装判断で見える場所に置き続けます。
