# Potex Project Workspace

This is the dedicated Hermes project folder for Potex work.

## Purpose
- Keep Potex work isolated from other projects
- Preserve project-specific docs, scripts, outputs, and session state
- Prefer spreadsheet-first operations and clear runbooks for non-technical operators

## Non-Negotiable Rule
**Do not modify or delete currently operating source/reference spreadsheets.**

Read-only source/reference workbooks:
- `受講者管理`
- `顧客満足度会議`
- `月次振り返りアンケート （回答）`
- `⭕️使用中｜POTEX数値管理`

## Current Managed Workbooks
- `POTEX DB`: canonical database workbook
- `Potex CS`: CS operator workbook
- `Potex Executive`: summary / health-check workbook
- `Potex Concierge`: read-only concierge follow-up workbook
- `Potex Sales`: read-only sales monitoring workbook
- `Potex Coaches`: read-only coach monitoring workbook

각 managed workbook의 operator-facing 탭은 일본어 탭명 기준으로 운영한다.

## Start Here
If someone is new to this project, read in this order:

1. `CLAUDE.md` — guardrails + current verdicts
2. `agents/workflow.md` — operating workflow
3. `docs/database-overview.md`
4. `docs/sheet-reference.md`
5. `OPERATIONS_MANUAL.md`
6. `PHASE1_CUTOVER_RUNBOOK.md`
7. `docs/phase1-acceptance-checklist.md`
8. `docs/backlog.md`
9. `agents/session.md`

## Authoritative Docs
- Database overview: `docs/database-overview.md`
- Sheet-by-sheet reference: `docs/sheet-reference.md`
- Operator manual: `OPERATIONS_MANUAL.md`
- Workbook architecture: `OPS_WORKBOOK_ARCHITECTURE.md`
- Phase 1 deploy/cutover steps: `PHASE1_CUTOVER_RUNBOOK.md`
- Phase 1 acceptance checks: `docs/phase1-acceptance-checklist.md`
- Current status / next work: `docs/backlog.md`
- Session checkpoint: `agents/session.md`

## Workspace Rules
- Manage Potex from this folder: `/mnt/c/Users/zerom/Desktop/DevZero/projects/potex`
- Treat source Google Sheets as read-only operational sources
- Prefer DB hub -> role workbook publish/writeback flow over ad-hoc local fixes
- Keep live session checkpoints in `agents/session.md`
- Keep backlog/status in `docs/backlog.md`

## Key Paths
- Project context / guardrails: `CLAUDE.md`
- Operating workflow: `agents/workflow.md`
- GAS code: `potex-gas/`
- Generated outputs: `generated/`
- Workbook manifest: `workbook_manifest.json`
- Provisioning script (one-shot, for new workbooks): `provision_phase1_workbooks.py`
- Script properties generator (one-shot): `generate_phase1_script_properties.py`
