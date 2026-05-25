import { getRuntimeConfig } from '../config';
import { SHEETS, VIEWS } from '../constants';
import { clearAndRewrite, openSpreadsheetById, readSheetAsObjects, readSheetAsObjectsOrEmpty } from '../sheets';
import { buildCustomerContractedView } from './views/customer';

const PROTECTION_DESCRIPTION = '[v2公開] menu writes this sheet. operator 編集は次の publish で上書きされます.';
const SHEET_NOTICE_ROW = '※ このシートは [Potex Sync > v2公開] メニュー実行時に自動再生成されます。直接編集は次回実行で上書きされます。修正は別途の入力タブで行ってください。';

function applyProtection(sheet: GoogleAppsScript.Spreadsheet.Sheet): void {
  try {
    const existing = sheet.getProtections(SpreadsheetApp.ProtectionType.SHEET);
    existing.forEach((protection) => {
      if (protection.getDescription() === PROTECTION_DESCRIPTION) {
        protection.remove();
      }
    });
    const protection = sheet.protect().setDescription(PROTECTION_DESCRIPTION);
    protection.setWarningOnly(true);
  } catch (error) {
    // protection is best-effort
  }
}

function applyConditionalFormatting(sheet: GoogleAppsScript.Spreadsheet.Sheet): void {
  try {
    const lastRow = sheet.getLastRow();
    const lastColumn = sheet.getLastColumn();
    if (lastRow < 2 || lastColumn < 4) return;
    const range = sheet.getRange(2, 1, lastRow - 1, lastColumn);
    sheet.clearConditionalFormatRules();
    const rule = SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=AND($D2>=1, OR(REGEXMATCH(LOWER($E2),"ベーシック|basic"), $E2=""), OR($L2="可能性あり", $L2="要打診"))')
      .setBackground('#FFF59D')
      .setRanges([range])
      .build();
    sheet.setConditionalFormatRules([rule]);
  } catch (error) {
    // best effort
  }
}

function writeNoticeRow(sheet: GoogleAppsScript.Spreadsheet.Sheet): void {
  if (sheet.getMaxRows() < 2) return;
  sheet.insertRowBefore(1);
  sheet.getRange(1, 1).setValue(SHEET_NOTICE_ROW);
  const lastColumn = sheet.getLastColumn();
  if (lastColumn >= 2) sheet.getRange(1, 1, 1, lastColumn).merge();
  sheet.getRange(1, 1).setBackground('#FFE0B2').setFontWeight('bold');
  sheet.setFrozenRows(2);
}

export function publishCustomerWorkbook(): void {
  const cfg = getRuntimeConfig();
  if (!cfg.customerV2SpreadsheetId) {
    throw new Error('CUSTOMER_V2_SPREADSHEET_ID is not set. 운영자에게 v2 워크북 ID 등록 요청 후 다시 실행하세요.');
  }
  const db = openSpreadsheetById(cfg.dbSpreadsheetId);
  const customerV2 = openSpreadsheetById(cfg.customerV2SpreadsheetId);

  const customers = readSheetAsObjects(db, SHEETS.CUSTOMERS);
  const plans = readSheetAsObjects(db, SHEETS.PLANS);
  const payments = readSheetAsObjects(db, SHEETS.PAYMENTS);
  const customerCoachAssignments = readSheetAsObjectsOrEmpty(db, SHEETS.CUSTOMER_COACH_ASSIGNMENTS);
  const coaches = readSheetAsObjects(db, SHEETS.COACHES);
  const lineRegistrations = readSheetAsObjects(db, SHEETS.LINE_REGISTRATIONS);
  const followupQueue = readSheetAsObjectsOrEmpty(db, SHEETS.OPS_FOLLOWUP_QUEUE);
  const editorialNotes: Array<Record<string, string>> = [];

  const syncedAt = new Date().toISOString();
  const rows = buildCustomerContractedView({
    customers,
    plans,
    payments,
    customerCoachAssignments,
    coaches,
    lineRegistrations,
    followupQueue,
    editorialNotes,
    syncedAt,
  });

  clearAndRewrite(customerV2, VIEWS.CUSTOMER_CONTRACTED_VIEW, rows);
  const sheet = customerV2.getSheetByName(VIEWS.CUSTOMER_CONTRACTED_VIEW);
  if (sheet) {
    writeNoticeRow(sheet);
    applyConditionalFormatting(sheet);
    applyProtection(sheet);
  }
}
