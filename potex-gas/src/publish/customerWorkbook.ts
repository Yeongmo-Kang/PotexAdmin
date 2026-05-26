import { getRuntimeConfig } from '../config';
import { SHEETS, VIEWS } from '../constants';
import { clearAndRewrite, openSpreadsheetById, readSheetAsObjects, readSheetAsObjectsOrEmpty } from '../sheets';
import { buildCustomerContractedView, CUSTOMER_VIEW_COLUMN_COUNT } from './views/customer';

const PROTECTION_DESCRIPTION = '[v2公開] menu writes this sheet. operator 編集は次の publish で上書きされます.';
const SHEET_NOTICE_ROW = '※ このシートは [Potex Sync > v2公開] メニュー実行時に自動再生成されます。直接編集は次回実行で上書きされます。修正は別途の入力タブで行ってください。';

const STATUS_COLOR_SEIYAKU_BG = { red: 0.7764706, green: 0.9372549, blue: 0.80784315 };
const STATUS_COLOR_SEIYAKU_FG = { red: 0, green: 0.38039216, blue: 0 };
const STATUS_COLOR_SHITSUCHU_BG = { red: 1, green: 0.78039217, blue: 0.80784315 };
const STATUS_COLOR_SHITSUCHU_FG = { red: 0.6117647, green: 0, blue: 0.023529412 };
const STATUS_COLOR_KENTOCHU_BG = { red: 1, green: 0.92156863, blue: 0.6117647 };
const STATUS_COLOR_KENTOCHU_FG = { red: 0.6117647, green: 0.34117648, blue: 0 };

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
    if (lastRow < 3 || lastColumn < CUSTOMER_VIEW_COLUMN_COUNT) return;
    const dataRange = sheet.getRange(3, 1, lastRow - 2, lastColumn);
    const statusRange = sheet.getRange(3, 8, lastRow - 2, 1);
    sheet.clearConditionalFormatRules();
    const rules = [
      SpreadsheetApp.newConditionalFormatRule()
        .whenTextEqualTo('成約')
        .setBackground(rgbHex(STATUS_COLOR_SEIYAKU_BG))
        .setFontColor(rgbHex(STATUS_COLOR_SEIYAKU_FG))
        .setRanges([statusRange])
        .build(),
      SpreadsheetApp.newConditionalFormatRule()
        .whenTextEqualTo('失注')
        .setBackground(rgbHex(STATUS_COLOR_SHITSUCHU_BG))
        .setFontColor(rgbHex(STATUS_COLOR_SHITSUCHU_FG))
        .setRanges([statusRange])
        .build(),
      SpreadsheetApp.newConditionalFormatRule()
        .whenTextEqualTo('検討中')
        .setBackground(rgbHex(STATUS_COLOR_KENTOCHU_BG))
        .setFontColor(rgbHex(STATUS_COLOR_KENTOCHU_FG))
        .setRanges([statusRange])
        .build(),
      SpreadsheetApp.newConditionalFormatRule()
        .whenFormulaSatisfied('=AND($O3>=1, OR(REGEXMATCH(LOWER($K3),"ベーシック|basic"), $K3=""), OR($W3="可能性あり", $W3="要打診"))')
        .setBackground('#FFF59D')
        .setRanges([dataRange])
        .build(),
    ];
    sheet.setConditionalFormatRules(rules);
  } catch (error) {
    // best effort
  }
}

function rgbHex(rgb: { red: number; green: number; blue: number }): string {
  const to255 = (v: number) => Math.round(Math.max(0, Math.min(1, v)) * 255);
  const hex = (v: number) => v.toString(16).padStart(2, '0');
  return `#${hex(to255(rgb.red))}${hex(to255(rgb.green))}${hex(to255(rgb.blue))}`;
}

function applyBasicFilter(sheet: GoogleAppsScript.Spreadsheet.Sheet): void {
  try {
    const lastRow = sheet.getLastRow();
    const lastColumn = sheet.getLastColumn();
    if (lastRow < 2 || lastColumn < 1) return;
    const existing = sheet.getFilter();
    if (existing) existing.remove();
    sheet.getRange(2, 1, lastRow - 1, lastColumn).createFilter();
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

export type PublishCustomerWorkbookStats = {
  customerRows: number;
  shodanMatched: number;
  shodanUnmatched: number;
  shodanAmbiguousNameSkipped: number;
};

export function publishCustomerWorkbook(): PublishCustomerWorkbookStats {
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
  const shodanRows = readSheetAsObjectsOrEmpty(customerV2, VIEWS.CUSTOMER_SHODAN_LIST);
  const editorialNotes: Array<Record<string, string>> = [];

  const syncedAt = new Date().toISOString();
  const result = buildCustomerContractedView({
    customers,
    plans,
    payments,
    customerCoachAssignments,
    coaches,
    lineRegistrations,
    followupQueue,
    editorialNotes,
    shodanRows,
    syncedAt,
  });

  clearAndRewrite(customerV2, VIEWS.CUSTOMER_CONTRACTED_VIEW, result.rows);
  const sheet = customerV2.getSheetByName(VIEWS.CUSTOMER_CONTRACTED_VIEW);
  if (sheet) {
    writeNoticeRow(sheet);
    applyBasicFilter(sheet);
    applyConditionalFormatting(sheet);
    applyProtection(sheet);
  }

  return {
    customerRows: Math.max(result.rows.length - 1, 0),
    shodanMatched: result.shodanMatched,
    shodanUnmatched: result.shodanUnmatched,
    shodanAmbiguousNameSkipped: result.shodanAmbiguousNameSkipped,
  };
}
