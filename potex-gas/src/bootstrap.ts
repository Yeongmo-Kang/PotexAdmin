import { getRuntimeConfig, setInitialScriptProperties } from './config';
import { requireValue } from './guards';

export function validateEnvironment(): void {
  const cfg = getRuntimeConfig();
  requireValue('DB_SPREADSHEET_ID', cfg.dbSpreadsheetId);
  requireValue('CS_SPREADSHEET_ID', cfg.csSpreadsheetId);
  requireValue('SOURCE_FEEDBACK_WORKBOOK_ID', cfg.sourceFeedbackWorkbookId);
  SpreadsheetApp.openById(cfg.dbSpreadsheetId);
  SpreadsheetApp.openById(cfg.csSpreadsheetId);
  SpreadsheetApp.openById(cfg.sourceFeedbackWorkbookId);
  if (cfg.sourceCustomersWorkbookId) SpreadsheetApp.openById(cfg.sourceCustomersWorkbookId);
  if (cfg.enableExec && cfg.execSpreadsheetId) SpreadsheetApp.openById(cfg.execSpreadsheetId);
  if (cfg.enableConcierge && cfg.conciergeSpreadsheetId) SpreadsheetApp.openById(cfg.conciergeSpreadsheetId);
  if (cfg.enableSales && cfg.salesSpreadsheetId) SpreadsheetApp.openById(cfg.salesSpreadsheetId);
  if (cfg.enableCoaches && cfg.coachesSpreadsheetId) SpreadsheetApp.openById(cfg.coachesSpreadsheetId);
}

export function bootstrapProject(): void {
  setInitialScriptProperties();
  validateEnvironment();
}
