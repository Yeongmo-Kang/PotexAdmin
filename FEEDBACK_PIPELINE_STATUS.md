# Potex Feedback Pipeline Status

## 実装済みの内容

### 取り込み元
- Google Form responses workbook: `月次振り返りアンケート （回答）`
- Tabs:
  - `通常月用`
  - `（最終月用）`

### 新規 / 更新された workbook tabs
- `Feedback` (canonical)
- `Ops_Feedback_Review`
- `Exceptions_FeedbackMatch` (`Staging_Feedback` 吸収後、raw 応答を直接取り込み。P-012 Phase 2 step 2d, 2026-05-20)

## 現在の pipeline の動き

### 1. Source -> Canonical（staging なし）
ingest は form responses を読み込み、coach / customer の正規化を行う。マッチ成功行は `Feedback`、失敗行は `Exceptions_FeedbackMatch` に直接入る。dedupe key は `response_id = resp_{12hex}` (SHA-256 hash)。`Exceptions_FeedbackMatch` には、alias 承認時に csWriteback が promote できるよう、raw 応答列 (`coach_id`, `feedback_type`, `satisfaction_score`, `nps_score`, `nps_category`, `progress_score`, `expectation_score`, `community_score`, `q_gap`, `free_comment`) をすべて保持する。

### 2. Coach normalization
Coach 名は `Coach_Alias_Map` で解決するため、次の揺れはすでに吸収済み。
- `坂本` -> `坂本直樹`
- `稲川コーチ` -> `稲川 雄介`
- `小島さん` -> `小島立照`
- `長坂ヒロコーチ` -> `長坂ヒロ`

### 3. Customer matching
現在の customer matching は次を使う。
- 正規化 email の完全一致
- 正規化 name の完全一致
- name + assigned coach による曖昧性解消

### 4. Canonical feedback table
`Feedback` には、正規化済み form responses が入っている。

### 5. Operational sheet
`Ops_Feedback_Review` は、feedback 向けの最初の運用ビューとして利用可能。
すでに次を支援できる。
- 低満足度レビュー
- follow-up queue レビュー
- coach 別 feedback チェック

### 6. Exception queue
未マッチの feedback 行は `Exceptions_FeedbackMatch` に書き込まれる。

## 現在の統計（acceptance 後、2026-05-19）
- total form responses ingested: `58`
- coach matched: `58 / 58`
- customer matched: `58 / 58` (after `知子佐藤 -> CUST-0065 / 佐藤知子` alias approval)
- `Exceptions_FeedbackMatch`: `0` rows
- `CS_別名解決入力`: `0` rows
- low-satisfaction rows: `11`
- needs-followup rows: `18`

## 現在の既知ギャップ
feedback pipeline 自体には未解決マッチはない。現在の CS alias review queue は downstream 側に移っている。
- `CS_入金名寄せ確認` (`P1=39`, payment unmatched) — operator approval 待ち
- `CS_継続名寄せ確認` (`P1=10`, continuation unmatched) — operator approval 待ち

どちらも同じ流れで処理する。
operator approval → `Customer_Alias_Map` writeback → canonical refresh → republish
詳細は `OPERATIONS_MANUAL.md` の Section 3.2 / 4 / 6 を参照。

## 重要な注意点
form の構造は時期によって変わっている可能性がある。
一部の応答では raw row values に後半の NPS / satisfaction 列がなく、現在は全レコードで次の両方が揃うとは限らない。
- `satisfaction_score`
- `nps_score`

それでも pipeline では次を取得している。
- progress score
- expectation score
- comment/gap text
- follow-up flags

過去の form schema 変化をさらに調べれば、score completeness が改善する可能性はある。

## 以前の推奨 next steps の状態
元の推奨 4 項目は、すべて出荷済み。

1. **Customer alias resolution via GAS** — DONE. `CS_別名解決入力` → `Customer_Alias_Map` writeback は live。さらに同じ方式を `CS_入金名寄せ確認` (`source=cs_payment_alias_review`) と `CS_継続名寄せ確認` (`source=cs_continuation_alias_review`) に拡張済み。`runWritebackCollection` は `refreshCanonicalStaging` + 7-workbook republish (CS / Executive / Concierge / Sales / Coaches / Sato / Inai) を自動で連結する (`potex-gas/src/main.ts:38-56`)。

2. **Canonical `Plans` / `Payments`** — DONE. Live counts: `Plans=228`, `Payments=136`, `Staging_Payments=136`, `ConversionHistory=543+`。continuation ingest は alias-aware matching を使う。

3. **Operational views from canonical data** — DONE. `Ops_コーチ_担当負荷` / `Ops_Followup_Queue` / `Ops_Continuation_Targets` はすべて Phase 1 **accept** verdict。

4. **Refresh automation beyond feedback** — DONE. Apps Script triggers は live。publish 1h、writeback collection 30m、full refresh daily 07:00 JST。`runFullRefresh()` は customer + feedback + commercial + LINE registration ingest を含む。

## 現在の重点
- `CS_入金名寄せ確認` (P1=39) と `CS_継続名寄せ確認` (P1=10) に対する operator approval
- approval → writeback → republish で、1 回の writeback cycle（約 30 分）以内に該当行が消えることの E2E 確認
- cadence の微調整は、operator の実運用データがたまってから行う
