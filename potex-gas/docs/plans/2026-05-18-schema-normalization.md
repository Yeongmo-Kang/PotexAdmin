# Potex Mutable-Relationship Schema Normalization Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Move mutable or multi-valued customer relationships out of `Customers` into dedicated tables, while adding `created_at` / `updated_at` metadata to canonical data tables.

**Architecture:** Keep `Customers` as the stable person master. Represent mutable relationships as separate canonical tables: coach assignments, channel links, plans, payments, and conversion events. Remove safe derived duplicate columns only after downstream views can recover names by joining on IDs.

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
1. `Customers` stores stable person-level identity.
2. Changing relationships live in separate tables.
3. Source evidence stays in staging tables.
4. Derived display names should be removed when recoverable by join.
5. Canonical tables should have `created_at` and `updated_at`.

---

## Phase 1: Add target tables and metadata columns

**Objective:** Introduce canonical tables for mutable relationships and attach metadata columns to existing canonical lifecycle tables.

**Files:**
- Modify: `src/constants.ts`
- Modify: `src/canonical/ingest.ts`
- Modify: `src/canonical/commercial.ts`
- Modify: `README.md`

**Steps:**
1. Add sheet constants for `Customer_Coach_Assignments` and `Customer_Channel_Links`.
2. Define headers for both tables including `created_at` / `updated_at`.
3. Derive current coach assignments from staged customer rows.
4. Derive channel links from staged LINE registrations.
5. Add `created_at` / `updated_at` to `Plans`, `Payments`, `ConversionHistory`.
6. Wire writes into `runCanonicalRefresh()`.
7. Build and push.

**Verification:**
- `npm run build`
- `npm run push`
- Sheets created on next canonical refresh

---

## Phase 2: Remove safe duplicate display columns

**Objective:** Remove columns whose values are recoverable by join and keep only IDs plus raw source evidence.

**Candidate removals:**
- `Staging_Payments.canonical_customer_name`
- `Staging_LineRegistration.matched_customer_name`
- `Staging_Feedback.matched_customer_name`
- `Staging_Feedback.canonical_coach_name`

**Steps:**
1. Update downstream views to join names from `Customers` / `Coaches`.
2. Remove duplicate columns from staging headers and builders.
3. Rebuild and republish.

---

## Phase 3: Normalize coach assignment usage

**Objective:** Stop treating `Customers.assigned_coach_*` as the source of truth.

**Steps:**
1. Publish coach-facing and management views from `Customer_Coach_Assignments` + `Coaches`.
2. Keep `Customers.assigned_coach_id` temporarily as current snapshot only if operationally necessary.
3. Remove `assigned_coach_name` after all joins are migrated.

---

## Phase 4: Normalize course / contract semantics

**Objective:** Make plan/contract tables authoritative so `Customers.course_name` becomes unnecessary.

**Steps:**
1. Define whether `Plans` is enough or if `Contracts` is needed.
2. Move current-plan derivation into plan lifecycle tables.
3. Remove `Customers.course_name` after downstream consumers are migrated.

---

## Phase 5: Normalize channel identity

**Objective:** Stop storing channel-specific pointers on `Customers`.

**Steps:**
1. Promote `Customer_Channel_Links` as the customer ↔ channel source of truth.
2. Remove `Customers.line_registration_id` after views are migrated.
3. Extend channel model later for non-LINE channels.

---

## Acceptance criteria

- Mutable relationships are represented in separate tables.
- Existing canonical lifecycle tables include `created_at` / `updated_at`.
- `Customers` is moving toward stable person-master semantics.
- Safe duplicate display columns have a clear removal path.
