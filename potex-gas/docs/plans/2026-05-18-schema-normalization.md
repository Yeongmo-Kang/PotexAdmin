# Potex 可変リレーション Schema Normalization 計画

> **Hermes 向け:** この計画を subagent-driven-development スキルでタスクごとに実装すること。

**Goal:** 可変、または複数値を持つ customer relationship を `Customers` から専用テーブルへ移し、同時に canonical data table へ `created_at` / `updated_at` metadata を追加する。

**Architecture:** `Customers` は安定した person master として維持する。可変 relationship は別の canonical table で表現する: coach assignment、channel link、plan、payment、conversion event。下流 view が ID join で名前を復元できるようになった後に限り、安全な derived duplicate column を削除する。

**Tech Stack:** Google Apps Script, TypeScript, clasp, spreadsheet-backed canonical tables.

---

## Target schema direction

### Stable master tables
- `Customers`
- `Coaches`

### Mutable / multi-valued relationship tables
- `Customer_Coach_Assignments`
- `Customer_Channel_Links`
- `Plans`
- `Payments`
- `ConversionHistory`

### Design rules
1. `Customers` には、安定した person-level identity を保存する。
2. 変化する relationship は別テーブルに置く。
3. source evidence は staging table に残す。
4. join で復元できる derived display name は削除すべき。
5. canonical table には `created_at` と `updated_at` を持たせる。

---

## Phase 1: target table と metadata column を追加する

**Objective:** 可変 relationship 用の canonical table を導入し、既存 canonical lifecycle table に metadata column を付与する。

**Files:**
- Modify: `src/constants.ts`
- Modify: `src/canonical/ingest.ts`
- Modify: `src/canonical/commercial.ts`
- Modify: `README.md`

**Steps:**
1. `Customer_Coach_Assignments` と `Customer_Channel_Links` の sheet constant を追加する。
2. 両 table の header を `created_at` / `updated_at` 付きで定義する。
3. staged customer row から current coach assignment を導出する。
4. staged LINE registration から channel link を導出する。
5. `Plans`, `Payments`, `ConversionHistory` に `created_at` / `updated_at` を追加する。
6. `runCanonicalRefresh()` に書き込みを組み込む。
7. build と push を行う。

**Verification:**
- `npm run build`
- `npm run push`
- 次回 canonical refresh で sheet が作成されること

---

## Phase 2: 安全な duplicate display column を削除する

**Objective:** join で復元可能な column を削除し、ID と raw source evidence のみを保持する。

**Candidate removals:**
- `Staging_Payments.canonical_customer_name`
- `Staging_LineRegistration.matched_customer_name`
- `Staging_Feedback.matched_customer_name`
- `Staging_Feedback.canonical_coach_name`

**Steps:**
1. 下流 view を更新し、`Customers` / `Coaches` から name を join する。
2. staging header と builder から duplicate column を削除する。
3. rebuild と republish を行う。

---

## Phase 3: coach assignment 利用を正規化する

**Objective:** `Customers.assigned_coach_*` を source of truth として扱うのをやめる。

**Steps:**
1. coach-facing / management view を `Customer_Coach_Assignments` + `Coaches` から publish する。
2. `Customers.assigned_coach_id` は、運用上必要であれば current snapshot として一時的に残してよい。
3. すべての join 移行後に `assigned_coach_name` を削除する。

---

## Phase 4: course / contract semantics を正規化する

**Objective:** plan/contract table を authoritative にし、`Customers.course_name` を不要にする。

**Steps:**
1. `Plans` だけで十分か、`Contracts` が必要かを定義する。
2. current-plan の導出を plan lifecycle table に移す。
3. 下流 consumer の移行後に `Customers.course_name` を削除する。

---

## Phase 5: channel identity を正規化する

**Objective:** `Customers` に channel 固有ポインタを保持するのをやめる。

**Steps:**
1. `Customer_Channel_Links` を customer ↔ channel の source of truth として昇格させる。
2. view 移行後に `Customers.line_registration_id` を削除する。
3. 将来的に non-LINE channel 向けに channel model を拡張する。

---

## Acceptance criteria

- 可変 relationship が別テーブルで表現されている。
- 既存 canonical lifecycle table に `created_at` / `updated_at` が含まれている。
- `Customers` が stable person-master semantics に向かって整理されている。
- 安全な duplicate display column に対して、明確な削除パスがある。
