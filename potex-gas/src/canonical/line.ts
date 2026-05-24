import { RuntimeConfig } from '../config';
import { SHEETS } from '../constants';
import { openSpreadsheetById, readSheetAsObjects } from '../sheets';

export const LINE_REGISTRATIONS_HEADER = [
  'line_registration_id',
  'segment',
  'line_user_id',
  'display_name',
  'line_registration_name',
  'real_name',
  'registered_at',
  'gender',
  'age',
  'occupation',
  'income',
  'goal',
  'attribution_tags',
  'customer_id',
  'customer_match_method',
  'created_at',
  'updated_at',
] as const;

const LINE_REGISTRATION_SHEETS: Array<{ sheetName: string; segment: 'ryu' | 'potex' }> = [
  { sheetName: 'csvA', segment: 'ryu' },
  { sheetName: 'csv_potex', segment: 'potex' },
];

const TAG_COLUMN_PREFIXES = ['YT_', 'PT_', 'IG_', 'TT_', 'TIK_', 'LP_', 'SDP_', '【流入】'];

const CHANNEL_PREFIX_TO_TOKEN: Array<{ prefix: string; token: string }> = [
  { prefix: 'YT_', token: 'yt' },
  { prefix: 'IG_', token: 'ig' },
  { prefix: 'TIK_', token: 'tik' },
  { prefix: 'TT_', token: 'tt' },
  { prefix: 'PT_', token: 'pt' },
  { prefix: 'LP_', token: 'lp' },
  { prefix: 'SDP_', token: 'sdp' },
  { prefix: '【流入】', token: 'inflow' },
];

type LineMatch = {
  customerId: string;
  customerName: string;
  method: string;
};

type LineOutputs = {
  lineRegistrations: Array<Record<string, string>>;
  lineRegistrationEvents: Array<{
    customerId: string;
    eventDate: string;
    note: string;
    changedBy: string;
  }>;
  lineRegistrationCount: number;
  lineRegistrationUnmatchedCount: number;
};

function normalizeName(value: string): string {
  return (value || '').replace(/[\s　]/g, '').trim().toLowerCase();
}

function normalizeLineName(value: string): string {
  return String(value || '').replace(/\s*\[.*?\]\s*/g, ' ').replace(/[\s　]+/g, ' ').trim();
}

function parseDateValue(value: string): Date | null {
  const text = String(value || '').trim();
  if (!text) return null;
  const normalized = text.replace(/[.]/g, '-').replace(/\//g, '-');
  const match = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4] || '0');
  const minute = Number(match[5] || '0');
  const second = Number(match[6] || '0');
  const parsed = new Date(year, month - 1, day, hour, minute, second);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDateOnly(value: string): string {
  const parsed = parseDateValue(value);
  if (!parsed) return '';
  const yyyy = parsed.getFullYear();
  const mm = String(parsed.getMonth() + 1).padStart(2, '0');
  const dd = String(parsed.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function readRawValues(ss: GoogleAppsScript.Spreadsheet.Spreadsheet, sheetName: string): string[][] {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];
  return sheet.getDataRange().getDisplayValues();
}

function findHeaderRowIndex(values: string[][], expected: string[]): number {
  const normalized = expected.map(normalizeName);
  for (let idx = 0; idx < values.length; idx += 1) {
    const row = (values[idx] || []).map((cell) => normalizeName(String(cell || '')));
    const matches = normalized.filter((header) => row.includes(header)).length;
    if (matches >= Math.max(2, Math.ceil(normalized.length * 0.5))) return idx;
  }
  return -1;
}

function rowsFromValues(values: string[][], headerIndex: number): Array<{ row: Record<string, string>; sourceRow: string }> {
  if (headerIndex < 0 || values.length <= headerIndex) return [];
  const header = (values[headerIndex] || []).map((cell) => String(cell || '').trim());
  return values.slice(headerIndex + 1).map((row, idx) => {
    const padded = row.concat(Array(Math.max(0, header.length - row.length)).fill(''));
    const obj: Record<string, string> = {};
    header.forEach((column, colIdx) => {
      if (column) obj[column] = String(padded[colIdx] || '').trim();
    });
    return { row: obj, sourceRow: String(headerIndex + idx + 2) };
  });
}

function pickColumn(row: Record<string, string>, candidates: string[]): string {
  for (const candidate of candidates) {
    if (candidate in row && row[candidate]) return row[candidate];
  }
  return '';
}

function collectAttributionTags(row: Record<string, string>): string {
  const tags: string[] = [];
  Object.keys(row).forEach((column) => {
    if (!TAG_COLUMN_PREFIXES.some((prefix) => column.startsWith(prefix))) return;
    const value = String(row[column] || '').trim().toLowerCase();
    if (!value) return;
    if (['', '0', 'false', 'no', 'off', '×'].includes(value)) return;
    tags.push(column);
  });
  return tags.join(';');
}

export function tokenizeAttributionTags(rawTags: string): string[] {
  if (!rawTags) return [];
  const tokens = new Set<string>();
  rawTags.split(';').forEach((column) => {
    const trimmed = column.trim();
    if (!trimmed) return;
    const mapping = CHANNEL_PREFIX_TO_TOKEN.find(({ prefix }) => trimmed.startsWith(prefix));
    if (mapping) tokens.add(mapping.token);
  });
  return Array.from(tokens);
}

function buildStableLineRegistrationId(segment: string, sheetName: string, sourceRow: string, lineUserId: string): string {
  const userPart = String(lineUserId || '').trim().replace(/[^A-Za-z0-9_-]/g, '');
  if (userPart) return `line_${segment}_${userPart}`;
  return `line_${segment}_${sheetName}_${sourceRow}`.replace(/[^A-Za-z0-9_-]/g, '_');
}

function buildCustomerLookups(
  customerRows: Array<Record<string, string>>,
  customerAliasRows: Array<Record<string, string>>,
): { byName: Map<string, Record<string, string>>; aliasByName: Map<string, { customerId: string; customerName: string }> } {
  const byName = new Map<string, Record<string, string>>();
  customerRows.forEach((row) => {
    const key = normalizeName(row['customer_name'] || '');
    if (key && !byName.has(key)) byName.set(key, row);
  });
  const aliasByName = new Map<string, { customerId: string; customerName: string }>();
  customerAliasRows.forEach((row) => {
    const status = String(row['status'] || '').trim().toLowerCase();
    if (!['approved', 'active', 'resolved'].includes(status)) return;
    const aliasName = normalizeName(row['alias_name'] || '');
    const customerId = row['canonical_customer_id'] || '';
    const customerName = row['canonical_customer_name'] || '';
    if (aliasName && customerId) aliasByName.set(aliasName, { customerId, customerName });
  });
  return { byName, aliasByName };
}

function matchCustomer(
  realName: string,
  lineRegistrationName: string,
  lookups: ReturnType<typeof buildCustomerLookups>,
): LineMatch {
  const candidates = [realName, lineRegistrationName]
    .map((value) => normalizeName(normalizeLineName(value || '')))
    .filter(Boolean);
  for (const candidate of candidates) {
    const direct = lookups.byName.get(candidate);
    if (direct) {
      return {
        customerId: direct['customer_id'] || '',
        customerName: direct['customer_name'] || '',
        method: 'name_exact',
      };
    }
  }
  for (const candidate of candidates) {
    const alias = lookups.aliasByName.get(candidate);
    if (alias) {
      return {
        customerId: alias.customerId,
        customerName: alias.customerName,
        method: 'alias_map',
      };
    }
  }
  return { customerId: '', customerName: '', method: '' };
}

function currentIsoTimestamp(): string {
  return new Date().toISOString();
}

export function buildLineRegistrationOutputs(cfg: RuntimeConfig, syncedAt: string = currentIsoTimestamp()): LineOutputs {
  const empty: LineOutputs = {
    lineRegistrations: [],
    lineRegistrationEvents: [],
    lineRegistrationCount: 0,
    lineRegistrationUnmatchedCount: 0,
  };
  if (!cfg.sourceCommercialWorkbookId) return empty;

  const db = openSpreadsheetById(cfg.dbSpreadsheetId);
  const sourceBook = openSpreadsheetById(cfg.sourceCommercialWorkbookId);
  const customerRows = readSheetAsObjects(db, SHEETS.CUSTOMERS);
  const customerAliasRows = readSheetAsObjects(db, SHEETS.CUSTOMER_ALIAS_MAP);
  const lookups = buildCustomerLookups(customerRows, customerAliasRows);

  const canonicalRows: Array<Record<string, string>> = [];
  const events: LineOutputs['lineRegistrationEvents'] = [];

  LINE_REGISTRATION_SHEETS.forEach(({ sheetName, segment }) => {
    const values = readRawValues(sourceBook, sheetName);
    if (!values.length) return;
    const headerIndex = findHeaderRowIndex(values, ['ID', '表示名', 'LINE登録名', '本名', '友だち追加日時']);
    if (headerIndex < 0) return;
    const sourceRows = rowsFromValues(values, headerIndex);

    sourceRows.forEach(({ row, sourceRow }) => {
      const lineUserId = pickColumn(row, ['ID', 'LINE ID', 'user_id']);
      const displayName = pickColumn(row, ['表示名', 'DisplayName']);
      const lineRegistrationName = pickColumn(row, ['LINE登録名', 'LINE名']);
      const realName = pickColumn(row, ['本名', '氏名', 'お名前']);
      const registeredAtRaw = pickColumn(row, ['友だち追加日時', '友達追加日時', '追加日時']);
      if (!lineUserId && !displayName && !lineRegistrationName && !realName) return;
      const registeredAt = formatDateOnly(registeredAtRaw);
      const matched = matchCustomer(realName, lineRegistrationName, lookups);
      const lineRegistrationId = buildStableLineRegistrationId(segment, sheetName, sourceRow, lineUserId);
      const attributionTags = collectAttributionTags(row);
      const gender = pickColumn(row, ['性別']);
      const age = pickColumn(row, ['年齢']);
      const occupation = pickColumn(row, ['職業']);
      const income = pickColumn(row, ['年収']);
      const goal = pickColumn(row, ['目標達成したい内容', '目標']);
      canonicalRows.push({
        line_registration_id: lineRegistrationId,
        segment,
        line_user_id: lineUserId,
        display_name: displayName,
        line_registration_name: lineRegistrationName,
        real_name: realName,
        registered_at: registeredAt,
        gender,
        age,
        occupation,
        income,
        goal,
        attribution_tags: attributionTags,
        customer_id: matched.customerId,
        customer_match_method: matched.method,
        created_at: registeredAt || syncedAt,
        updated_at: syncedAt,
      });

      if (matched.customerId && registeredAt) {
        events.push({
          customerId: matched.customerId,
          eventDate: registeredAt,
          changedBy: `lstep_${segment}`,
          note: '',
        });
      }
    });
  });

  return {
    lineRegistrations: canonicalRows,
    lineRegistrationEvents: events,
    lineRegistrationCount: canonicalRows.length,
    lineRegistrationUnmatchedCount: canonicalRows.filter((row) => !(row['customer_id'] || '')).length,
  };
}
