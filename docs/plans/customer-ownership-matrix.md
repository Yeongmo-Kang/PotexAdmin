# Potex Customer Ownership Matrix

> **For Hermes:** Keep this document aligned with canonical schema, operator workbook UX, and any future ERP/API design. Do not move fields into a web tool without deciding owner, overwrite rule, and review rule here first.

**Goal:** `Customers` cutover と将来 ERP 化の前提として、「どの顧客情報を誰が責任を持って更新するか」を明確にする。

**Architecture:** Potex は当面 spreadsheet-first 運用を続けるため、field ごとの owner は **業務責任** と **更新経路** を分けて考える。`POTEX DB` canonical は最終基準だが、入力は営業 / CS / コーチ / upstream CSV / 将来 API にまたがるので、overwrite ルールと review ルールを先に固定して accidental drift を防ぐ。

**Tech Stack:** Google Sheets, Google Apps Script, canonical workbook (`POTEX DB`), future ERP/API boundary planning

---

## 1. Ownership 原則

1. **1 field = 1 primary owner** を持つ
   - 参照元が複数あっても、最終更新責任者は 1 つにする
2. **upstream system が明確なものは upstream 優先**
   - 例: LINE registration, LStep tags, imported CSV
3. **業務判断が必要なものは operator owner を立てる**
   - 例: alias resolution, customer status exception, assignee correction
4. **publish workbook は owner UI であり、canonical schema ではない**
   - operator-facing シートで日本語化されていても、ownership は canonical field 単位で考える
5. **owner 未確定 field は ERP UI に先行移管しない**
   - まずこの文書で owner / overwrite / review を決める

---

## 2. Customer field ownership matrix

## 2.1 Identity / matching

- `customer_id`
  - Primary owner: system
  - Source of truth: canonical bootstrap / ingest
  - Overwrite rule: 手動上書き禁止
  - Review rule: ID 不整合は alias / exception queue で解決してから間接的に反映

- `customer_name`
  - Primary owner: CS
  - Supporting sources: source workbook, LINE registration, payment / continuation alias review
  - Overwrite rule: canonical name correctionは CS judgment を優先。raw source の表記ゆれでは自動上書きしない
  - Review rule: payment / continuation / feedback の alias review で根拠確認後に更新

- `display_name`
  - Primary owner: system
  - Supporting sources: LINE registration / source name variants
  - Overwrite rule: operator が直接 stable master として扱わない
  - Review rule: canonical `customer_name` と矛盾した場合は alias 解決を先に行う

- `respondent_email` / primary contact email
  - Primary owner: sales
  - Supporting sources: form response, customer source workbook
  - Overwrite rule: newer valid non-empty value を優先。ただし明確な typo correction は operator correction 優先
  - Review rule: conflicting values は sales confirmation、ERP 化時は change history 対象

- `phone`
  - Primary owner: sales
  - Supporting sources: application form, source workbook
  - Overwrite rule: newer valid non-empty value を優先
  - Review rule: format conflict は sales confirmation

- `line_registration_id`
  - Primary owner: system
  - Source of truth: `Line_Registrations`
  - Overwrite rule: direct manual edit 禁止
  - Review rule: alias / customer linkage review で間接解決

---

## 2.2 Lifecycle / status

- `current_status`
  - Primary owner: CS
  - Supporting sources: plans, sessions, follow-up workflow
  - Overwrite rule: lifecycle-derived status は system candidate を出しても、最終業務意味づけは CS owner
  - Review rule: status anomaly は `CS_要フォロー一覧` / `CS_継続対象一覧` と合わせて確認

- `assigned_coach_id` / current coach assignment
  - Primary owner: CS
  - Source of truth: `Customer_Coach_Assignments`
  - Overwrite rule: assignment relation を更新し、`Customers` snapshot を直接手で直さない
  - Review rule: `CS_担当割当入力` から変更、ERP 化時も assignment module 経由を維持

- `assigned_coach_name`
  - Primary owner: system
  - Source of truth: current active assignment join
  - Overwrite rule: direct manual edit 禁止
  - Review rule: coach relation が正しいかを assignment module で確認

- `current_plan_name`
  - Primary owner: sales
  - Supporting sources: plans / commercial ingest
  - Overwrite rule: active plan relation を優先し snapshot を直接修正しない
  - Review rule: commercial flow mismatch は sales owner が確認

- `continuation_flag` / continuation stage related fields
  - Primary owner: CS
  - Supporting sources: continuation source workbook, plan data
  - Overwrite rule: system-generated candidate 可。ただし業務 action state は CS owner
  - Review rule: continuation review queue で確認

---

## 2.3 Channel / acquisition

- `acquisition_channel`
  - Primary owner: marketing / sales upstream
  - Source of truth: LINE attribution tags, upstream import
  - Overwrite rule: imported structured signal を優先。operator free text 上書きは原則しない
  - Review rule: missing / weird distribution は executive data health で検知

- `lstep_tags`
  - Primary owner: CS upstream
  - Source of truth: LStep
  - Overwrite rule: spreadsheet 側からは原則上書きしない
  - Review rule: long-term API integration対象

- `source_campaign` / `source_detail`
  - Primary owner: marketing upstream
  - Overwrite rule: imported source wins
  - Review rule: ERP 化時は channel module に寄せる

---

## 2.4 Feedback / risk context

- low satisfaction / follow-up flags on customer snapshot
  - Primary owner: system
  - Source of truth: feedback + follow-up derived views
  - Overwrite rule: direct manual edit 禁止
  - Review rule: operator は snapshot ではなく `CS_要フォロー一覧` で判断

- risk note / operator note
  - Primary owner: CS
  - Overwrite rule: manual note を保持。system-generated note で消さない
  - Review rule: future `Customer_Edit_History` の main target

---

## 3. Overwrite policy by source

### 3.1 Upstream-import wins

次は upstream / imported structured source を優先する:
- LINE registration linkage
- attribution tags / acquisition structured fields
- payment imported facts
- continuation imported facts
- source workbook row identifiers

### 3.2 Operator-decision wins

次は operator decision を優先する:
- alias resolution target customer
- continuation / payment review approval result
- coach assignment correction
- freeform operator note
- exception handling outcome

### 3.3 Relation-table wins over snapshot

次は relation / event table を優先する:
- current coach assignment ← `Customer_Coach_Assignments`
- current plan / contract state ← `Plans`, `Payments`
- current follow-up / feedback state ← `Feedback`, ops queues

`Customers` に snapshot を持たせる場合も、**relation の join 再計算で再現できる値は derive-only として扱う**。

---

## 4. Review rules

### 4.1 No-review auto-accept

以下は基本的に人レビュー不要:
- refresh での row count / latest timestamp 更新
- relation table join による display-only snapshot refresh
- immutable imported IDs の再投影

### 4.2 Operator review required

以下は human review を必須にする:
- ambiguous customer match
- payment alias / continuation alias approval
- assignee correction
- customer name canonical correction
- conflicting contact info overwrite

### 4.3 Business-owner review required

以下は業務側判断が必要:
- customer lifecycle policy changes
- ownership transfer between sales / CS / coach
- source-of-truth changes involving LStep / Slack / TimeRex
- authority model changes for future ERP editing

---

## 5. ERP module implications

この ownership matrix から先に web/API 化しやすいモジュール:

1. **Customer matching / identity review**
   - owner: CS
   - current UI: `CS_別名解決入力`, `CS_入金名寄せ確認`, `CS_継続名寄せ確認`

2. **Assignments**
   - owner: CS
   - current UI: `CS_担当割当入力`

3. **Commercial status / plans / payments**
   - owner: sales + CS split
   - review-heavy, ERP 化前に ownership fixed が必要

4. **Customer notes / edit history**
   - owner: CS primary, with cross-team actors
   - future `Customer_Edit_History` の主要対象

---

## 6. 아직 남아 있는 open questions

- `customer_name` canonical correction authority を sales と CS のどちらに最終委譲するか
- contact info conflict 時に “newest wins” だけでよいか、source priority matrix を別途持つか
- `Customers` にどこまで snapshot columns を残すか
- partner-specific customer progress fields を `Customers` に持たせるか、assignment/event 側だけに置くか
- future ERP で field-level permissions をどこまで厳密に分けるか

---

## 7. Immediate usage rule

`Customers` cutover や ERP mock を始める前に、少なくとも次の field 群はこの文書を基準にする:
- identity (`customer_name`, email, phone, line linkage)
- assignment
- lifecycle/status
- operator notes

owner / overwrite / review がここで未定義の field は、先にこの文書へ追記してから実装する。
