import { RuntimeConfig } from '../config';
import { SHEETS } from '../constants';
import { clearAndRewrite, ensureAuditColumns, openSpreadsheetById, readSheetAsObjects, readSheetAsObjectsOrEmpty } from '../sheets';
import {
  buildCommercialOutputs,
  CONTINUATION_EXCEPTION_HEADER,
  CONVERSION_HISTORY_HEADER,
  PAYMENTS_HEADER,
  PLANS_HEADER,
  STAGING_PAYMENTS_HEADER,
} from './commercial';
import {
  buildLineRegistrationOutputs,
  LINE_REGISTRATIONS_HEADER,
} from './line';
import { PARTNER_ASSIGNEES } from '../partners';

type Stats = {
  sourceCustomerRowsRead: number;
  sourceFeedbackRowsRead: number;
  partnersWritten: number;
  partnerAliasRowsWritten: number;
  customerPartnerAssignmentsWritten: number;
  partnerPipelineStatusesWritten: number;
  stagingCustomersWritten: number;
  feedbackRowsWritten: number;
  feedbackExceptionRowsWritten: number;
  feedbackResponseIdCollisions: number;
  customerFallbackUsed: boolean;
  stagingPaymentsWritten: number;
  plansWritten: number;
  paymentsWritten: number;
  conversionHistoryWritten: number;
  paymentUnmatchedCount: number;
  lineRegistrationsWritten: number;
  lineRegistrationUnmatchedCount: number;
  continuationExceptionsWritten: number;
  continuationUnmatchedCount: number;
};

type LineRegistrationLookup = Map<string, string>;

const STAGING_CUSTOMER_HEADER = [
  'customer_id',
  'line_registration_id',
  'customer_name',
  'source_sheet',
  'source_row',
  'course_name',
  'assigned_coach_name',
  'matching_contact_date',
  'drive_label_or_url',
  'goal_navi_url',
  'dashboard_url',
  'video_url',
  'current_status',
  'after_follow_progress',
  'after_follow_offer_date',
  'after_follow_event_date',
  'after_follow_result',
  'discord_sheetlock_survey_done',
  'continuation_tag',
  'program_completed_flag',
  'app_status',
  'email',
  'phone',
  'address',
  'age',
  'created_at',
  'updated_at',
];

export const FEEDBACK_HEADER = [
  'feedback_id',
  'response_id',
  'session_id',
  'customer_id',
  'customer_name',
  'coach_id',
  'feedback_date',
  'feedback_type',
  'rating',
  'nps_score',
  'nps_category',
  'progress_score',
  'expectation_score',
  'community_score',
  'comment',
  'followup_needed',
  'note',
  'respondent_name',
  'respondent_email',
  'created_at',
  'updated_at',
];

const EXCEPTION_HEADER = [
  'response_id',
  'submitted_at',
  'respondent_name',
  'respondent_email',
  'raw_coach_name',
  'canonical_coach_name',
  'coach_id',
  'feedback_type',
  'satisfaction_score',
  'nps_score',
  'nps_category',
  'progress_score',
  'expectation_score',
  'community_score',
  'q_gap',
  'free_comment',
  'issue',
  'note',
  'created_at',
  'updated_at',
];

const CUSTOMER_COACH_ASSIGNMENTS_HEADER = [
  'assignment_id',
  'lead_id',
  'customer_id',
  'lead_display_name',
  'respondent_email',
  'phone',
  'age',
  'source_sheet',
  'source_row',
  'coach_id',
  'role',
  'assignee_kind',
  'assignee_scope',
  'assignment_status',
  'assigned_at',
  'assignment_source',
  'meeting_status',
  'meeting_done_at',
  'potex_sale_status',
  'recruitment_status',
  'partner_status_note',
  'last_partner_update_at',
  'last_partner_updated_by',
  'ended_at',
  'note',
  'created_at',
  'updated_at',
];

const CUSTOMER_CHANNEL_LINKS_HEADER = [
  'channel_link_id',
  'customer_id',
  'channel_type',
  'channel_user_id',
  'channel_record_id',
  'is_primary',
  'link_status',
  'registered_at',
  'note',
  'created_at',
  'updated_at',
];

function normalizeName(value: string): string {
  return (value || '').replace(/[\s　]/g, '').trim().toLowerCase();
}

function normalizeEmail(value: string): string {
  return (value || '').trim().toLowerCase();
}

function headerLookup(header: string[]): Map<string, number> {
  const lookup = new Map<string, number>();
  header.forEach((col, idx) => lookup.set(col, idx));
  return lookup;
}

function getByAliases(row: string[], lookup: Map<string, number>, aliases: string[]): string {
  for (const alias of aliases) {
    const index = lookup.get(alias);
    if (index !== undefined && row[index] !== undefined) {
      return String(row[index] || '').trim();
    }
  }
  return '';
}

function parseScore(value: string): string {
  const text = String(value || '').trim();
  const match = text.match(/^(\d+)/);
  return match ? match[1] : text;
}

function toBooleanFlag(value: string): string {
  const text = String(value || '').trim().toLowerCase();
  return ['true', '1', 'yes', 'on'].includes(text) ? 'TRUE' : 'FALSE';
}

function inferCustomerStatus(row: Record<string, string>): string {
  const currentStatus = row['current_status'] || '';
  if (currentStatus) return currentStatus;
  const completed = toBooleanFlag(row['program_completed_flag'] || '') === 'TRUE';
  if (completed) return 'completed';
  return 'active';
}

function currentIsoTimestamp(): string {
  return new Date().toISOString();
}

function buildResponseId(sourceSheet: string, submittedAt: string, respondentEmail: string, rawCoachName: string): string {
  const composite = [
    String(sourceSheet || '').trim(),
    String(submittedAt || '').trim(),
    String(respondentEmail || '').trim().toLowerCase(),
    String(rawCoachName || '').replace(/[\s　]/g, '').trim().toLowerCase(),
  ].join('||');
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, composite, Utilities.Charset.UTF_8);
  const hex = bytes.map((b) => {
    const v = (b < 0 ? b + 256 : b).toString(16);
    return v.length === 1 ? `0${v}` : v;
  }).join('');
  return `resp_${hex.slice(0, 12)}`;
}

function buildAssignedCoachNameByCustomerId(
  assignmentRows: Array<Record<string, string>>,
  coachRows: Array<Record<string, string>>,
): Map<string, string> {
  const coachById = new Map<string, string>();
  coachRows.forEach((row) => {
    const coachId = row['coach_id'] || '';
    const coachName = row['coach_name'] || '';
    if (coachId && coachName && !coachById.has(coachId)) coachById.set(coachId, coachName);
  });

  const assignmentByCustomerId = new Map<string, Record<string, string>>();
  assignmentRows
    .slice()
    .filter((row) => (row['customer_id'] || ''))
    .sort((a, b) => {
      const aActive = !(a['ended_at'] || '') && (a['assignment_status'] || '') !== 'ended';
      const bActive = !(b['ended_at'] || '') && (b['assignment_status'] || '') !== 'ended';
      if (aActive !== bActive) return aActive ? -1 : 1
      const aDate = a['assigned_at'] || a['updated_at'] || a['created_at'] || '';
      const bDate = b['assigned_at'] || b['updated_at'] || b['created_at'] || '';
      return bDate.localeCompare(aDate);
    })
    .forEach((row) => {
      const customerId = row['customer_id'] || '';
      if (customerId && !assignmentByCustomerId.has(customerId)) assignmentByCustomerId.set(customerId, row);
    });

  const assignedCoachNameByCustomerId = new Map<string, string>();
  assignmentByCustomerId.forEach((row, customerId) => {
    const coachName = coachById.get(row['coach_id'] || '') || '';
    const noteCoachName = ((row['note'] || '').match(/(?:^|\| )coach_name=([^|]+)/) || [])[1] || '';
    const assignedCoachName = (coachName || noteCoachName || '').trim();
    if (assignedCoachName) assignedCoachNameByCustomerId.set(customerId, assignedCoachName);
  });

  return assignedCoachNameByCustomerId;
}

function buildCurrentPlanNameByCustomerId(
  planRows: Array<Record<string, string>>,
): Map<string, string> {
  const planByCustomerId = new Map<string, string>();
  planRows
    .slice()
    .filter((row) => (row['customer_id'] || ''))
    .sort((a, b) => {
      const aActive = !['completed', 'lost', 'cancelled', 'ended'].includes((a['status'] || '').toLowerCase());
      const bActive = !['completed', 'lost', 'cancelled', 'ended'].includes((b['status'] || '').toLowerCase());
      if (aActive !== bActive) return aActive ? -1 : 1;
      const aDate = a['contract_date'] || a['start_date'] || a['created_at'] || '';
      const bDate = b['contract_date'] || b['start_date'] || b['created_at'] || '';
      return bDate.localeCompare(aDate);
    })
    .forEach((row) => {
      const customerId = row['customer_id'] || '';
      const planName = row['plan_name'] || '';
      if (customerId && planName && !planByCustomerId.has(customerId)) planByCustomerId.set(customerId, planName);
    });
  return planByCustomerId;
}

function buildCoachAliasLookup(
  coachRows: Array<Record<string, string>>,
  coachAliasRows: Array<Record<string, string>>,
): Map<string, { coachId: string; coachName: string }> {
  const lookup = new Map<string, { coachId: string; coachName: string }>();
  coachRows.forEach((row) => {
    const coachName = row['coach_name'] || '';
    const coachId = row['coach_id'] || '';
    const key = normalizeName(coachName);
    if (key && coachId) lookup.set(key, { coachId, coachName });
  });
  coachAliasRows.forEach((row) => {
    const aliasName = normalizeName(row['alias_name'] || '');
    const canonicalCoachId = row['canonical_coach_id'] || '';
    const canonicalCoachName = row['canonical_coach_name'] || '';
    if (aliasName && canonicalCoachId) lookup.set(aliasName, { coachId: canonicalCoachId, coachName: canonicalCoachName });
  });
  return lookup;
}

function buildCustomerMatchers(
  customerRows: Array<Record<string, string>>,
  aliasRows: Array<Record<string, string>>,
  assignedCoachNameByCustomerId: Map<string, string> = new Map(),
): {
  byEmail: Map<string, Record<string, string>>;
  byName: Map<string, Array<Record<string, string>>>;
  aliasByName: Map<string, Record<string, string>>;
  assignedCoachNameByCustomerId: Map<string, string>;
} {
  const byEmail = new Map<string, Record<string, string>>();
  const byName = new Map<string, Array<Record<string, string>>>();
  const aliasByName = new Map<string, Record<string, string>>();

  customerRows.forEach((row) => {
    const email = normalizeEmail(row['email'] || '');
    const name = normalizeName(row['customer_name'] || '');
    if (email && !byEmail.has(email)) byEmail.set(email, row);
    if (name) {
      const existing = byName.get(name) || [];
      existing.push(row);
      byName.set(name, existing);
    }
  });

  aliasRows.forEach((row) => {
    const alias = normalizeName(row['alias_name'] || '');
    const status = (row['status'] || '').trim().toLowerCase();
    const canonicalCustomerId = row['canonical_customer_id'] || '';
    if (!alias || !canonicalCustomerId || !['approved', 'active', 'resolved'].includes(status)) return;
    aliasByName.set(alias, row);
  });

  return { byEmail, byName, aliasByName, assignedCoachNameByCustomerId };
}

function matchCustomer(
  respondentName: string,
  respondentEmail: string,
  canonicalCoachName: string,
  customerRows: Array<Record<string, string>>,
  customerMatchers: ReturnType<typeof buildCustomerMatchers>,
): { customerId: string; customerName: string; method: string; confidence: string } {
  const emailKey = normalizeEmail(respondentEmail);
  const nameKey = normalizeName(respondentName);

  if (emailKey && customerMatchers.byEmail.has(emailKey)) {
    const customer = customerMatchers.byEmail.get(emailKey)!;
    return {
      customerId: customer['customer_id'] || '',
      customerName: customer['customer_name'] || '',
      method: 'email_exact',
      confidence: 'high',
    };
  }

  if (nameKey && customerMatchers.aliasByName.has(nameKey)) {
    const alias = customerMatchers.aliasByName.get(nameKey)!;
    return {
      customerId: alias['canonical_customer_id'] || '',
      customerName: alias['canonical_customer_name'] || '',
      method: 'alias_map',
      confidence: 'high',
    };
  }

  const named = customerMatchers.byName.get(nameKey) || [];
  if (named.length === 1) {
    return {
      customerId: named[0]['customer_id'] || '',
      customerName: named[0]['customer_name'] || '',
      method: 'name_exact',
      confidence: 'medium',
    };
  }

  if (named.length > 1 && canonicalCoachName) {
    const sameCoach = named.filter((row) => customerMatchers.assignedCoachNameByCustomerId.get(row['customer_id'] || '') === canonicalCoachName);
    if (sameCoach.length === 1) {
      return {
        customerId: sameCoach[0]['customer_id'] || '',
        customerName: sameCoach[0]['customer_name'] || '',
        method: 'name_plus_coach',
        confidence: 'medium',
      };
    }
  }

  // use customerRows to keep signature close to future extension and avoid unused-arg lint complaints
  void customerRows;

  return { customerId: '', customerName: '', method: '', confidence: '' };
}

function readRawValues(ss: GoogleAppsScript.Spreadsheet.Spreadsheet, sheetName: string): string[][] {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];
  return sheet.getDataRange().getDisplayValues();
}

function removeColumnIfExists(
  sheet: GoogleAppsScript.Spreadsheet.Sheet | null,
  columnName: string,
): void {
  if (!sheet) return;
  const values = sheet.getDataRange().getValues();
  if (!values.length) return;
  const header = (values[0] || []).map(String);
  const index = header.indexOf(columnName);
  if (index < 0) return;
  sheet.deleteColumn(index + 1);
}

function migrateCustomersSchema(
  db: GoogleAppsScript.Spreadsheet.Spreadsheet,
): void {
  removeColumnIfExists(db.getSheetByName(SHEETS.CUSTOMERS), 'assigned_coach_id');
}


function ensureColumns(sheet: GoogleAppsScript.Spreadsheet.Sheet | null, columns: string[]): void {
  if (!sheet) return;
  const lastColumn = sheet.getLastColumn();
  if (lastColumn === 0) return;
  const header = sheet.getRange(1, 1, 1, lastColumn).getValues()[0].map((cell) => String(cell || ''));
  const additions = columns.filter((column) => !header.includes(column));
  if (!additions.length) return;
  sheet.getRange(1, lastColumn + 1, 1, additions.length).setValues([additions]);
}

function ensurePartnerAssigneeSeeds(db: GoogleAppsScript.Spreadsheet.Spreadsheet, syncedAt: string): void {
  const coachSheet = db.getSheetByName(SHEETS.COACHES);
  if (!coachSheet) return;
  ensureColumns(coachSheet, ['coach_id', 'coach_name', 'assignee_kind', 'assignee_scope', 'external_role', 'is_active', 'created_at', 'updated_at']);

  const values = coachSheet.getDataRange().getValues();
  const header = (values[0] || []).map((cell) => String(cell || ''));
  const rows = values.slice(1).map((row) => header.reduce<Record<string, string>>((acc, key, idx) => {
    acc[key] = String(row[idx] || '');
    return acc;
  }, {}));
  const indexByCoachId = new Map<string, number>();
  const indexByCoachName = new Map<string, number>();
  rows.forEach((row, idx) => {
    if (row['coach_id']) indexByCoachId.set(row['coach_id'], idx);
    if (row['coach_name']) indexByCoachName.set(normalizeName(row['coach_name']), idx);
  });

  PARTNER_ASSIGNEES.forEach((partner) => {
    const coachId = partner.coachId || '';
    const coachName = partner.coachName || '';
    if (!coachName) return;
    const byIdIndex = indexByCoachId.get(coachId);
    const byNameIndex = indexByCoachName.get(normalizeName(coachName));
    const existingIndex = byIdIndex !== undefined ? byIdIndex : byNameIndex;
    const base = existingIndex !== undefined ? rows[existingIndex] : {};
    const nextRow = {
      ...base,
      coach_id: base['coach_id'] || coachId,
      coach_name: base['coach_name'] || coachName,
      assignee_kind: 'partner',
      assignee_scope: partner.assigneeScope || base['assignee_scope'] || '',
      external_role: partner.externalRole || base['external_role'] || '',
      is_active: partner.isActive || base['is_active'] || 'TRUE',
      created_at: base['created_at'] || syncedAt,
      updated_at: syncedAt,
    };
    if (existingIndex !== undefined) rows[existingIndex] = nextRow;
    else rows.push(nextRow);
  });

  clearAndRewrite(db, SHEETS.COACHES, [header, ...rows.map((row) => header.map((key) => row[key] || ''))]);
}

function syncCustomerLineRegistrationIds(
  db: GoogleAppsScript.Spreadsheet.Spreadsheet,
  lineRegistrationLookup: LineRegistrationLookup,
): void {
  if (lineRegistrationLookup.size === 0) return;
  const sheet = db.getSheetByName(SHEETS.CUSTOMERS);
  if (!sheet) return;
  const values = sheet.getDataRange().getValues();
  if (!values.length) return;

  const header = (values[0] || []).map(String);
  const customerIdIdx = header.indexOf('customer_id');
  if (customerIdIdx < 0) return;

  let lineRegistrationIdx = header.indexOf('line_registration_id');
  if (lineRegistrationIdx < 0) {
    lineRegistrationIdx = header.length;
    sheet.getRange(1, lineRegistrationIdx + 1).setValue('line_registration_id');
  }

  const updates: Array<{ rowIndex: number; value: string }> = [];
  for (let i = 1; i < values.length; i += 1) {
    const row = values[i] || [];
    const customerId = String(row[customerIdIdx] || '');
    if (!customerId) continue;
    const lookupValue = lineRegistrationLookup.get(customerId) || '';
    if (!lookupValue) continue;
    const currentValue = String(row[lineRegistrationIdx] || '');
    if (currentValue === lookupValue) continue;
    updates.push({ rowIndex: i + 1, value: currentValue || lookupValue });
  }

  updates.forEach(({ rowIndex, value }) => {
    sheet.getRange(rowIndex, lineRegistrationIdx + 1).setValue(value);
  });
}

function buildLineRegistrationLookup(lineRegistrationRows: Array<Record<string, string>>): LineRegistrationLookup {
  const byCustomerId = new Map<string, { lineRegistrationId: string; registeredAt: string }>();
  lineRegistrationRows.forEach((row) => {
    const customerId = row['customer_id'] || '';
    const lineRegistrationId = row['line_registration_id'] || '';
    if (!customerId || !lineRegistrationId) return;
    const registeredAt = row['registered_at'] || '';
    const existing = byCustomerId.get(customerId);
    if (!existing || registeredAt > existing.registeredAt || (registeredAt === existing.registeredAt && lineRegistrationId > existing.lineRegistrationId)) {
      byCustomerId.set(customerId, { lineRegistrationId, registeredAt });
    }
  });
  return new Map(Array.from(byCustomerId.entries()).map(([customerId, value]) => [customerId, value.lineRegistrationId]));
}

function buildCustomerCoachAssignments(
  customerRows: Array<Record<string, string>>,
  coachLookup: Map<string, { coachId: string; coachName: string }>,
  existingAssignmentRows: Array<Record<string, string>>,
  syncedAt: string,
): Array<Record<string, string>> {
  const generatedRows = customerRows
    .filter((row) => (row['customer_id'] || '') && (row['assigned_coach_name'] || ''))
    .map((row) => {
      const customerId = row['customer_id'] || '';
      const assignedCoachName = row['assigned_coach_name'] || '';
      const resolvedCoach = coachLookup.get(normalizeName(assignedCoachName)) || { coachId: '', coachName: '' };
      const coachId = resolvedCoach.coachId || '';
      const assignedAt = row['matching_contact_date'] || row['created_at'] || syncedAt;
      const assignmentKey = coachId || normalizeName(assignedCoachName) || 'unresolved_primary';
      return {
        assignment_id: `assign_${customerId}_${assignmentKey}`.replace(/[^A-Za-z0-9_-]/g, '_'),
        lead_id: customerId,
        customer_id: customerId,
        lead_display_name: row['customer_name'] || '',
        respondent_email: row['email'] || '',
        phone: row['phone'] || '',
        age: row['age'] || '',
        source_sheet: row['source_sheet'] || '',
        source_row: row['source_row'] || '',
        coach_id: coachId,
        role: 'primary',
        assignee_kind: 'coach',
        assignee_scope: 'core_coaching',
        assignment_status: coachId ? 'active' : 'unresolved',
        assigned_at: assignedAt,
        assignment_source: 'source_customer_snapshot',
        meeting_status: '',
        meeting_done_at: '',
        potex_sale_status: '',
        recruitment_status: '',
        partner_status_note: '',
        last_partner_update_at: '',
        last_partner_updated_by: '',
        ended_at: '',
        note: assignedCoachName ? `coach_name=${assignedCoachName}` : '',
        created_at: assignedAt,
        updated_at: syncedAt,
      };
    });

  const passthroughRows = existingAssignmentRows
    .filter((row) => (row['assignment_source'] || '') !== 'source_customer_snapshot')
    .map((row) => {
      const normalized: Record<string, string> = {};
      CUSTOMER_COACH_ASSIGNMENTS_HEADER.forEach((key) => {
        normalized[key] = row[key] || '';
      });
      normalized['created_at'] = normalized['created_at'] || syncedAt;
      normalized['updated_at'] = normalized['updated_at'] || normalized['created_at'] || syncedAt;
      return normalized;
    });

  return [...generatedRows, ...passthroughRows];
}

function buildCustomerChannelLinks(
  lineRows: Array<Record<string, string>>,
  syncedAt: string,
): Array<Record<string, string>> {
  const latestByCustomer = new Map<string, { registeredAt: string; channelRecordId: string }>();
  lineRows.forEach((row) => {
    const customerId = row['customer_id'] || '';
    const channelRecordId = row['line_registration_id'] || '';
    if (!customerId || !channelRecordId) return;
    const registeredAt = row['registered_at'] || '';
    const existing = latestByCustomer.get(customerId);
    if (!existing || registeredAt > existing.registeredAt || (registeredAt === existing.registeredAt && channelRecordId > existing.channelRecordId)) {
      latestByCustomer.set(customerId, { registeredAt, channelRecordId });
    }
  });

  return lineRows
    .filter((row) => (row['customer_id'] || '') && (row['line_registration_id'] || ''))
    .map((row) => {
      const customerId = row['customer_id'] || '';
      const channelRecordId = row['line_registration_id'] || '';
      const latest = latestByCustomer.get(customerId);
      const registeredAt = row['registered_at'] || '';
      return {
        channel_link_id: `link_${customerId}_${channelRecordId}`.replace(/[^A-Za-z0-9_-]/g, '_'),
        customer_id: customerId,
        channel_type: 'line',
        channel_user_id: row['line_user_id'] || '',
        channel_record_id: channelRecordId,
        is_primary: latest && latest.channelRecordId === channelRecordId ? 'TRUE' : 'FALSE',
        link_status: 'active',
        registered_at: registeredAt,
        note: [
          row['segment'] ? `segment=${row['segment']}` : '',
          row['line_registration_name'] ? `line_name=${row['line_registration_name']}` : '',
        ].filter(Boolean).join(' | '),
        created_at: registeredAt || syncedAt,
        updated_at: syncedAt,
      };
    });
}

function buildStagingCustomers(
  cfg: RuntimeConfig,
  lineRegistrationLookup: LineRegistrationLookup = new Map(),
  syncedAt: string = currentIsoTimestamp(),
): { rows: Array<Record<string, string>>; sourceRowsRead: number; fallbackUsed: boolean } {
  const db = openSpreadsheetById(cfg.dbSpreadsheetId);
  const coachRows = readSheetAsObjects(db, SHEETS.COACHES);
  const coachAliasRows = readSheetAsObjects(db, 'Coach_Alias_Map');
  const coachLookup = buildCoachAliasLookup(coachRows, coachAliasRows);
  const assignmentRows = readSheetAsObjectsOrEmpty(db, SHEETS.CUSTOMER_COACH_ASSIGNMENTS);
  const planRows = readSheetAsObjects(db, SHEETS.PLANS);
  const assignedCoachNameByCustomerId = buildAssignedCoachNameByCustomerId(assignmentRows, coachRows);
  const planNameByCustomerId = buildCurrentPlanNameByCustomerId(planRows);
  if (!cfg.sourceCustomersWorkbookId) {
    const canonicalRows = readSheetAsObjects(db, SHEETS.CUSTOMERS);
    return {
      rows: canonicalRows.map((row) => ({
        customer_id: row['customer_id'] || '',
        line_registration_id: row['line_registration_id'] || lineRegistrationLookup.get(row['customer_id'] || '') || '',
        customer_name: row['customer_name'] || '',
        source_sheet: row['source_sheet'] || cfg.sourceCustomersSheetName,
        source_row: row['source_row'] || '',
        created_at: row['created_at'] || '',
        course_name: planNameByCustomerId.get(row['customer_id'] || '') || row['course_name'] || '',
        assigned_coach_name: assignedCoachNameByCustomerId.get(row['customer_id'] || '') || row['assigned_coach_name'] || '',
        matching_contact_date: row['matching_contact_date'] || '',
        drive_label_or_url: row['drive_label_or_url'] || '',
        goal_navi_url: '',
        dashboard_url: '',
        video_url: '',
        current_status: inferCustomerStatus(row),
        after_follow_progress: row['app_status'] || '',
        after_follow_offer_date: '',
        after_follow_event_date: '',
        after_follow_result: row['note'] || '',
        discord_sheetlock_survey_done: 'FALSE',
        continuation_tag: row['continuation_tag'] || '',
        program_completed_flag: row['program_completed_flag'] || '',
        app_status: row['app_status'] || '',
        email: row['email'] || '',
        phone: row['phone'] || '',
        address: '',
        age: '',
        updated_at: syncedAt,
      })),
      sourceRowsRead: canonicalRows.length,
      fallbackUsed: true,
    };
  }

  const source = openSpreadsheetById(cfg.sourceCustomersWorkbookId);
  const customerValues = readRawValues(source, cfg.sourceCustomersSheetName);
  const appValues = readRawValues(source, cfg.sourceApplicationsSheetName);
  if (!customerValues.length) {
    return { rows: [], sourceRowsRead: 0, fallbackUsed: cfg.sourceCustomersFallbackToCanonical };
  }

  const customerHeader = headerLookup(customerValues[0]);
  const appHeader = appValues.length ? headerLookup(appValues[0]) : new Map<string, number>();
  const appByName = new Map<string, Record<string, string>>();
  appValues.slice(1).forEach((row) => {
    const name = normalizeName(getByAliases(row, appHeader, ['氏名', 'お名前']));
    if (!name) return;
    appByName.set(name, {
      email: getByAliases(row, appHeader, ['メールアドレス']),
      phone: getByAliases(row, appHeader, ['電話番号']),
      address: getByAliases(row, appHeader, ['住所']),
      age: getByAliases(row, appHeader, ['年齢']),
    });
  });

  const canonicalRows = readSheetAsObjects(db, SHEETS.CUSTOMERS);
  const canonicalByKey = new Map<string, Record<string, string>>();
  canonicalRows.forEach((row) => {
    const key = `${row['source_sheet'] || ''}::${row['source_row'] || ''}`;
    if (key !== '::') canonicalByKey.set(key, row);
  });

  const rows = customerValues.slice(1).map((row, idx) => {
    const sourceRow = String(idx + 2);
    const customerName = getByAliases(row, customerHeader, ['氏名', 'お名前']);
    const canonical = canonicalByKey.get(`${cfg.sourceCustomersSheetName}::${sourceRow}`) || {};
    const app = appByName.get(normalizeName(customerName)) || {};
    const completedFlag = getByAliases(row, customerHeader, ['受講終了']);
    const appStatus = getByAliases(row, customerHeader, ['app希望ステータス']);
    const courseName = getByAliases(row, customerHeader, ['コース']);
    const afterFollowProgress = getByAliases(row, customerHeader, ['ｱﾌﾀｰﾌｫﾛｰ進捗']);
    const customerId = canonical['customer_id'] || '';
    const resolvedCourseName = planNameByCustomerId.get(customerId) || courseName;
    return {
      customer_id: customerId,
      line_registration_id: canonical['line_registration_id'] || lineRegistrationLookup.get(customerId) || '',
      customer_name: customerName,
      source_sheet: cfg.sourceCustomersSheetName,
      source_row: sourceRow,
      created_at: getByAliases(row, customerHeader, ['　', 'タイムスタンプ', '作成日']),
      course_name: resolvedCourseName,
      assigned_coach_name: assignedCoachNameByCustomerId.get(customerId) || (coachLookup.get(normalizeName(getByAliases(row, customerHeader, ['担当コーチ'])))?.coachName || getByAliases(row, customerHeader, ['担当コーチ'])),
      matching_contact_date: getByAliases(row, customerHeader, ['マッチング連絡日', 'マッチング連絡日　']),
      drive_label_or_url: getByAliases(row, customerHeader, ['ドライブ名', 'ドライブラベル', 'Drive']),
      goal_navi_url: getByAliases(row, customerHeader, ['ゴールナビURL', 'Goal Navi URL']),
      dashboard_url: getByAliases(row, customerHeader, ['ダッシュボードURL', 'Dashboard URL']),
      video_url: getByAliases(row, customerHeader, ['動画URL', 'Video URL']),
      current_status: toBooleanFlag(completedFlag) === 'TRUE' ? 'completed' : (canonical['current_status'] || 'active'),
      after_follow_progress: afterFollowProgress,
      after_follow_offer_date: getByAliases(row, customerHeader, ['ｱﾌﾀｰﾌｫﾛｰ打診日']),
      after_follow_event_date: getByAliases(row, customerHeader, ['ｱﾌﾀｰﾌｫﾛｰ実施日']),
      after_follow_result: getByAliases(row, customerHeader, ['ｱﾌﾀｰﾌｫﾛｰ結果']),
      discord_sheetlock_survey_done: getByAliases(row, customerHeader, ['discord・sheetlockアンケート', 'discord_sheetlock_survey_done']) || 'FALSE',
      continuation_tag: canonical['continuation_tag'] || '',
      program_completed_flag: toBooleanFlag(completedFlag),
      app_status: appStatus,
      email: app['email'] || canonical['email'] || '',
      phone: app['phone'] || canonical['phone'] || '',
      address: app['address'] || '',
      age: app['age'] || '',
      updated_at: syncedAt,
    };
  }).filter((row) => row.customer_name);

  return { rows, sourceRowsRead: rows.length, fallbackUsed: false };
}

function buildFeedbackResponses(
  cfg: RuntimeConfig,
  syncedAt: string = currentIsoTimestamp(),
): { rows: Array<Record<string, string>>; sourceRowsRead: number; responseIdCollisions: number } {
  const db = openSpreadsheetById(cfg.dbSpreadsheetId);
  const feedbackBook = openSpreadsheetById(cfg.sourceFeedbackWorkbookId);
  const coachRows = readSheetAsObjects(db, SHEETS.COACHES);
  const coachAliasRows = readSheetAsObjects(db, 'Coach_Alias_Map');
  const customerRows = readSheetAsObjects(db, SHEETS.CUSTOMERS);
  const customerAliasRows = readSheetAsObjects(db, SHEETS.CUSTOMER_ALIAS_MAP);
  const assignmentRows = readSheetAsObjectsOrEmpty(db, SHEETS.CUSTOMER_COACH_ASSIGNMENTS);

  const coachLookup = buildCoachAliasLookup(coachRows, coachAliasRows);
  const assignedCoachNameByCustomerId = buildAssignedCoachNameByCustomerId(assignmentRows, coachRows);
  const customerMatchers = buildCustomerMatchers(customerRows, customerAliasRows, assignedCoachNameByCustomerId);

  const rows: Array<Record<string, string>> = [];
  let sourceRowsRead = 0;

  cfg.sourceFeedbackSheets.forEach((sheetName) => {
    const values = readRawValues(feedbackBook, sheetName);
    if (!values.length) return;
    const header = headerLookup(values[0]);
    values.slice(1).forEach((row, idx) => {
      const respondentEmail = getByAliases(row, header, ['メールアドレス']);
      const respondentName = getByAliases(row, header, ['お名前']);
      if (!respondentEmail && !respondentName) return;
      sourceRowsRead += 1;

      const rawCoachName = getByAliases(row, header, ['担当コーチ名']);
      const coach = coachLookup.get(normalizeName(rawCoachName)) || { coachId: '', coachName: '' };
      const matched = matchCustomer(respondentName, respondentEmail, coach.coachName, customerRows, customerMatchers);

      const isFinal = sheetName.includes('最終');
      const submittedAt = getByAliases(row, header, ['タイムスタンプ']);
      const responseId = buildResponseId(sheetName, submittedAt, respondentEmail, rawCoachName);
      rows.push({
        response_id: responseId,
        feedback_type: isFinal ? 'final' : 'monthly',
        submitted_at: submittedAt,
        respondent_email: respondentEmail,
        respondent_name: respondentName,
        raw_coach_name: rawCoachName,
        coach_id: coach.coachId,
        customer_id: matched.customerId,
        customer_match_method: matched.method,
        customer_match_confidence: matched.confidence,
        progress_score: parseScore(getByAliases(row, header, [
          'Q1 POTEXを通じて、ご自身の生産性向上や目標達成に向けた「変化」や「前進」をどの程度実感していますか？',
          'Q4 POTEXを通じて、ご自身の生産性向上や目標達成に向けた「変化」や「前進」をどの程度実感していますか？',
        ])),
        expectation_score: parseScore(getByAliases(row, header, [
          'Q4 POTEX受講開始前のご期待と比べて、現在の進捗や体験はいかがですか？',
          'Q7 POTEX受講開始前のご期待と比べて、現在の進捗や体験はいかがですか？',
        ])),
        satisfaction_score: parseScore(getByAliases(row, header, [
          'Q7 POTEXのコーチングサービスをご利用いただいての満足度はどのくらいでしょうか？',
          'Q10 POTEXのコーチングサービスをご利用いただいての満足度はどのくらいでしょうか？',
          'Q1 POTEXサービス全体の満足度を教えてください',
        ])),
        nps_score: parseScore(getByAliases(row, header, [
          'Q6 POTEXのコーチングサービスを、友人/知人にすすめる可能性はどの程度ありますでしょうか？（10=勧める可能性が高い、0=勧める可能性が低い）',
          'Q9 POTEXのコーチングサービスを、友人/知人にすすめる可能性はどの程度ありますでしょうか？（10=勧める可能性が高い、0=勧める可能性が低い）',
          'Q3 POTEXは、周りで同じ悩みを抱える方にどの程度おすすめしたいと思いますか？\n0（全くすすめない）– 10（ぜひすすめたい）',
        ])),
        nps_category: '',
        q_reason: getByAliases(row, header, [
          'Q2 Q1の選択理由と、具体的に実感した変化・があれば教えてください。\n※特にない場合、「なし」とご記載ください',
          'Q5 Q4の選択理由と、具体的に実感した変化・があれば教えてください。\n※特にない場合、「なし」とご記載ください',
          'Q2 Q1.の選択理由を教えてください',
        ]),
        q_gap: getByAliases(row, header, [
          'Q5 【Q4で1もしくは2と回答した方】 \nどのような点にギャップを感じていますか？ 率直にお聞かせください。\n※特にない場合、「なし」とご記載ください',
          'Q8 【Q7で1もしくは2と回答した方】 \nどのような点にギャップを感じていますか？ 率直にお聞かせください。\n※特にない場合、「なし」とご記載ください',
        ]),
        free_comment: getByAliases(row, header, [
          'Q8 その他、POTEXサービス全体へのご要望やご意見があればご自由にお書きください。',
          'Q11 その他、POTEXサービス全体へのご要望やご意見があればご自由にお書きください。',
        ]),
        community_score: parseScore(getByAliases(row, header, ['③ POTEXコミュニティ（Discord）や各種イベント（ワークショップ・オフ会・合宿など）'])),
        daily_support_score: parseScore(getByAliases(row, header, ['① デイリークエスト記録＆コーチからのフォローコメント'])),
        session_score: parseScore(getByAliases(row, header, ['② コーチとの1on1セッション'])),
        created_at: submittedAt || syncedAt,
        updated_at: syncedAt,
      });
    });
  });

  rows.forEach((row) => {
    const nps = Number(row.nps_score || '');
    if (!Number.isNaN(nps) && row.nps_score) {
      row.nps_category = nps >= 9 ? 'promoter' : nps >= 7 ? 'passive' : 'detractor';
    }
  });

  const responseIdCounts = new Map<string, number>();
  rows.forEach((row) => {
    const rid = row['response_id'] || '';
    if (!rid) return;
    responseIdCounts.set(rid, (responseIdCounts.get(rid) || 0) + 1);
  });
  let responseIdCollisions = 0;
  responseIdCounts.forEach((count) => {
    if (count > 1) responseIdCollisions += count - 1;
  });

  return { rows, sourceRowsRead, responseIdCollisions };
}

function buildFeedbackOutputs(
  responseRows: Array<Record<string, string>>,
  customerRows: Array<Record<string, string>>,
  coachRows: Array<Record<string, string>>,
  syncedAt: string = currentIsoTimestamp(),
): {
  feedbackRows: Array<Record<string, string>>;
  exceptionRows: Array<Record<string, string>>;
} {
  const feedbackRows: Array<Record<string, string>> = [];
  const exceptionRows: Array<Record<string, string>> = [];
  const customerById = new Map<string, Record<string, string>>();
  customerRows.forEach((row) => {
    const customerId = row['customer_id'] || '';
    if (customerId && !customerById.has(customerId)) customerById.set(customerId, row);
  });
  const coachById = new Map<string, Record<string, string>>();
  coachRows.forEach((row) => {
    const coachId = row['coach_id'] || '';
    if (coachId && !coachById.has(coachId)) coachById.set(coachId, row);
  });

  responseRows.forEach((row, idx) => {
    const missingCoach = !row['coach_id'];
    const missingCustomer = !row['customer_id'];
    if (!missingCoach && !missingCustomer) {
      feedbackRows.push({
        feedback_id: `FDBK-${String(idx + 1).padStart(4, '0')}`,
        response_id: row['response_id'] || '',
        session_id: '',
        customer_id: row['customer_id'] || '',
        customer_name: customerById.get(row['customer_id'] || '')?.['customer_name'] || '',
        coach_id: row['coach_id'] || '',
        feedback_date: row['submitted_at'] || '',
        feedback_type: row['feedback_type'] || '',
        rating: row['satisfaction_score'] || '',
        nps_score: row['nps_score'] || '',
        nps_category: row['nps_category'] || '',
        progress_score: row['progress_score'] || '',
        expectation_score: row['expectation_score'] || '',
        community_score: row['community_score'] || '',
        comment: row['free_comment'] || '',
        followup_needed: '',
        note: '',
        respondent_name: row['respondent_name'] || '',
        respondent_email: row['respondent_email'] || '',
        created_at: row['submitted_at'] || syncedAt,
        updated_at: syncedAt,
      });
      return;
    }

    exceptionRows.push({
      response_id: row['response_id'] || '',
      submitted_at: row['submitted_at'] || '',
      respondent_name: row['respondent_name'] || '',
      respondent_email: row['respondent_email'] || '',
      raw_coach_name: row['raw_coach_name'] || '',
      canonical_coach_name: coachById.get(row['coach_id'] || '')?.['coach_name'] || '',
      coach_id: row['coach_id'] || '',
      feedback_type: row['feedback_type'] || '',
      satisfaction_score: row['satisfaction_score'] || '',
      nps_score: row['nps_score'] || '',
      nps_category: row['nps_category'] || '',
      progress_score: row['progress_score'] || '',
      expectation_score: row['expectation_score'] || '',
      community_score: row['community_score'] || '',
      q_gap: row['q_gap'] || '',
      free_comment: row['free_comment'] || '',
      issue: missingCoach ? 'coach_unmatched' : 'customer_unmatched',
      note: missingCoach ? 'coach unmatched' : 'customer unmatched',
      created_at: row['submitted_at'] || syncedAt,
      updated_at: syncedAt,
    });
  });

  return { feedbackRows, exceptionRows };
}

const MANUALLY_MAINTAINED_DB_SHEETS = [
  SHEETS.CUSTOMERS,
  SHEETS.COACHES,
  SHEETS.SESSIONS,
  'Coach_Alias_Map',
  SHEETS.CUSTOMER_ALIAS_MAP,
  SHEETS.OPS_FOLLOWUP_QUEUE,
  SHEETS.OPS_COACH_LOAD,
  SHEETS.OPS_CONTINUATION_TARGETS,
] as const;

export function refreshCanonicalStaging(cfg: RuntimeConfig): Stats {
  const db = openSpreadsheetById(cfg.dbSpreadsheetId);
  const syncedAt = currentIsoTimestamp();
  MANUALLY_MAINTAINED_DB_SHEETS.forEach((sheetName) => ensureAuditColumns(db, sheetName, syncedAt));
  ensurePartnerAssigneeSeeds(db, syncedAt);
  const customerRows = readSheetAsObjects(db, SHEETS.CUSTOMERS);
  const coachRows = readSheetAsObjects(db, SHEETS.COACHES);
  const coachAliasRows = readSheetAsObjects(db, 'Coach_Alias_Map');
  const coachLookup = buildCoachAliasLookup(coachRows, coachAliasRows);
  const existingAssignmentRows = readSheetAsObjectsOrEmpty(db, SHEETS.CUSTOMER_COACH_ASSIGNMENTS);
  const lineOutputs = buildLineRegistrationOutputs(cfg, syncedAt);
  const lineRegistrationLookup = buildLineRegistrationLookup(lineOutputs.lineRegistrations);
  const stagingCustomers = buildStagingCustomers(cfg, lineRegistrationLookup, syncedAt);
  const customerCoachAssignments = buildCustomerCoachAssignments(stagingCustomers.rows, coachLookup, existingAssignmentRows, syncedAt);
  const customerChannelLinks = buildCustomerChannelLinks(lineOutputs.lineRegistrations, syncedAt);
  const feedbackResponses = buildFeedbackResponses(cfg, syncedAt);
  const outputs = buildFeedbackOutputs(feedbackResponses.rows, customerRows, coachRows, syncedAt);
  const commercial = buildCommercialOutputs(
    cfg,
    lineOutputs.lineRegistrationEvents.map((event) => ({
      customerId: event.customerId,
      eventDate: event.eventDate,
      eventType: 'line_registered',
      changedBy: event.changedBy,
      note: event.note,
    })),
  );

  clearAndRewrite(db, SHEETS.STAGING_CUSTOMERS, [
    STAGING_CUSTOMER_HEADER,
    ...stagingCustomers.rows.map((row) => STAGING_CUSTOMER_HEADER.map((key) => row[key] || '')),
  ]);
  clearAndRewrite(db, SHEETS.STAGING_PAYMENTS, [
    STAGING_PAYMENTS_HEADER as unknown as string[],
    ...commercial.stagingPayments.map((row) => STAGING_PAYMENTS_HEADER.map((key) => row[key] || '')),
  ]);
  clearAndRewrite(db, SHEETS.LINE_REGISTRATIONS, [
    LINE_REGISTRATIONS_HEADER as unknown as string[],
    ...lineOutputs.lineRegistrations.map((row) => LINE_REGISTRATIONS_HEADER.map((key) => row[key] || '')),
  ]);
  clearAndRewrite(db, SHEETS.CUSTOMER_COACH_ASSIGNMENTS, [
    CUSTOMER_COACH_ASSIGNMENTS_HEADER,
    ...customerCoachAssignments.map((row) => CUSTOMER_COACH_ASSIGNMENTS_HEADER.map((key) => row[key] || '')),
  ]);
  clearAndRewrite(db, SHEETS.CUSTOMER_CHANNEL_LINKS, [
    CUSTOMER_CHANNEL_LINKS_HEADER,
    ...customerChannelLinks.map((row) => CUSTOMER_CHANNEL_LINKS_HEADER.map((key) => row[key] || '')),
  ]);
  syncCustomerLineRegistrationIds(db, lineRegistrationLookup);
  migrateCustomersSchema(db);
  clearAndRewrite(db, SHEETS.FEEDBACK, [
    FEEDBACK_HEADER,
    ...outputs.feedbackRows.map((row) => FEEDBACK_HEADER.map((key) => row[key] || '')),
  ]);
  clearAndRewrite(db, SHEETS.PLANS, [
    PLANS_HEADER as unknown as string[],
    ...commercial.plans.map((row) => PLANS_HEADER.map((key) => row[key] || '')),
  ]);
  clearAndRewrite(db, SHEETS.PAYMENTS, [
    PAYMENTS_HEADER as unknown as string[],
    ...commercial.payments.map((row) => PAYMENTS_HEADER.map((key) => row[key] || '')),
  ]);
  clearAndRewrite(db, SHEETS.CONVERSION_HISTORY, [
    CONVERSION_HISTORY_HEADER as unknown as string[],
    ...commercial.conversionHistory.map((row) => CONVERSION_HISTORY_HEADER.map((key) => row[key] || '')),
  ]);
  clearAndRewrite(db, SHEETS.EXCEPTIONS_FEEDBACK_MATCH, [
    EXCEPTION_HEADER,
    ...outputs.exceptionRows.map((row) => EXCEPTION_HEADER.map((key) => row[key] || '')),
  ]);
  clearAndRewrite(db, SHEETS.EXCEPTIONS_CONTINUATION_MATCH, [
    CONTINUATION_EXCEPTION_HEADER as unknown as string[],
    ...commercial.continuationExceptions.map((row) => CONTINUATION_EXCEPTION_HEADER.map((key) => row[key] || '')),
  ]);

  return {
    sourceCustomerRowsRead: stagingCustomers.sourceRowsRead,
    sourceFeedbackRowsRead: feedbackResponses.sourceRowsRead,
    partnersWritten: 0,
    partnerAliasRowsWritten: 0,
    customerPartnerAssignmentsWritten: 0,
    partnerPipelineStatusesWritten: 0,
    feedbackResponseIdCollisions: feedbackResponses.responseIdCollisions,
    stagingCustomersWritten: stagingCustomers.rows.length,
    feedbackRowsWritten: outputs.feedbackRows.length,
    feedbackExceptionRowsWritten: outputs.exceptionRows.length,
    customerFallbackUsed: stagingCustomers.fallbackUsed,
    stagingPaymentsWritten: commercial.stagingPayments.length,
    plansWritten: commercial.plans.length,
    paymentsWritten: commercial.payments.length,
    conversionHistoryWritten: commercial.conversionHistory.length,
    paymentUnmatchedCount: commercial.paymentUnmatchedCount,
    lineRegistrationsWritten: lineOutputs.lineRegistrationCount,
    lineRegistrationUnmatchedCount: lineOutputs.lineRegistrationUnmatchedCount,
    continuationExceptionsWritten: commercial.continuationExceptions.length,
    continuationUnmatchedCount: commercial.continuationUnmatchedCount,
  };
}
