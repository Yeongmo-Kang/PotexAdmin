# P-006 Commercial Model Ingest Slice 計画

> **Hermes 向け:** この計画を subagent-driven-development スキルでタスクごとに実装すること。

**Goal:** 現在のプレースホルダー `Plans` / `Payments` / `ConversionHistory` row を source-backed な商流データに置き換える。その第一歩として、ライブ運用 workbook 上ですでに確認できている、最も安全な実ソースシートから着手する。

**Architecture:** `POTEX DB` を canonical hub として維持する。sales 向け workbook を試みる前に、薄い source-backed commercial ingest slice を追加する。P-006 の Phase 1 では、実データに基づく `Plans` を生成し、`Staging_Payments` と source-backed `Payments` を導入し、運用ステータス event から最小限だが防御可能な `ConversionHistory` backfill を作る。

**Tech Stack:** Google Sheets source tabs, Python inspection scripts, Apps Script canonical refresh/publish pipeline, spreadsheet-first operator workflow.

---

## 現時点で確認できている事実

- `Plans`、`Payments`、`ConversionHistory` はすでに `POTEX DB` に存在するが、現在の内容は source-backed な canonical row ではなく、placeholder/demo data に見える。
- 現在の `Plans` row には `Starter 8`、`Trial + Proposal`、`Short 4` のような値がある一方、対応する customer は現在 `course_name = マスター6か月` を持っている。
- 現在の `Payments` row も synthetic に見える（`INV-2026-001`、英語メモなど）。
- 現在の `ConversionHistory` row には `lead_created` のような synthetic event 値と英語メモが使われている。
- ライブ運用 workbook `⭕️使用中｜POTEX数値管理` には、有望な commercial source tab が存在する:
  - `着金管理マスター`
  - `継続プラン管理`
  - `体験者一覧`
  - `失注理由ログ`
  - `営業フォロー`
- `CURRENT_TO_MVP_MAPPING.md` はすでに次の結論に達している:
  - `Plans` は `顧客管理`.`コース` から導出できる
  - `Payments` は、現時点で確認済みの source sheet だけでは完全には復元できない
  - `ConversionHistory` は、完璧な履歴再構成ではなく、最小限の event backfill から始めるべき

---

## Recommended implementation scope

### この slice で扱う範囲
1. 実ソースに基づく `Plans` 生成
2. `Staging_Payments` の導入と、`着金管理マスター` からの初期 `Payments` ingest
3. customer lifecycle + sales outcome source からの最小限の `ConversionHistory` backfill
4. commercial row count / exception の data-health 可視化

### 明示的に対象外
- まだ `Potex Sales` workbook は作らない
- 完璧な revenue accounting の再構成はしない
- 大規模な commercial dashboard の構築はしない
- payments 用 operator writeback flow はまだ作らない

---

## Task 1: inspection evidence を docs に固定する

**Objective:** 現在の commercial table がまだ信頼できない理由を、正確に記録する。

**Files:**
- Create: `generated/commercial_model_inspection_2026-05-17.md`
- Modify: `docs/backlog.md`
- Modify: `agents/session.md`

**Step 1: inspection summary を書く**

次を含める:
- `Plans`, `Payments`, `ConversionHistory` の current row count
- current row が placeholder/synthetic である証拠
- `⭕️使用中｜POTEX数値管理` で発見した source tab

**Step 2: backlog/session status を更新する**

P-006 は、placeholder な commercial row を source-backed canonical data に置き換えるところから始めるべきだと明記する。

**Step 3: Verify**
- docs に `着金管理マスター` / `継続プラン管理` が次の実 commercial source として記載されていることを確認する。

---

## Task 2: payments の staging contract を追加する

**Objective:** canonical `Payments` logic に触る前に、DB 側の structural contract を作る。

**Files:**
- Modify: `workbook_manifest.json`
- Modify: `provision_phase1_workbooks.py`
- Modify: `potex-gas/src/constants.ts`
- Modify: `potex-gas/src/canonical/ingest.ts`
- Modify: `docs/sheet-reference.md`
- Modify: `docs/database-overview.md`

**Step 1: `Staging_Payments` tab を manifest/DB contract に追加する**

Suggested columns:
- `staging_payment_id`
- `source_sheet`
- `source_row`
- `line_name`
- `customer_name`
- `experience_date`
- `contract_date`
- `sales_owner_name`
- `plan_name_raw`
- `amount_text_raw`
- `amount_numeric`
- `segment`
- `paid_flag`
- `paid_date`
- `note`

**Step 2: provision し、header のみを確認する**

workbook provisioner を実行し、`POTEX DB` に `Staging_Payments` が存在することを確認する。

**Step 3: docs を更新する**

`Staging_Payments` を、`着金管理マスター` を source とする raw ingest layer として文書化する。

---

## Task 3: 実ソースに基づく `Plans` 生成を実装する

**Objective:** synthetic な `Plans` row を、実際の customer/course data から導出した row に置き換える。

**Files:**
- Modify: `potex-gas/src/canonical/ingest.ts`
- Modify: `potex-gas/src/sheets.ts` if helper changes are needed
- Modify: `inspect_phase1_operability.py` or a new inspection script if needed
- Test/inspect with: `受講者管理`.`顧客管理`, `受講者管理`.`フォームの回答`, optional `継続プラン管理`

**Step 1: 最小限の plan-generation rule を定義する**

customer ごとに 1 行の canonical current-plan row を使い、次を持たせる:
- `plan_id`
- `customer_id`
- `plan_name`
- `plan_type`
- `sessions_included`（安全に導出できない場合は nullable）
- `contract_date`
- `start_date`
- `end_date`
- `amount_tax_included`（当初は防御可能でなければ nullable でよい）
- `status`
- `note`

**Step 2: source priority**

推奨優先順位:
1. `顧客管理`.`コース` を base plan name に使う
2. `フォームの回答`.`ご希望のプラン` を補足情報として使う
3. `継続プラン管理` は明示的な continuation-plan enrichment にのみ使い、広範な overwrite には使わない

**Step 3: synthetic row を置き換える**

`Plans` は refresh 時に source-backed logic から完全再生成し、手動 patch はしない。

**Step 4: Verify**
- `Plans.plan_name` のサンプルが、対応する `Customers.course_name` と整合すること
- source に実在しない限り、`Starter 8` / `Trial + Proposal` の synthetic 例が残らないこと

---

## Task 4: `着金管理マスター` から first-pass `Payments` ingest を実装する

**Objective:** 現時点で確認可能な、最良の payment-like source から実際の payment event を取り込む。

**Files:**
- Modify: `potex-gas/src/canonical/ingest.ts`
- Modify: `potex-gas/src/config.ts` only if source metadata needs explicit properties
- Optional create: `generated/payment_source_header_snapshot.json`

**Step 1: 実際の header row を使って `着金管理マスター` を読む**

重要: 実 header は explanatory row の下から始まるため、ingest は row 1 が schema header だと仮定してはいけない。

**Step 2: `Staging_Payments` に書き出す**

raw column と source coordinate をそのまま保持する。

**Step 3: canonical `Payments` に正規化する**

Minimum safe fields:
- `payment_id`
- `customer_id`（未一致なら nullable）
- `plan_id`（当初は nullable 可）
- `payment_date`
- `amount`
- `payment_method`（nullable）
- `payment_status`
- `invoice_number`（nullable）
- `note`

**Step 4: matching rule**

保守的な customer matching 順序を使う:
1. canonical customer への exact name match
2. 利用可能なら alias match
3. 未一致 row は無理に link せず、将来の exception surface で見える状態に保つ

**Step 5: Verify**
- `Payments` row count が `着金管理マスター` 上の実 paid/contract event を反映すること
- `¥597,800` のような値が数値 amount field に正規化されること
- unmatched payment row を件数として数えられること

---

## Task 5: 最小限の `ConversionHistory` backfill を実装する

**Objective:** 完璧な履歴再現を装わずに、防御可能な event trail を構築する。

**Files:**
- Modify: `potex-gas/src/canonical/ingest.ts`
- Inspect source tabs:
  - `体験者一覧`
  - `失注理由ログ`
  - `顧客管理`
  - `着金管理マスター`

**Step 1: 最小限の event type を定義する**

まずは次だけから始める:
- `lead_created`
- `experience_scheduled`
- `contracted`
- `paid`
- `completed`
- `lost`

**Step 2: 保守的な source mapping を使う**
- `体験者一覧`.`体験申込日` -> `lead_created`
- `体験者一覧`.`コーチング体験日` -> `experience_scheduled`
- `体験者一覧`.`成約/失注` + `成約日` -> `contracted` or `lost`
- `着金管理マスター`.`着金済み` + `着金日` -> `paid`
- `顧客管理`.`受講終了` / latest session horizon -> `completed`

**Step 3: event provenance を保持する**

現在の schema に source column がない場合は、次のいずれかを行う:
- `ConversionHistory` を拡張する
- 少なくとも provenance を `note` に書く

**Step 4: Verify**
- 少なくとも 1 人の customer について、もっともらしい順序の path が見えること
- 再生成した row から synthetic な英語 lifecycle note が消えること

---

## Task 6: commercial data health visibility を追加する

**Objective:** Sales workbook がまだなくても、新しい commercial slice を inspect 可能にする。

**Files:**
- Modify: `potex-gas/src/publish/views.ts`
- Modify: `potex-gas/src/publish/managementWorkbook.ts`
- Modify: `inspect_phase1_operability.py`
- Modify: `docs/phase1-acceptance-checklist.md` if needed

**Step 1: `経営_データ状況` または inspection output を拡張する**

次のような metric を追加する:
- `plans_count`
- `payments_count`
- `conversion_events_count`
- `payment_unmatched_count`（利用可能なら）

**Step 2: Verify**
- 件数が placeholder baseline から source-backed baseline に変化すること
- operator が DB raw sheet を開かなくても commercial ingest の有無を確認できること

---

## Task 7: 最終 verification と cutover note

**Objective:** Sales workbook がまだなくても、この slice が canonical backend として実利用可能であることを示す。

**Files:**
- Modify: `docs/backlog.md`
- Modify: `agents/session.md`
- Optional create: `generated/commercial_model_verification.json`

**Step 1: Verification checklist**
- `Plans` row が canonical customer course data と整合する
- `Payments` row は demo placeholder ではなく `着金管理マスター` 由来である
- `ConversionHistory` event が source-backed で妥当である
- 実ソースにない限り、英語の demo note が残っていない

**Step 2: Status update**

具体的な slice definition 付きで P-006 を started と記録し、この確認が通るまでは `Potex Sales` を明確に out of scope のままにする。

---

## Acceptance criteria

この slice が complete とみなせる条件:
- `Plans` に明らかな placeholder/demo row が残っていない
- `Payments` が実運用 workbook tab を source にしている
- `ConversionHistory` に最小限だが source-backed な lifecycle event が含まれている
- commercial row count が inspection または health surface で見える
- 新たな operator writeback process を早まって導入していない
