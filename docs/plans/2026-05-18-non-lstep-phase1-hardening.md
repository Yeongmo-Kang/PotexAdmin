# Non-LStep Phase 1 Hardening 実装計画

> **Hermes 向け:** この計画がコード中心の実装になった場合は subagent-driven-development スキルを使うこと。現時点では、これは低リスクな documentation/inspection slice なので、直接実行できる。

**Goal:** LStep/TimeRex/marketing-CS workflow に関する判断を意図的に保留したまま、Potex Phase 1 を前進させる。

**Architecture:** `POTEX DB` を唯一の canonical database として維持する。source/reference workbook は変更しない。すでに構築済みの CS/Executive/Concierge surface を中心に、runbook の一貫性、operator 向け documentation、inspectability を強化する。

**Tech Stack:** Google Sheets, Apps Script (`potex-gas`), Python Google Sheets API inspection scripts, Markdown runbooks.

---

## Scope

### In scope
- LStep/TimeRex/marketing-CS automation は、business workflow の確認が終わるまで保留であることを明確化する。
- すでに provision 済みの workbook を前提に、Phase 1 cutover runbook を harden する。
- 現在 live な CS/Executive/Concierge surface に合わせて、sheet reference / operator docs を更新する。
- `clasp run` に依存しない deterministic な post-refresh inspection checklist を追加する。
- 最新 publish 前の古い P1/P2/P3 payment queue count を前提にしている stale な backlog 記述を整理する。

### Out of scope
- LStep API / webhook / TimeRex integration。
- Slack reporting workflow の変更。
- Automatic LStep writeback。
- Source workbook の変更。
- fresh publish verification 前の alias/payment row の operator approval。

---

## Task 1: LStep/TimeRex path を parked と明記する

**Objective:** 未確認の marketing-CS workflow に対して誤って実装を始めることを防ぐ。

**Files:**
- Modify: `docs/backlog.md`
- Modify: `agents/session.md`
- Modify: `CLAUDE.md`

**Steps:**
1. LStep/TimeRex/marketing-CS workflow は意図的に parked している、という短い注記を追加する。
2. 現在の spreadsheet reader は thin であり、将来置き換え可能であることを明記する。
3. plan/option/API/TimeRex requirement が確認されるまで、LStep writeback/API work を始めてはいけないと明記する。
4. docs 内で `LStep/TimeRex` と `parked` を検索して確認する。

**Verification:**
```bash
python - <<'PY'
from pathlib import Path
for p in ['docs/backlog.md','agents/session.md','CLAUDE.md']:
    text = Path(p).read_text(encoding='utf-8')
    assert 'LStep' in text
print('ok')
PY
```

---

## Task 2: 現実の状態に合わせて Phase 1 cutover runbook を確定する

**Objective:** runbook を現在の deploy 状態と既知の CLI 制約に一致させる。

**Files:**
- Modify: `PHASE1_CUTOVER_RUNBOOK.md`

**Steps:**
1. final full refresh の節の下に、CLI `clasp run runFullRefresh` は local OAuth scope の都合で block される可能性があることを追記する。
2. Google Sheets API inspection と既存 Python script を使う fallback verification path を文書化する。
3. 現在必要な check を追加する:
   - `Customer_Acquisition_Source` が存在しないこと。
   - publish 後に `経営_データ状況` / `コンシェルジュ_データ状況` の acquisition metric が存在すること。
   - 承認前に `CS_入金名寄せ確認` の header が blank/stale でないこと。
   - publish 後に `CS_継続名寄せ確認` の存在 / row count を確認すること。
4. やむを得ない場合を除き manual UI step は増やさず、script-based inspection を優先する。

**Verification:**
- runbook 内で `clasp run`, `Customer_Acquisition_Source`, `CS_入金名寄せ確認` を検索する。

---

## Task 3: 現在の CS review tab に合わせて sheet reference を更新する

**Objective:** 非技術系 operator が、どの tab が read-only で、どの column が編集可能かを理解できるようにする。

**Files:**
- Modify: `docs/sheet-reference.md`
- Modify: `OPERATIONS_MANUAL.md`

**Steps:**
1. `CS_入金名寄せ確認` と `CS_継続名寄せ確認` の entry がなければ、sheet reference に追加する。
2. 各 tab について、editable column だけを列挙する:
   - `operator_decision_status`
   - `operator_selected_customer_id`
   - `operator_selected_customer_name`
   - `operator_note`
3. warning を追加する: header / priority count が stale に見える場合、fresh publish verification 前に row を approve しないこと。
4. publish column は編集してはいけないことを追記する。

**Verification:**
- `docs/sheet-reference.md` と `OPERATIONS_MANUAL.md` の両方で、2 つの tab 名を検索する。

---

## Task 4: post-refresh inspection script/report plan を追加する

**Objective:** Apps Script execution API が local で block される場合でも、post-refresh verification を再実行可能にする。

**Files:**
- Create or modify: `inspect_post_refresh_state.py` or extend `inspect_phase1_operability.py`
- Output: `generated/post_refresh_state.json`

**Steps:**
1. `generated/phase1_script_properties.json` から ID を読む。
2. Google Sheets API 用に `~/.hermes/google_token.json` を使う。
3. 次を収集する:
   - workbook tab の存在
   - `Customer_Acquisition_Source` の不在
   - `経営_データ状況` の metric
   - `コンシェルジュ_データ状況` の metric
   - `CS_入金名寄せ確認` の header と priority count
   - `CS_継続名寄せ確認` の存在と priority count
4. timestamp と verdict を含む JSON report を出力する。
5. read-only を維持する。

**Verification:**
```bash
python inspect_post_refresh_state.py
python -m json.tool generated/post_refresh_state.json >/dev/null
```

---

## Task 5: documentation または code change 後に build/push する

**Objective:** code を触った場合に TypeScript regression がないことを保証する。

**Files:**
- `potex-gas/src/**` only if code changes are made.

**Steps:**
1. Markdown だけを変更した場合、GAS push は不要。
2. TypeScript を変更した場合:
   ```bash
   cd potex-gas
   npm run build
   npm run push
   ```
3. build/push の結果を `agents/session.md` に記録する。

**Verification:**
- code を変更した場合は `npm run build` が通ること。

---

## Task 6: backlog/session の closeout を更新する

**Objective:** project を再開可能な状態で残す。

**Files:**
- Modify: `agents/session.md`
- Modify: `docs/backlog.md`

**Steps:**
1. non-LStep hardening slice を completed または in-progress として記録し、次の step を明確にする。
2. LStep/TimeRex は parked / needs-confirmation のままにする。
3. 次回の live full refresh/publish に依存して残る verification を記録する。
4. stale な row を operator に approve させるような priority を残さない。

**Verification:**
- priority section 周辺の `agents/session.md` と `docs/backlog.md` を読む。

---

## Exit Criteria

- LStep/TimeRex work が docs 上で明示的に parked されている。
- Phase 1 runbook に current post-refresh check と CLI limitation が含まれている。
- sheet reference が payment / continuation の両 alias review tab をカバーしている。
- 再実行可能で read-only な inspection path が存在する、または正確な output path 付きで計画されている。
- backlog/session の next step が安全で stale でない。
