# 2026-05-25 — `POTEX_顧客管理_v2` × `Import_csvD` × Potex DB 統合方針メモ

> **For Hermes:** これは「LStep CSV → POTEX DB の `Import_csvD` タブ手動貼付 → DB 顧客モデル更新 → v2 表示 + 限定 writeback」を採用するかの判断メモ。`docs/architecture-guardrails.md` / `docs/plans/customer-ownership-matrix.md` / `docs/plans/erp-module-map.md` の既存ルールを前提に、phase 1 運用の v2 を canonical pipeline に接続するときの owner / overwrite / review を決める。コード変更前にまずこの memo の合意を取る。

**Status:** Operator 回答受領済（§10）。設計確定済、Phase A 着手可。Phase B input tab 列は運用開始後の使用実績で固める。

**Verdict:** **GO**。`Import_csvD` (POTEX DB 内タブ) を raw landing、Potex DB を canonical truth、v2 を display + 限定入力 input タブのみ。自動 cadence は当面入れない — 3 つの操作（csvD 取込 / v2 公開 / v2 書戻し）はすべて **operator が DB 워크북 메뉴で수동 클릭**.

---

## 1. 前提整理

### 1.1 現在の確定事項
- live workbook 8 系統: `POTEX DB` / `Potex CS` / `Potex Executive` / `Potex Concierge` / `Potex Sales` / `Potex Coaches` / `Potex Sato` / `Potex Inai` (`docs/backlog.md`).
- canonical 原則: `POTEX DB` だけが truth、source workbook 4 種は read-only (`docs/architecture-guardrails.md`).
- approval queue は `CS_別名解決入力` / `CS_入金名寄せ確認` / `CS_継続名寄せ確認` を operator input boundary として既に確立済み.

### 1.2 今回新しく持ち込まれる要素
| 要素 | 役割 | 現在のステータス |
|---|---|---|
| `POTEX_顧客管理_v2` workbook | operator が daily に見る成約以降の顧客管理 UI | live にあるが PotexAdmin 管轄外 |
| **`Import_csvD` タブ (POTEX DB 内に新設)** | operator が LStep CSV を手動で paste する **raw landing**。`⭕️使用中｜POTEX数値管理` の csvD は触らない | 未作成 |
| LStep CSV (full dump) | LStep export | 手動 download → `Import_csvD` に paste |
| PotexAdmin | phase 2 ツール（最終的に v2 を deprecate 予定、時期未定） | 設計中 |

**`⭕️使用中｜POTEX数値管理` workbook には触らない**。csvD の構造は同じだが、operator が POTEX DB 内 `Import_csvD` に直接貼付する運用に変える。

### 1.3 csvD 実測構造（2026-05-25 read-only inspection）
operator が `Import_csvD` に貼り付ける CSV は `⭕️使用中｜POTEX数値管理 / csvD` (gid=862638536) と同形式：

- **2 行 header**: row 1 = LStep internal ID (例: `タグ_9282405`)、row 2 = human label (例: `成約`)。**ingest parser は row 2 を header として読む**。row 1 は schema drift 検知用にだけ保持。
- **列数**: 26（LStep export の固定 schema）。
  - `A` `登録ID` — LStep friend PK
  - `B` `表示名` — operator-friendly display
  - `C` `LINE登録名` — raw LINE name
  - `D` `対応マーク` — operator marking
  - `E` `友だち追加日時` — friend added timestamp
  - `F`–`S` 14 個の boolean tag (`0`/`1`): 勉強会予約 / 体験応募済み（HP・シナリオ・RM・プッシュ・勉強会経由の派生 5 種）/ 7日以上日程調整返信なし / 審査不合格・分母除外 / 日程調整済み / 体験キャンセル / 再面談 / **成約 (R 列)** / 失注
  - `T`–`Z` 7 個の date: 勉強会予約日 / コーチング体験申込日 / 日程調整完了 / 体験日 / 体験キャンセル / **成約日 (Y 列)** / 失注日
- **データ行数 (2026-05-25 時点)**: 4294。R 列 `成約` 分布 `1=105 / 0=4189`。**成約者 105 名**。
- **`Import_csvD` には customer_id / AFS / コーチ / プラン情報なし**。canonical `Customers` との join は `登録ID` → `Line_Registrations.line_user_id` 経由が基本。AFS / コーチ / プランは DB の `Plans` / `Payments` / `Customer_Coach_Assignments` から引く。

### 1.4 operator 回答済の業務制約
- v2 表示対象 = `Import_csvD.R=1 (成約)` AND `lifecycle ∈ {セッション中, AFS 中}`。**AFS 終了時点で v2 から外す**。
- **AFS は希望者のみ追加課金で進入**（全成約者が AFS に入るわけではない）。AFS 進入判定は DB 側の `Plans` / `Payments` に AFS plan row があるかどうかで判定。
- LStep CSV は **full dump 前提**（operator 確認）。`Line_Registrations` は `line_user_id` PK 基準 reconcile（dump にない既存行は `friend_status='absent'` mark、物理削除なし）。
- **자동 cadence なし**。下記 3 操作はすべて operator が POTEX DB 워크북 메뉴에서 **수동 클릭** (자연스러운 의존 순서: 두 입력원 (csvD ingest, v2 writeback) 둘 다 DB 에 기록된 후에 publish 가 최신 결과를 v2 에 표시):
  1. `csvD取込` — `Import_csvD` row を読んで `Line_Registrations` 등 canonical 갱신.
  2. `v2書戻し` — v2 input 탭 → DB writeback.
  3. `v2公開` — DB → v2 publish.
- 既存 publish 1h / writeback 30m / 매일 07:00 full refresh trigger 는 다른 워크북에서 그대로 유지. v2 / `Import_csvD` 흐름만 수동.
- PotexAdmin と v2 = **시나리오 X（v2 를 최종 deprecate）**、시기 미정. Phase D 진입은 phase C 결과 보고 operator 와 결정.

### 1.5 operator から新規追加要請（2026-05-25）
> 成約者の中でアップグレードの余地がある方（迷っていたり、まずはベーシックにした方）に対して、1ヶ月経過時にサポート LINE 経由で連絡し、アップグレードのリマインド／提案ができる体制を整えたい。リスト内に「アップグレード余地」や「今後提案可能性あり」といった内容を記載できる欄を追加してほしい。

→ §4 ownership / §6 出力契約 / §9 phase plan に組み込む。表示側（成約後経過月数 + 現プラン）は Phase A に含め、operator 판단列（「アップグレード余지」「今後提案可能性あり」）는 Phase B의 input タブ에서 받는다.

---

## 2. Verdict と設計を縛る前提

### 2.1 Verdict
**GO。** `Import_csvD` を POTEX DB 内に置くことで `⭕️使用中` workbook は完全に触らずに済む（read-only 원칙도 형식적으로 풀린다 — 운영자가 LStep CSV를 직접 paste 하는 곳이 canonical DB 안의 staging 탭이 되므로 기존 `CS_別名解決入力` / `CS_承認進捗` などの operator input boundary と同じ카テゴリ）.

### 2.2 設計を縛る operator 制約（全件確定済）
1. **`⭕️使用中｜POTEX数値管理` には触らない**.
2. **v2 内で「表示タブ」と「入力タブ」を物理的に別シートに分離**.
3. **LStep CSV = full dump**. `Import_csvD` ingest は reconcile 방식（PK upsert + dump 없는 행은 absent mark）.
4. **자동화 없음, 수동 트리거 3개**.
5. **PotexAdmin = phase 2、v2 = 최종 deprecate（시기 미정）**.

---

## 3. v2 と `Import_csvD` の役割定義

### 3.1 v2 は display + 限定入力 UI（system of record ではない）
- v2 의 표시 탭 = **POTEX DB 에서 GAS publish 가 호출될 때 上書き**. operator 의 손편집은 무효（실행되면 덮어씀）.
- v2 의 입력 탭 = 명시적 input boundary. input 탭 이외에는 writeback 대상 아님.
- 표시 탭과 입력 탭은 물리적으로 다른 시트.

### 3.2 `Import_csvD` 의 위치
- 配置: POTEX DB 내 신규 탭 `Import_csvD`.
- 역할: **operator paste 전용의 raw landing**. canonical 데이터가 아니라 staging.
- `workbook_manifest.json` 의 `phase1.db.required_tabs` 에 `Import_csvD` 추가.
- `Staging_*` 시리즈와 의미적으로 같음. 단 다른 staging 은 GAS 가 source workbook 으로부터 pull 해서 채우지만, `Import_csvD` 는 **operator 가 직접 paste** 함. ingest 후 다른 canonical 탭에 흘러간다.

### 3.3 既存 workbook と同じ pattern で v2 を扱う
v2 를 9 系統目의 live workbook 으로 `workbook_manifest.json` 에 등록. `publish/views/customer.ts` 신설하여 view spec 집약. `docs/architecture-guardrails.md` 의 의존 방향 룰에 따라 `canonical/` 에는 손대지 않음. `publish/customerWorkbook.ts` 를 facade 로.

---

## 4. Ownership split（열 단위）

> 既存 `customer-ownership-matrix.md` を逸脱せず、`Import_csvD` / v2 を **owner** ではなく **landing / mirror** として位置づける.

| 영역 | `Import_csvD` | Potex DB canonical | v2 (표시) | v2 (input 탭) |
|---|---|---|---|---|
| LStep raw funnel tags (`登録ID` / 14 boolean / 7 dates) | **owner (landing)** | mirror (`Line_Registrations` + `ConversionHistory`) | — | — |
| `customer_id` (canonical PK) | — | **owner** | display | — |
| `customer_name` / `表示名` | — | **owner**（CS 판단、alias resolved 우선） | display | — |
| `成約日` | mirror (`Import_csvD.Y`) | **owner** (`Plans.contract_date_first`) | display | — |
| `成約後経過月数` | — | **derived** (publish time) | display | — |
| 現プラン / `current_plan_name` | — | **owner** (`Plans`) | display | — |
| AFS 진입 / `afs_status` | — | **owner** (`Plans` AFS row 有無) | display | — |
| 담당 코치 | — | **owner** (`Customer_Coach_Assignments`) | display | — |
| 직근 입금 / 미입금 flag | — | **owner** (`Payments` derived) | display | — |
| LINE 상태 / `friend_status` | mirror | mirror (`Line_Registrations`) | display | — |
| alias 승인 입력 | — | mirror (writeback 으로 반영) | — | **既存 input 탭 owner** |
| **`upgrade_potential` (アップグレード余地)** | — | mirror (writeback) | display | **v2 input 탭 owner**（CS / sales 판단） |
| **`future_proposal_possibility` (今後提案可能性)** | — | mirror (writeback) | display | **v2 input 탭 owner**（CS / sales 판단） |
| 운영 메모 / 후속 액션 | — | mirror | display | **v2 input 탭 owner**（`Customer_Edit_History` 경유） |

신규 operator 판단열의 DB 저장처는 §9 Phase B 에서 `Customers` snapshot 추가열로 갈지 별 relation table（`Customer_Sales_Notes` 등）으로 갈지 결정（`Customer_Edit_History` 설계와 연동）.

---

## 5. `Import_csvD` → POTEX DB canonical 입력 계약

### 5.1 `Import_csvD` 시트 운영 약속
- operator 가 LStep 에서 export 한 CSV 의 셀 전체를 **A1 셀부터 그대로 paste**.
- 기존 데이터는 paste 전에 운영자가 클리어. 또는 paste 시 `import` 트리거가 첫 번째 단계로 자동 클리어 → 안전을 위해 **paste 후 `csvD取込` 메뉴 클릭** 만 운영자 책임으로 한다.
- header 행 (2 행) 를 변경하거나 셀을 손편집 금지.

### 5.2 csvD parser 사양 (`canonical/lstepCsv.ts`)
- **header = row 2**（human label）로 인식. row 1（LStep internal ID）는 schema drift 감지용으로 별도 capture.
- 데이터 행은 row 3 부터.
- 열 매핑은 **human label 명으로 완전 일치**（위치 의존이 아님）. LStep 이 열 순서를 바꿔도 라벨이 같으면 흡수.

### 5.3 필수 열（빠지면 ingest abort + Sync_Log error）
- `登録ID` (`Import_csvD` A) → `line_user_id` PK
- `友だち追加日時` (`Import_csvD` E) → `friend_added_at`
- `成約` (`Import_csvD` R) → `is_contracted` boolean (`1` = true / `0` = false)

### 5.4 권장 열（있으면 funnel state / matching 정밀도 향상）
- `表示名` (B) → `display_name`
- `LINE登録名` (C) → `line_display_name`
- `成約日` (Y) → `contract_date_lstep`（DB `Plans.contract_date_first` 와의 대조용）
- `失注日` (Z) → `lost_date`
- 각 boolean tag → `ConversionHistory` event row 로 전개

### 5.5 LStep CSV = full dump의 reconcile 전략
- `Line_Registrations` 를 `line_user_id` PK 로 reconcile:
  - dump 에 있는 기존 행 → update（최신 값으로 field 덮어쓰기）
  - dump 에 있는 새 행 → insert
  - **dump 에 없는 기존 행 → `friend_status='absent'` mark, 물리 삭제 안 함**（이력 보존）
- `ConversionHistory` 는 append-only, reconcile 대상 아님.
- 새 boolean tag 나 友だち情報 列이 CSV 에 등장하면 → `Sync_Log` 의 `unknown_lstep_columns` 카운터에 가산 + warning.

### 5.6 ingest 실행 시퀀스（`csvD取込` 메뉴 클릭 시）
1. `Import_csvD` 의 row 1 LStep ID 헤더와 row 2 human label 헤더를 검증（label 셋이 expected 와 불일치 시 abort）.
2. 데이터 행을 `Line_Registrations` 로 reconcile.
3. boolean tag → `ConversionHistory` event 추가.
4. `Sync_Log` 에 `csvD_ingest_*` 카운터 (`rows_total` / `rows_inserted` / `rows_updated` / `rows_absent_marked` / `unknown_lstep_columns`) 기록.
5. 종료 후 operator 에게 spreadsheet UI 로 결과 요약 표시.

---

## 6. POTEX DB → v2 출력 계약 (`v2公開` 메뉴 클릭 시)

### 6.1 publish view 신설: `顧客一覧_成約以降`
- 배치: `publish/views/customer.ts`（feature facade 신설）.
- 입구 facade: `publish/customerWorkbook.ts`.
- 입력: canonical `Customers` / `Plans` / `Payments` / `Customer_Coach_Assignments` / `Line_Registrations` / derived followup flags.
- 필터 조건: `Customers.customer_id` 중에서
  - `Plans` 에 성약 row 있음（`Import_csvD.R=1` 와 정합）
  - 그리고 `lifecycle_phase ∈ {session_active, afs_active}`（AFS 종료자는 제외）
- 출력 탭 이름: `顧客一覧_成約以降`（v2 내 신설）.

### 6.2 필수 열（operator-facing 일본어 라벨）
| 열 | 유래 | 성격 |
|---|---|---|
| `customer_id` | `Customers.customer_id` | hidden 또는 우측 끝 |
| `表示名` | alias resolved → `Customers.customer_name` → LStep `display_name` 우선순 | display |
| `成約日` | `Plans.contract_date_first` | display |
| `成約後経過月数` | publish 시점 `(now - 成約日) / 30` 버림 | derived |
| `現プラン` | `Plans` active row plan name | display |
| `AFS状態` | `none` / `active` / `ended` | display |
| `担当コーチ` | `Customer_Coach_Assignments` 현역 row | display |
| `直近入金日` | `Payments` 최신 | display |
| `未入金フラグ` | `Payments` derived | display |
| `LINE状態` | `Line_Registrations.friend_status` (`active` / `absent` / `blocked` 등) | display |
| `要対応フラグ` | `Ops_Followup_Queue` 파생 | display |
| `アップグレード余地` | v2 input 탭에서의 writeback 값 | display |
| `今後提案可能性` | v2 input 탭에서의 writeback 값 | display |
| `last_synced_at` | publish 시각 | display |

### 6.3 v2 표시 탭 금칙
- 표시 탭 내에 operator editable 열 섞지 않음.
- 표시 탭 최상단에 안내 텍스트를 GAS 가 매 publish 마다 재기재：「※ このシートは [v2公開] 메뉴 실행 시에 자동 재生成 됩니다. 수정은 [입력 탭] 에서 해 주세요.」
- sheet protection 을 publish 마다 reapply（operator 가 해제해도 다음 publish 에서 복귀）.

### 6.4 1개월 경과 리마인드 지원
- `成約後経過月数 >= 1` AND `現プラン ∈ {ベーシック相当}` AND `アップグレード余地 ∈ {可能性あり, 要打診}` 의 조합을 v2 표시 탭 조건부 서식으로 강조 (Phase A 대응).
- 리마인드 송신 자체는 out of scope (operator 가 LINE 수동).

---

## 7. 가장 큰 sync contradiction（피해야 할 #1）

**v2 표시 탭에서 operator 가 직접 셀을 손편집한 후 `v2公開` 메뉴 클릭으로 덮어쓰는 race condition.**

- operator 는「직접 고쳤다」고 인식하지만 다음 publish 실행 시 사라짐 → canonical 자체에 대한 불신.
- 기존 publish 5 계통에서 발생하지 않았던 이유는「표시 탭과 입력 탭이 물리 분리되어 있었기 때문」. v2 에서도 반드시 같은 규율.

**2 차 리스크:**
- LStep CSV 의 schema drift（새 열 등장 / 라벨 변경）.`Import_csvD` ingest 가 row 2 라벨 셋을 검증하고 불일치 시 abort + Sync_Log error.
- `Import_csvD` paste 시 operator 의 클리어 누락 → 이전 dump 와 새 dump 가 혼재. `csvD取込` 트리거 첫 번째 단계에서 row count 변화를 Sync_Log 에 기록하여 비정상 (예: 전회 대비 50% 이상 증가) 시 warning.
- 신규 열 `upgrade_potential` / `future_proposal_possibility` 의 값이 free text 화 되면 집계 무너짐. input 탭에서 **enum dropdown** 강제 (`data validation`).

---

## 8. PotexAdmin 의 next implementation slice

**v2 / `Import_csvD` 통합은 PotexAdmin 작업이 아님. `potex-gas` 측의 publish 확장 + ingest + UI 메뉴 추가로 완결.**

이유：
- v2 는 phase 1 operator UI. phase 2 도구（PotexAdmin）는 phase 1 을 짊어지지 않는 편이 architecture-guardrails 의「ERP module 잘라내기」원칙과 정합.
- 기존 `publish/views/` 패턴에 1 개 feature facade 만 추가하면 됨.

PotexAdmin 이 다음으로 착수해야 할 것은 **`Customer_Edit_History` 의 최소 설계**（`docs/backlog.md` 의 첫 항목）. v2 입력 탭에서 operator 가 업데이트하는 `upgrade_potential` / `future_proposal_possibility` / 운영 메모 등의 audit trail 이 이 설계 위에 얹혀야 하며, v2 통합의 Phase B writeback 은 이 설계 완료를 전제로 한다.

순서:
1. **potex-gas 측**: `Import_csvD` 시트 신설 + csvD parser + `publish/views/customer.ts` + `publish/customerWorkbook.ts` + UI 메뉴 3 개 + writeback 스텁 (Phase A).
2. **PotexAdmin 측**: `Customer_Edit_History` 설계 확정 (병주).
3. v2 input 탭 + writeback 본격화 (Phase B).

---

## 9. Phased migration plan

### Phase A — `Import_csvD` 신설 + v2 publish + UI 메뉴 3 개 (potex-gas)
**기간:** 1–2 주 / 착수 조건: §10 전건 확정 → **착수 가능**.

- A1: POTEX DB 에 `Import_csvD` 탭 신설. `workbook_manifest.json` 의 `phase1.db.required_tabs` 에 추가. `bootstrap.ts` 의 ensure 로직에도 포함.
- A2: `canonical/lstepCsv.ts` 신설. row 2 헤더 인식 + row 1 LStep ID 캡처 + label 기반 열 매핑 + full dump reconcile + Sync_Log 카운터.
- A3: `Line_Registrations` reconcile path 를 `Import_csvD` 입력으로 통합. `ConversionHistory` event 전개.
- A4: `publish/views/customer.ts` 신설, `顧客一覧_成約以降` matrix builder 구현. AFS 상태 판정 (`Plans` AFS row 유무), 경과 월수 derived, `upgrade_potential` / `future_proposal_possibility` 표시 열 (Phase B 입력 전엔 빈 표시).
- A5: `publish/customerWorkbook.ts` facade, `workbook_manifest.json` 에 v2 9 계통째로 추가, `Publish_Manifest` 등록.
- A6: **UI 메뉴 3 개를 POTEX DB 워크북에 등록** (`ui/` 측, 자연 순서로 정렬):
  - `顧客DB / csvD取込` → `runImportCsvD()`
  - `顧客DB / v2書戻し` → `runWritebackCustomerV2()` (Phase A 시점에서는 no-op + 안내 메시지)
  - `顧客DB / v2公開` → `runPublishCustomerV2()`
- A7: v2 표시 탭에 sheet protection + 안내 텍스트 재기재 + 조건부 서식 (1개월 경과 + 베이직 + 余地有).
- A8: `OPERATIONS_MANUAL.md` / `docs/sheet-reference.md` / `docs/backlog.md` / `agents/session.md` 갱신. 새 메뉴 사용법을 운영자용으로 기재.
- A9: read-only verify 를 `inspect_post_refresh_state.py` 확장으로 대응 (v2 탭 존재 + 행 수 + last_synced_at + `Import_csvD` Sync_Log).

**완료 조건:** live workbook 9 계통으로 가동. operator 가 csvD paste 후 `csvD取込` → (`v2書戻し` 있으면) → `v2公開` 순으로 클릭하면 v2 가 갱신. 성약 105 명 중 AFS 종료자를 제외한 수가 표시.

### Phase B — v2 input 탭과 writeback (potex-gas + `Customer_Edit_History`)
**착수 조건:** Phase A 검증 완료 + `Customer_Edit_History` 설계 완료 + operator 가 실제로 v2 를 1–2 주 운용해 「직접 편집하고 싶은 열」 리스트가 잡힘.

- B1: operator 운용 후 편집 요망 청취 (실제로 어떤 열을 고치고 싶었는지).
- B2: 최소 입력 탭 `顧客一覧_運用入力` 을 v2 에 신설. `contracts/customer.ts` 에 input contract 정의 (`upgrade_potential` / `future_proposal_possibility` enum + 운영 메모 free text + customer_id key).
- B3: `upgrade_potential` / `future_proposal_possibility` 의 DB 저장처 결정 — `Customers` snapshot 추가열 vs 새 relation table (`Customer_Sales_Notes` 등). `Customer_Edit_History` 설계와 정합.
- B4: `runWritebackCustomerV2()` 본구현. evidence 는 기존 alias / assignment pattern 답습 (`customer_input:{customer_id}@{timestamp}`).
- B5: 입력 탭에서 enum dropdown / data validation 을 GAS 측에서 강제 설정 (매 publish 마다 reapply).

### Phase C — PotexAdmin 이 customer 모듈을 병주로 흡수
**착수 조건:** Phase B 안정 + ERP module map §2.1 Customer / Identity 모듈 설계 완료.

- C1: PotexAdmin 이 POTEX DB 를 read-only 로 참조하는 customer dashboard.
- C2: v2 input 탭과 PotexAdmin UI 병존, 양쪽이 같은 writeback queue → DB 로 도착.
- C3: operator 사용 비율이 PotexAdmin 측으로 기울면, v2 해당 input 탭을 단계적으로 deprecate.

### Phase D — v2 deprecate
**착수 조건:** Phase C 에서 PotexAdmin 이 안정 운용 진입 + operator 가 v2 를 실용하지 않음을 1–2 개월 계측.

- v2 표시 전용 → 완전 deprecate. 판단 시기는 phase C 종반에 operator 와 합의.

---

## 10. operator 회답 로그 (2026-05-25 확정)

| Q# | 질문 | 회답 |
|---|---|---|
| Q1 | v2 에서 operator 가 지금 직접 편집하는 열 | 미확정 — 운용에 내보내고 확인. Phase B 에서 대응 |
| Q2 | LStep CSV 가 full dump 인지 delta 인지 | **full dump** 전제 |
| Q3 | 「成約以降」의 정의 | 成約 → 세션 중 → AFS (희망자만 추가 과금으로 진입) → AFS 종료 시 v2 에서 제외 |
| Q4 | v2 와 PotexAdmin 의 최종형 | **시나리오 X** (PotexAdmin 이 v2 를 최종 deprecate), 시기 미정 |
| 추가 | `⭕️使用中` 워크북 취급 | **건드리지 않음**. `Import_csvD` 탭을 POTEX DB 내에 신설 |
| 추가 | 자동화 cadence | **없음**. `csvD取込` / `v2書戻し` / `v2公開` 3 메뉴 모두 operator 수동 클릭 |
| 추가 | 신규 열 요망 | 「アップグレード余地」「今後提案可能性あり」 를 v2 에 추가 (CS / sales 판단, 1 개월 경과 시 upgrade 리마인드 지원용) |
| 임포트 탭 이름 | — | **`Import_csvD`** |
| 메뉴 구성 | — | **분리 3 개**: `csvD取込` / `v2書戻し` / `v2公開` |

---

## 11. 참고
- `docs/architecture-guardrails.md` (모듈 경계 / 의존 방향 / operator UX 원칙)
- `docs/plans/customer-ownership-matrix.md` (field 단위 owner / overwrite / review)
- `docs/plans/erp-module-map.md` (Customer / Identity = priority high)
- `docs/plans/2026-05-25-automation-and-erp-roadmap.md` (roadmap, ERP migration 단계)
- `docs/backlog.md` (현재 우선순위)
- `workbook_manifest.json` (live workbook 8 계통 → 9 계통 확장)
- `OPERATIONS_MANUAL.md` (operator 운용서)

---

## 12. 결론 요약

| 항목 | 결론 |
|---|---|
| Verdict | GO (전제 조건 전건 확정) |
| `Import_csvD` 위치 | POTEX DB 내 신규 탭. `⭕️使用中` 워크북은 건드리지 않음 |
| v2 역할 | display 중심 + 명시 input 탭만 writeback 허가 |
| 최대 리스크 | 표시 탭 내 operator 손편집의 덮어쓰기 race |
| `Import_csvD` → DB 계약 | §5 (2-row 헤더, `登録ID` 필수, full dump reconcile, schema drift 는 Sync_Log warning) |
| DB → v2 계약 | §6 (`顧客一覧_成約以降` view, 성약 이후 + AFS 중 + 경과 월수 + 업그레이드 余지 표시) |
| 자동 cadence | 없음. `csvD取込` / `v2書戻し` / `v2公開` 3 메뉴 수동 클릭 |
| Next slice | potex-gas 측 `Import_csvD` 신설 + csvD parser + `publish/views/customer.ts` + UI 메뉴 3 개 |
| PotexAdmin 관여 | 병주 (`Customer_Edit_History` 설계 먼저) |
| Migration | A (publish + csvD ingest + UI 메뉴) → B (input + writeback) → C (PotexAdmin 병주) → D (v2 deprecate) |
| Phase A 착수 | **가능** |
