import { getRuntimeConfig } from '../config';
import { SHEETS, VIEWS } from '../constants';
import { PARTNER_ASSIGNEES } from '../partners';
import { clearAndRewrite, openSpreadsheetById, readSheetAsObjects, readSheetAsObjectsOrEmpty } from '../sheets';

export type PartnerStatusWritebackStats = {
  pendingPartnerStatusRows: number;
  processedPartnerStatusRows: number;
  invalidPartnerStatusRows: number;
};

function safeReadSheetAsObjects(spreadsheet: GoogleAppsScript.Spreadsheet.Spreadsheet, sheetName: string): Array<Record<string, string>> {
  try {
    return readSheetAsObjects(spreadsheet, sheetName);
  } catch (error) {
    return [];
  }
}

function rowsToValues(header: string[], rows: Array<Record<string, string>>): Array<Array<string>> {
  return [header, ...rows.map((row) => header.map((key) => row[key] || ''))];
}

function isTruthy(value: string): boolean {
  return ['true', '1', 'yes', 'y', 'submit'].includes(String(value || '').trim().toLowerCase());
}

const CUSTOMER_COACH_ASSIGNMENTS_HEADER = [
  'assignment_id', 'lead_id', 'customer_id', 'lead_display_name', 'respondent_email', 'phone', 'age', 'source_sheet', 'source_row',
  'coach_id', 'role', 'assignee_kind', 'assignee_scope', 'assignment_status', 'assigned_at', 'assignment_source',
  'meeting_status', 'meeting_done_at', 'potex_sale_status', 'recruitment_status', 'partner_status_note', 'last_partner_update_at', 'last_partner_updated_by',
  'ended_at', 'note', 'created_at', 'updated_at',
] as const;

export function collectPartnerStatusWritebackRows(): PartnerStatusWritebackStats {
  const cfg = getRuntimeConfig();
  const db = openSpreadsheetById(cfg.dbSpreadsheetId);
  const assignmentRows = readSheetAsObjectsOrEmpty(db, SHEETS.CUSTOMER_COACH_ASSIGNMENTS).map((row) => {
    const normalized: Record<string, string> = {};
    CUSTOMER_COACH_ASSIGNMENTS_HEADER.forEach((key) => {
      normalized[key] = row[key] || '';
    });
    return normalized;
  });
  const assignmentIndexByKey = new Map<string, number>();
  assignmentRows.forEach((row, idx) => {
    const key = [row['lead_id'] || '', row['coach_id'] || '', (row['assignee_kind'] || '').toLowerCase()].join('||');
    if (key) assignmentIndexByKey.set(key, idx);
  });

  const workbookTargets = [
    { spreadsheetId: cfg.inaiSpreadsheetId, partnerCoachId: PARTNER_ASSIGNEES[0]?.coachId || '' },
    { spreadsheetId: cfg.satoSpreadsheetId, partnerCoachId: PARTNER_ASSIGNEES[1]?.coachId || '' },
  ].filter((target) => target.spreadsheetId && target.partnerCoachId);

  let pendingPartnerStatusRows = 0;
  let processedPartnerStatusRows = 0;
  let invalidPartnerStatusRows = 0;
  let canonicalChanged = false;
  const syncedAt = new Date().toISOString();

  workbookTargets.forEach((target) => {
    const workbook = openSpreadsheetById(target.spreadsheetId || '');
    const sheet = workbook.getSheetByName(VIEWS.PARTNER_STATUS_INPUT);
    if (!sheet) return;
    const inputRows = safeReadSheetAsObjects(workbook, VIEWS.PARTNER_STATUS_INPUT);
    const lastColumn = sheet.getLastColumn();
    if (lastColumn <= 0) return;
    const header = sheet.getRange(1, 1, 1, lastColumn).getValues()[0].map((cell) => String(cell || ''));
    const syncStatusCol = header.indexOf('sync_status') + 1;
    const lastCollectedAtCol = header.indexOf('last_collected_at') + 1;

    inputRows.forEach((row, index) => {
      if (!isTruthy(row['submit_update'] || '')) return;
      pendingPartnerStatusRows += 1;
      const leadId = row['lead_id'] || '';
      const coachId = row['coach_id'] || target.partnerCoachId;
      const key = [leadId, coachId, 'partner'].join('||');
      const assignmentIndex = assignmentIndexByKey.get(key);
      const sheetRow = index + 2;

      if (!leadId || coachId !== target.partnerCoachId || assignmentIndex === undefined) {
        invalidPartnerStatusRows += 1;
        if (syncStatusCol > 0) sheet.getRange(sheetRow, syncStatusCol).setValue('error_assignment_not_found');
        if (lastCollectedAtCol > 0) sheet.getRange(sheetRow, lastCollectedAtCol).setValue(syncedAt);
        return;
      }

      const assignment = assignmentRows[assignmentIndex];
      assignment['meeting_status'] = row['operator_meeting_status'] || assignment['meeting_status'] || '';
      assignment['meeting_done_at'] = row['operator_meeting_done_at'] || assignment['meeting_done_at'] || '';
      assignment['potex_sale_status'] = row['operator_potex_sale_status'] || assignment['potex_sale_status'] || '';
      assignment['recruitment_status'] = row['operator_recruitment_status'] || assignment['recruitment_status'] || '';
      assignment['partner_status_note'] = row['operator_partner_status_note'] || assignment['partner_status_note'] || '';
      assignment['last_partner_update_at'] = syncedAt;
      assignment['last_partner_updated_by'] = 'partner';
      assignment['updated_at'] = syncedAt;
      canonicalChanged = true;
      processedPartnerStatusRows += 1;

      if (syncStatusCol > 0) sheet.getRange(sheetRow, syncStatusCol).setValue('processed');
      if (lastCollectedAtCol > 0) sheet.getRange(sheetRow, lastCollectedAtCol).setValue(syncedAt);
    });
  });

  if (canonicalChanged) {
    clearAndRewrite(db, SHEETS.CUSTOMER_COACH_ASSIGNMENTS, rowsToValues(CUSTOMER_COACH_ASSIGNMENTS_HEADER as unknown as string[], assignmentRows));
  }

  return {
    pendingPartnerStatusRows,
    processedPartnerStatusRows,
    invalidPartnerStatusRows,
  };
}
