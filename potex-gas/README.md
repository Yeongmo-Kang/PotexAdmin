# Potex GAS Scaffold

이 디렉토리는 Potex의 **DB workbook → 역할별 운영 workbook** 구조를 위한 Google Apps Script 스캐폴드다.

## 목표
- canonical DB workbook 하나를 허브로 사용
- CS / Concierge / Sales / Coaches / Executive workbook에 publish
- 운영자가 입력한 writeback sheet를 다시 DB로 수집

## 권장 실행 계정
트리거와 publish/writeback 수집은 **공용 Workspace 실행 계정 1개**로 통일하는 것이 안전하다.

## 로컬 준비
```bash
cd /mnt/c/Users/zerom/Desktop/DevZero/projects/potex/potex-gas
npm install
npm run build
clasp login
clasp create --type sheets --title "Potex Automation Hub" --rootDir ./dist
```

생성 후 `.clasp.json`이 생기면 아래를 실행:
```bash
npm run deploy
```

## Apps Script에서 최초 실행
1. `onOpen` 또는 `bootstrapProject`
2. `setInitialScriptProperties`
3. `installTriggers`
4. `runPublishAll` 테스트

## Script Properties에 넣을 키
- `DB_SPREADSHEET_ID`
- `CS_SPREADSHEET_ID`
- `CONCIERGE_SPREADSHEET_ID`
- `SALES_SPREADSHEET_ID`
- `COACHES_SPREADSHEET_ID`
- `EXEC_SPREADSHEET_ID`
- `ENABLE_CONCIERGE`
- `ENABLE_SALES`
- `ENABLE_COACHES`
- `ENABLE_EXEC`
- `SOURCE_FEEDBACK_WORKBOOK_ID` (default: monthly feedback workbook)
- `SOURCE_FEEDBACK_SHEETS` (default: `通常月用,（最終月用）`)
- `SOURCE_CUSTOMERS_WORKBOOK_ID` (optional; if empty, current scaffold falls back to canonical `Customers` as a temporary staging source)
- `SOURCE_CUSTOMERS_SHEET_NAME` (default: `顧客管理`)
- `SOURCE_APPLICATIONS_SHEET_NAME` (default: `フォームの回答`)
- `SOURCE_CUSTOMERS_FALLBACK_TO_CANONICAL` (default: `true`)

## 현재 포함된 공개 함수
- `bootstrapProject()`
- `validateEnvironment()`
- `runCanonicalRefresh()`
- `runPublishAll()`
- `runWritebackCollection()`
- `runFullRefresh()`
- `installTriggers()`
- `reinstallTriggers()`

## 현재 포함된 Sales publish 흐름
- `runPublishAll()` / `runFullRefresh()` / `runWritebackCollection()`가 `ENABLE_SALES=true` 및 `SALES_SPREADSHEET_ID` 설정 시 Sales workbook도 함께 publish
- `営業_契約一覧`: 계약/착금 source 기준 전체 상업 row를 최신순으로 노출하며 unmatched row도 그대로 표시
- `営業_未入金一覧`: 미착금 row 전용 큐
- `営業_ファネル推移`: canonical `ConversionHistory` 기반 최근 funnel 이벤트 뷰
- `営業_データ状況`: payments / plans / conversion / unmatched counts 요약

## 현재 포함된 source -> canonical feedback 흐름
- `runCanonicalRefresh()`가 `Feedback`, `Exceptions_FeedbackMatch`, `Line_Registrations`를 GAS 안에서 재구성 (P-012 Phase 2 step 2d로 `Staging_Feedback` 흡수, Phase 1로 `Staging_LineRegistration` 흡수)
- feedback source는 기본적으로 `月次振り返りアンケート （回答）` workbook의 `通常月用`, `（最終月用）`를 읽음
- feedback dedupe key: `response_id = resp_{12hex}` SHA-256 hash (`source_sheet + submitted_at + respondent_email + raw_coach_name`)
- customer source workbook id가 아직 설정되지 않았으면 `Staging_Customers`는 임시로 canonical `Customers`를 fallback source로 사용
- `Staging_Customers`는 `line_registration_id` 컬럼을 포함하며, canonical `Customers`에 이미 값이 있으면 보존하고, 없으면 최신 matched LINE registration을 customer 기준으로 채움
- `runCanonicalRefresh()`는 canonical `Customers` 시트에 `line_registration_id` 컬럼이 없으면 추가하고, customer별 최신 LINE registration id를 빈 칸에 채워 넣음
- `Line_Registrations`의 PK는 `line_registration_id = line_{segment}_{line_user_id}` (LStep CSV 재import에도 안정)
- `Staging_Payments`는 raw 유입명 `customer_name`을 유지하고, canonical 연결 결과는 `customer_id`만 저장하며 canonical 고객명은 publish 단계에서 `Customers` 조인으로 표시함
- `runCanonicalRefresh()`는 `Customer_Coach_Assignments`, `Customer_Channel_Links` canonical 테이블도 재생성하며, mutable 관계 데이터는 별도 테이블로 분리하는 방향으로 정규화를 시작함
- DB 모든 표는 `created_at` / `updated_at`을 끝에 둠 (`Sync_Log` append-only 만 예외)

## 현재 포함된 CS alias 운영 흐름
- DB의 `Exceptions_FeedbackMatch`와 `Customer_Alias_Map`를 읽어 `CS_別名解決入力`을 publish
- CS 운영자는 `operator_decision_status`, `operator_selected_customer_id`, `operator_selected_customer_name`, `operator_note`만 입력
- `runWritebackCollection()`이 입력을 `Customer_Alias_Map`에 반영
- 승인된 alias는 같은 실행에서 `Feedback` / `Ops_Feedback_Review` / `Exceptions_FeedbackMatch`에도 자동 적용
- 따라서 정상 운영에서는 로컬 Python 실행 없이도 alias 예외를 닫는 것을 목표로 한다

## 주의
- 현재 코드는 **스캐폴드 + 운영 가능한 feedback ingest/writeback 프레임**이다.
- feedback 원본 ingest는 GAS로 들어왔지만, customer raw ingest는 source workbook id 설정이 더 필요하다.
- 따라서 현재 단계에서는 feedback 파이프라인 운영 자동화는 가능하고, customer source는 점진적으로 이관하는 전략이 적절하다.

## 로컬라이제이션 규칙
- **DB / canonical 시트의 컬럼명은 영어 snake_case를 유지**한다. 스키마 안정성, 조인, writeback, 스크립트 호환성을 위해 번역하지 않는다.
- **운영자-facing publish workbook만 일본어 표시를 적용**한다. 대상은 visible header, README/help 문구, summary/health label, queue/status/reason 같은 visible enum 값이다.
- dual-header publish 시트에서는 **1행=표시용 일본어, 2행=숨김 machine header(영어)** 원칙을 유지한다.
- hidden machine row의 영어 키(`purpose`, `read_first`, `open_total` 등)는 정상이며, operator visible 셀에만 영어가 남지 않도록 점검한다.
