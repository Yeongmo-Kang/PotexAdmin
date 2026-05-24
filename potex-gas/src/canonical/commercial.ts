import { RuntimeConfig } from '../config';
import { SHEETS } from '../constants';
import { openSpreadsheetById, readSheetAsObjects } from '../sheets';

export const STAGING_PAYMENTS_HEADER = [
  'staging_payment_id',
  'source_sheet',
  'source_row',
  'line_name',
  'customer_name',
  'experience_date',
  'contract_date',
  'sales_owner_name',
  'plan_name_raw',
  'amount_text_raw',
  'amount_numeric',
  'segment',
  'paid_flag',
  'paid_date',
  'note',
  'customer_id',
  'customer_match_method',
  'created_at',
  'updated_at',
] as const;

export const PLANS_HEADER = [
  'plan_id',
  'customer_id',
  'plan_name',
  'plan_type',
  'sessions_included',
  'contract_date',
  'start_date',
  'end_date',
  'amount_tax_included',
  'status',
  'note',
  'created_at',
  'updated_at',
] as const;

export const PAYMENTS_HEADER = [
  'payment_id',
  'customer_id',
  'plan_id',
  'payment_date',
  'amount',
  'payment_method',
  'payment_status',
  'invoice_number',
  'note',
  'created_at',
  'updated_at',
] as const;

export const CONVERSION_HISTORY_HEADER = [
  'event_id',
  'customer_id',
  'event_date',
  'from_status',
  'to_status',
  'event_type',
  'changed_by',
  'note',
  'created_at',
  'updated_at',
] as const;

export const CONTINUATION_EXCEPTION_HEADER = [
  'continuation_exception_id',
  'raw_name',
  'cleaned_name',
  'raw_plan',
  'raw_contract_date',
  'raw_amount',
  'issue',
  'note',
  'created_at',
  'updated_at',
] as const;

export function buildContinuationExceptionId(
  rawName: string,
  rawPlan: string,
  rawContractDate: string,
  rawAmount: string,
): string {
  const composite = [
    String(rawName || '').replace(/[\s　]/g, '').trim().toLowerCase(),
    String(rawPlan || '').trim(),
    String(rawContractDate || '').trim(),
    String(rawAmount || '').trim(),
  ].join('||');
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, composite, Utilities.Charset.UTF_8);
  const hex = bytes.map((b) => {
    const v = (b < 0 ? b + 256 : b).toString(16);
    return v.length === 1 ? `0${v}` : v;
  }).join('');
  return `ce_${hex.slice(0, 12)}`;
}

type CommercialOutputs = {
  stagingPayments: Array<Record<string, string>>;
  plans: Array<Record<string, string>>;
  payments: Array<Record<string, string>>;
  conversionHistory: Array<Record<string, string>>;
  continuationExceptions: Array<Record<string, string>>;
  paymentUnmatchedCount: number;
  continuationUnmatchedCount: number;
};

export type ExtraConversionEvent = {
  customerId: string;
  eventDate: string;
  eventType: string;
  changedBy: string;
  note: string;
};

type PaymentMatch = {
  customerId: string;
  customerName: string;
  method: string;
};

type CustomerSourceDetail = {
  firstSessionDate: string;
  latestSessionDate: string;
  afterFollowEventDate: string;
};

function resolvePlanNameCandidate(customer: Record<string, string>, latestPayment?: { planName?: string } | null): string {
  return latestPayment?.planName || customer['course_name'] || customer['desired_plan_from_form'] || 'unknown_plan';
}

type RawTableRow = Record<string, string> & { _sourceRow: string };

const COMMERCIAL_SHEETS = {
  PAYMENTS: '着金管理マスター',
  CONTINUATIONS: '継続プラン管理',
  TRIALS: '体験者一覧',
  LOSSES: '失注理由ログ',
} as const;

function normalizeName(value: string): string {
  return (value || '').replace(/[\s　]/g, '').trim().toLowerCase();
}

function normalizeLineName(value: string): string {
  return String(value || '').replace(/\s*\[.*?\]\s*/g, ' ').replace(/[\s　]+/g, ' ').trim();
}

function toBooleanFlag(value: string): string {
  const text = String(value || '').trim().toLowerCase();
  return ['true', '1', 'yes', 'on', '済', '完了'].includes(text) ? 'TRUE' : 'FALSE';
}

function parseAmount(value: string): string {
  const digits = String(value || '').replace(/[^\d.-]/g, '');
  if (!digits) return '';
  const numeric = Number(digits);
  return Number.isFinite(numeric) ? String(Math.round(numeric)) : '';
}

function parseDateValue(value: string): Date | null {
  const text = String(value || '').trim();
  if (!text) return null;
  const normalized = text.replace(/[.]/g, '-').replace(/\//g, '-');
  const match = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
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

function formatDateValue(value: string): string {
  const parsed = parseDateValue(value);
  if (!parsed) return String(value || '').trim();
  const yyyy = parsed.getFullYear();
  const mm = String(parsed.getMonth() + 1).padStart(2, '0');
  const dd = String(parsed.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function currentIsoTimestamp(): string {
  return new Date().toISOString();
}

function addDays(value: string, days: number): string {
  const parsed = parseDateValue(value);
  if (!parsed) return '';
  parsed.setDate(parsed.getDate() + days);
  const yyyy = parsed.getFullYear();
  const mm = String(parsed.getMonth() + 1).padStart(2, '0');
  const dd = String(parsed.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function uniqueNonEmptyDates(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => formatDateValue(value)).filter(Boolean)));
}

function uniqueNonEmptyStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => String(value || '').trim()).filter(Boolean)));
}

function pickLatestDate(values: string[]): string {
  const normalized = uniqueNonEmptyDates(values).sort();
  return normalized.length ? normalized[normalized.length - 1] : '';
}

function findHeaderRowIndex(values: string[][], expectedHeaders: string[]): number {
  const expected = expectedHeaders.map((item) => normalizeName(item));
  for (let idx = 0; idx < values.length; idx += 1) {
    const row = values[idx] || [];
    const normalizedRow = row.map((item) => normalizeName(String(item || '')));
    const matches = expected.filter((header) => normalizedRow.includes(header)).length;
    if (matches >= Math.max(2, Math.ceil(expected.length * 0.5))) return idx;
  }
  return -1;
}

function tableRowsFromValues(values: string[][], headerIndex: number): RawTableRow[] {
  if (headerIndex < 0 || values.length <= headerIndex) return [];
  const header = (values[headerIndex] || []).map((item) => String(item || ''));
  return values.slice(headerIndex + 1).map((row, idx) => {
    const padded = row.concat(Array(Math.max(0, header.length - row.length)).fill(''));
    const object: RawTableRow = { _sourceRow: String(headerIndex + idx + 2) };
    header.forEach((column, colIdx) => {
      object[column] = String(padded[colIdx] || '').trim();
    });
    return object;
  });
}

function buildCustomerAliasMap(aliasRows: Array<Record<string, string>>): Map<string, PaymentMatch> {
  const lookup = new Map<string, PaymentMatch>();
  aliasRows.forEach((row) => {
    const status = String(row['status'] || '').trim().toLowerCase();
    if (!['approved', 'active', 'resolved'].includes(status)) return;
    const aliasName = normalizeName(row['alias_name'] || '');
    const customerId = row['canonical_customer_id'] || '';
    const customerName = row['canonical_customer_name'] || '';
    if (aliasName && customerId) {
      lookup.set(aliasName, {
        customerId,
        customerName,
        method: 'alias_map',
      });
    }
  });
  return lookup;
}

function matchCustomerByName(
  normalizedName: string,
  customerByName: Map<string, Record<string, string>>,
  customerAliasMap: Map<string, PaymentMatch>,
): PaymentMatch {
  const exact = customerByName.get(normalizedName);
  if (exact) {
    return {
      customerId: exact['customer_id'] || '',
      customerName: exact['customer_name'] || '',
      method: 'name_exact',
    };
  }
  return customerAliasMap.get(normalizedName) || { customerId: '', customerName: '', method: '' };
}

function inferPlanType(planName: string): string {
  const normalized = normalizeName(planName);
  if (!normalized) return 'coaching';
  if (normalized.includes('light') || normalized.includes('next') || normalized.includes('プレミアム') || normalized.includes('継続')) return 'continuation';
  return 'coaching';
}

function inferSessionsIncluded(planName: string): string {
  const text = String(planName || '');
  if (/6か月/.test(text)) return '24';
  const digitMatch = text.match(/(\d+)/);
  return digitMatch ? digitMatch[1] : '';
}

function normalizeCustomerStatus(value: string): string {
  const normalized = normalizeName(value);
  if (!normalized) return 'active';
  if (normalized.includes('complete') || normalized.includes('卒業') || normalized.includes('終了')) return 'completed';
  if (normalized.includes('cancel') || normalized.includes('lost')) return 'lost';
  return value;
}

function readRawValues(ss: GoogleAppsScript.Spreadsheet.Spreadsheet, sheetName: string): string[][] {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];
  return sheet.getDataRange().getDisplayValues();
}

function buildCustomerSourceDetails(cfg: RuntimeConfig): Map<string, CustomerSourceDetail> {
  const details = new Map<string, CustomerSourceDetail>();
  if (!cfg.sourceCustomersWorkbookId) return details;
  const source = openSpreadsheetById(cfg.sourceCustomersWorkbookId);
  const values = readRawValues(source, cfg.sourceCustomersSheetName);
  if (!values.length) return details;
  const header = values[0] || [];
  const sessionIndexes = header
    .map((column, index) => ({ column, index }))
    .filter(({ column }) => /回目面談/.test(String(column || '')))
    .map(({ index }) => index);
  const afterFollowIndex = header.findIndex((column) => String(column || '').includes('ｱﾌﾀｰﾌｫﾛｰ開催日') || String(column || '').includes('ｱﾌﾀｰﾌｫﾛｰ実施日'));
  values.slice(1).forEach((row, idx) => {
    const sessionDates = sessionIndexes.map((index) => String(row[index] || '').trim()).filter(Boolean);
    details.set(String(idx + 2), {
      firstSessionDate: formatDateValue(sessionDates[0] || ''),
      latestSessionDate: pickLatestDate(sessionDates),
      afterFollowEventDate: afterFollowIndex >= 0 ? formatDateValue(String(row[afterFollowIndex] || '').trim()) : '',
    });
  });
  return details;
}

function pickPrimaryPlanId(planIds: string[]): string {
  return planIds[0] || '';
}

export function buildCommercialOutputs(cfg: RuntimeConfig, extraEvents: ExtraConversionEvent[] = []): CommercialOutputs {
  const syncedAt = currentIsoTimestamp();
  const db = openSpreadsheetById(cfg.dbSpreadsheetId);
  const commercialBook = cfg.sourceCommercialWorkbookId
    ? openSpreadsheetById(cfg.sourceCommercialWorkbookId)
    : null;

  const customerRows = readSheetAsObjects(db, SHEETS.CUSTOMERS);
  const customerAliasRows = readSheetAsObjects(db, SHEETS.CUSTOMER_ALIAS_MAP);
  const customerSourceDetails = buildCustomerSourceDetails(cfg);

  const customerByName = new Map<string, Record<string, string>>();
  const customerById = new Map<string, Record<string, string>>();
  customerRows.forEach((row) => {
    const key = normalizeName(row['customer_name'] || '');
    const customerId = row['customer_id'] || '';
    if (key && !customerByName.has(key)) customerByName.set(key, row);
    if (customerId && !customerById.has(customerId)) customerById.set(customerId, row);
  });
  const customerAliasMap = buildCustomerAliasMap(customerAliasRows);

  const paymentValues = commercialBook ? readRawValues(commercialBook, COMMERCIAL_SHEETS.PAYMENTS) : [];
  const paymentHeaderIndex = findHeaderRowIndex(paymentValues, ['LINE登録名', '本名', '成約日', 'プラン', '単価']);
  const paymentSourceRows = tableRowsFromValues(paymentValues, paymentHeaderIndex)
    .filter((row) => row['LINE登録名'] || row['本名'] || row['成約日'] || row['プラン']);

  const continuationValues = commercialBook ? readRawValues(commercialBook, COMMERCIAL_SHEETS.CONTINUATIONS) : [];
  const continuationHeaderIndex = findHeaderRowIndex(continuationValues, ['No.', '名前', 'プラン', '成約日', '担当']);
  const continuationSourceRows = tableRowsFromValues(continuationValues, continuationHeaderIndex)
    .filter((row) => (row['名前'] || '').trim() && (row['名前'] || '').trim() !== '合計' && !(row['名前'] || '').includes('件数'));

  const paymentsByCustomer = new Map<string, Array<{ amount: string; contractDate: string; paidDate: string; planName: string }>>();
  const stagingPayments = paymentSourceRows.map((row, idx) => {
    const cleanedName = normalizeLineName(row['本名'] || row['LINE登録名'] || '');
    const normalizedName = normalizeName(cleanedName);
    const matchedCustomer = matchCustomerByName(normalizedName, customerByName, customerAliasMap);
    const amountNumeric = parseAmount(row['単価'] || '');
    const paidFlag = toBooleanFlag(row['着金済み'] || '');
    const contractDate = formatDateValue(row['成約日'] || '');
    const paidDate = formatDateValue(row['着金日'] || '') || (paidFlag === 'TRUE' ? contractDate : '');
    if (matchedCustomer.customerId) {
      const existing = paymentsByCustomer.get(matchedCustomer.customerId) || [];
      existing.push({
        amount: amountNumeric,
        contractDate,
        paidDate,
        planName: row['プラン'] || '',
      });
      paymentsByCustomer.set(matchedCustomer.customerId, existing);
    }
    return {
      staging_payment_id: `STGPAY-${String(idx + 1).padStart(4, '0')}`,
      source_sheet: COMMERCIAL_SHEETS.PAYMENTS,
      source_row: row._sourceRow,
      line_name: row['LINE登録名'] || '',
      customer_name: cleanedName,
      experience_date: formatDateValue(row['コーチング体験日'] || ''),
      contract_date: contractDate,
      sales_owner_name: row['担当営業マン'] || '',
      plan_name_raw: row['プラン'] || '',
      amount_text_raw: row['単価'] || '',
      amount_numeric: amountNumeric,
      segment: row['区分'] || '',
      paid_flag: paidFlag,
      paid_date: paidDate,
      note: row['メモ'] || '',
      customer_id: matchedCustomer.customerId || '',
      customer_match_method: matchedCustomer.method || '',
      created_at: contractDate || paidDate || formatDateValue(row['コーチング体験日'] || '') || syncedAt,
      updated_at: syncedAt,
    };
  });

  const plans: Array<Record<string, string>> = [];
  const planIdsByCustomer = new Map<string, string[]>();
  customerRows.forEach((customer, idx) => {
    const sourceDetail = customerSourceDetails.get(customer['source_row'] || '') || { firstSessionDate: '', latestSessionDate: '', afterFollowEventDate: '' };
    const paymentFacts = paymentsByCustomer.get(customer['customer_id'] || '') || [];
    const latestPayment = paymentFacts.sort((a, b) => (a.contractDate || '').localeCompare(b.contractDate || '')).slice(-1)[0];
    const planId = `PLAN-${String(plans.length + 1).padStart(4, '0')}`;
    const contractDate = formatDateValue(customer['created_at'] || '') || latestPayment?.contractDate || '';
    const startDate = addDays(customer['matching_contact_date'] || '', 3) || sourceDetail.firstSessionDate || latestPayment?.contractDate || '';
    const endDate = normalizeCustomerStatus(customer['current_status'] || '') === 'completed'
      ? (sourceDetail.latestSessionDate || sourceDetail.afterFollowEventDate || '')
      : '';
    const resolvedPlanName = resolvePlanNameCandidate(customer, latestPayment);
    const row = {
      plan_id: planId,
      customer_id: customer['customer_id'] || '',
      plan_name: resolvedPlanName,
      plan_type: inferPlanType(resolvedPlanName),
      sessions_included: inferSessionsIncluded(resolvedPlanName),
      contract_date: contractDate,
      start_date: startDate,
      end_date: endDate,
      amount_tax_included: latestPayment?.amount || '',
      status: normalizeCustomerStatus(customer['current_status'] || ''),
      note: uniqueNonEmptyStrings([
        customer['desired_plan_from_form'] ? `desired_plan=${customer['desired_plan_from_form']}` : '',
      ]).join(' | '),
      created_at: contractDate || syncedAt,
      updated_at: syncedAt,
    };
    plans.push(row);
    void idx;
    const existing = planIdsByCustomer.get(row.customer_id) || [];
    existing.push(planId);
    planIdsByCustomer.set(row.customer_id, existing);
  });

  const continuationExceptions: Array<Record<string, string>> = [];
  continuationSourceRows.forEach((row) => {
    const cleanedName = normalizeLineName(row['名前'] || '');
    const matchedCustomer = matchCustomerByName(normalizeName(cleanedName), customerByName, customerAliasMap);
    const customer = customerById.get(matchedCustomer.customerId || '') || {};
    if (!matchedCustomer.customerId || !customer['customer_id']) {
      const rawName = row['名前'] || '';
      const rawPlan = row['プラン'] || '';
      const rawContractDate = row['成約日'] || '';
      const rawAmount = row['単価(自動)'] || '';
      continuationExceptions.push({
        continuation_exception_id: buildContinuationExceptionId(rawName, rawPlan, rawContractDate, rawAmount),
        raw_name: rawName,
        cleaned_name: cleanedName,
        raw_plan: rawPlan,
        raw_contract_date: rawContractDate,
        raw_amount: rawAmount,
        issue: 'continuation_customer_unmatched',
        note: [
          'continuation row skipped because canonical customer could not be resolved',
          cleanedName ? `cleaned_name=${cleanedName}` : '',
        ].filter(Boolean).join(' | '),
        created_at: formatDateValue(rawContractDate) || syncedAt,
        updated_at: syncedAt,
      });
      return;
    }
    const planId = `PLAN-${String(plans.length + 1).padStart(4, '0')}`;
    plans.push({
      plan_id: planId,
      customer_id: customer['customer_id'] || '',
      plan_name: row['プラン'] || '継続プラン',
      plan_type: 'continuation',
      sessions_included: inferSessionsIncluded(row['プラン'] || ''),
      contract_date: formatDateValue(row['成約日'] || ''),
      start_date: formatDateValue(row['成約日'] || ''),
      end_date: '',
      amount_tax_included: parseAmount(row['単価(自動)'] || ''),
      status: normalizeCustomerStatus(customer['current_status'] || ''),
      note: uniqueNonEmptyStrings([
        matchedCustomer.method ? `customer_match_method=${matchedCustomer.method}` : '',
        cleanedName ? `source_name=${cleanedName}` : '',
      ]).join(' | '),
      created_at: formatDateValue(row['成約日'] || '') || syncedAt,
      updated_at: syncedAt,
    });
    const existing = planIdsByCustomer.get(customer['customer_id'] || '') || [];
    existing.push(planId);
    planIdsByCustomer.set(customer['customer_id'] || '', existing);
  });

  const payments = stagingPayments.map((row, idx) => {
    const candidatePlanIds = planIdsByCustomer.get(row['customer_id'] || '') || [];
    const paymentDate = row['paid_date'] || row['contract_date'] || row['experience_date'] || '';
    return {
      payment_id: `PAY-${String(idx + 1).padStart(4, '0')}`,
      customer_id: row['customer_id'] || '',
      plan_id: pickPrimaryPlanId(candidatePlanIds),
      payment_date: paymentDate,
      amount: row['amount_numeric'] || '',
      payment_method: '',
      payment_status: row['paid_flag'] === 'TRUE' ? 'paid' : 'pending',
      invoice_number: '',
      note: [
        row['sales_owner_name'] ? `sales_owner=${row['sales_owner_name']}` : '',
        row['segment'] ? `segment=${row['segment']}` : '',
        row['plan_name_raw'] ? `plan=${row['plan_name_raw']}` : '',
        row['note'] || '',
      ].filter(Boolean).join(' | '),
      created_at: paymentDate || syncedAt,
      updated_at: syncedAt,
    };
  });

  const trialValues = commercialBook ? readRawValues(commercialBook, COMMERCIAL_SHEETS.TRIALS) : [];
  const trialHeaderIndex = findHeaderRowIndex(trialValues, ['LINE名', '本名', '体験申込日', 'コーチング体験日', '成約/失注']);
  const trialSourceRows = tableRowsFromValues(trialValues, trialHeaderIndex)
    .filter((row) => row['LINE名'] || row['本名'] || row['体験申込日']);

  const lossValues = commercialBook ? readRawValues(commercialBook, COMMERCIAL_SHEETS.LOSSES) : [];
  const lossHeaderIndex = findHeaderRowIndex(lossValues, ['名前', '本名', '失注日']);
  const lossSourceRows = tableRowsFromValues(lossValues, lossHeaderIndex)
    .filter((row) => row['名前'] || row['本名'] || row['失注日']);

  const provisionalEvents: Array<Record<string, string>> = [];
  const pushEvent = (customerId: string, eventDate: string, eventType: string, changedBy: string, note: string) => {
    const normalizedDate = formatDateValue(eventDate);
    if (!customerId || !normalizedDate) return;
    provisionalEvents.push({
      customer_id: customerId,
      event_date: normalizedDate,
      event_type: eventType,
      changed_by: changedBy,
      note,
    });
  };

  customerRows.forEach((customer) => {
    const customerId = customer['customer_id'] || '';
    const sourceDetail = customerSourceDetails.get(customer['source_row'] || '') || { firstSessionDate: '', latestSessionDate: '', afterFollowEventDate: '' };
    pushEvent(customerId, customer['created_at'] || '', 'lead_created', '顧客管理', '');
    if (normalizeCustomerStatus(customer['current_status'] || '') === 'completed') {
      const completedDate = sourceDetail.latestSessionDate || sourceDetail.afterFollowEventDate;
      pushEvent(customerId, completedDate, 'completed', '顧客管理', '');
    }
  });

  trialSourceRows.forEach((row) => {
    const customer = customerByName.get(normalizeName(normalizeLineName(row['本名'] || row['LINE名'] || '')));
    if (!customer) return;
    const customerId = customer['customer_id'] || '';
    pushEvent(customerId, row['体験申込日'] || '', 'lead_created', COMMERCIAL_SHEETS.TRIALS, '');
    pushEvent(customerId, row['コーチング体験日'] || '', 'experience_scheduled', COMMERCIAL_SHEETS.TRIALS, '');
    const outcome = row['成約/失注'] || '';
    if (outcome.includes('成約')) {
      pushEvent(customerId, row['成約日'] || row['コーチング体験日'] || '', 'contracted', COMMERCIAL_SHEETS.TRIALS, '');
    }
    if (outcome.includes('失注')) {
      pushEvent(customerId, row['成約日'] || row['コーチング体験日'] || row['体験申込日'] || '', 'lost', COMMERCIAL_SHEETS.TRIALS, '');
    }
  });

  lossSourceRows.forEach((row) => {
    const customer = customerByName.get(normalizeName(normalizeLineName(row['本名'] || row['名前'] || '')));
    if (!customer) return;
    pushEvent(customer['customer_id'] || '', row['失注日'] || '', 'lost', COMMERCIAL_SHEETS.LOSSES, '');
  });

  stagingPayments.forEach((row) => {
    const customerId = row['customer_id'] || '';
    if (!customerId) return;
    pushEvent(customerId, row['contract_date'] || '', 'contracted', COMMERCIAL_SHEETS.PAYMENTS, '');
    if (row['paid_flag'] === 'TRUE') {
      pushEvent(customerId, row['paid_date'] || row['contract_date'] || '', 'paid', COMMERCIAL_SHEETS.PAYMENTS, '');
    }
  });

  extraEvents.forEach((event) => {
    pushEvent(event.customerId, event.eventDate, event.eventType, event.changedBy, event.note);
  });

  const statusByEventType: Record<string, string> = {
    line_registered: 'line_registered',
    lead_created: 'lead_created',
    experience_scheduled: 'experience_scheduled',
    contracted: 'contracted',
    paid: 'paid',
    completed: 'completed',
    lost: 'lost',
  };

  const dedupe = new Set<string>();
  const conversionHistory: Array<Record<string, string>> = [];
  provisionalEvents
    .sort((a, b) => {
      if ((a.customer_id || '') !== (b.customer_id || '')) return (a.customer_id || '').localeCompare(b.customer_id || '');
      if ((a.event_date || '') !== (b.event_date || '')) return (a.event_date || '').localeCompare(b.event_date || '');
      return (a.event_type || '').localeCompare(b.event_type || '');
    })
    .forEach((event) => {
      const key = [event.customer_id, event.event_date, event.event_type, event.note].join('||');
      if (dedupe.has(key)) return;
      dedupe.add(key);
      const previous = conversionHistory.filter((row) => row['customer_id'] === event.customer_id).slice(-1)[0];
      conversionHistory.push({
        event_id: `EVT-${String(conversionHistory.length + 1).padStart(4, '0')}`,
        customer_id: event.customer_id || '',
        event_date: event.event_date || '',
        from_status: previous ? previous['to_status'] || '' : '',
        to_status: statusByEventType[event.event_type || ''] || '',
        event_type: event.event_type || '',
        changed_by: event.changed_by || '',
        note: event.note || '',
        created_at: event.event_date || syncedAt,
        updated_at: syncedAt,
      });
    });

  return {
    stagingPayments,
    plans,
    payments,
    conversionHistory,
    continuationExceptions,
    paymentUnmatchedCount: stagingPayments.filter((row) => !(row['customer_id'] || '')).length,
    continuationUnmatchedCount: continuationExceptions.length,
  };
}
