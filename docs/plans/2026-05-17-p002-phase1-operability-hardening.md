# P-002 Phase 1 運用性ハードニング計画

> **Hermes 向け:** 実行が委譲された場合は、この計画を subagent-driven-development スキルでタスクごとに実装すること。

**Goal:** `⭕️使用中｜POTEX数値管理` ですでに有効性が確認されているライブ参照シートのパターンに、ワークブック表面を合わせることで、Phase 1 のワークブック切り替えを非技術系の Potex オペレーターにとって「実運用が完成している」と感じられる状態にする。

**Architecture:** `POTEX DB` を canonical hub として維持し、read model を `Potex CS` と `Potex Executive` に publish し、ライブシートが示している最小限の運用レイヤーを追加する。具体的には、明示的な operator input surface、軽量な data-health / verification surface、そして in-workbook guidance / runbook 構造を加える。これらのビューは手動保守ではなく refresh 可能な構造を保つため、GAS で生成する。

**Tech Stack:** Google Sheets, Google Apps Script TypeScript, clasp, 既存の `potex-gas/` publish/writeback flow, `workbook_manifest.json` provisioning.

---

## Scope summary

### ライブ参照シートから学べること
- workbook は、人向けの README タブが含まれていると運用しやすい。
- 派生ダッシュボードは、手入力用の surface と分離すべき。
- Data health / reconciliation view は、単なるログではなく first-class なタブとして存在すべき。
- rollout 中の operator の推測を減らせるなら、debug/verification タブは許容される。

### Phase 1 にすでにあったもの
- DB / CS / Executive の split-workbook architecture。
- publish 済みの CS operational views。
- publish 済みの Executive summary views。
- provisioning と script-properties の scaffolding。

### まだ不足していた点 / 不整合だった点
- `CS_別名解決入力` は GAS workflow と docs には含まれていたが、`workbook_manifest.json` には存在していなかった。
- `経営_データ状況` は workbook manifest には存在していたが、Executive publish flow では populate されていなかった。
- ライブシート由来の operability pattern は認識されていたが、具体的な hardening sequence にはまだ落とし込まれていなかった。

---

## Task 1: 実際の CS operator workflow と workbook provisioning を整合させる

**Objective:** 新規 provision された CS workbook に、文書化済みの GAS flow が前提としている全シートが最初から含まれている状態にする。

**Files:**
- Modify: `workbook_manifest.json`
- Inspect: `potex-gas/src/publish/views.ts`
- Inspect: `PHASE1_CUTOVER_RUNBOOK.md`

**Step 1: CS alias-input contract を固定する**

`CS_別名解決入力` の想定 contract が次の header であることを確認する:
- `alias_name`
- `respondent_email`
- `related_coach_name`
- `source_sheet`
- `source_row`
- `current_status`
- `current_canonical_customer_id`
- `current_canonical_customer_name`
- `operator_decision_status`
- `operator_selected_customer_id`
- `operator_selected_customer_name`
- `operator_note`
- `sync_status`
- `last_collected_at`

**Step 2: その contract を provisioning に反映する**

`workbook_manifest.json` に、上記と完全に同じ header 順で `CS_別名解決入力` が含まれていることを保証する。

**Step 3: Verification**

Run:
```bash
cd /mnt/c/Users/zerom/Desktop/DevZero/projects/potex/potex-gas && npm run build
```

Expected: build が成功し、manifest が文書化済みの CS workflow と一致している。

---

## Task 2: Executive workbook の data health を実際の published view にする

**Objective:** ライブ参照 workbook の `数値整合性チェック` と同じ役割を持つ、軽量な verification sheet を追加する。

**Files:**
- Modify: `potex-gas/src/constants.ts`
- Modify: `potex-gas/src/publish/views.ts`
- Modify: `potex-gas/src/publish/managementWorkbook.ts`
- Inspect: `OPS_WORKBOOK_ARCHITECTURE.md`

**Step 1: Executive view constant を明示的に追加する**

`VIEWS` に `経営_データ状況` を公開し、publish layer がこれを first-class surface として扱うようにする。

**Step 2: 初期 health metrics を定義する**

まずはシンプルだが有用な指標から始める:
- `customers_count`
- `coaches_count`
- `sessions_count`
- `feedback_count`
- `followup_queue_count`
- `continuation_targets_count`
- `feedback_match_exception_count`

shape は最小限に保つ:
- `metric`
- `value`
- `note`

**Step 3: Executive refresh ごとにそのシートを publish する**

`publishExecutiveWorkbook()` 実行時に、DB workbook の source tab を使って `経営_データ状況` を毎回 rebuild する。

**Step 4: Verification**

Run:
```bash
cd /mnt/c/Users/zerom/Desktop/DevZero/projects/potex/potex-gas && npm run build
```

Expected: build が成功し、追加した published tab の配線後も TypeScript error が出ない。

---

## Task 3: ライブシートの pattern mapping を project docs に記録する

**Objective:** 運用性改善の意図を発見可能な状態にし、将来の作業で raw-data-only な workbook 設計へ逆戻りしないようにする。

**Files:**
- Modify: `docs/backlog.md`
- Modify: `agents/session.md`
- Optional modify: `README.md`

**Step 1: 具体的な mapping を記録する**

ライブシートから Potex Phase 1 への変換を次のように文書化する:
- `📘README_v2` pattern -> 後から追加する workbook guidance/runbook tabs
- `ダッシュボード` pattern -> `経営_コーチ負荷`, `経営_顧客リスク`
- `数値整合性チェック` pattern -> `経営_データ状況`
- debug/verify pattern -> publish/writeback 周辺の rollout-time verification sheets または logs

**Step 2: 今回 harden した内容を記録する**

今回の session で、すでに次が提供されたことを明記する:
- `CS_別名解決入力` の manifest alignment
- `経営_データ状況` の実 publish support

**Step 3: Verification**

更新後の docs を読み、次の両方が説明されていることを確認する:
- 技術的に何が変わったか
- その変更がなぜ operator usability を改善するか

---

## Task 4: この hardening の次に取る thin slice を定義する

**Objective:** 過剰実装せずに P-002 の勢いを維持する。

**Files:**
- Modify: `docs/backlog.md`
- Inspect: `PHASE1_CUTOVER_RUNBOOK.md`
- Inspect: `generated/phase1_script_properties.json`

**Step 1: 次の実行ステップを狭く保つ**

この hardening の次の P-002 slice は、次に限定する:
1. GAS project を create/deploy する
2. script properties を inject する
3. `bootstrapProject()` / `installTriggers()` / `runCanonicalRefresh()` / `runPublishAll()` を実行する
4. 実 workbook 上で `CS_別名解決入力` と `経営_データ状況` を確認する

**Step 2: blocked status を正直に維持する**

`SOURCE_CUSTOMERS_WORKBOOK_ID` が利用可能になるまで、customer raw ingest が complete だとは主張しない。

**Step 3: Verification**

backlog が引き続き次を区別していることを確認する:
- executable now: GAS deploy + publish verification
- blocked later: customer source ingest completion

---

## Acceptance criteria
- `workbook_manifest.json` に `CS_別名解決入力` が含まれている。
- Executive publish flow が `経営_データ状況` を書き出す。
- project docs が、これらの変更がなぜ必要か、そしてライブ参照 workbook とどうつながるかを説明している。
- 次の operational step が、引き続き本当の cutover であること: GAS を deploy し、publish 済みの Phase 1 workbooks を検証すること。
