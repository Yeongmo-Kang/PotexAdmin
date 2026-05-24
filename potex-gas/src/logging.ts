import { SHEETS, PROPS } from './constants';

const SYNC_LOG_HEADER = ['timestamp', 'job_name', 'status', 'stats'];

function resolveLogSpreadsheet(): GoogleAppsScript.Spreadsheet.Spreadsheet | null {
  const dbId = PropertiesService.getScriptProperties().getProperty(PROPS.DB_SPREADSHEET_ID);
  if (dbId) {
    try {
      return SpreadsheetApp.openById(dbId);
    } catch (error) {
      // fall through to active
    }
  }
  try {
    return SpreadsheetApp.getActiveSpreadsheet();
  } catch (error) {
    return null;
  }
}

function ensureSyncLogHeader(sheet: GoogleAppsScript.Spreadsheet.Sheet): void {
  const lastRow = sheet.getLastRow();
  const lastCol = Math.max(sheet.getLastColumn(), SYNC_LOG_HEADER.length);
  if (lastRow === 0) {
    sheet.getRange(1, 1, 1, SYNC_LOG_HEADER.length).setValues([SYNC_LOG_HEADER]);
    sheet.setFrozenRows(1);
    return;
  }
  const current = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map((v) => String(v || ''));
  const matchesHeader =
    current.length >= SYNC_LOG_HEADER.length &&
    SYNC_LOG_HEADER.every((label, idx) => current[idx] === label);
  if (matchesHeader) return;

  // Existing rows have no header. Insert a header row at the top so data is interpretable.
  sheet.insertRowBefore(1);
  sheet.getRange(1, 1, 1, SYNC_LOG_HEADER.length).setValues([SYNC_LOG_HEADER]);
  sheet.setFrozenRows(1);
}

function formatStatsValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch (error) {
      return String(value);
    }
  }
  return String(value);
}

function formatStats(stats: Record<string, unknown>): string {
  const keys = Object.keys(stats).sort();
  if (keys.length === 0) return '';
  return keys.map((key) => `${key}=${formatStatsValue(stats[key])}`).join('\n');
}

export function appendSyncLog(jobName: string, status: string, stats: Record<string, unknown> = {}): void {
  try {
    const ss = resolveLogSpreadsheet();
    if (!ss) return;
    let sheet = ss.getSheetByName(SHEETS.SYNC_LOG);
    if (!sheet) {
      sheet = ss.insertSheet(SHEETS.SYNC_LOG);
    }
    ensureSyncLogHeader(sheet);
    sheet.appendRow([
      new Date().toISOString(),
      jobName,
      status,
      formatStats(stats),
    ]);
  } catch (error) {
    // logging is best-effort; never break the main job because the log sheet is unreachable
    console.error('appendSyncLog failed', error);
  }
}
