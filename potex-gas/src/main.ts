import { publishCsWorkbook } from './publish/csWorkbook';
import { publishExecutiveWorkbook } from './publish/managementWorkbook';
import { publishCoachesWorkbook } from './publish/coachWorkbook';
import { publishConciergeWorkbook } from './publish/conciergeWorkbook';
import { publishSalesWorkbook } from './publish/salesWorkbook';
import { publishPartnerWorkbooks } from './publish/partnerWorkbook';
import { collectCsWritebackRows } from './writeback/csWriteback';
import { collectPartnerStatusWritebackRows } from './writeback/partnerStatusWriteback';
import { getRuntimeConfig, type RuntimeConfig } from './config';
import { appendSyncLog } from './logging';
import { withScriptLock } from './locks';
import { refreshCanonicalStaging } from './canonical/ingest';
import { openSpreadsheetById } from './sheets';
import { PROPS } from './constants';
import { PARTNER_ASSIGNEES } from './partners';

const LEGACY_DB_SHEETS = [
  'Partners',
  'Partner_Alias_Map',
  'Customer_Partner_Assignments',
  'Partner_Pipeline_Status',
] as const;

const LEGACY_CS_SHEETS = ['CS_Partner_Assignment_Input'] as const;
const DEFAULT_PARTNER_SHEET_NAME = 'Sheet1';

type CsWritebackStats = ReturnType<typeof collectCsWritebackRows>;
type PartnerWritebackStats = ReturnType<typeof collectPartnerStatusWritebackRows>;
type WritebackStats = CsWritebackStats & PartnerWritebackStats;
type SyncLogDetails = Record<string, unknown>;

type LegacyCleanupResult = {
  removed: string[];
  notFound: string[];
};

function deleteSheetIfPresent(
  workbook: GoogleAppsScript.Spreadsheet.Spreadsheet,
  sheetName: string,
): boolean {
  const sheet = workbook.getSheetByName(sheetName);
  if (!sheet) return false;
  workbook.deleteSheet(sheet);
  return true;
}

function cleanupLegacyPartnerArtifacts(cfg: RuntimeConfig): LegacyCleanupResult {
  const removed: string[] = [];
  const notFound: string[] = [];
  const db = openSpreadsheetById(cfg.dbSpreadsheetId);
  const cs = openSpreadsheetById(cfg.csSpreadsheetId);

  LEGACY_DB_SHEETS.forEach((sheetName) => {
    if (deleteSheetIfPresent(db, sheetName)) {
      removed.push(`db:${sheetName}`);
      return;
    }
    notFound.push(`db:${sheetName}`);
  });

  LEGACY_CS_SHEETS.forEach((sheetName) => {
    if (deleteSheetIfPresent(cs, sheetName)) {
      removed.push(`cs:${sheetName}`);
      return;
    }
    notFound.push(`cs:${sheetName}`);
  });

  [cfg.inaiSpreadsheetId, cfg.satoSpreadsheetId].forEach((spreadsheetId, index) => {
    if (!spreadsheetId) return;
    const workbook = openSpreadsheetById(spreadsheetId);
    const workbookKey = index === 0 ? 'inai' : 'sato';
    const defaultSheet = workbook.getSheetByName(DEFAULT_PARTNER_SHEET_NAME);
    if (defaultSheet && workbook.getSheets().length > 1) {
      workbook.deleteSheet(defaultSheet);
      removed.push(`${workbookKey}:${DEFAULT_PARTNER_SHEET_NAME}`);
      return;
    }
    notFound.push(`${workbookKey}:${DEFAULT_PARTNER_SHEET_NAME}`);
  });

  return { removed, notFound };
}

function publishAllWorkbooks(cfg: RuntimeConfig = getRuntimeConfig()): void {
  publishCsWorkbook();
  publishExecutiveWorkbook();
  publishCoachesWorkbook();
  publishConciergeWorkbook();
  publishSalesWorkbook();
  publishPartnerWorkbooks();
  cleanupLegacyPartnerArtifacts(cfg);
}

function collectWritebackStats(): WritebackStats {
  return {
    ...collectCsWritebackRows(),
    ...collectPartnerStatusWritebackRows(),
  };
}

function shouldRefreshAfterWriteback(stats: WritebackStats): boolean {
  return (
    stats.processedPaymentAliasRows > 0
    || stats.processedContinuationAliasRows > 0
    || stats.processedPartnerAssignmentRows > 0
    || stats.processedPartnerStatusRows > 0
  );
}

function writebackChangedAnything(stats: WritebackStats): boolean {
  return (
    stats.processedAliasRows
    + stats.processedPaymentAliasRows
    + stats.processedContinuationAliasRows
    + stats.processedPartnerAssignmentRows
    + stats.invalidAliasRows
    + stats.invalidPaymentAliasRows
    + stats.invalidContinuationAliasRows
    + stats.invalidPartnerAssignmentRows
    + stats.processedPartnerStatusRows
    + stats.invalidPartnerStatusRows
  ) > 0;
}

function runWritebackCycle(cfg: RuntimeConfig, baseStats: SyncLogDetails = {}): SyncLogDetails {
  const writebackStats = collectWritebackStats();
  let latestStats: SyncLogDetails = { ...baseStats, ...writebackStats };

  if (shouldRefreshAfterWriteback(writebackStats)) {
    latestStats = { ...refreshCanonicalStaging(cfg), ...writebackStats };
  }

  if (writebackChangedAnything(writebackStats)) {
    publishAllWorkbooks(cfg);
  }

  return latestStats;
}

function dropSheetAndLog(actionName: string, sheetName: string): void {
  const cfg = getRuntimeConfig();
  const db = openSpreadsheetById(cfg.dbSpreadsheetId);
  const removed = deleteSheetIfPresent(db, sheetName);
  appendSyncLog(actionName, 'success', removed ? { removed: true } : { removed: false, reason: 'not_found' });
}

export function runCanonicalRefresh(): void {
  withScriptLock('runCanonicalRefresh', () => {
    const cfg = getRuntimeConfig();
    const stats = refreshCanonicalStaging(cfg);
    appendSyncLog('runCanonicalRefresh', 'success', stats);
  });
}

export function runPublishAll(): void {
  withScriptLock('runPublishAll', () => {
    const cfg = getRuntimeConfig();
    publishAllWorkbooks(cfg);
    appendSyncLog('runPublishAll', 'success');
  });
}

export function runWritebackCollection(): void {
  withScriptLock('runWritebackCollection', () => {
    const cfg = getRuntimeConfig();
    const latestStats = runWritebackCycle(cfg);
    appendSyncLog('runWritebackCollection', 'success', latestStats);
  });
}

export function runFullRefresh(): void {
  withScriptLock('runFullRefresh', () => {
    const cfg = getRuntimeConfig();
    const refreshStats = refreshCanonicalStaging(cfg);
    publishAllWorkbooks(cfg);
    const latestStats = runWritebackCycle(cfg, refreshStats);
    appendSyncLog('runFullRefresh', 'success', latestStats);
  });
}

export function dropOrphanStagingLineRegistration(): void {
  dropSheetAndLog('dropOrphanStagingLineRegistration', 'Staging_LineRegistration');
}

export function dropOrphanStagingFeedback(): void {
  dropSheetAndLog('dropOrphanStagingFeedback', 'Staging_Feedback');
}

export function provisionPartnerWorkbooks(): void {
  const props = PropertiesService.getScriptProperties();
  const existingInaiId = props.getProperty(PROPS.INAI_SPREADSHEET_ID) || '';
  const existingSatoId = props.getProperty(PROPS.SATO_SPREADSHEET_ID) || '';

  const inaiSpreadsheet = existingInaiId ? SpreadsheetApp.openById(existingInaiId) : SpreadsheetApp.create('Potex Inai');
  const satoSpreadsheet = existingSatoId ? SpreadsheetApp.openById(existingSatoId) : SpreadsheetApp.create('Potex Sato');

  props.setProperties({
    [PROPS.INAI_SPREADSHEET_ID]: inaiSpreadsheet.getId(),
    [PROPS.SATO_SPREADSHEET_ID]: satoSpreadsheet.getId(),
  }, false);

  publishAllWorkbooks(getRuntimeConfig());
  appendSyncLog('provisionPartnerWorkbooks', 'success', {
    inaiSpreadsheetId: inaiSpreadsheet.getId(),
    inaiUrl: inaiSpreadsheet.getUrl(),
    inaiCoachId: PARTNER_ASSIGNEES[0]?.coachId || '',
    satoSpreadsheetId: satoSpreadsheet.getId(),
    satoUrl: satoSpreadsheet.getUrl(),
    satoCoachId: PARTNER_ASSIGNEES[1]?.coachId || '',
  });
}

export function dropLegacyPartnerSheets(): void {
  const cleanup = cleanupLegacyPartnerArtifacts(getRuntimeConfig());
  appendSyncLog('dropLegacyPartnerSheets', 'success', cleanup);
}
