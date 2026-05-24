# Hermes → Claude Handoff (2026-05-23)

대상 프로젝트: `/mnt/c/Users/zerom/Desktop/DevZero/projects/potex`
대상 서브프로젝트: `/mnt/c/Users/zerom/Desktop/DevZero/projects/potex/potex-gas`

---

## 1. 이번 세션에서 실제로 끝난 것

### 1.1 publish UX localization live 반영 완료
- `potex-gas/src/sheets.ts`
  - publish/read-only 시트용 dual-header 구조 유지:
    - row 1 = operator-facing display label
    - row 2 = hidden machine key
  - 표시용 헤더를 **한국어/영어 혼합 → 일본어 operator-friendly** 방향으로 정리.
  - `canonical_customer_name`, `segment`, `sales_owner_name`, `customer_match_method`, `source_sheet`, `source_row` 등 Sales 쪽 누락 label도 보강.
- `potex-gas/src/publish/views.ts`
  - README/help text 일본어화:
    - `buildExecReadme()`
    - `buildCsReadme()`
    - `buildConciergeReadme()`
    - `buildSalesReadme()`
    - `buildCoachReadme()`
  - 주요 data-health / note text 일본어화:
    - `buildCsApprovalProgress()`
    - `buildExecDataHealth()`
    - `buildConciergeDataHealth()`
    - `buildSalesDataHealth()`
    - `buildCoachDataHealth()`
    - `buildPartnerDataHealth()`
- `npm run build` 성공.
- Windows Node 경로를 직접 써서 push 성공:
  - PowerShell에서 `C:\Program Files\nodejs\node.exe node_modules\@google\clasp\build\src\index.js push -f`
- 사용자 측 `runPublishAll` 성공 확인까지 받음.

### 1.2 legacy workbook 실제 시트 검토 완료
브라우저 런타임 의존성 설치 후 실제 Google Sheet를 열어 확인했다.

검토한 시트:
- `POTEX_顧客管理_v2 のコピーテスト用 のコピー`
- URL: `https://docs.google.com/spreadsheets/d/13gkQBNoquTwjNO_91zpLBU5h5oE2Hdmh2eBcL8m3RR4/edit?gid=1749642372#gid=1749642372`

실제 확인한 UX 패턴:
- `__README`가 landing page 역할
- role-based tab naming
- 일본어 운영 문구 중심
- 실제 보이는 탭 구조:
  - `__README`
  - `商談リスト`
  - `0_取込ログ`
  - `コンシェルジュ業務`
  - `受講者管理`
  - `AFS面談管理`
  - `AFS受講管理`
  - `入金管理`
  - `コースマスター`
  - `コーチマスター`
  - `テンプレ`
  - `返金管理`
  - `0_集計用ビュー`
  - `債権履歴`
  - `債権サマリー`

결론:
- **채택할 것:** README-first, role-first naming, Japanese operator wording, daily work tabs vs reference/admin tabs 구분
- **채택하지 않을 것:** sheet-coupled formula architecture, column-position/version-offset branching, workbook-as-DB, cumulative upgrade-patch architecture

### 1.3 프로젝트 계획 문서 반영 완료
수정한 파일:
- `docs/plans/2026-05-22-workbook-ux-priority-plan.md`
- `docs/backlog.md`
- `agents/session.md`

핵심 반영 내용:
- legacy workbook review 결과 추가
- second-pass UX 방향을 `__README` 스타일 / role-first Japanese wording / 잔여 영어 display value 정리로 업데이트

---

## 2. 현재 중요한 운영/아키텍처 컨텍스트

### 2.1 절대 규칙
- 원본 4종 workbook (`受講者管理`, `顧客満足度会議`, `月次振り返りアンケート（回答）`, `⭕️使用中｜POTEX数値管理`)은 **read-only reference**. 구조 변경 / 탭 삭제 / GAS write 금지.
- **POTEX DB만 canonical**.
- publish 시트 수기 입력 금지. 입력은 명시적 input/review 탭에서만.
- DB에 derive-only 데이터를 중복 저장하지 말 것.
- 확신 없는 이름 매칭을 alias map에 `approved` 처리 금지.

### 2.2 현재 publish UX 구현 철학
- operator-friendly UX는 workbook surface에서만 강화한다.
- machine key / hidden row / writeback contract는 유지한다.
- 즉, **표시용 일본어**와 **내부 key 안정성**을 동시에 유지하는 것이 원칙이다.

### 2.3 최근에 이미 해결된 함정
- dual-header를 editable 탭까지 적용하면 validation이 깨진다.
- 따라서 dual-header는 **read-only / publish-only 시트에만 적용**해야 한다.
- editable input/review 탭은 single header를 유지하는 쪽이 현재 안전하다.

### 2.4 Claude가 이미 재검토한 내용
Claude read-only review 기준으로:
- 일본어 헤더/README/help/note는 많이 정리되었음
- 남은 operator-facing risk는 주로:
  1. `suggested_action` 같은 **셀 값 자체의 영어 코드**
  2. workbook별 README 톤/landing UX의 일관성

---

## 3. Claude에게 맡길 다음 작업 제안

## 추천 주작업: operator-facing residual English cleanup + README UX second pass

### Goal
legacy workbook의 `__README`/role-tab UX를 참고하되, current managed-workbook architecture는 유지하면서:
1. operator가 실제로 보는 **영어 값**을 줄이고,
2. role workbook의 README/guide tone을 더 일본 운영팀 친화적으로 맞추고,
3. machine key / writeback contract는 그대로 유지.

### 우선 범위
#### A. `suggested_action` display 문제 검토/수정
현재 의심 지점:
- `CS_入金名寄せ確認`
- `CS_継続名寄せ確認`

현재 값 예시:
- `approve_if_context_matches`
- `search_customer_or_wait_for_customer_ingest`
- `hold_no_candidate_found`

이 값들은 operator가 직접 보는 셀 값이라 UX 리스크가 있다.
다만 writeback 또는 downstream logic이 이 값을 key처럼 기대하는지 먼저 확인해야 한다.

#### B. README / landing guidance second pass
파일 중심:
- `potex-gas/src/publish/views.ts`
- 필요시 `potex-gas/src/sheets.ts`

검토 포인트:
- workbook별 README가 legacy `__README`처럼
  - 읽는 순서
  - 무엇을 편집하면 되는지
  - 무엇을 편집하면 안 되는지
  - 색 의미 / 예외 처리 방향
  를 더 직접적으로 안내하는지
- 역할별 tone이 일관적인지

### 비추천 작업
- source workbook 구조를 따라 formula web을 도입하는 것
- canonical schema를 legacy workbook 구조로 맞추는 것
- editable input 탭에 dual-header를 다시 확대하는 것

---

## 4. Claude가 꼭 읽어야 할 파일
우선순위 순:
1. `agents/session.md`
2. `docs/backlog.md`
3. `docs/plans/2026-05-22-workbook-ux-priority-plan.md`
4. `potex-gas/src/sheets.ts`
5. `potex-gas/src/publish/views.ts`
6. 필요시:
   - `potex-gas/src/publish/csWorkbook.ts`
   - `potex-gas/src/publish/managementWorkbook.ts`
   - `potex-gas/src/publish/conciergeWorkbook.ts`
   - `potex-gas/src/publish/coachWorkbook.ts`
   - `potex-gas/src/writeback/csWriteback.ts`

---

## 5. 기대 결과물
Claude에게 기대하는 output은 두 단계 중 하나:

### Option A — review + patch plan only
- `suggested_action` 값을 일본어 display로 바꿔도 안전한지 판단
- 안전하지 않으면 display-only 우회안 제안
- workbook README second-pass 개선안 제시

### Option B — implementation까지
- 위 판단을 바탕으로 실제 코드 patch
- `npm run build`
- push 가능하면 push 경로까지 정리
- 문서(`docs/backlog.md`, `agents/session.md`) 업데이트

개인적으로는 **Option B**가 더 낫지만, Claude가 먼저 안전성 판단 후 바로 구현하는 방식이 좋다.

---

## 6. 중요 주의사항
- `suggested_action`를 바꿀 때는 **표시값인지 로직키인지 먼저 증명**할 것.
- operator-friendly display text를 넣더라도 writeback이 기대하는 machine field를 깨면 안 된다.
- README 일본어화는 단순 번역보다 **운영자 지시문**으로 다듬는 게 중요하다.
- 탭 구조/README UX는 legacy workbook을 참고하되, 아키텍처는 current managed model을 유지해야 한다.

---

## 7. 현재 상태 한 줄 요약
**live deploy는 이미 성공했고, 이제 남은 일은 구조 변경이 아니라 operator-facing residual UX polish다.**
