import { RuntimeConfig } from '../config';
import { SHEETS } from '../constants';
import { openSpreadsheetById } from '../sheets';

export const IMPORT_CSV_D_REQUIRED_LABELS = ['ID', '友だち追加日時', '成約'] as const;

const BOOLEAN_TAG_LABELS = [
  '勉強会予約',
  '体験応募済み',
  '体験応募済み｜シナリオ経由',
  '体験応募済み｜RM経由',
  '体験応募済み｜プッシュ経由',
  '体験応募済み｜勉強会経由',
  '体験応募済み｜HP経由',
  '7日以上日程調整返信なし',
  '審査不合格・分母除外',
  '日程調整済み',
  '体験キャンセル',
  '再面談',
  '成約',
  '失注',
] as const;

const DATE_TAG_LABELS = [
  '勉強会予約日',
  'コーチング体験申込日',
  'コーチング体験日程調整完了',
  'コーチング体験日',
  'コーチング体験キャンセル',
  '成約日',
  '失注日',
] as const;

const FRIEND_STATUS_ACTIVE = 'active';
const FRIEND_STATUS_ABSENT = 'absent';

export type CsvDIngestStats = {
  csvDRowsTotal: number;
  csvDRowsInserted: number;
  csvDRowsUpdated: number;
  csvDRowsAbsentMarked: number;
  csvDContractedCount: number;
  csvDUnknownLstepColumns: number;
  csvDConversionEventsAppended: number;
  csvDHeaderDriftDetected: boolean;
  csvDUnknownColumnNames: string;
};

type LstepRow = {
  lineUserId: string;
  displayName: string;
  lineRegistrationName: string;
  responseMark: string;
  friendAddedAt: string;
  contractDateLstep: string;
  lostDateLstep: string;
  isContracted: boolean;
  booleanTags: Record<string, boolean>;
  dateTags: Record<string, string>;
};

function normalizeLabel(value: unknown): string {
  return String(value || '').replace(/[\s　]/g, '').trim();
}

function parseBooleanCell(value: unknown): boolean {
  const text = String(value || '').trim().toLowerCase();
  return text === '1' || text === 'true' || text === 'yes';
}

function isoNow(): string {
  return new Date().toISOString();
}

function readImportCsvDValues(db: GoogleAppsScript.Spreadsheet.Spreadsheet): string[][] {
  const sheet = db.getSheetByName(SHEETS.IMPORT_CSV_D);
  if (!sheet) {
    throw new Error(`Sheet not found: ${SHEETS.IMPORT_CSV_D}. operator が LStep CSV を A1 から貼り付けてください.`);
  }
  return sheet.getDataRange().getDisplayValues();
}

function ensureRequiredLabels(headerRow: string[]): { missing: string[]; labelToColumn: Map<string, number> } {
  const labelToColumn = new Map<string, number>();
  headerRow.forEach((cell, idx) => {
    const label = normalizeLabel(cell);
    if (label && !labelToColumn.has(label)) labelToColumn.set(label, idx);
  });
  const missing = IMPORT_CSV_D_REQUIRED_LABELS.filter((label) => !labelToColumn.has(label));
  return { missing, labelToColumn };
}

function pickByLabel(row: string[], labelToColumn: Map<string, number>, label: string): string {
  const idx = labelToColumn.get(label);
  if (idx === undefined) return '';
  return String(row[idx] ?? '').trim();
}

function parseCsvDRows(values: string[][]): {
  rows: LstepRow[];
  unknownLabels: string[];
  headerDrift: boolean;
} {
  if (values.length < 3) {
    return { rows: [], unknownLabels: [], headerDrift: false };
  }
  const idRow = values[0] || [];
  const labelRow = values[1] || [];
  const { missing, labelToColumn } = ensureRequiredLabels(labelRow);
  if (missing.length > 0) {
    throw new Error(`Import_csvD: 必須ラベルが見つかりません: ${missing.join(', ')}`);
  }

  const knownLabelSet = new Set<string>([
    ...IMPORT_CSV_D_REQUIRED_LABELS.map(normalizeLabel),
    ...BOOLEAN_TAG_LABELS.map(normalizeLabel),
    ...DATE_TAG_LABELS.map(normalizeLabel),
    normalizeLabel('表示名'),
    normalizeLabel('LINE登録名'),
    normalizeLabel('対応マーク'),
  ]);
  const unknownLabels: string[] = [];
  labelRow.forEach((cell) => {
    const label = normalizeLabel(cell);
    if (!label) return;
    if (!knownLabelSet.has(label)) unknownLabels.push(label);
  });

  const headerDrift = idRow.some((cell) => {
    const text = String(cell || '').trim();
    return text !== '' && !/^(タグ_|友だち情報_|登録ID|表示名|LINE登録名|対応マーク|友だち追加日時)/.test(text);
  });

  const dataRows = values.slice(2);
  const rows: LstepRow[] = [];
  dataRows.forEach((row) => {
    if (!row || row.every((cell) => String(cell || '').trim() === '')) return;
    const lineUserId = pickByLabel(row, labelToColumn, 'ID');
    if (!lineUserId) return;
    const friendAddedAt = pickByLabel(row, labelToColumn, '友だち追加日時');
    const isContracted = parseBooleanCell(pickByLabel(row, labelToColumn, '成約'));
    const booleanTags: Record<string, boolean> = {};
    BOOLEAN_TAG_LABELS.forEach((label) => {
      booleanTags[label] = parseBooleanCell(pickByLabel(row, labelToColumn, label));
    });
    const dateTags: Record<string, string> = {};
    DATE_TAG_LABELS.forEach((label) => {
      dateTags[label] = pickByLabel(row, labelToColumn, label);
    });
    rows.push({
      lineUserId,
      displayName: pickByLabel(row, labelToColumn, '表示名'),
      lineRegistrationName: pickByLabel(row, labelToColumn, 'LINE登録名'),
      responseMark: pickByLabel(row, labelToColumn, '対応マーク'),
      friendAddedAt,
      contractDateLstep: pickByLabel(row, labelToColumn, '成約日'),
      lostDateLstep: pickByLabel(row, labelToColumn, '失注日'),
      isContracted,
      booleanTags,
      dateTags,
    });
  });

  return { rows, unknownLabels: Array.from(new Set(unknownLabels)), headerDrift };
}

function reconcileLineRegistrations(
  db: GoogleAppsScript.Spreadsheet.Spreadsheet,
  rows: LstepRow[],
  syncedAt: string,
): { inserted: number; updated: number; absentMarked: number } {
  const sheet = db.getSheetByName(SHEETS.LINE_REGISTRATIONS);
  if (!sheet) {
    throw new Error(`Sheet not found: ${SHEETS.LINE_REGISTRATIONS}`);
  }
  const initialValues = sheet.getDataRange().getValues();
  if (initialValues.length === 0) {
    throw new Error(`Sheet has no header: ${SHEETS.LINE_REGISTRATIONS}`);
  }
  const header = initialValues[0].map((cell) => String(cell || ''));
  const lineUserIdCol = header.indexOf('line_user_id');
  if (lineUserIdCol < 0) {
    throw new Error(`Column not found in ${SHEETS.LINE_REGISTRATIONS}: line_user_id`);
  }

  const additions: string[] = [];
  ['friend_status', 'lstep_is_contracted', 'lstep_contract_date', 'lstep_lost_date', 'lstep_last_seen_at'].forEach((col) => {
    if (header.indexOf(col) < 0) additions.push(col);
  });
  additions.forEach((col) => header.push(col));

  const dataRows: unknown[][] = initialValues.slice(1).map((row) => {
    const copy = row.slice();
    for (let i = 0; i < additions.length; i += 1) copy.push('');
    return copy;
  });

  const friendStatusCol = header.indexOf('friend_status');
  const lstepContractFlagCol = header.indexOf('lstep_is_contracted');
  const lstepContractDateCol = header.indexOf('lstep_contract_date');
  const lstepLostDateCol = header.indexOf('lstep_lost_date');
  const lstepLastSeenCol = header.indexOf('lstep_last_seen_at');
  const updatedAtCol = header.indexOf('updated_at');
  const createdAtCol = header.indexOf('created_at');
  const lineRegistrationIdCol = header.indexOf('line_registration_id');
  const segmentCol = header.indexOf('segment');
  const displayNameCol = header.indexOf('display_name');
  const lineRegistrationNameCol = header.indexOf('line_registration_name');
  const registeredAtCol = header.indexOf('registered_at');

  const existingByLineUserId = new Map<string, number>();
  dataRows.forEach((row, idx) => {
    const key = String(row[lineUserIdCol] || '').trim();
    if (key) existingByLineUserId.set(key, idx);
  });

  let inserted = 0;
  let updated = 0;
  let absentMarked = 0;
  const seenIds = new Set<string>();

  rows.forEach((row) => {
    const key = row.lineUserId;
    seenIds.add(key);
    const idx = existingByLineUserId.get(key);
    if (idx !== undefined) {
      const target = dataRows[idx];
      if (friendStatusCol >= 0) target[friendStatusCol] = FRIEND_STATUS_ACTIVE;
      if (lstepContractFlagCol >= 0) target[lstepContractFlagCol] = row.isContracted ? 'TRUE' : 'FALSE';
      if (lstepContractDateCol >= 0) target[lstepContractDateCol] = row.contractDateLstep;
      if (lstepLostDateCol >= 0) target[lstepLostDateCol] = row.lostDateLstep;
      if (lstepLastSeenCol >= 0) target[lstepLastSeenCol] = syncedAt;
      if (updatedAtCol >= 0) target[updatedAtCol] = syncedAt;
      updated += 1;
      return;
    }

    const newRow: unknown[] = new Array(header.length).fill('');
    const setIf = (col: number, value: string) => {
      if (col >= 0) newRow[col] = value;
    };
    setIf(lineRegistrationIdCol, `line_csvd_${key}`);
    setIf(segmentCol, 'csvd');
    setIf(lineUserIdCol, key);
    setIf(displayNameCol, row.displayName);
    setIf(lineRegistrationNameCol, row.lineRegistrationName);
    setIf(registeredAtCol, row.friendAddedAt);
    setIf(friendStatusCol, FRIEND_STATUS_ACTIVE);
    setIf(lstepContractFlagCol, row.isContracted ? 'TRUE' : 'FALSE');
    setIf(lstepContractDateCol, row.contractDateLstep);
    setIf(lstepLostDateCol, row.lostDateLstep);
    setIf(lstepLastSeenCol, syncedAt);
    setIf(createdAtCol, syncedAt);
    setIf(updatedAtCol, syncedAt);
    dataRows.push(newRow);
    inserted += 1;
  });

  if (friendStatusCol >= 0) {
    existingByLineUserId.forEach((idx, lineUserId) => {
      if (seenIds.has(lineUserId)) return;
      const target = dataRows[idx];
      const currentStatus = String(target[friendStatusCol] || '').trim();
      if (currentStatus === FRIEND_STATUS_ABSENT) return;
      target[friendStatusCol] = FRIEND_STATUS_ABSENT;
      if (updatedAtCol >= 0) target[updatedAtCol] = syncedAt;
      absentMarked += 1;
    });
  }

  if (additions.length > 0) {
    sheet.getRange(1, 1, 1, header.length).setValues([header]);
  }
  if (dataRows.length > 0) {
    sheet.getRange(2, 1, dataRows.length, header.length).setValues(dataRows);
  }

  return { inserted, updated, absentMarked };
}

function appendConversionEvents(
  db: GoogleAppsScript.Spreadsheet.Spreadsheet,
  rows: LstepRow[],
  syncedAt: string,
): number {
  const sheet = db.getSheetByName(SHEETS.CONVERSION_HISTORY);
  if (!sheet) return 0;
  const allValues = sheet.getDataRange().getValues();
  if (allValues.length === 0) return 0;
  const header = allValues[0].map((cell) => String(cell || ''));
  const customerIdCol = header.indexOf('customer_id');
  const eventDateCol = header.indexOf('event_date');
  const eventTypeCol = header.indexOf('event_type');
  const changedByCol = header.indexOf('changed_by');
  const noteCol = header.indexOf('note');
  const createdAtCol = header.indexOf('created_at');
  const updatedAtCol = header.indexOf('updated_at');
  if (eventDateCol < 0 || eventTypeCol < 0) return 0;

  const lineSheet = db.getSheetByName(SHEETS.LINE_REGISTRATIONS);
  if (!lineSheet) return 0;
  const lineValues = lineSheet.getDataRange().getValues();
  const lineHeader = lineValues[0].map((cell) => String(cell || ''));
  const lineUserIdIdx = lineHeader.indexOf('line_user_id');
  const customerIdIdx = lineHeader.indexOf('customer_id');
  const customerIdByLineUserId = new Map<string, string>();
  if (lineUserIdIdx >= 0 && customerIdIdx >= 0) {
    lineValues.slice(1).forEach((row) => {
      const key = String(row[lineUserIdIdx] || '').trim();
      const cid = String(row[customerIdIdx] || '').trim();
      if (key && cid) customerIdByLineUserId.set(key, cid);
    });
  }

  const existingEvents = new Set<string>();
  if (eventDateCol >= 0 && eventTypeCol >= 0 && customerIdCol >= 0) {
    allValues.slice(1).forEach((row) => {
      const key = `${row[customerIdCol] || ''}|${row[eventDateCol] || ''}|${row[eventTypeCol] || ''}`;
      existingEvents.add(key);
    });
  }

  const newRows: string[][] = [];
  rows.forEach((row) => {
    const customerId = customerIdByLineUserId.get(row.lineUserId) || '';
    if (!customerId) return;
    DATE_TAG_LABELS.forEach((label) => {
      const dateValue = row.dateTags[label];
      if (!dateValue) return;
      const eventType = `lstep:${label}`;
      const key = `${customerId}|${dateValue}|${eventType}`;
      if (existingEvents.has(key)) return;
      existingEvents.add(key);
      const newRow: string[] = new Array(header.length).fill('');
      const setIf = (col: number, value: string) => {
        if (col >= 0) newRow[col] = value;
      };
      setIf(header.indexOf('event_id'), `evt_csvd_${customerId}_${eventType}_${dateValue}`.replace(/[^A-Za-z0-9_:-]/g, '_'));
      setIf(customerIdCol, customerId);
      setIf(eventDateCol, dateValue);
      setIf(eventTypeCol, eventType);
      setIf(changedByCol, 'csvD_ingest');
      setIf(noteCol, label);
      setIf(createdAtCol, syncedAt);
      setIf(updatedAtCol, syncedAt);
      newRows.push(newRow);
    });
  });

  if (newRows.length === 0) return 0;
  const startRow = sheet.getLastRow() + 1;
  sheet.getRange(startRow, 1, newRows.length, header.length).setValues(newRows);
  return newRows.length;
}

export function runImportCsvDIngest(cfg: RuntimeConfig, syncedAt: string = isoNow()): CsvDIngestStats {
  const db = openSpreadsheetById(cfg.dbSpreadsheetId);
  const values = readImportCsvDValues(db);
  const { rows, unknownLabels, headerDrift } = parseCsvDRows(values);
  const reconcile = reconcileLineRegistrations(db, rows, syncedAt);
  const eventsAppended = appendConversionEvents(db, rows, syncedAt);
  const contractedCount = rows.filter((row) => row.isContracted).length;
  return {
    csvDRowsTotal: rows.length,
    csvDRowsInserted: reconcile.inserted,
    csvDRowsUpdated: reconcile.updated,
    csvDRowsAbsentMarked: reconcile.absentMarked,
    csvDContractedCount: contractedCount,
    csvDUnknownLstepColumns: unknownLabels.length,
    csvDConversionEventsAppended: eventsAppended,
    csvDHeaderDriftDetected: headerDrift,
    csvDUnknownColumnNames: unknownLabels.join(','),
  };
}
