import { getRuntimeConfig } from '../config';
import { SHEETS, VIEWS } from '../constants';
import { FEEDBACK_HEADER } from '../canonical/ingest';
import { clearAndRewrite, openSpreadsheetById, readSheetAsObjects } from '../sheets';
import { CS_CONTINUATION_ALIAS_REVIEW_HEADER, CS_ASSIGNMENT_INPUT_HEADER, resolveContinuationCeId } from '../publish/views';

type Stats = {
  pendingAliasRows: number;
  processedAliasRows: number;
  invalidAliasRows: number;
  pendingPaymentAliasRows: number;
  processedPaymentAliasRows: number;
  invalidPaymentAliasRows: number;
  pendingContinuationAliasRows: number;
  processedContinuationAliasRows: number;
  invalidContinuationAliasRows: number;
  pendingPartnerAssignmentRows: number;
  processedPartnerAssignmentRows: number;
  invalidPartnerAssignmentRows: number;
  feedbackRowsAdded: number;
  opsFeedbackRowsAdded: number;
  exceptionRowsRemoved: number;
};

const APPROVED_ALIAS_STATUSES = new Set(['approved', 'active', 'resolved']);
const DEFAULT_ALIAS_HEADER = [
  'alias_name',
  'canonical_customer_id',
  'canonical_customer_name',
  'status',
  'confidence',
  'source',
  'respondent_email',
  'related_coach_name',
  'evidence',
  'note',
  'created_at',
  'updated_at',
];

const OPS_FEEDBACK_REVIEW_HEADER = [
  'feedback_id',
  'feedback_date',
  'feedback_type',
  'customer_id',
  'customer_name',
  'coach_id',
  'coach_name',
  'satisfaction_score',
  'nps_score',
  'nps_category',
  'progress_score',
  'expectation_score',
  'low_satisfaction_flag',
  'needs_followup_flag',
  'followup_reason',
  'comment',
  'gap_comment',
  'created_at',
  'updated_at',
];

function currentIsoTimestamp(): string {
  return new Date().toISOString();
}

const CS_ALIAS_INPUT_HEADER = [
  'alias_name',
  'respondent_email',
  'related_coach_name',
  'response_id',
  'current_status',
  'current_canonical_customer_id',
  'current_canonical_customer_name',
  'operator_decision_status',
  'operator_selected_customer_id',
  'operator_selected_customer_name',
  'operator_note',
  'sync_status',
  'last_collected_at',
];

const CS_ASSIGNMENT_HEADER = CS_ASSIGNMENT_INPUT_HEADER as unknown as string[];

const CS_PAYMENT_ALIAS_REVIEW_HEADER = [
  'priority',
  'payment_id',
  'payment_customer_name',
  'payment_line_name',
  'writeback_alias_name',
  'contract_date',
  'paid_date',
  'plan_name',
  'amount',
  'payment_segment',
  'payment_source_sheet',
  'payment_source_row',
  'candidate_segment',
  'candidate_line_registration_id',
  'candidate_display_name',
  'candidate_line_registration_name',
  'candidate_real_name',
  'current_status',
  'current_canonical_customer_id',
  'current_canonical_customer_name',
  'suggestion_basis',
  'suggested_action',
  'operator_decision_status',
  'operator_selected_customer_id',
  'operator_selected_customer_name',
  'operator_note',
  'sync_status',
  'last_collected_at',
];

function normalizeName(value: string): string {
  return (value || '').replace(/\s|　/g, '').trim().toLowerCase();
}

function feedbackKey(responseId: string): string {
  return String(responseId || '').trim();
}

function normalizeLower(value: string): string {
  return String(value || '').trim().toLowerCase();
}

function normalizeApprovalStatus(value: string): string {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const lowered = raw.toLowerCase();
  const aliasMap: Record<string, string> = {
    approved: 'approved',
    active: 'active',
    resolved: 'resolved',
    ok: 'approved',
    승인: 'approved',
    승인완료: 'approved',
    승인됨: 'approved',
    承認: 'approved',
    承認済み: 'approved',
    active_ko: 'active',
    진행중: 'active',
    대응중: 'active',
    처리중: 'active',
    active_ja: 'active',
    対応中: 'active',
    進行中: 'active',
    resolved_ko: 'resolved',
    완료: 'resolved',
    해결: 'resolved',
    종료: 'resolved',
    resolved_ja: 'resolved',
    完了: 'resolved',
    解決: 'resolved',
    クローズ: 'resolved',
  };
  return aliasMap[raw] || aliasMap[lowered] || lowered;
}

function parsePartnerAssignmentNumber(assignmentId: string): number {
  const match = (assignmentId || '').match(/^CPA-(\d+)$/);
  return match ? Number(match[1]) : 0;
}

function parseFeedbackNumber(feedbackId: string): number {
  const match = (feedbackId || '').match(/^FDBK-(\d+)$/);
  return match ? Number(match[1]) : 0;
}

function getCustomerNameById(customerById: Map<string, Record<string, string>>, customerId: string): string {
  return customerById.get(customerId)?.['customer_name'] || '';
}

function isApprovalLikeStatus(status: string): boolean {
  return APPROVED_ALIAS_STATUSES.has(normalizeApprovalStatus(status));
}

function rowsToValues(header: string[], rows: Array<Record<string, string>>): string[][] {
  return [header, ...rows.map((row) => header.map((key) => row[key] || ''))];
}

function buildAliasLookup(aliasRows: Array<Record<string, string>>): Map<string, Record<string, string>> {
  const lookup = new Map<string, Record<string, string>>();
  aliasRows.forEach((row) => {
    const alias = normalizeName(row['alias_name'] || '');
    const status = normalizeApprovalStatus(row['status'] || '');
    const canonicalId = row['canonical_customer_id'] || '';
    if (!alias || !canonicalId || !APPROVED_ALIAS_STATUSES.has(status)) return;
    lookup.set(alias, row);
  });
  return lookup;
}

function buildFeedbackRow(
  exc: Record<string, string>,
  feedbackId: string,
  customerId: string,
  customerName: string,
  syncedAt: string,
  existingCreatedAt: string = '',
): Record<string, string> {
  return {
    feedback_id: feedbackId,
    response_id: exc['response_id'] || '',
    session_id: '',
    customer_id: customerId,
    customer_name: customerName,
    coach_id: exc['coach_id'] || '',
    feedback_date: exc['submitted_at'] || '',
    feedback_type: exc['feedback_type'] || '',
    rating: exc['satisfaction_score'] || '',
    nps_score: exc['nps_score'] || '',
    nps_category: exc['nps_category'] || '',
    progress_score: exc['progress_score'] || '',
    expectation_score: exc['expectation_score'] || '',
    community_score: exc['community_score'] || '',
    comment: exc['free_comment'] || '',
    followup_needed: '',
    note: 'resolved_by_customer_alias_map',
    respondent_name: exc['respondent_name'] || '',
    respondent_email: exc['respondent_email'] || '',
    created_at: existingCreatedAt || exc['submitted_at'] || syncedAt,
    updated_at: syncedAt,
  };
}

function buildOpsFeedbackRow(
  feedbackRow: Record<string, string>,
  exc: Record<string, string>,
  coachName: string,
  syncedAt: string,
  existingCreatedAt: string = '',
): Record<string, string> {
  return {
    feedback_id: feedbackRow['feedback_id'] || '',
    feedback_date: feedbackRow['feedback_date'] || '',
    feedback_type: feedbackRow['feedback_type'] || '',
    customer_id: feedbackRow['customer_id'] || '',
    customer_name: feedbackRow['customer_name'] || '',
    coach_id: feedbackRow['coach_id'] || '',
    coach_name: coachName,
    satisfaction_score: exc['satisfaction_score'] || '',
    nps_score: exc['nps_score'] || '',
    nps_category: exc['nps_category'] || '',
    progress_score: exc['progress_score'] || '',
    expectation_score: exc['expectation_score'] || '',
    low_satisfaction_flag: '',
    needs_followup_flag: '',
    followup_reason: '',
    comment: exc['free_comment'] || '',
    gap_comment: exc['q_gap'] || '',
    created_at: existingCreatedAt || feedbackRow['feedback_date'] || syncedAt,
    updated_at: syncedAt,
  };
}

function emptyStats(): Stats {
  return {
    pendingAliasRows: 0,
    processedAliasRows: 0,
    invalidAliasRows: 0,
    pendingPaymentAliasRows: 0,
    processedPaymentAliasRows: 0,
    invalidPaymentAliasRows: 0,
    pendingContinuationAliasRows: 0,
    processedContinuationAliasRows: 0,
    invalidContinuationAliasRows: 0,
    pendingPartnerAssignmentRows: 0,
    processedPartnerAssignmentRows: 0,
    invalidPartnerAssignmentRows: 0,
    feedbackRowsAdded: 0,
    opsFeedbackRowsAdded: 0,
    exceptionRowsRemoved: 0,
  };
}

function safeReadSheetAsObjects(
  spreadsheet: GoogleAppsScript.Spreadsheet.Spreadsheet,
  sheetName: string,
): Array<Record<string, string>> {
  try {
    return readSheetAsObjects(spreadsheet, sheetName);
  } catch (error) {
    return [];
  }
}

export function collectCsWritebackRows(): Stats {
  const cfg = getRuntimeConfig();
  const db = openSpreadsheetById(cfg.dbSpreadsheetId);
  const cs = openSpreadsheetById(cfg.csSpreadsheetId);
  const syncedAt = currentIsoTimestamp();

  const inputRows = safeReadSheetAsObjects(cs, VIEWS.CS_ALIAS_RESOLUTION_INPUT);
  const paymentInputRows = safeReadSheetAsObjects(cs, VIEWS.CS_PAYMENT_ALIAS_REVIEW);
  const continuationInputRows = safeReadSheetAsObjects(cs, VIEWS.CS_CONTINUATION_ALIAS_REVIEW);
  const assignmentInputRows = safeReadSheetAsObjects(cs, VIEWS.CS_ASSIGNMENT_INPUT);

  const actionableRows = inputRows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => {
      const decision = normalizeApprovalStatus(row['operator_decision_status'] || '');
      const syncStatus = (row['sync_status'] || '').trim().toLowerCase();
      return Boolean(decision) && syncStatus !== 'processed';
    });

  const actionablePaymentRows = paymentInputRows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => {
      const decision = normalizeApprovalStatus(row['operator_decision_status'] || '');
      const syncStatus = (row['sync_status'] || '').trim().toLowerCase();
      return Boolean(decision) && syncStatus !== 'processed';
    });

  const actionableContinuationRows = continuationInputRows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => {
      const decision = normalizeApprovalStatus(row['operator_decision_status'] || '');
      const syncStatus = (row['sync_status'] || '').trim().toLowerCase();
      return Boolean(decision) && syncStatus !== 'processed';
    });

  const actionablePartnerRows = assignmentInputRows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => {
      const decision = normalizeApprovalStatus(row['operator_decision_status'] || '');
      const syncStatus = normalizeLower(row['sync_status'] || '');
      return Boolean(decision) && syncStatus !== 'processed';
    });

  if (!actionableRows.length && !actionablePaymentRows.length && !actionableContinuationRows.length && !actionablePartnerRows.length) {
    return emptyStats();
  }

  const aliasRows = readSheetAsObjects(db, SHEETS.CUSTOMER_ALIAS_MAP);
  const feedbackRows = readSheetAsObjects(db, SHEETS.FEEDBACK);
  const opsRows = readSheetAsObjects(db, 'Ops_Feedback_Review');
  const excRows = readSheetAsObjects(db, SHEETS.EXCEPTIONS_FEEDBACK_MATCH);
  const customerRows = readSheetAsObjects(db, SHEETS.CUSTOMERS);
  const coachRows = readSheetAsObjects(db, SHEETS.COACHES);
  const customerCoachAssignmentRows = safeReadSheetAsObjects(db, SHEETS.CUSTOMER_COACH_ASSIGNMENTS);

  const aliasByName = new Map<string, Record<string, string>>();
  aliasRows.forEach((row) => {
    const aliasName = row['alias_name'] || '';
    if (aliasName) aliasByName.set(normalizeName(aliasName), { ...row });
  });

  const customerById = new Map<string, Record<string, string>>();
  customerRows.forEach((row) => {
    const customerId = row['customer_id'] || '';
    if (customerId) customerById.set(customerId, row);
  });

  const processedInputIndexes = new Set<number>();
  const invalidInputReasons = new Map<number, string>();
  const processedPaymentInputIndexes = new Set<number>();
  const invalidPaymentInputReasons = new Map<number, string>();
  const processedContinuationInputIndexes = new Set<number>();
  const invalidContinuationInputReasons = new Map<number, string>();
  const processedPartnerInputIndexes = new Set<number>();
  const invalidPartnerInputReasons = new Map<number, string>();

  actionableRows.forEach(({ row, index }) => {
    const aliasName = row['alias_name'] || '';
    if (!aliasName) {
      invalidInputReasons.set(index, 'error_missing_alias_name');
      console.warn('CS alias writeback skipped: missing alias_name', { rowIndex: index + 2, row });
      return;
    }

    const existing = aliasByName.get(normalizeName(aliasName)) || {};
    const decisionStatus = normalizeApprovalStatus(row['operator_decision_status'] || row['current_status'] || 'review');
    const selectedCustomerId = row['operator_selected_customer_id'] || row['current_canonical_customer_id'] || existing['canonical_customer_id'] || '';
    const selectedCustomerName = row['operator_selected_customer_name']
      || row['current_canonical_customer_name']
      || existing['canonical_customer_name']
      || getCustomerNameById(customerById, selectedCustomerId);

    if (!isApprovalLikeStatus(decisionStatus)) {
      invalidInputReasons.set(index, 'error_unsupported_status');
      return;
    }

    if (!selectedCustomerId) {
      invalidInputReasons.set(index, 'error_missing_customer_id');
      console.warn('CS alias writeback skipped: approval-like status without customer id', {
        rowIndex: index + 2,
        aliasName,
        decisionStatus,
        row,
      });
      return;
    }

    if (!selectedCustomerName) {
      invalidInputReasons.set(index, 'error_missing_customer_name');
      console.warn('CS alias writeback skipped: approval-like status without customer name', {
        rowIndex: index + 2,
        aliasName,
        decisionStatus,
        selectedCustomerId,
        row,
      });
      return;
    }

    const noteParts = [existing['note'] || '', row['operator_note'] || ''].filter(Boolean);

    aliasByName.set(normalizeName(aliasName), {
      alias_name: aliasName,
      canonical_customer_id: selectedCustomerId,
      canonical_customer_name: selectedCustomerName,
      status: decisionStatus,
      confidence: existing['confidence'] || 'operator_review',
      source: 'cs_alias_resolution_input',
      respondent_email: row['respondent_email'] || existing['respondent_email'] || '',
      related_coach_name: row['related_coach_name'] || existing['related_coach_name'] || '',
      evidence: `response:${row['response_id'] || ''}`,
      note: noteParts.join(' | '),
      created_at: existing['created_at'] || syncedAt,
      updated_at: syncedAt,
    });
    processedInputIndexes.add(index);
  });

  actionablePaymentRows.forEach(({ row, index }) => {
    const aliasName = row['writeback_alias_name'] || row['payment_customer_name'] || row['payment_line_name'] || '';
    if (!aliasName) {
      invalidPaymentInputReasons.set(index, 'error_missing_alias_name');
      return;
    }

    const existing = aliasByName.get(normalizeName(aliasName)) || {};
    const decisionStatus = normalizeApprovalStatus(row['operator_decision_status'] || row['current_status'] || 'review');
    const selectedCustomerId = row['operator_selected_customer_id'] || row['current_canonical_customer_id'] || existing['canonical_customer_id'] || '';
    const selectedCustomerName = row['operator_selected_customer_name']
      || row['current_canonical_customer_name']
      || existing['canonical_customer_name']
      || getCustomerNameById(customerById, selectedCustomerId);

    if (!isApprovalLikeStatus(decisionStatus)) {
      invalidPaymentInputReasons.set(index, 'error_unsupported_status');
      return;
    }

    if (!selectedCustomerId) {
      invalidPaymentInputReasons.set(index, 'error_missing_customer_id');
      console.warn('CS payment alias writeback skipped: approval-like status without customer id', {
        rowIndex: index + 2,
        aliasName,
        decisionStatus,
        row,
      });
      return;
    }

    if (!selectedCustomerName) {
      invalidPaymentInputReasons.set(index, 'error_missing_customer_name');
      console.warn('CS payment alias writeback skipped: approval-like status without customer name', {
        rowIndex: index + 2,
        aliasName,
        decisionStatus,
        selectedCustomerId,
        row,
      });
      return;
    }

    const noteParts = [existing['note'] || '', row['operator_note'] || '', row['suggestion_basis'] || ''].filter(Boolean);
    aliasByName.set(normalizeName(aliasName), {
      alias_name: aliasName,
      canonical_customer_id: selectedCustomerId,
      canonical_customer_name: selectedCustomerName,
      status: decisionStatus,
      confidence: existing['confidence'] || 'operator_review',
      source: 'cs_payment_alias_review',
      respondent_email: existing['respondent_email'] || '',
      related_coach_name: existing['related_coach_name'] || '',
      evidence: `${row['payment_source_sheet'] || ''} row ${row['payment_source_row'] || ''}`.trim(),
      note: noteParts.join(' | '),
      created_at: existing['created_at'] || syncedAt,
      updated_at: syncedAt,
    });
    processedPaymentInputIndexes.add(index);
  });


  const partnerById = new Map<string, Record<string, string>>();
  const partnerIdByName = new Map<string, string>();
  coachRows.forEach((row) => {
    const coachId = row['coach_id'] || '';
    const coachName = row['coach_name'] || '';
    if ((row['assignee_kind'] || '').trim().toLowerCase() !== 'partner') return;
    if (coachId) partnerById.set(coachId, row);
    if (coachName) partnerIdByName.set(normalizeName(coachName), coachId);
  });

  const mutablePartnerAssignments = customerCoachAssignmentRows.map((row) => ({ ...row }));
  const partnerAssignmentIndexById = new Map<string, number>();
  mutablePartnerAssignments.forEach((row, index) => {
    const assignmentId = row['assignment_id'] || '';
    if (assignmentId) partnerAssignmentIndexById.set(assignmentId, index);
  });
  const currentPartnerAssignmentByLeadId = new Map<string, Record<string, string>>();
  mutablePartnerAssignments
    .slice()
    .filter((row) => (row['assignee_kind'] || '').trim().toLowerCase() === 'partner')
    .sort((a, b) => {
      const aDate = a['updated_at'] || a['assigned_at'] || a['created_at'] || '';
      const bDate = b['updated_at'] || b['assigned_at'] || b['created_at'] || '';
      return bDate.localeCompare(aDate);
    })
    .forEach((row) => {
      const leadId = row['lead_id'] || row['customer_id'] || '';
      if (leadId && !currentPartnerAssignmentByLeadId.has(leadId)) currentPartnerAssignmentByLeadId.set(leadId, row);
    });
  let nextPartnerAssignmentNumber = Math.max(0, ...mutablePartnerAssignments.map((row) => parsePartnerAssignmentNumber(row['assignment_id'] || '')));

  actionablePartnerRows.forEach(({ row, index }) => {
    const leadId = row['lead_id'] || row['customer_id'] || '';
    if (!leadId) {
      invalidPartnerInputReasons.set(index, 'error_missing_lead_id');
      return;
    }

    const decisionStatus = normalizeApprovalStatus(row['operator_decision_status'] || '');
    if (!isApprovalLikeStatus(decisionStatus)) {
      invalidPartnerInputReasons.set(index, 'error_unsupported_status');
      return;
    }

    const selectedPartnerId = row['operator_selected_assignee_id'] || row['suggested_assignee_id'] || partnerIdByName.get(normalizeName(row['operator_selected_assignee_name'] || '')) || '';
    const selectedPartner = partnerById.get(selectedPartnerId) || {};
    if (!selectedPartnerId || !selectedPartner['coach_id']) {
      invalidPartnerInputReasons.set(index, 'error_missing_partner_id');
      return;
    }

    const existingAssignment = currentPartnerAssignmentByLeadId.get(leadId) || {};
    const assignmentId = existingAssignment['assignment_id'] || `CPA-${String(++nextPartnerAssignmentNumber).padStart(4, '0')}`;
    const assignmentNote = [existingAssignment['note'] || existingAssignment['assignment_note'] || '', row['assignment_note'] || ''].filter(Boolean).join(' | ');
    const customerId = row['customer_id'] || (leadId.startsWith('CUST-') ? leadId : '');
    const updatedRow = {
      assignment_id: assignmentId,
      lead_id: leadId,
      customer_id: customerId,
      lead_display_name: row['lead_display_name'] || row['customer_name'] || '',
      respondent_email: row['respondent_email'] || '',
      phone: row['phone'] || '',
      age: row['age'] || '',
      source_sheet: row['form_response_sheet'] || existingAssignment['source_sheet'] || '',
      source_row: row['form_response_row'] || existingAssignment['source_row'] || '',
      coach_id: selectedPartnerId,
      role: existingAssignment['role'] || 'partner',
      assignee_kind: 'partner',
      assignee_scope: selectedPartner['assignee_scope'] || row['suggested_assignee_scope'] || '',
      assignment_status: 'active',
      assigned_at: existingAssignment['assigned_at'] || syncedAt,
      assignment_source: 'cs_assignment_input',
      meeting_status: existingAssignment['meeting_status'] || '',
      meeting_done_at: existingAssignment['meeting_done_at'] || '',
      potex_sale_status: existingAssignment['potex_sale_status'] || '',
      recruitment_status: existingAssignment['recruitment_status'] || '',
      partner_status_note: existingAssignment['partner_status_note'] || '',
      last_partner_update_at: existingAssignment['last_partner_update_at'] || '',
      last_partner_updated_by: existingAssignment['last_partner_updated_by'] || '',
      ended_at: '',
      note: assignmentNote,
      created_at: existingAssignment['created_at'] || syncedAt,
      updated_at: syncedAt,
    };

    const existingIndex = partnerAssignmentIndexById.get(assignmentId);
    if (existingIndex !== undefined) {
      mutablePartnerAssignments[existingIndex] = updatedRow;
    } else {
      partnerAssignmentIndexById.set(assignmentId, mutablePartnerAssignments.length);
      mutablePartnerAssignments.push(updatedRow);
    }
    currentPartnerAssignmentByLeadId.set(leadId, updatedRow);
    processedPartnerInputIndexes.add(index);
  });

  actionableContinuationRows.forEach(({ row, index }) => {
    const aliasName = row['writeback_alias_name'] || row['cleaned_name'] || row['raw_name'] || '';
    if (!aliasName) {
      invalidContinuationInputReasons.set(index, 'error_missing_alias_name');
      return;
    }

    const existing = aliasByName.get(normalizeName(aliasName)) || {};
    const decisionStatus = normalizeApprovalStatus(row['operator_decision_status'] || row['current_status'] || 'review');
    const selectedCustomerId = row['operator_selected_customer_id'] || row['current_canonical_customer_id'] || existing['canonical_customer_id'] || '';
    const selectedCustomerName = row['operator_selected_customer_name']
      || row['current_canonical_customer_name']
      || existing['canonical_customer_name']
      || getCustomerNameById(customerById, selectedCustomerId);

    if (!isApprovalLikeStatus(decisionStatus)) {
      invalidContinuationInputReasons.set(index, 'error_unsupported_status');
      return;
    }

    if (!selectedCustomerId) {
      invalidContinuationInputReasons.set(index, 'error_missing_customer_id');
      console.warn('CS continuation alias writeback skipped: approval-like status without customer id', {
        rowIndex: index + 2,
        aliasName,
        decisionStatus,
        row,
      });
      return;
    }

    if (!selectedCustomerName) {
      invalidContinuationInputReasons.set(index, 'error_missing_customer_name');
      console.warn('CS continuation alias writeback skipped: approval-like status without customer name', {
        rowIndex: index + 2,
        aliasName,
        decisionStatus,
        selectedCustomerId,
        row,
      });
      return;
    }

    const noteParts = [existing['note'] || '', row['operator_note'] || '', row['suggestion_basis'] || ''].filter(Boolean);
    aliasByName.set(normalizeName(aliasName), {
      alias_name: aliasName,
      canonical_customer_id: selectedCustomerId,
      canonical_customer_name: selectedCustomerName,
      status: decisionStatus,
      confidence: existing['confidence'] || 'operator_review',
      source: 'cs_continuation_alias_review',
      respondent_email: existing['respondent_email'] || '',
      related_coach_name: existing['related_coach_name'] || '',
      evidence: `continuation_exception_id:${resolveContinuationCeId(row)}`,
      note: noteParts.join(' | '),
      created_at: existing['created_at'] || syncedAt,
      updated_at: syncedAt,
    });
    processedContinuationInputIndexes.add(index);
  });

  if (processedPartnerInputIndexes.size > 0) {
    clearAndRewrite(db, SHEETS.CUSTOMER_COACH_ASSIGNMENTS, rowsToValues([
      'assignment_id', 'lead_id', 'customer_id', 'lead_display_name', 'respondent_email', 'phone', 'age', 'source_sheet', 'source_row',
      'coach_id', 'role', 'assignee_kind', 'assignee_scope', 'assignment_status', 'assigned_at', 'assignment_source',
      'meeting_status', 'meeting_done_at', 'potex_sale_status', 'recruitment_status', 'partner_status_note', 'last_partner_update_at', 'last_partner_updated_by',
      'ended_at', 'note', 'created_at', 'updated_at',
    ], mutablePartnerAssignments));
  }

  const mergedAliasRows = Array.from(aliasByName.values()).sort((a, b) => normalizeName(a['alias_name'] || '').localeCompare(normalizeName(b['alias_name'] || '')));
  clearAndRewrite(db, SHEETS.CUSTOMER_ALIAS_MAP, rowsToValues(DEFAULT_ALIAS_HEADER, mergedAliasRows));

  const aliasLookup = buildAliasLookup(mergedAliasRows);
  const coachById = new Map<string, Record<string, string>>();
  coachRows.forEach((row) => {
    const coachId = row['coach_id'] || '';
    if (coachId) coachById.set(coachId, row);
  });

  const existingFeedbackKeys = new Set(feedbackRows.map((row) => feedbackKey(row['response_id'] || '')));
  const existingOpsKeys = new Set(opsRows.map((row) => row['feedback_id'] || ''));
  let nextFeedbackNumber = Math.max(0, ...feedbackRows.map((row) => parseFeedbackNumber(row['feedback_id'] || '')));

  const additionsFeedback: Array<Record<string, string>> = [];
  const additionsOps: Array<Record<string, string>> = [];
  const keptExceptions: Array<Record<string, string>> = [];
  let exceptionRowsRemoved = 0;
  let feedbackRowsMutated = false;
  let opsRowsMutated = false;

  excRows.forEach((exc) => {
    if ((exc['issue'] || '') !== 'customer_unmatched') {
      keptExceptions.push(exc);
      return;
    }

    const aliasRow = aliasLookup.get(normalizeName(exc['respondent_name'] || ''));
    if (!aliasRow) {
      keptExceptions.push(exc);
      return;
    }

    const canonicalCustomerId = aliasRow['canonical_customer_id'] || '';
    const canonicalCustomerName = aliasRow['canonical_customer_name'] || customerById.get(canonicalCustomerId)?.['customer_name'] || '';
    if (!canonicalCustomerId) {
      keptExceptions.push(exc);
      return;
    }

    const fKey = feedbackKey(exc['response_id'] || '');
    if (!fKey) {
      keptExceptions.push(exc);
      return;
    }

    let feedbackRow = feedbackRows.find((row) => feedbackKey(row['response_id'] || '') === fKey)
      || additionsFeedback.find((row) => feedbackKey(row['response_id'] || '') === fKey)
      || null;

    if (!existingFeedbackKeys.has(fKey)) {
      nextFeedbackNumber += 1;
      feedbackRow = buildFeedbackRow(exc, `FDBK-${String(nextFeedbackNumber).padStart(4, '0')}`, canonicalCustomerId, canonicalCustomerName, syncedAt);
      additionsFeedback.push(feedbackRow);
      existingFeedbackKeys.add(fKey);
    } else if (feedbackRow) {
      Object.assign(
        feedbackRow,
        buildFeedbackRow(exc, feedbackRow['feedback_id'] || '', canonicalCustomerId, canonicalCustomerName, syncedAt, feedbackRow['created_at'] || ''),
      );
      feedbackRowsMutated = true;
    }

    if (feedbackRow) {
      const coachName = coachById.get(feedbackRow['coach_id'] || '')?.['coach_name'] || '';
      const opsId = feedbackRow['feedback_id'] || '';
      const existingOpsRow = opsRows.find((row) => (row['feedback_id'] || '') === opsId)
        || additionsOps.find((row) => (row['feedback_id'] || '') === opsId)
        || null;

      if (!existingOpsKeys.has(opsId)) {
        additionsOps.push(buildOpsFeedbackRow(feedbackRow, exc, coachName, syncedAt));
        existingOpsKeys.add(opsId);
      } else if (existingOpsRow) {
        Object.assign(existingOpsRow, buildOpsFeedbackRow(feedbackRow, exc, coachName, syncedAt, existingOpsRow['created_at'] || ''));
        opsRowsMutated = true;
      }
    }

    exceptionRowsRemoved += 1;
  });

  if (additionsFeedback.length || feedbackRowsMutated) {
    clearAndRewrite(db, SHEETS.FEEDBACK, rowsToValues(FEEDBACK_HEADER, [...feedbackRows, ...additionsFeedback]));
  }

  if (additionsOps.length || opsRowsMutated) {
    clearAndRewrite(db, 'Ops_Feedback_Review', rowsToValues(OPS_FEEDBACK_REVIEW_HEADER, [...opsRows, ...additionsOps]));
  }

  if (exceptionRowsRemoved > 0) {
    const excHeader = Object.keys(excRows[0] || keptExceptions[0] || { issue: '', respondent_name: '', respondent_email: '' });
    clearAndRewrite(db, SHEETS.EXCEPTIONS_FEEDBACK_MATCH, rowsToValues(excHeader, keptExceptions));
  }

  const collectedAt = Utilities.formatDate(new Date(), 'Asia/Tokyo', "yyyy-MM-dd'T'HH:mm:ssXXX");
  const updatedInputRows = inputRows.map((row, index) => {
    const decision = (row['operator_decision_status'] || '').trim();
    const syncStatus = (row['sync_status'] || '').trim().toLowerCase();
    if (!decision || syncStatus === 'processed') return row;
    if (processedInputIndexes.has(index)) {
      return {
        ...row,
        sync_status: 'processed',
        last_collected_at: collectedAt,
      };
    }
    const invalidReason = invalidInputReasons.get(index);
    if (!invalidReason) return row;
    return {
      ...row,
      sync_status: invalidReason,
      last_collected_at: collectedAt,
    };
  });
  clearAndRewrite(cs, VIEWS.CS_ALIAS_RESOLUTION_INPUT, rowsToValues(CS_ALIAS_INPUT_HEADER, updatedInputRows));

  const updatedPartnerInputRows = assignmentInputRows.map((row, index) => {
    const decision = (row['operator_decision_status'] || '').trim();
    const syncStatus = (row['sync_status'] || '').trim().toLowerCase();
    if (!decision || syncStatus === 'processed') return row;
    if (processedPartnerInputIndexes.has(index)) {
      return {
        ...row,
        sync_status: 'processed',
        last_collected_at: collectedAt,
      };
    }
    const invalidReason = invalidPartnerInputReasons.get(index);
    if (!invalidReason) return row;
    return {
      ...row,
      sync_status: invalidReason,
      last_collected_at: collectedAt,
    };
  });
  clearAndRewrite(cs, VIEWS.CS_ASSIGNMENT_INPUT, rowsToValues(CS_ASSIGNMENT_HEADER, updatedPartnerInputRows));

  const updatedPaymentInputRows = paymentInputRows.map((row, index) => {
    const decision = (row['operator_decision_status'] || '').trim();
    const syncStatus = (row['sync_status'] || '').trim().toLowerCase();
    if (!decision || syncStatus === 'processed') return row;
    if (processedPaymentInputIndexes.has(index)) {
      return {
        ...row,
        sync_status: 'processed',
        last_collected_at: collectedAt,
      };
    }
    const invalidReason = invalidPaymentInputReasons.get(index);
    if (!invalidReason) return row;
    return {
      ...row,
      sync_status: invalidReason,
      last_collected_at: collectedAt,
    };
  });
  clearAndRewrite(cs, VIEWS.CS_PAYMENT_ALIAS_REVIEW, rowsToValues(CS_PAYMENT_ALIAS_REVIEW_HEADER, updatedPaymentInputRows));

  const updatedContinuationInputRows = continuationInputRows.map((row, index) => {
    const decision = (row['operator_decision_status'] || '').trim();
    const syncStatus = (row['sync_status'] || '').trim().toLowerCase();
    if (!decision || syncStatus === 'processed') return row;
    if (processedContinuationInputIndexes.has(index)) {
      return {
        ...row,
        sync_status: 'processed',
        last_collected_at: collectedAt,
      };
    }
    const invalidReason = invalidContinuationInputReasons.get(index);
    if (!invalidReason) return row;
    return {
      ...row,
      sync_status: invalidReason,
      last_collected_at: collectedAt,
    };
  });
  clearAndRewrite(cs, VIEWS.CS_CONTINUATION_ALIAS_REVIEW, rowsToValues(CS_CONTINUATION_ALIAS_REVIEW_HEADER as unknown as string[], updatedContinuationInputRows));

  return {
    pendingAliasRows: actionableRows.length,
    processedAliasRows: processedInputIndexes.size,
    invalidAliasRows: invalidInputReasons.size,
    pendingPaymentAliasRows: actionablePaymentRows.length,
    processedPaymentAliasRows: processedPaymentInputIndexes.size,
    invalidPaymentAliasRows: invalidPaymentInputReasons.size,
    pendingContinuationAliasRows: actionableContinuationRows.length,
    processedContinuationAliasRows: processedContinuationInputIndexes.size,
    invalidContinuationAliasRows: invalidContinuationInputReasons.size,
    pendingPartnerAssignmentRows: actionablePartnerRows.length,
    processedPartnerAssignmentRows: processedPartnerInputIndexes.size,
    invalidPartnerAssignmentRows: invalidPartnerInputReasons.size,
    feedbackRowsAdded: additionsFeedback.length,
    opsFeedbackRowsAdded: additionsOps.length,
    exceptionRowsRemoved,
  };
}
