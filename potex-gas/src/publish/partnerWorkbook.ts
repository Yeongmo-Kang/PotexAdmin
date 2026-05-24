import { getRuntimeConfig } from '../config';
import { PROPS, SHEETS, VIEWS } from '../constants';
import { openSpreadsheetById, readSheetAsObjects, readSheetAsObjectsOrEmpty, clearAndRewrite } from '../sheets';
import { PARTNER_ASSIGNEES } from '../partners';
import {
  buildPartnerAssignedLeadsView,
  buildPartnerDataHealth,
  buildPartnerReadme,
  buildPartnerStatusInput,
} from './views/partner';

function safeReadSheetAsObjects(spreadsheet: GoogleAppsScript.Spreadsheet.Spreadsheet, sheetName: string): Array<Record<string, string>> {
  try {
    return readSheetAsObjects(spreadsheet, sheetName);
  } catch (error) {
    return [];
  }
}

export function publishPartnerWorkbooks(): void {
  const cfg = getRuntimeConfig();
  const props = PropertiesService.getScriptProperties();

  if (!cfg.inaiSpreadsheetId) {
    const workbook = SpreadsheetApp.create('Potex Inai');
    props.setProperty(PROPS.INAI_SPREADSHEET_ID, workbook.getId());
    cfg.inaiSpreadsheetId = workbook.getId();
  }
  if (!cfg.satoSpreadsheetId) {
    const workbook = SpreadsheetApp.create('Potex Sato');
    props.setProperty(PROPS.SATO_SPREADSHEET_ID, workbook.getId());
    cfg.satoSpreadsheetId = workbook.getId();
  }

  const db = openSpreadsheetById(cfg.dbSpreadsheetId);
  const customerRows = readSheetAsObjects(db, SHEETS.CUSTOMERS);
  const assignmentRows = readSheetAsObjectsOrEmpty(db, SHEETS.CUSTOMER_COACH_ASSIGNMENTS);
  const plansRows = readSheetAsObjectsOrEmpty(db, SHEETS.PLANS);

  const workbookTargets = [
    { spreadsheetId: cfg.inaiSpreadsheetId, partnerCoachId: PARTNER_ASSIGNEES[0]?.coachId || '', partnerName: PARTNER_ASSIGNEES[0]?.coachName || '' },
    { spreadsheetId: cfg.satoSpreadsheetId, partnerCoachId: PARTNER_ASSIGNEES[1]?.coachId || '', partnerName: PARTNER_ASSIGNEES[1]?.coachName || '' },
  ].filter((target) => target.spreadsheetId && target.partnerCoachId);

  workbookTargets.forEach((target) => {
    const workbook = openSpreadsheetById(target.spreadsheetId || '');
    const existingStatusInputRows = safeReadSheetAsObjects(workbook, VIEWS.PARTNER_STATUS_INPUT);

    clearAndRewrite(workbook, VIEWS.PARTNER_README, buildPartnerReadme(target.partnerName));
    clearAndRewrite(workbook, VIEWS.PARTNER_ASSIGNED_LEADS, buildPartnerAssignedLeadsView(target.partnerName, target.partnerCoachId, assignmentRows, customerRows, plansRows));
    clearAndRewrite(workbook, VIEWS.PARTNER_STATUS_INPUT, buildPartnerStatusInput(target.partnerCoachId, assignmentRows, customerRows, plansRows, existingStatusInputRows));
    clearAndRewrite(workbook, VIEWS.PARTNER_DATA_HEALTH, buildPartnerDataHealth(target.partnerName, target.partnerCoachId, assignmentRows));
  });
}
