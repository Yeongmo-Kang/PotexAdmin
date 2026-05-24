import { publishCsWorkbook } from './publish/csWorkbook';
import { publishExecutiveWorkbook } from './publish/managementWorkbook';
import { publishCoachesWorkbook } from './publish/coachWorkbook';
import { publishConciergeWorkbook } from './publish/conciergeWorkbook';
import { publishSalesWorkbook } from './publish/salesWorkbook';
import { publishPartnerWorkbooks } from './publish/partnerWorkbook';
import { collectCsWritebackRows } from './writeback/csWriteback';
import { collectPartnerStatusWritebackRows } from './writeback/partnerStatusWriteback';
import { getRuntimeConfig } from './config';
import { appendSyncLog } from './logging';
import { withScriptLock } from './locks';
import { refreshCanonicalStaging } from './canonical/ingest';
import { openSpreadsheetById } from './sheets';
import { PROPS, SHEETS } from './constants';
import { PARTNER_ASSIGNEES } from './partners';

function pruneLegacyPartnerSheets(): void {
  const cfg = getRuntimeConfig();
  const db = openSpreadsheetById(cfg.dbSpreadsheetId);
  const cs = openSpreadsheetById(cfg.csSpreadsheetId);
  ['Partners', 'Partner_Alias_Map', 'Customer_Partner_Assignments', 'Partner_Pipeline_Status'].forEach((sheetName) => {
    const sheet = db.getSheetByName(sheetName);
    if (sheet) db.deleteSheet(sheet);
  });
  const oldCsSheet = cs.getSheetByName('CS_Partner_Assignment_Input');
  if (oldCsSheet) cs.deleteSheet(oldCsSheet);
  [cfg.inaiSpreadsheetId, cfg.satoSpreadsheetId].forEach((spreadsheetId) => {
    if (!spreadsheetId) return;
    const workbook = openSpreadsheetById(spreadsheetId);
    const defaultSheet = workbook.getSheetByName('Sheet1');
    if (defaultSheet && workbook.getSheets().length > 1) workbook.deleteSheet(defaultSheet);
  });
}

function publishAllWorkbooks(): void {
  publishCsWorkbook();
  publishExecutiveWorkbook();
  publishCoachesWorkbook();
  publishConciergeWorkbook();
  publishSalesWorkbook();
  publishPartnerWorkbooks();
  pruneLegacyPartnerSheets();
}

function writebackChangedAnything(
  csStats: ReturnType<typeof collectCsWritebackRows>,
  partnerStats: ReturnType<typeof collectPartnerStatusWritebackRows>,
): boolean {
  return (
    csStats.processedAliasRows + csStats.processedPaymentAliasRows + csStats.processedContinuationAliasRows + csStats.processedPartnerAssignmentRows
    + csStats.invalidAliasRows + csStats.invalidPaymentAliasRows + csStats.invalidContinuationAliasRows + csStats.invalidPartnerAssignmentRows
    + partnerStats.processedPartnerStatusRows + partnerStats.invalidPartnerStatusRows
  ) > 0;
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
    publishAllWorkbooks();
    appendSyncLog('runPublishAll', 'success');
  });
}

export function runWritebackCollection(): void {
  withScriptLock('runWritebackCollection', () => {
    const cfg = getRuntimeConfig();
    const csWritebackStats = collectCsWritebackRows();
    const partnerWritebackStats = collectPartnerStatusWritebackRows();
    const writebackStats = { ...csWritebackStats, ...partnerWritebackStats };
    let latestStats: Record<string, unknown> = { ...writebackStats };

    if (csWritebackStats.processedPaymentAliasRows > 0 || csWritebackStats.processedContinuationAliasRows > 0 || csWritebackStats.processedPartnerAssignmentRows > 0 || partnerWritebackStats.processedPartnerStatusRows > 0) {
      latestStats = { ...refreshCanonicalStaging(cfg), ...writebackStats };
    }

    if (writebackChangedAnything(csWritebackStats, partnerWritebackStats)) publishAllWorkbooks();

    appendSyncLog('runWritebackCollection', 'success', latestStats);
  });
}

export function runFullRefresh(): void {
  withScriptLock('runFullRefresh', () => {
    const cfg = getRuntimeConfig();
    let latestStats: Record<string, unknown> = refreshCanonicalStaging(cfg);
    publishAllWorkbooks();

    const csWritebackStats = collectCsWritebackRows();
    const partnerWritebackStats = collectPartnerStatusWritebackRows();
    const writebackStats = { ...csWritebackStats, ...partnerWritebackStats };
    latestStats = { ...latestStats, ...writebackStats };

    if (csWritebackStats.processedPaymentAliasRows > 0 || csWritebackStats.processedContinuationAliasRows > 0 || csWritebackStats.processedPartnerAssignmentRows > 0 || partnerWritebackStats.processedPartnerStatusRows > 0) {
      latestStats = { ...refreshCanonicalStaging(cfg), ...writebackStats };
    }

    if (writebackChangedAnything(csWritebackStats, partnerWritebackStats)) publishAllWorkbooks();

    appendSyncLog('runFullRefresh', 'success', latestStats);
  });
}

export function dropOrphanStagingLineRegistration(): void {
  const cfg = getRuntimeConfig();
  const ss = openSpreadsheetById(cfg.dbSpreadsheetId);
  const sheet = ss.getSheetByName('Staging_LineRegistration');
  if (!sheet) {
    appendSyncLog('dropOrphanStagingLineRegistration', 'success', { removed: false, reason: 'not_found' });
    return;
  }
  ss.deleteSheet(sheet);
  appendSyncLog('dropOrphanStagingLineRegistration', 'success', { removed: true });
}

export function dropOrphanStagingFeedback(): void {
  const cfg = getRuntimeConfig();
  const ss = openSpreadsheetById(cfg.dbSpreadsheetId);
  const sheet = ss.getSheetByName('Staging_Feedback');
  if (!sheet) {
    appendSyncLog('dropOrphanStagingFeedback', 'success', { removed: false, reason: 'not_found' });
    return;
  }
  ss.deleteSheet(sheet);
  appendSyncLog('dropOrphanStagingFeedback', 'success', { removed: true });
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

  publishAllWorkbooks();
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
  const cfg = getRuntimeConfig();
  const removed: string[] = [];
  const notFound: string[] = [];
  const db = openSpreadsheetById(cfg.dbSpreadsheetId);
  const cs = openSpreadsheetById(cfg.csSpreadsheetId);

  [
    'Partners',
    'Partner_Alias_Map',
    'Customer_Partner_Assignments',
    'Partner_Pipeline_Status',
  ].forEach((sheetName) => {
    const sheet = db.getSheetByName(sheetName);
    if (!sheet) {
      notFound.push(`db:${sheetName}`);
      return;
    }
    db.deleteSheet(sheet);
    removed.push(`db:${sheetName}`);
  });

  const oldCsSheet = cs.getSheetByName('CS_Partner_Assignment_Input');
  if (oldCsSheet) {
    cs.deleteSheet(oldCsSheet);
    removed.push('cs:CS_Partner_Assignment_Input');
  } else {
    notFound.push('cs:CS_Partner_Assignment_Input');
  }

  [cfg.inaiSpreadsheetId, cfg.satoSpreadsheetId].forEach((spreadsheetId, index) => {
    if (!spreadsheetId) return;
    const workbook = openSpreadsheetById(spreadsheetId);
    const defaultSheet = workbook.getSheetByName('Sheet1');
    if (defaultSheet && workbook.getSheets().length > 1) {
      workbook.deleteSheet(defaultSheet);
      removed.push(`${index === 0 ? 'inai' : 'sato'}:Sheet1`);
    } else {
      notFound.push(`${index === 0 ? 'inai' : 'sato'}:Sheet1`);
    }
  });

  appendSyncLog('dropLegacyPartnerSheets', 'success', { removed, notFound });
}

