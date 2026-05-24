import { SHEETS, VIEWS } from '../constants';
import { tokenizeAttributionTags } from '../canonical/line';
import { buildContinuationExceptionId } from '../canonical/commercial';
import { CS_ASSIGNMENT_INPUT_HEADER, CS_CONTINUATION_ALIAS_REVIEW_HEADER } from '../contracts/cs';
import { PARTNER_STATUS_INPUT_HEADER } from '../contracts/partner';

export function resolveContinuationCeId(row: Record<string, string>): string {
  const explicit = row['continuation_exception_id'];
  if (explicit) return explicit;
  return buildContinuationExceptionId(
    row['raw_name'] || '',
    row['raw_plan'] || '',
    row['raw_contract_date'] || '',
    row['raw_amount'] || '',
  );
}

function normalizeName(value: string): string {
  return (value || '').replace(/\s|　/g, '').trim().toLowerCase();
}

function parseViewDateValue(value: string): Date | null {
  const text = String(value || '').trim();
  if (!text) return null;

  const normalized = text.replace(/[.]/g, '-').replace(/\//g, '-');
  const localMatch = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (localMatch) {
    const year = Number(localMatch[1]);
    const month = Number(localMatch[2]);
    const day = Number(localMatch[3]);
    const hour = Number(localMatch[4] || '0');
    const minute = Number(localMatch[5] || '0');
    const second = Number(localMatch[6] || '0');
    const parsed = new Date(year, month - 1, day, hour, minute, second);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function formatViewDate(value: string): string {
  const parsed = parseViewDateValue(value);
  if (!parsed) return String(value || '').trim();
  return `${parsed.getFullYear()}-${pad2(parsed.getMonth() + 1)}-${pad2(parsed.getDate())}`;
}

function formatViewDateTime(value: string): string {
  const parsed = parseViewDateValue(value);
  if (!parsed) return String(value || '').trim();
  return `${parsed.getFullYear()}-${pad2(parsed.getMonth() + 1)}-${pad2(parsed.getDate())} ${pad2(parsed.getHours())}:${pad2(parsed.getMinutes())}:${pad2(parsed.getSeconds())}`;
}

function compareDateValuesDesc(a: string, b: string): number {
  const aParsed = parseViewDateValue(a);
  const bParsed = parseViewDateValue(b);
  if (aParsed && bParsed) return bParsed.getTime() - aParsed.getTime();
  if (aParsed) return -1;
  if (bParsed) return 1;
  return String(b || '').localeCompare(String(a || ''));
}

function localizeSuggestedAction(action: string): string {
  const labels: Record<string, string> = {
    approve_if_context_matches: '候補に違和感がなければ承認',
    search_customer_or_wait_for_customer_ingest: '顧客検索または次回取込待ち',
    hold_no_candidate_found: '保留（候補なし）',
  };
  return labels[action] || action;
}

function localizeSuggestionBasis(value: string): string {
  return String(value || '')
    .split(/\s*;\s*/)
    .filter(Boolean)
    .map((token) => {
      const labels: Record<string, string> = {
        line_row_already_matched: 'LINE行は既存顧客に紐づき済み',
        real_name_match: '実名一致',
        line_registration_name_match: 'LINE登録名一致',
        display_name_match: '表示名一致',
        line_name_match: '入金表LINE名一致',
        raw_name_to_line_registration_name_match: '元名とLINE登録名が一致',
      };
      if (labels[token]) return labels[token];
      if (token.startsWith('segment=')) return `セグメント=${token.slice('segment='.length)}`;
      if (token.startsWith('score=')) return `スコア=${token.slice('score='.length)}`;
      return token;
    })
    .join(' / ');
}

function localizeCurrentStatus(value: string): string {
  const labels: Record<string, string> = {
    active: '受講中',
    completed: '受講完了',
    review: '要確認',
    approved: '承認済み',
    resolved: '対応完了',
    pending: '保留中',
  };
  return labels[String(value || '').trim().toLowerCase()] || value;
}

function localizePaymentStatus(value: string): string {
  const labels: Record<string, string> = {
    paid: '入金済み',
    pending: '未入金',
  };
  return labels[String(value || '').trim().toLowerCase()] || value;
}

function localizeFollowupReason(value: string): string {
  const labels: Record<string, string> = {
    low_nps: 'NPS低',
    low_satisfaction: '満足度低',
    low_progress: '進捗不安',
    low_expectation: '期待値ギャップ',
    low_community: 'コミュニティ評価低',
    gap_comment_present: 'ギャップコメントあり',
  };
  return String(value || '')
    .split(/\s*,\s*/)
    .filter(Boolean)
    .map((token) => labels[String(token || '').trim().toLowerCase()] || token)
    .join(' / ');
}

function localizeBooleanFlag(value: string): string {
  const lowered = String(value || '').trim().toLowerCase();
  if (lowered === 'true') return 'あり';
  if (lowered === 'false') return 'なし';
  return value;
}

function localizeAssigneeType(value: string): string {
  const labels: Record<string, string> = {
    partner: 'パートナー',
    coach: 'コーチ',
  };
  return labels[String(value || '').trim().toLowerCase()] || value;
}

function localizeEventType(value: string): string {
  const labels: Record<string, string> = {
    line_registered: 'LINE登録',
    lead_created: '顧客化',
    experience_scheduled: '体験面談予定',
    contracted: '成約',
    paid: '入金',
    completed: '受講完了',
    lost: '失注',
  };
  return labels[String(value || '').trim().toLowerCase()] || value;
}

function localizeQueueStatus(value: string): string {
  const labels: Record<string, string> = {
    open: '対応待ち',
    closed: 'クローズ',
    resolved: '対応完了',
    active: '進行中',
  };
  return labels[String(value || '').trim().toLowerCase()] || value;
}

function localizeIngestMode(value: string): string {
  const labels: Record<string, string> = {
    raw_source_configured: '原本ソース設定済み',
    raw_source_configured_and_named_rows_aligned: '原本ソース設定済み・氏名行整列済み',
    fallback: 'フォールバック取込',
  };
  return labels[String(value || '').trim().toLowerCase()] || value;
}

function aliasInputKey(responseId: string, aliasName: string): string {
  return [String(responseId || ''), normalizeName(aliasName || '')].join('||');
}

function normalizeEmail(value: string): string {
  return String(value || '').trim().toLowerCase();
}

function partnerAssignmentInputKey(leadId: string, formResponseSheet: string, formResponseRow: string): string {
  return [String(leadId || ''), String(formResponseSheet || ''), String(formResponseRow || '')].join('||');
}

function paymentReviewKey(sourceSheet: string, sourceRow: string): string {
  return [sourceSheet || '', String(sourceRow || '')].join('||');
}

// Sheets auto-converts string TRUE/FALSE to boolean on roundtrip; compare case-insensitively.
function isPaid(row: Record<string, string>): boolean {
  return String(row['paid_flag'] || '').toUpperCase() === 'TRUE';
}

function buildCustomerById(customerRows: Array<Record<string, string>>): Map<string, Record<string, string>> {
  const customerById = new Map<string, Record<string, string>>();
  customerRows.forEach((row) => {
    const customerId = row['customer_id'] || '';
    if (customerId && !customerById.has(customerId)) customerById.set(customerId, row);
  });
  return customerById;
}

function buildCoachById(coachRows: Array<Record<string, string>>): Map<string, Record<string, string>> {
  const coachById = new Map<string, Record<string, string>>();
  coachRows.forEach((row) => {
    const coachId = row['coach_id'] || '';
    if (coachId && !coachById.has(coachId)) coachById.set(coachId, row);
  });
  return coachById;
}

function buildCurrentCoachAssignmentByCustomerId(assignmentRows: Array<Record<string, string>>): Map<string, Record<string, string>> {
  const assignmentByCustomerId = new Map<string, Record<string, string>>();
  assignmentRows
    .slice()
    .filter((row) => (row['customer_id'] || '') && (row['coach_id'] || ''))
    .sort((a, b) => {
      const aActive = !(a['ended_at'] || '') && (a['assignment_status'] || '') !== 'ended';
      const bActive = !(b['ended_at'] || '') && (b['assignment_status'] || '') !== 'ended';
      if (aActive !== bActive) return aActive ? -1 : 1;
      const aDate = a['assigned_at'] || a['updated_at'] || a['created_at'] || '';
      const bDate = b['assigned_at'] || b['updated_at'] || b['created_at'] || '';
      return compareDateValuesDesc(aDate, bDate);
    })
    .forEach((row) => {
      const customerId = row['customer_id'] || '';
      if (customerId && !assignmentByCustomerId.has(customerId)) assignmentByCustomerId.set(customerId, row);
    });
  return assignmentByCustomerId;
}

function resolveAssignedCoachName(
  customerId: string,
  snapshotCoachName: string,
  assignmentByCustomerId: Map<string, Record<string, string>>,
  coachById: Map<string, Record<string, string>>,
): string {
  const assignment = assignmentByCustomerId.get(customerId || '') || {};
  const coachName = coachById.get(assignment['coach_id'] || '')?.['coach_name'] || '';
  // Treat the customer/ops row coach field as a snapshot fallback only;
  // normalized assignment relations are the primary display source.
  return coachName || snapshotCoachName || '';
}

function buildCurrentPlanByCustomerId(plansRows: Array<Record<string, string>>): Map<string, Record<string, string>> {
  const planByCustomerId = new Map<string, Record<string, string>>();
  plansRows
    .slice()
    .filter((row) => (row['customer_id'] || ''))
    .sort((a, b) => {
      const aActive = !['completed', 'lost', 'cancelled', 'ended'].includes((a['status'] || '').toLowerCase());
      const bActive = !['completed', 'lost', 'cancelled', 'ended'].includes((b['status'] || '').toLowerCase());
      if (aActive != bActive) return aActive ? -1 : 1;
      const aDate = a['contract_date'] || a['start_date'] || a['created_at'] || '';
      const bDate = b['contract_date'] || b['start_date'] || b['created_at'] || '';
      return compareDateValuesDesc(aDate, bDate);
    })
    .forEach((row) => {
      const customerId = row['customer_id'] || '';
      if (customerId && !planByCustomerId.has(customerId)) planByCustomerId.set(customerId, row);
    });
  return planByCustomerId;
}

function resolveCurrentPlanName(
  customerId: string,
  snapshotCourseName: string,
  planByCustomerId: Map<string, Record<string, string>>,
): string {
  const currentPlan = planByCustomerId.get(customerId || '') || {};
  return currentPlan['plan_name'] || snapshotCourseName || '';
}

function findPaymentAliasRow(
  aliasByName: Map<string, Record<string, string>>,
  paymentCustomerName: string,
): Record<string, string> {
  return aliasByName.get(normalizeName(paymentCustomerName || '')) || {};
}

function scoreLineCandidate(
  paymentCustomerName: string,
  paymentLineName: string,
  paymentSegment: string,
  candidate: Record<string, string>,
): number {
  const paymentCustomer = normalizeName(paymentCustomerName || '');
  const paymentLine = normalizeName(paymentLineName || '');
  const displayName = normalizeName(candidate['display_name'] || '');
  const lineRegistrationName = normalizeName(candidate['line_registration_name'] || '');
  const realName = normalizeName(candidate['real_name'] || '');
  const paymentSegmentNormalized = normalizeName(paymentSegment || '');
  const candidateSegmentNormalized = normalizeName(candidate['segment'] || '');

  let score = 0;
  if (candidate['customer_id']) score += 100;
  if (paymentCustomer && paymentCustomer === realName) score += 30;
  if (paymentCustomer && paymentCustomer === lineRegistrationName) score += 24;
  if (paymentCustomer && paymentCustomer === displayName) score += 18;
  if (paymentLine && paymentLine === lineRegistrationName) score += 16;
  if (paymentLine && paymentLine === displayName) score += 12;
  if (paymentSegmentNormalized && paymentSegmentNormalized === candidateSegmentNormalized) score += 6;
  return score;
}

export function buildCsFollowupQueue(feedbackRows: Array<Record<string, string>>): Array<Array<string>> {
  const header = [
    'priority', 'low_satisfaction_flag', 'feedback_date', 'customer_name', 'coach_name',
    'followup_reason', 'comment', 'gap_comment', 'customer_id', 'feedback_id',
  ];
  const rows = feedbackRows.map((r) => [
    r['priority'] || (r['low_satisfaction_flag'] === 'TRUE' ? 'P1' : 'P2'),
    localizeBooleanFlag(r['low_satisfaction_flag'] || ''),
    formatViewDateTime(r['feedback_date'] || ''),
    r['customer_name'] || '',
    r['feedback_coach_name'] || r['assigned_coach_name'] || r['coach_name'] || '',
    localizeFollowupReason(r['followup_reason'] || ''),
    r['comment'] || '',
    r['gap_comment'] || '',
    r['customer_id'] || '',
    r['feedback_id'] || '',
  ]);
  return [header, ...rows];
}

export function buildCsContinuationTargets(
  continuationRows: Array<Record<string, string>>,
  assignmentRows: Array<Record<string, string>>,
  coachRows: Array<Record<string, string>>,
  plansRows: Array<Record<string, string>>,
): Array<Array<string>> {
  const header = [
    'priority', 'customer_name', 'current_status', 'continuation_tag', 'after_follow_progress',
    'after_follow_offer_date', 'after_follow_event_date', 'assigned_coach_name', 'course_name', 'note', 'customer_id',
  ];
  const assignmentByCustomerId = buildCurrentCoachAssignmentByCustomerId(assignmentRows);
  const coachById = buildCoachById(coachRows);
  const planByCustomerId = buildCurrentPlanByCustomerId(plansRows);
  const rows = continuationRows.map((r) => [
    r['priority'] || '',
    r['customer_name'] || '',
    localizeCurrentStatus(r['current_status'] || ''),
    r['continuation_tag'] || '',
    r['after_follow_progress'] || '',
    formatViewDate(r['after_follow_offer_date'] || ''),
    formatViewDate(r['after_follow_event_date'] || ''),
    resolveAssignedCoachName(r['customer_id'] || '', r['assigned_coach_name'] || '', assignmentByCustomerId, coachById),
    resolveCurrentPlanName(r['customer_id'] || '', r['course_name'] || '', planByCustomerId),
    r['note'] || '',
    r['customer_id'] || '',
  ]);
  return [header, ...rows];
}


type SyncLogJobSummary = {
  jobName: string;
  latestSuccessAtMs: number;
  latestSuccessAtJst: string;
  latestSuccessStats: Record<string, string>;
};

type ExecutivePipelineSummary = {
  publish: SyncLogJobSummary;
  fullRefresh: SyncLogJobSummary;
  writeback: SyncLogJobSummary;
};

type ExecDomainAssessment = {
  domain: string;
  status: string;
  lastEffectiveUpdateAtJst: string;
  expectedCadence: string;
  staleThreshold: string;
  staleBy: string;
  likelyIssueType: string;
  likelyDecisionRisk: string;
  recommendedCheck: string;
  isStale: boolean;
  isHighRisk: boolean;
  likelyHumanUpdateOmission: boolean;
};

type ExecutiveFreshnessSnapshot = {
  pipelines: ExecutivePipelineSummary;
  domains: ExecDomainAssessment[];
  staleDomainCount: number;
  staleHighRiskDomainCount: number;
  likelyHumanUpdateOmissionCount: number;
  likelyHumanUpdateOmissionDomains: string[];
  meetingRiskStatus: 'GO' | 'GO_WITH_CAUTION' | 'CHECK_BEFORE_MEETING';
  criticalTeamIssueCount: number;
};

type ExecDomainConfig = {
  domain: string;
  anchorTimestamp: string;
  expectedCadenceHours: number;
  staleThresholdHours: number;
  pipeline: SyncLogJobSummary;
  pipelineStaleThresholdHours: number;
  likelyDecisionRisk: string;
  recommendedCheck: string;
  warningSignalCount?: number;
  highRiskSignalCount?: number;
  extraWarningText?: string;
};

const EXEC_STATUS_HEALTHY = '更新良好';
const EXEC_STATUS_WARNING = '要確認（更新遅れの可能性）';
const EXEC_STATUS_HIGH_RISK = '高リスク（会議前に確認推奨）';
const EXEC_ISSUE_OK = '更新良好';
const EXEC_ISSUE_PIPELINE = '自動更新自体が未実行の可能性';
const EXEC_ISSUE_HUMAN_OMISSION = '自動更新は成功 / 元データ更新漏れの可能性';
const EXEC_ISSUE_SOURCE_STALE = '上流データ停滞の可能性';
const EXEC_PIPELINE_PUBLISH_STALE_HOURS = 6;
const EXEC_PIPELINE_WRITEBACK_STALE_HOURS = 36;
const EXEC_PIPELINE_FULL_REFRESH_STALE_HOURS = 36;

function emptySyncLogJobSummary(jobName: string): SyncLogJobSummary {
  return {
    jobName,
    latestSuccessAtMs: 0,
    latestSuccessAtJst: '',
    latestSuccessStats: {},
  };
}

function summarizeExecutivePipelines(syncLogRows: Array<Record<string, string>>): ExecutivePipelineSummary {
  const summaries: Record<string, SyncLogJobSummary> = {
    runPublishAll: emptySyncLogJobSummary('runPublishAll'),
    runFullRefresh: emptySyncLogJobSummary('runFullRefresh'),
    runWritebackCollection: emptySyncLogJobSummary('runWritebackCollection'),
  };

  syncLogRows.forEach((row) => {
    const jobName = row['job_name'] || '';
    if (!(jobName in summaries)) return;
    if (normalizeLower(row['status'] || '') !== 'success') return;
    const parsedDate = parseViewDateValue(row['timestamp'] || '');
    if (!parsedDate) return;
    const timestampMs = parsedDate.getTime();
    if (timestampMs <= summaries[jobName].latestSuccessAtMs) return;
    summaries[jobName] = {
      jobName,
      latestSuccessAtMs: timestampMs,
      latestSuccessAtJst: formatTrendTimestampJst(parsedDate),
      latestSuccessStats: parseSyncLogStats(row['stats'] || ''),
    };
  });

  return {
    publish: summaries.runPublishAll,
    fullRefresh: summaries.runFullRefresh,
    writeback: summaries.runWritebackCollection,
  };
}

function formatHoursLabel(hours: number): string {
  if (!Number.isFinite(hours) || hours <= 0) return '0h';
  if (hours % 24 === 0) return `${hours / 24}日`;
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return remainingHours > 0 ? `${days}日${remainingHours}h` : `${days}日`;
  }
  return `${hours}h`;
}

function hoursSinceTimestamp(timestamp: string, now: Date): number {
  const parsed = parseViewDateValue(timestamp);
  if (!parsed) return Number.POSITIVE_INFINITY;
  return (now.getTime() - parsed.getTime()) / (1000 * 60 * 60);
}

function formatTimestampJst(timestamp: string): string {
  const parsed = parseViewDateValue(timestamp);
  return parsed ? formatTrendTimestampJst(parsed) : '';
}

function selectLatestTimestamp(current: string, candidate: string): string {
  if (!candidate) return current;
  if (!current) return candidate;
  const currentParsed = parseViewDateValue(current);
  const candidateParsed = parseViewDateValue(candidate);
  if (currentParsed && candidateParsed) {
    return candidateParsed.getTime() > currentParsed.getTime() ? candidate : current;
  }
  if (candidateParsed) return candidate;
  return current;
}

function latestTimestampFromRows(rows: Array<Record<string, string>>, fields: string[]): string {
  let latest = '';
  rows.forEach((row) => {
    fields.forEach((field) => {
      latest = selectLatestTimestamp(latest, row[field] || '');
    });
  });
  return latest;
}

function buildExecDomainAssessment(config: ExecDomainConfig, now: Date): ExecDomainAssessment {
  const warningSignalCount = config.warningSignalCount || 0;
  const highRiskSignalCount = config.highRiskSignalCount || 0;
  const noActivitySignals = !config.anchorTimestamp && warningSignalCount === 0 && highRiskSignalCount === 0;
  const sourceAgeHours = hoursSinceTimestamp(config.anchorTimestamp, now);
  const pipelineAgeHours = config.pipeline.latestSuccessAtMs > 0
    ? (now.getTime() - config.pipeline.latestSuccessAtMs) / (1000 * 60 * 60)
    : Number.POSITIVE_INFINITY;
  const isSourceStale = noActivitySignals ? false : (!Number.isFinite(sourceAgeHours) || sourceAgeHours > config.staleThresholdHours);
  const isPipelineStale = !Number.isFinite(pipelineAgeHours) || pipelineAgeHours > config.pipelineStaleThresholdHours;
  const likelyHumanUpdateOmission = !isPipelineStale && isSourceStale;
  const isHighRisk = isPipelineStale || (isSourceStale && highRiskSignalCount > 0);
  const status = isHighRisk
    ? EXEC_STATUS_HIGH_RISK
    : (isSourceStale || warningSignalCount > 0 ? EXEC_STATUS_WARNING : EXEC_STATUS_HEALTHY);
  const likelyIssueType = isPipelineStale
    ? EXEC_ISSUE_PIPELINE
    : (likelyHumanUpdateOmission ? EXEC_ISSUE_HUMAN_OMISSION : (isSourceStale ? EXEC_ISSUE_SOURCE_STALE : EXEC_ISSUE_OK));
  const staleByHours = isSourceStale && Number.isFinite(sourceAgeHours)
    ? Math.max(0, Math.round(sourceAgeHours - config.staleThresholdHours))
    : 0;
  const staleBy = noActivitySignals
    ? '対象データなし'
    : (!config.anchorTimestamp
      ? '更新時刻未取得'
      : (isSourceStale ? `${formatHoursLabel(staleByHours)}超過` : '閾値内'));
  const riskSuffixParts: string[] = [];
  if (warningSignalCount > 0) riskSuffixParts.push(`要確認件数 ${warningSignalCount}件`);
  if (config.extraWarningText) riskSuffixParts.push(config.extraWarningText);
  return {
    domain: config.domain,
    status,
    lastEffectiveUpdateAtJst: formatTimestampJst(config.anchorTimestamp),
    expectedCadence: formatHoursLabel(config.expectedCadenceHours),
    staleThreshold: formatHoursLabel(config.staleThresholdHours),
    staleBy,
    likelyIssueType,
    likelyDecisionRisk: riskSuffixParts.length > 0
      ? `${config.likelyDecisionRisk}（${riskSuffixParts.join(' / ')}）`
      : config.likelyDecisionRisk,
    recommendedCheck: config.recommendedCheck,
    isStale: isSourceStale,
    isHighRisk,
    likelyHumanUpdateOmission,
  };
}

function buildExecutiveFreshnessSnapshot(
  followupRows: Array<Record<string, string>>,
  continuationRows: Array<Record<string, string>>,
  exceptionRows: Array<Record<string, string>>,
  plansRows: Array<Record<string, string>>,
  paymentsRows: Array<Record<string, string>>,
  conversionRows: Array<Record<string, string>>,
  stagingPaymentsRows: Array<Record<string, string>>,
  lineRegistrationRows: Array<Record<string, string>>,
  continuationExceptionRows: Array<Record<string, string>>,
  assignmentRows: Array<Record<string, string>>,
  syncLogRows: Array<Record<string, string>>,
): ExecutiveFreshnessSnapshot {
  const pipelines = summarizeExecutivePipelines(syncLogRows);
  const now = new Date();
  const activePartnerAssignments = assignmentRows.filter((row) => (row['assignee_kind'] || '').toLowerCase() === 'partner' && !(row['ended_at'] || '') && (row['assignment_status'] || '').toLowerCase() !== 'ended');
  const activeCoachAssignments = assignmentRows.filter((row) => (row['assignee_kind'] || '').toLowerCase() !== 'partner' && !(row['ended_at'] || '') && (row['assignment_status'] || '').toLowerCase() !== 'ended');
  const lowSatisfactionCount = followupRows.filter((row) => normalizeLower(row['low_satisfaction_flag'] || '') === 'true').length;
  const criticalTeamIssueCount = followupRows.length + exceptionRows.length + continuationExceptionRows.length;
  const partnerWaitingFirstUpdateCount = activePartnerAssignments.filter((row) => !(row['last_partner_update_at'] || '')).length;
  const partnerStaleCount = activePartnerAssignments.filter((row) => {
    const anchor = row['last_partner_update_at'] || row['assigned_at'] || row['updated_at'] || row['created_at'] || '';
    return daysSince(anchor, now) >= 30;
  }).length;
  const unresolvedPaymentRows = stagingPaymentsRows.filter((row) => !(row['customer_id'] || ''));
  const unresolvedPaymentCount = stagingPaymentsRows.filter((row) => !(row['customer_id'] || '')).length;
  const paymentPendingCount = stagingPaymentsRows.filter((row) => !isPaid(row)).length;
  const unresolvedLineCount = lineRegistrationRows.filter((row) => !(row['customer_id'] || '')).length;
  const openContinuationCount = continuationRows.length + continuationExceptionRows.length;
  const aliasReviewOpenCount = exceptionRows.length + unresolvedPaymentCount;
  const csAliasReviewAnchor = selectLatestTimestamp(
    latestTimestampFromRows(exceptionRows, ['updated_at', 'submitted_at', 'last_collected_at', 'created_at']),
    latestTimestampFromRows(unresolvedPaymentRows, ['updated_at', 'last_collected_at', 'created_at', 'paid_date', 'contract_date']),
  );
  const csContinuationReviewAnchor = latestTimestampFromRows(
    [...continuationRows, ...continuationExceptionRows],
    ['updated_at', 'last_collected_at', 'created_at'],
  );

  const domains = [
    buildExecDomainAssessment({
      domain: 'publish_pipeline',
      anchorTimestamp: pipelines.publish.latestSuccessAtJst,
      expectedCadenceHours: 1,
      staleThresholdHours: EXEC_PIPELINE_PUBLISH_STALE_HOURS,
      pipeline: pipelines.publish,
      pipelineStaleThresholdHours: EXEC_PIPELINE_PUBLISH_STALE_HOURS,
      likelyDecisionRisk: '各タブは更新済みに見えても全体publish自体が古く、会議資料全体が過去状態のままの可能性',
      recommendedCheck: 'POTEX DB > Sync_Log で runPublishAll の最新成功を確認',
    }, now),
    buildExecDomainAssessment({
      domain: 'commercial_payments',
      anchorTimestamp: latestTimestampFromRows([...paymentsRows, ...stagingPaymentsRows], ['updated_at', 'paid_date', 'contract_date', 'created_at']),
      expectedCadenceHours: 24,
      staleThresholdHours: 36,
      pipeline: pipelines.writeback,
      pipelineStaleThresholdHours: EXEC_PIPELINE_WRITEBACK_STALE_HOURS,
      likelyDecisionRisk: '入金実績・売上進捗が実態より少なく見える可能性',
      recommendedCheck: '営業_未入金一覧 / CS_入金名寄せ確認 / 元の着金管理マスター更新状況を確認',
      warningSignalCount: unresolvedPaymentCount,
      highRiskSignalCount: unresolvedPaymentCount + paymentPendingCount,
      extraWarningText: `未紐づけ ${unresolvedPaymentCount}件 / 未入金 ${paymentPendingCount}件`,
    }, now),
    buildExecDomainAssessment({
      domain: 'sales_funnel',
      anchorTimestamp: latestTimestampFromRows(conversionRows, ['updated_at', 'event_date', 'created_at']),
      expectedCadenceHours: 24,
      staleThresholdHours: 36,
      pipeline: pipelines.fullRefresh,
      pipelineStaleThresholdHours: EXEC_PIPELINE_FULL_REFRESH_STALE_HOURS,
      likelyDecisionRisk: '商談・成約・失注の進捗が昨日以前の状態で止まり、営業判断を誤る可能性',
      recommendedCheck: '営業_ファネル推移 / ConversionHistory / 元営業シートの更新漏れを確認',
      warningSignalCount: conversionRows.length > 0 ? 1 : 0,
    }, now),
    buildExecDomainAssessment({
      domain: 'cs_alias_review',
      anchorTimestamp: csAliasReviewAnchor,
      expectedCadenceHours: 24,
      staleThresholdHours: 36,
      pipeline: pipelines.writeback,
      pipelineStaleThresholdHours: EXEC_PIPELINE_WRITEBACK_STALE_HOURS,
      likelyDecisionRisk: '未解決の名寄せ・紐づけ確認件数が見えている数より多い可能性',
      recommendedCheck: 'CS_例外確認 / CS_入金名寄せ確認 / runWritebackCollection の最新成功を確認',
      warningSignalCount: aliasReviewOpenCount,
      highRiskSignalCount: exceptionRows.length,
      extraWarningText: `例外 ${exceptionRows.length}件 / 入金未紐づけ ${unresolvedPaymentCount}件`,
    }, now),
    buildExecDomainAssessment({
      domain: 'cs_continuation_review',
      anchorTimestamp: csContinuationReviewAnchor,
      expectedCadenceHours: 24,
      staleThresholdHours: 36,
      pipeline: pipelines.writeback,
      pipelineStaleThresholdHours: EXEC_PIPELINE_WRITEBACK_STALE_HOURS,
      likelyDecisionRisk: '継続検討・継続名寄せの未処理件数が古く、継続率議論が実態より軽く見える可能性',
      recommendedCheck: 'CS_継続対象一覧 / CS_継続名寄せ確認 / 元の継続プラン管理更新を確認',
      warningSignalCount: openContinuationCount,
      highRiskSignalCount: continuationExceptionRows.length,
      extraWarningText: `継続対象 ${continuationRows.length}件 / 継続未紐づけ ${continuationExceptionRows.length}件`,
    }, now),
    buildExecDomainAssessment({
      domain: 'feedback_followup',
      anchorTimestamp: latestTimestampFromRows([...followupRows, ...plansRows], ['updated_at', 'feedback_date', 'last_collected_at', 'created_at']),
      expectedCadenceHours: 24,
      staleThresholdHours: 36,
      pipeline: pipelines.fullRefresh,
      pipelineStaleThresholdHours: EXEC_PIPELINE_FULL_REFRESH_STALE_HOURS,
      likelyDecisionRisk: '顧客リスク・クレーム候補・要フォロー案件が実態より少なく見える可能性',
      recommendedCheck: 'CS_要フォロー一覧 / 顧客満足度系の元シート / 各担当者の更新漏れを確認',
      warningSignalCount: followupRows.length,
      highRiskSignalCount: lowSatisfactionCount,
      extraWarningText: `要フォロー ${followupRows.length}件 / 低満足 ${lowSatisfactionCount}件`,
    }, now),
    buildExecDomainAssessment({
      domain: 'coach_assignment',
      anchorTimestamp: latestTimestampFromRows(activeCoachAssignments, ['updated_at', 'assigned_at', 'created_at']),
      expectedCadenceHours: 24,
      staleThresholdHours: 48,
      pipeline: pipelines.writeback,
      pipelineStaleThresholdHours: EXEC_PIPELINE_WRITEBACK_STALE_HOURS,
      likelyDecisionRisk: '担当コーチ・負荷の見え方が古く、現場配分判断を誤る可能性',
      recommendedCheck: 'Customer_Coach_Assignments / CS_担当割当入力 / 最新writeback結果を確認',
      warningSignalCount: activeCoachAssignments.length > 0 ? 1 : 0,
    }, now),
    buildExecDomainAssessment({
      domain: 'partner_status',
      anchorTimestamp: latestTimestampFromRows(activePartnerAssignments, ['last_partner_update_at', 'updated_at', 'assigned_at', 'created_at']),
      expectedCadenceHours: 24,
      staleThresholdHours: 72,
      pipeline: pipelines.writeback,
      pipelineStaleThresholdHours: EXEC_PIPELINE_WRITEBACK_STALE_HOURS,
      likelyDecisionRisk: 'パートナー進捗が停滞して見える、または重要案件の進行が古いまま会議に出る可能性',
      recommendedCheck: 'パートナー_状況入力 / last_partner_update_at / meeting_status 更新漏れを確認',
      warningSignalCount: partnerWaitingFirstUpdateCount + partnerStaleCount,
      highRiskSignalCount: partnerWaitingFirstUpdateCount + partnerStaleCount,
      extraWarningText: `初回更新待ち ${partnerWaitingFirstUpdateCount}件 / 30日停滞 ${partnerStaleCount}件`,
    }, now),
    buildExecDomainAssessment({
      domain: 'line_registration',
      anchorTimestamp: latestTimestampFromRows(lineRegistrationRows, ['updated_at', 'registered_at', 'created_at']),
      expectedCadenceHours: 24,
      staleThresholdHours: 36,
      pipeline: pipelines.fullRefresh,
      pipelineStaleThresholdHours: EXEC_PIPELINE_FULL_REFRESH_STALE_HOURS,
      likelyDecisionRisk: '流入数・チャネル評価が古く、友だち追加や導線評価を誤る可能性',
      recommendedCheck: 'LINE登録CSV取込 / Line_Registrations / attribution_tags 付与状況を確認',
      warningSignalCount: unresolvedLineCount,
      highRiskSignalCount: unresolvedLineCount,
      extraWarningText: `未紐づけ ${unresolvedLineCount}件`,
    }, now),
    buildExecDomainAssessment({
      domain: 'critical_team_issues',
      anchorTimestamp: latestTimestampFromRows([...followupRows, ...exceptionRows, ...continuationExceptionRows], ['updated_at', 'feedback_date', 'submitted_at', 'last_collected_at', 'created_at']),
      expectedCadenceHours: 24,
      staleThresholdHours: 36,
      pipeline: pipelines.fullRefresh,
      pipelineStaleThresholdHours: EXEC_PIPELINE_FULL_REFRESH_STALE_HOURS,
      likelyDecisionRisk: '各チームの重要案件（クレーム含む）が実態より少なく見え、会議アジェンダ優先順位を誤る可能性',
      recommendedCheck: 'CS_要フォロー一覧 / CS_例外確認 / 継続名寄せ確認 / 各担当者の元シート更新状況を確認',
      warningSignalCount: criticalTeamIssueCount,
      highRiskSignalCount: lowSatisfactionCount + continuationExceptionRows.length,
      extraWarningText: `重要案件 ${criticalTeamIssueCount}件`,
    }, now),
  ];

  const staleDomainCount = domains.filter((domain) => domain.isStale).length;
  const staleHighRiskDomainCount = domains.filter((domain) => domain.isHighRisk).length;
  const likelyHumanUpdateOmissionDomains = domains.filter((domain) => domain.likelyHumanUpdateOmission).map((domain) => domain.domain);
  const likelyHumanUpdateOmissionCount = likelyHumanUpdateOmissionDomains.length;
  const meetingRiskStatus: ExecutiveFreshnessSnapshot['meetingRiskStatus'] = staleHighRiskDomainCount > 0
    ? 'CHECK_BEFORE_MEETING'
    : (staleDomainCount > 0 || likelyHumanUpdateOmissionCount > 0 ? 'GO_WITH_CAUTION' : 'GO');

  return {
    pipelines,
    domains,
    staleDomainCount,
    staleHighRiskDomainCount,
    likelyHumanUpdateOmissionCount,
    likelyHumanUpdateOmissionDomains,
    meetingRiskStatus,
    criticalTeamIssueCount,
  };
}

export function buildExecReadme(): Array<Array<string>> {
  return [
    ['section', 'content'],
    ['purpose', '経営・管理向けの参照ブックです。会議前にまず数字の鮮度と更新漏れリスクを確認し、その後に論点別タブを見ます。'],
    ['read_first', 'まず 経営_会議前チェック → 次に 経営_更新状況 → 経営_データ状況 → 経営_例外推移 → 必要に応じて 経営_顧客リスク / 経営_コーチ負荷 の順で見てください。'],
    ['do_not_edit', 'このブックは参照専用です。数値や行を直接編集しないでください。修正が必要な場合は POTEX DB または各運用ブック側で対応します。'],
    ['color_legend_red', '会議前に確認したい高リスク状態です。更新遅れ・更新漏れ・自動化停止の可能性があります。'],
    ['color_legend_orange', '更新遅れや人手更新漏れの疑いがあり、数字の読み方に注意が必要な状態です。'],
    ['color_legend_green', '鮮度・件数ともに大きな懸念が見えていない状態です。'],
    ['how_to_read', '会議前チェックで GO / GO_WITH_CAUTION / CHECK_BEFORE_MEETING を見て、更新状況タブで stale ドメインと想定バイアスを把握してください。'],
    ['data_freshness', 'stale 警告は自動更新失敗だけでなく、担当者の元データ更新漏れでも発生します。'],
    ['escalation', '想定外の変動や急増がある場合は、POTEX DB の Sync_Log と各運用タブを確認し、担当チームまたは自動化担当へ連携してください。'],
  ];
}

export function buildExecCoachLoad(coachLoadRows: Array<Record<string, string>>): Array<Array<string>> {
  const header = [
    'coach_name', 'active_customer_count', 'session_count', 'followup_customer_count',
    'low_satisfaction_feedback_count', 'remaining_capacity', 'coach_id',
  ];
  const rows = coachLoadRows.map((r) => [
    r['coach_name'] || '',
    r['active_customer_count'] || '',
    r['session_count'] || '',
    r['followup_customer_count'] || '',
    r['low_satisfaction_feedback_count'] || '',
    r['remaining_capacity'] || '',
    r['coach_id'] || '',
  ]);
  return [header, ...rows];
}

export function buildExecCustomerRiskSummary(feedbackRows: Array<Record<string, string>>, exceptionRows: Array<Record<string, string>>): Array<Array<string>> {
  const header = ['metric', 'value'];
  const lowSat = feedbackRows.filter((r) => r['low_satisfaction_flag'] === 'TRUE').length;
  const followup = feedbackRows.length;
  return [
    header,
    ['low_satisfaction_feedback_count', String(lowSat)],
    ['followup_feedback_count', String(followup)],
    ['feedback_match_exception_count', String(exceptionRows.length)],
  ];
}

export function buildCsReadme(): Array<Array<string>> {
  return [
    ['section', 'content'],
    ['purpose', 'CS日次運用ブックです。今日どの案件を先に触るか、どこに入力するか、どの alias / 担当割当を処理するかをここで判断します。'],
    ['read_first', '最初に CS_承認進捗 で滞留箇所を確認し、その後 CS_要フォロー一覧 → alias review 2種 → CS_担当割当入力 → CS_継続対象一覧 の順で見てください。'],
    ['edit_here', '編集してよいのは入力・レビュー系タブの指定列だけです。とくに operator_decision_status / operator_selected_* / operator_note 以外は原則編集しないでください。'],
    ['do_not_edit', '参照用の公開列、候補列、ID列、sync_status、最終取込日時は手で書き換えないでください。'],
    ['status_rule', 'operator_decision_status は原則 approved / active / resolved を使います。シート内に個別案内がある場合はその案内を優先してください。'],
    ['color_legend_red', '未処理の緊急案件、入力エラー、最優先対応です。'],
    ['color_legend_orange', '近いうちに確認・処理したい案件です。'],
    ['color_legend_green', '処理済み、正常、進行中の状態です。'],
    ['escalation', '候補ロジックや表示内容に違和感がある場合は、POTEX DB の exception / source 系タブと照合し、自動化担当へ連携してください。'],
  ];
}

function summarizeChannelDistribution(lineRegistrationRows: Array<Record<string, string>>): {
  withChannel: number;
  withoutChannel: number;
  topChannels: string;
} {
  const distribution = new Map<string, number>();
  let withChannel = 0;
  let withoutChannel = 0;
  lineRegistrationRows.forEach((row) => {
    const tokens = tokenizeAttributionTags(row['attribution_tags'] || '');
    if (tokens.length > 0) {
      withChannel += 1;
      tokens.forEach((token) => distribution.set(token, (distribution.get(token) || 0) + 1));
    } else {
      withoutChannel += 1;
    }
  });
  const topChannels = Array.from(distribution.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([token, count]) => `${token}=${count}`)
    .join('; ');
  return { withChannel, withoutChannel, topChannels };
}

type TrendMetricSpec = {
  statKey: string;
  column: string;
};

const EXEC_EXCEPTION_TREND_METRICS: TrendMetricSpec[] = [
  { statKey: 'feedbackExceptionRowsWritten', column: 'feedback_match_exception_count' },
  { statKey: 'paymentUnmatchedCount', column: 'payment_unmatched_count' },
  { statKey: 'continuationUnmatchedCount', column: 'continuation_unmatched_count' },
  { statKey: 'lineRegistrationUnmatchedCount', column: 'line_registration_unmatched_count' },
  { statKey: 'feedbackResponseIdCollisions', column: 'feedback_response_id_collision_count' },
];

const EXEC_EXCEPTION_TREND_LOOKBACK_DAYS = 30;

function parseSyncLogStats(statsText: string): Record<string, string> {
  return String(statsText || '')
    .split(/\r?\n/)
    .reduce<Record<string, string>>((acc, line) => {
      const trimmed = String(line || '').trim();
      if (!trimmed) return acc;
      const separator = trimmed.indexOf('=');
      if (separator <= 0) return acc;
      const key = trimmed.slice(0, separator).trim();
      if (!key) return acc;
      acc[key] = trimmed.slice(separator + 1).trim();
      return acc;
    }, {});
}

function parseTrendMetricValue(value: string): number | null {
  if (value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function tableToObjects(table: Array<Array<string>>): Array<Record<string, string>> {
  if (table.length <= 1) return [];
  const header = table[0].map((value) => String(value || ''));
  return table.slice(1).map((row) => {
    const obj: Record<string, string> = {};
    header.forEach((key, idx) => {
      obj[key] = String(row[idx] || '');
    });
    return obj;
  });
}

function normalizeLower(value: string): string {
  return String(value || '').trim().toLowerCase();
}

type ApprovalProgressSnapshot = {
  openTotal: number;
  openP1: number;
  openP2: number;
  openP3: number;
  undecidedP1: number;
  decidedAwaitingSync: number;
  invalidOpen: number;
};

function summarizeApprovalQueue(rows: Array<Record<string, string>>): ApprovalProgressSnapshot {
  return rows.reduce<ApprovalProgressSnapshot>((acc, row) => {
    const priority = String(row['priority'] || '');
    const decision = normalizeLower(row['operator_decision_status'] || '');
    const syncStatus = normalizeLower(row['sync_status'] || '');
    acc.openTotal += 1;
    if (priority === 'P1') acc.openP1 += 1;
    if (priority === 'P2') acc.openP2 += 1;
    if (priority === 'P3') acc.openP3 += 1;
    if (priority === 'P1' && !decision) acc.undecidedP1 += 1;
    if (decision && syncStatus !== 'processed') acc.decidedAwaitingSync += 1;
    if (syncStatus && syncStatus !== 'processed') acc.invalidOpen += (syncStatus.includes('invalid') ? 1 : 0);
    return acc;
  }, {
    openTotal: 0,
    openP1: 0,
    openP2: 0,
    openP3: 0,
    undecidedP1: 0,
    decidedAwaitingSync: 0,
    invalidOpen: 0,
  });
}

type ApprovalWritebackSummary = {
  processed7d: number;
  invalid7d: number;
  lastSuccessAtJst: string;
};

function summarizeWritebackThroughput(
  syncLogRows: Array<Record<string, string>>,
  processedKey: string,
  invalidKey: string,
): ApprovalWritebackSummary {
  const cutoff = Date.now() - (7 * 24 * 60 * 60 * 1000);
  let processed7d = 0;
  let invalid7d = 0;
  let lastSuccessAtMs = 0;
  let lastSuccessAtJst = '';

  syncLogRows.forEach((row) => {
    if ((row['job_name'] || '') !== 'runWritebackCollection') return;
    if (normalizeLower(row['status'] || '') !== 'success') return;
    const timestamp = row['timestamp'] || '';
    const parsedDate = new Date(timestamp);
    const timestampMs = parsedDate.getTime();
    if (Number.isNaN(timestampMs)) return;

    const stats = parseSyncLogStats(row['stats'] || '');
    const processed = parseTrendMetricValue(stats[processedKey] || '') || 0;
    const invalid = parseTrendMetricValue(stats[invalidKey] || '') || 0;

    if (timestampMs >= cutoff) {
      processed7d += processed;
      invalid7d += invalid;
    }
    if (timestampMs > lastSuccessAtMs) {
      lastSuccessAtMs = timestampMs;
      lastSuccessAtJst = formatTrendTimestampJst(parsedDate);
    }
  });

  return { processed7d, invalid7d, lastSuccessAtJst };
}

export function buildCsApprovalProgress(
  paymentAliasReviewTable: Array<Array<string>>,
  continuationAliasReviewTable: Array<Array<string>>,
  syncLogRows: Array<Record<string, string>>,
  assignmentRows: Array<Record<string, string>> = [],
): Array<Array<string>> {
  const paymentRows = tableToObjects(paymentAliasReviewTable);
  const continuationRows = tableToObjects(continuationAliasReviewTable);
  const paymentSnapshot = summarizeApprovalQueue(paymentRows);
  const continuationSnapshot = summarizeApprovalQueue(continuationRows);
  const paymentThroughput = summarizeWritebackThroughput(syncLogRows, 'processedPaymentAliasRows', 'invalidPaymentAliasRows');
  const continuationThroughput = summarizeWritebackThroughput(syncLogRows, 'processedContinuationAliasRows', 'invalidContinuationAliasRows');
  const partnerThroughput = summarizeWritebackThroughput(syncLogRows, 'processedPartnerStatusRows', 'invalidPartnerStatusRows');
  const partnerAssignments = assignmentRows.filter((row) => (row['assignee_kind'] || '').toLowerCase() === 'partner' && !(row['ended_at'] || '') && (row['assignment_status'] || '').toLowerCase() !== 'ended');
  const now = new Date();
  const partnerStaleCount = partnerAssignments.filter((row) => {
    const anchor = row['last_partner_update_at'] || row['assigned_at'] || row['updated_at'] || row['created_at'] || '';
    return daysSince(anchor, now) >= 30;
  }).length;
  const partnerWaitingFirstUpdate = partnerAssignments.filter((row) => !(row['last_partner_update_at'] || '')).length;
  const partnerMeetingCompleted = partnerAssignments.filter((row) => (row['meeting_status'] || '').toLowerCase() === 'completed').length;
  const partnerPotexInProgress = partnerAssignments.filter((row) => ['introduced', 'in_discussion'].includes((row['potex_sale_status'] || '').toLowerCase())).length;

  return [
    ['scope', 'metric', 'value', 'note'],
    ['payment_alias_review', 'open_total', String(paymentSnapshot.openTotal), 'CS_入金名寄せ確認 に現在表示されている件数です。'],
    ['payment_alias_review', 'open_p1', String(paymentSnapshot.openP1), '最優先で確定判断が必要な入金レビュー件数です。'],
    ['payment_alias_review', 'open_p2', String(paymentSnapshot.openP2), '候補調査や今後の顧客取込待ちが必要な入金レビュー件数です。'],
    ['payment_alias_review', 'open_p3', String(paymentSnapshot.openP3), '現時点で有力候補がない入金レビュー件数です。'],
    ['payment_alias_review', 'p1_undecided', String(paymentSnapshot.undecidedP1), 'P1 のうち operator_decision_status が未入力の件数です。'],
    ['payment_alias_review', 'decided_waiting_sync', String(paymentSnapshot.decidedAwaitingSync), '運営判断は入ったが sync_status が processed ではない件数です。'],
    ['payment_alias_review', 'invalid_open', String(paymentSnapshot.invalidOpen), 'invalid_* の sync_status が残っており、入力修正が必要な件数です。'],
    ['payment_alias_review', 'processed_last_7d', String(paymentThroughput.processed7d), '直近7日で runWritebackCollection が処理した入金alias件数の合計です。'],
    ['payment_alias_review', 'invalid_last_7d', String(paymentThroughput.invalid7d), '直近7日で runWritebackCollection が invalid とした入金alias件数の合計です。'],
    ['payment_alias_review', 'last_writeback_success_at_jst', paymentThroughput.lastSuccessAtJst, 'Sync_Log で確認できる最新の runWritebackCollection 成功日時です。'],
    ['continuation_alias_review', 'open_total', String(continuationSnapshot.openTotal), 'CS_継続名寄せ確認 に現在表示されている件数です。'],
    ['continuation_alias_review', 'open_p1', String(continuationSnapshot.openP1), '最優先で確定判断が必要な継続レビュー件数です。'],
    ['continuation_alias_review', 'open_p2', String(continuationSnapshot.openP2), '候補調査や今後の顧客取込待ちが必要な継続レビュー件数です。'],
    ['continuation_alias_review', 'open_p3', String(continuationSnapshot.openP3), '現時点で有力候補がない継続レビュー件数です。'],
    ['continuation_alias_review', 'p1_undecided', String(continuationSnapshot.undecidedP1), 'P1 のうち operator_decision_status が未入力の件数です。'],
    ['continuation_alias_review', 'decided_waiting_sync', String(continuationSnapshot.decidedAwaitingSync), '運営判断は入ったが sync_status が processed ではない件数です。'],
    ['continuation_alias_review', 'invalid_open', String(continuationSnapshot.invalidOpen), 'invalid_* の sync_status が残っており、入力修正が必要な件数です。'],
    ['continuation_alias_review', 'processed_last_7d', String(continuationThroughput.processed7d), '直近7日で runWritebackCollection が処理した継続alias件数の合計です。'],
    ['continuation_alias_review', 'invalid_last_7d', String(continuationThroughput.invalid7d), '直近7日で runWritebackCollection が invalid とした継続alias件数の合計です。'],
    ['continuation_alias_review', 'last_writeback_success_at_jst', continuationThroughput.lastSuccessAtJst, 'Sync_Log で確認できる最新の runWritebackCollection 成功日時です。'],
    ['partner_status_pipeline', 'open_total', String(partnerAssignments.length), 'Customer_Coach_Assignments に残っている有効な partner 割当件数です。'],
    ['partner_status_pipeline', 'waiting_first_update', String(partnerWaitingFirstUpdate), 'last_partner_update_at がまだ入っていない partner lead 件数です。'],
    ['partner_status_pipeline', 'stale_30d', String(partnerStaleCount), '最終更新基準日から30日以上経過した partner lead 件数です。'],
    ['partner_status_pipeline', 'meeting_completed', String(partnerMeetingCompleted), 'meeting_status=completed の partner 割当件数です。'],
    ['partner_status_pipeline', 'potex_in_progress', String(partnerPotexInProgress), 'potex_sale_status が introduced / in_discussion の件数です。'],
    ['partner_status_pipeline', 'processed_last_7d', String(partnerThroughput.processed7d), '直近7日で runWritebackCollection が処理した partner status 件数の合計です。'],
    ['partner_status_pipeline', 'invalid_last_7d', String(partnerThroughput.invalid7d), '直近7日で runWritebackCollection が invalid とした partner status 件数の合計です。'],
    ['partner_status_pipeline', 'last_writeback_success_at_jst', partnerThroughput.lastSuccessAtJst, 'Sync_Log で確認できる最新の partner status writeback 成功日時です。'],
  ];
}

function formatTrendDateJst(date: Date): string {
  return Utilities.formatDate(date, Session.getScriptTimeZone() || 'Asia/Tokyo', 'yyyy-MM-dd');
}

function formatTrendTimestampJst(date: Date): string {
  return Utilities.formatDate(date, Session.getScriptTimeZone() || 'Asia/Tokyo', "yyyy-MM-dd'T'HH:mm:ss");
}

export function buildExecExceptionTrend(syncLogRows: Array<Record<string, string>>): Array<Array<string>> {
  const header = [
    'date_jst',
    'latest_run_at_jst',
    'source_job',
    'feedback_match_exception_count',
    'feedback_match_exception_delta',
    'payment_unmatched_count',
    'payment_unmatched_delta',
    'continuation_unmatched_count',
    'continuation_unmatched_delta',
    'line_registration_unmatched_count',
    'line_registration_unmatched_delta',
    'feedback_response_id_collision_count',
    'feedback_response_id_collision_delta',
  ];

  const dailyLatest = new Map<string, {
    timestampMs: number;
    latestRunAtJst: string;
    sourceJob: string;
    values: Record<string, string>;
  }>();

  syncLogRows.forEach((row) => {
    if ((row['status'] || '').toLowerCase() !== 'success') return;
    const timestamp = row['timestamp'] || '';
    if (!timestamp) return;
    const parsedDate = new Date(timestamp);
    const timestampMs = parsedDate.getTime();
    if (Number.isNaN(timestampMs)) return;

    const parsedStats = parseSyncLogStats(row['stats'] || '');
    const values: Record<string, string> = {};
    let hasTrackedMetric = false;
    EXEC_EXCEPTION_TREND_METRICS.forEach(({ statKey, column }) => {
      const statValue = parsedStats[statKey] || '';
      if (statValue !== '') hasTrackedMetric = true;
      values[column] = statValue;
    });
    if (!hasTrackedMetric) return;

    const bucket = formatTrendDateJst(parsedDate);
    const existing = dailyLatest.get(bucket);
    if (existing && existing.timestampMs >= timestampMs) return;

    dailyLatest.set(bucket, {
      timestampMs,
      latestRunAtJst: formatTrendTimestampJst(parsedDate),
      sourceJob: row['job_name'] || '',
      values,
    });
  });

  const dates = Array.from(dailyLatest.keys()).sort().slice(-EXEC_EXCEPTION_TREND_LOOKBACK_DAYS);
  const previousValues: Record<string, number | null> = {};
  const rows = dates.map((dateKey) => {
    const day = dailyLatest.get(dateKey)!;
    const row: string[] = [dateKey, day.latestRunAtJst, day.sourceJob];
    EXEC_EXCEPTION_TREND_METRICS.forEach(({ column }) => {
      const rawValue = day.values[column] || '';
      const currentValue = parseTrendMetricValue(rawValue);
      const previousValue = previousValues[column] ?? null;
      const delta = currentValue === null || previousValue === null
        ? ''
        : String(currentValue - previousValue);
      row.push(rawValue, delta);
      previousValues[column] = currentValue;
    });
    return row;
  });

  return [header, ...rows];
}

export function buildExecUpdateStatus(
  followupRows: Array<Record<string, string>>,
  continuationRows: Array<Record<string, string>>,
  exceptionRows: Array<Record<string, string>>,
  plansRows: Array<Record<string, string>>,
  paymentsRows: Array<Record<string, string>>,
  conversionRows: Array<Record<string, string>>,
  stagingPaymentsRows: Array<Record<string, string>>,
  lineRegistrationRows: Array<Record<string, string>>,
  continuationExceptionRows: Array<Record<string, string>> = [],
  assignmentRows: Array<Record<string, string>> = [],
  syncLogRows: Array<Record<string, string>> = [],
): Array<Array<string>> {
  const snapshot = buildExecutiveFreshnessSnapshot(
    followupRows,
    continuationRows,
    exceptionRows,
    plansRows,
    paymentsRows,
    conversionRows,
    stagingPaymentsRows,
    lineRegistrationRows,
    continuationExceptionRows,
    assignmentRows,
    syncLogRows,
  );

  return [
    ['domain', 'status', 'last_effective_update_at_jst', 'expected_cadence', 'stale_threshold', 'stale_by', 'likely_issue_type', 'likely_decision_risk', 'recommended_check'],
    ...snapshot.domains.map((domain) => [
      domain.domain,
      domain.status,
      domain.lastEffectiveUpdateAtJst,
      domain.expectedCadence,
      domain.staleThreshold,
      domain.staleBy,
      domain.likelyIssueType,
      domain.likelyDecisionRisk,
      domain.recommendedCheck,
    ]),
  ];
}

export function buildExecMeetingCheck(
  followupRows: Array<Record<string, string>>,
  continuationRows: Array<Record<string, string>>,
  exceptionRows: Array<Record<string, string>>,
  plansRows: Array<Record<string, string>>,
  paymentsRows: Array<Record<string, string>>,
  conversionRows: Array<Record<string, string>>,
  stagingPaymentsRows: Array<Record<string, string>>,
  lineRegistrationRows: Array<Record<string, string>>,
  continuationExceptionRows: Array<Record<string, string>> = [],
  assignmentRows: Array<Record<string, string>> = [],
  syncLogRows: Array<Record<string, string>> = [],
): Array<Array<string>> {
  const snapshot = buildExecutiveFreshnessSnapshot(
    followupRows,
    continuationRows,
    exceptionRows,
    plansRows,
    paymentsRows,
    conversionRows,
    stagingPaymentsRows,
    lineRegistrationRows,
    continuationExceptionRows,
    assignmentRows,
    syncLogRows,
  );
  const now = new Date();
  const publishFresh = snapshot.pipelines.publish.latestSuccessAtMs > 0
    && ((now.getTime() - snapshot.pipelines.publish.latestSuccessAtMs) / (1000 * 60 * 60) <= EXEC_PIPELINE_PUBLISH_STALE_HOURS);
  const fullRefreshFresh = snapshot.pipelines.fullRefresh.latestSuccessAtMs > 0
    && ((now.getTime() - snapshot.pipelines.fullRefresh.latestSuccessAtMs) / (1000 * 60 * 60) <= EXEC_PIPELINE_FULL_REFRESH_STALE_HOURS);
  const writebackFresh = snapshot.pipelines.writeback.latestSuccessAtMs > 0
    && ((now.getTime() - snapshot.pipelines.writeback.latestSuccessAtMs) / (1000 * 60 * 60) <= EXEC_PIPELINE_WRITEBACK_STALE_HOURS);
  const overallDetail = snapshot.meetingRiskStatus === 'GO'
    ? '主要ドメインに重大な stale は見えていません。通常どおり会議を進められます。'
    : (snapshot.meetingRiskStatus === 'GO_WITH_CAUTION'
      ? '会議は進められますが、stale ドメインと更新漏れ疑いを前提に数字を読み解いてください。'
      : '会議前に stale ドメインまたは自動更新状況を確認し、数字の利用可否を先に合わせてください。');

  return [
    ['check_item', 'status', 'detail'],
    ['publish freshness', publishFresh ? 'OK' : 'NG', snapshot.pipelines.publish.latestSuccessAtJst || 'runPublishAll の成功履歴が見つかりません'],
    ['full refresh freshness', fullRefreshFresh ? 'OK' : 'NG', snapshot.pipelines.fullRefresh.latestSuccessAtJst || 'runFullRefresh の成功履歴が見つかりません'],
    ['writeback freshness', writebackFresh ? 'OK' : 'NG', snapshot.pipelines.writeback.latestSuccessAtJst || 'runWritebackCollection の成功履歴が見つかりません'],
    ['stale domains present', snapshot.staleDomainCount === 0 ? 'OK' : 'CHECK', `${snapshot.staleDomainCount}件`],
    ['high risk stale domains present', snapshot.staleHighRiskDomainCount === 0 ? 'OK' : 'CHECK', `${snapshot.staleHighRiskDomainCount}件`],
    ['likely human update omissions present', snapshot.likelyHumanUpdateOmissionCount === 0 ? 'OK' : 'CHECK', snapshot.likelyHumanUpdateOmissionDomains.join(', ') || 'なし'],
    ['critical team issues in meeting scope', snapshot.criticalTeamIssueCount === 0 ? 'OK' : 'CHECK', `${snapshot.criticalTeamIssueCount}件（クレーム/要フォロー/未紐づけ含む）`],
    ['overall meeting risk', snapshot.meetingRiskStatus, overallDetail],
  ];
}

export function buildExecDataHealth(
  customersRows: Array<Record<string, string>>,
  coachesRows: Array<Record<string, string>>,
  sessionsRows: Array<Record<string, string>>,
  feedbackRows: Array<Record<string, string>>,
  followupRows: Array<Record<string, string>>,
  continuationRows: Array<Record<string, string>>,
  exceptionRows: Array<Record<string, string>>,
  plansRows: Array<Record<string, string>>,
  paymentsRows: Array<Record<string, string>>,
  conversionRows: Array<Record<string, string>>,
  stagingPaymentsRows: Array<Record<string, string>>,
  lineRegistrationRows: Array<Record<string, string>>,
  continuationExceptionRows: Array<Record<string, string>> = [],
  assignmentRows: Array<Record<string, string>> = [],
  syncLogRows: Array<Record<string, string>> = [],
): Array<Array<string>> {
  const header = ['metric', 'value', 'note'];
  const unmatchedPayments = stagingPaymentsRows.filter((row) => !(row['customer_id'] || '')).length;
  const unmatchedLineRegistrations = lineRegistrationRows.filter((row) => !(row['customer_id'] || '')).length;
  const acquisition = summarizeChannelDistribution(lineRegistrationRows);
  const partnerAssignments = assignmentRows.filter((row) => (row['assignee_kind'] || '').toLowerCase() === 'partner' && !(row['ended_at'] || '') && (row['assignment_status'] || '').toLowerCase() !== 'ended');
  const now = new Date();
  const partnerStaleCount = partnerAssignments.filter((row) => {
    const anchor = row['last_partner_update_at'] || row['assigned_at'] || row['updated_at'] || row['created_at'] || '';
    return daysSince(anchor, now) >= 30;
  }).length;
  const partnerUpdatedCount = partnerAssignments.filter((row) => !!(row['last_partner_update_at'] || '')).length;
  const partnerMeetingCompletedCount = partnerAssignments.filter((row) => (row['meeting_status'] || '').toLowerCase() === 'completed').length;
  const partnerPotexInProgressCount = partnerAssignments.filter((row) => ['introduced', 'in_discussion'].includes((row['potex_sale_status'] || '').toLowerCase())).length;
  const partnerRecruitmentActiveCount = partnerAssignments.filter((row) => ['intern_intro', 'intern_active', 'selection'].includes((row['recruitment_status'] || '').toLowerCase())).length;
  const feedbackResponseIds = new Set<string>();
  let feedbackResponseIdCollisions = 0;
  feedbackRows.forEach((row) => {
    const rid = row['response_id'] || '';
    if (!rid) return;
    if (feedbackResponseIds.has(rid)) feedbackResponseIdCollisions += 1;
    feedbackResponseIds.add(rid);
  });
  const freshness = buildExecutiveFreshnessSnapshot(
    followupRows,
    continuationRows,
    exceptionRows,
    plansRows,
    paymentsRows,
    conversionRows,
    stagingPaymentsRows,
    lineRegistrationRows,
    continuationExceptionRows,
    assignmentRows,
    syncLogRows,
  );
  return [
    header,
    ['last_publish_success_at_jst', freshness.pipelines.publish.latestSuccessAtJst, 'Sync_Log で確認できる最新の runPublishAll 成功日時です。'],
    ['last_full_refresh_success_at_jst', freshness.pipelines.fullRefresh.latestSuccessAtJst, 'Sync_Log で確認できる最新の runFullRefresh 成功日時です。'],
    ['last_writeback_success_at_jst', freshness.pipelines.writeback.latestSuccessAtJst, 'Sync_Log で確認できる最新の runWritebackCollection 成功日時です。'],
    ['stale_domain_count', String(freshness.staleDomainCount), '経営_更新状況 で stale 判定になったドメイン数です。'],
    ['stale_high_risk_domain_count', String(freshness.staleHighRiskDomainCount), '会議前に確認推奨の高リスク stale ドメイン数です。'],
    ['likely_human_update_omission_count', String(freshness.likelyHumanUpdateOmissionCount), '自動更新は走っているが元データ更新漏れの可能性があるドメイン数です。'],
    ['domains_with_likely_human_update_omission', freshness.likelyHumanUpdateOmissionDomains.join(', '), '更新漏れ疑いのあるドメイン一覧です。'],
    ['meeting_risk_status', freshness.meetingRiskStatus, '経営_会議前チェック と同じ最終判断ステータスです。'],
    ['critical_team_issue_count', String(freshness.criticalTeamIssueCount), '会議論点になりやすい要フォロー / 例外 / クレーム候補件数の概算です。'],
    ['customers_count', String(customersRows.length), 'canonical Customers の行数です。'],
    ['coaches_count', String(coachesRows.length), 'canonical Coaches の行数です。'],
    ['sessions_count', String(sessionsRows.length), 'canonical Sessions の行数です。'],
    ['feedback_count', String(feedbackRows.length), 'canonical Feedback の行数です。'],
    ['feedback_response_id_collision_count', String(feedbackResponseIdCollisions), 'canonical Feedback 内で同じ response_id を共有する件数です。想定値は 0 で、0 以外は要調査です。'],
    ['followup_queue_count', String(followupRows.length), '現在公開されている follow-up キュー件数です。'],
    ['continuation_targets_count', String(continuationRows.length), '現在公開されている継続対象件数です。'],
    ['feedback_match_exception_count', String(exceptionRows.length), '未解決の feedback/customer 紐づけ例外件数です。'],
    ['plans_count', String(plansRows.length), 'canonical Plans の行数です。'],
    ['payments_count', String(paymentsRows.length), 'canonical Payments の行数です（着金管理マスター由来）。'],
    ['conversion_events_count', String(conversionRows.length), 'canonical ConversionHistory の行数です。'],
    ['payment_unmatched_count', String(unmatchedPayments), 'customer_id が未付与の staging payment 件数です。'],
    ['line_registrations_count', String(lineRegistrationRows.length), 'canonical LINE friend-add 行数です（csvA + csv_potex）。'],
    ['line_registration_unmatched_count', String(unmatchedLineRegistrations), 'canonical customer に未紐づけの LINE 登録件数です。'],
    ['continuation_unmatched_count', String(continuationExceptionRows.length), '継続プラン管理由来で canonical customer に未紐づけの件数です。'],
    ['partner_assignment_count', String(partnerAssignments.length), '有効な partner 割当件数です。'],
    ['partner_status_updated_count', String(partnerUpdatedCount), 'last_partner_update_at が1回以上入っている partner 割当件数です。'],
    ['partner_stale_30d_count', String(partnerStaleCount), '最終更新基準日から30日以上経過した partner 割当件数です。'],
    ['partner_meeting_completed_count', String(partnerMeetingCompletedCount), 'meeting_status=completed の partner 割当件数です。'],
    ['partner_potex_in_progress_count', String(partnerPotexInProgressCount), 'potex_sale_status が introduced / in_discussion の件数です。'],
    ['partner_recruitment_active_count', String(partnerRecruitmentActiveCount), 'recruitment_status が intern_intro / intern_active / selection の件数です。'],
    ['acquisition_with_channel_count', String(acquisition.withChannel), 'Line_Registrations.attribution_tags から正規化チャネルタグを1つ以上持つ件数です。'],
    ['acquisition_without_channel_count', String(acquisition.withoutChannel), '流入タグが付いていない LINE 登録件数です。'],
    ['acquisition_top_channels', acquisition.topChannels, '件数上位5件の流入チャネルです（セミコロン区切り）。'],
  ];
}

export function buildConciergeReadme(ingestMode: string): Array<Array<string>> {
  return [
    ['section', 'content'],
    ['purpose', 'コンシェルジュ向けの参照ブックです。上流で確定した情報を確認し、フォロー時の文脈把握に使います。'],
    ['read_first', '日次確認は コンシェルジュ_フォロー一覧 を先に見て、件数や異常確認が必要なときだけ コンシェルジュ_データ状況 を見てください。'],
    ['publish_only', 'このブックの全タブは参照専用です。行や値を直接編集しないでください。'],
    ['writeback_policy', '現時点では concierge 用 writeback はありません。修正が必要な場合は DB / CS 側フローで対応してください。'],
    ['customer_ingest_mode', localizeIngestMode(ingestMode)],
    ['ingest_note', '顧客取込は fallback や変換途中の影響を受ける場合があります。迷うケースはまず コンシェルジュ_データ状況 を確認してください。'],
    ['escalation', '表示内容がおかしい場合は POTEX DB > Ops_Followup_Queue と照合し、自動化担当へ連携してください。'],
  ];
}

export function buildConciergeFollowupView(
  feedbackRows: Array<Record<string, string>>,
  assignmentRows: Array<Record<string, string>>,
  coachRows: Array<Record<string, string>>,
): Array<Array<string>> {
  const header = [
    'priority', 'queue_status', 'feedback_date', 'customer_name', 'current_status',
    'assigned_coach_name', 'feedback_coach_name', 'followup_reason', 'comment', 'gap_comment',
    'owner', 'customer_id', 'feedback_id', 'source_ref',
  ];
  const assignmentByCustomerId = buildCurrentCoachAssignmentByCustomerId(assignmentRows);
  const coachById = buildCoachById(coachRows);
  const rows = feedbackRows.map((r) => [
    r['priority'] || (r['low_satisfaction_flag'] === 'TRUE' ? 'P1' : 'P2'),
    localizeQueueStatus(r['queue_status'] || ''),
    formatViewDateTime(r['feedback_date'] || ''),
    r['customer_name'] || '',
    localizeCurrentStatus(r['current_status'] || ''),
    resolveAssignedCoachName(r['customer_id'] || '', r['assigned_coach_name'] || '', assignmentByCustomerId, coachById),
    r['feedback_coach_name'] || r['coach_name'] || '',
    localizeFollowupReason(r['followup_reason'] || ''),
    r['comment'] || '',
    r['gap_comment'] || '',
    r['owner'] || '',
    r['customer_id'] || '',
    r['feedback_id'] || '',
    r['source_ref'] || '',
  ]);
  return [header, ...rows];
}

export function buildConciergeDataHealth(
  ingestMode: string,
  followupRows: Array<Record<string, string>>,
  continuationRows: Array<Record<string, string>>,
  exceptionRows: Array<Record<string, string>>,
  plansRows: Array<Record<string, string>>,
  paymentsRows: Array<Record<string, string>>,
  conversionRows: Array<Record<string, string>>,
  stagingPaymentsRows: Array<Record<string, string>>,
  lineRegistrationRows: Array<Record<string, string>>,
  continuationExceptionRows: Array<Record<string, string>> = [],
): Array<Array<string>> {
  const unmatchedPayments = stagingPaymentsRows.filter((row) => !(row['customer_id'] || '')).length;
  const unmatchedLineRegistrations = lineRegistrationRows.filter((row) => !(row['customer_id'] || '')).length;
  const acquisition = summarizeChannelDistribution(lineRegistrationRows);
  return [
    ['metric', 'value', 'note'],
    ['customer_ingest_mode', localizeIngestMode(ingestMode), '現在の設定と取込状態から判定した顧客取込モードです。'],
    ['followup_queue_count', String(followupRows.length), 'コンシェルジュ向けに現在表示されているフォロー件数です。'],
    ['continuation_targets_count', String(continuationRows.length), '継続対象キューの参照件数です。'],
    ['feedback_match_exception_count', String(exceptionRows.length), 'DB に残っている未解決の feedback/customer 紐づけ例外件数です。'],
    ['plans_count', String(plansRows.length), 'canonical Plans の行数です。'],
    ['payments_count', String(paymentsRows.length), '下流運用で参照可能な canonical Payments の行数です。'],
    ['conversion_events_count', String(conversionRows.length), 'canonical ConversionHistory の行数です。'],
    ['payment_unmatched_count', String(unmatchedPayments), 'customer_id が未付与の staging payment 件数です。'],
    ['line_registrations_count', String(lineRegistrationRows.length), 'canonical LINE friend-add 行数です（csvA + csv_potex）。'],
    ['line_registration_unmatched_count', String(unmatchedLineRegistrations), 'canonical customer に未紐づけの LINE 登録件数です。'],
    ['continuation_unmatched_count', String(continuationExceptionRows.length), 'commercial ingest 時にスキップされた継続プラン件数です（POTEX DB の Exceptions_ContinuationMatch を確認）。'],
    ['acquisition_with_channel_count', String(acquisition.withChannel), '正規化済み流入タグを1つ以上持つ LINE 登録件数です。'],
    ['acquisition_top_channels', acquisition.topChannels, '件数上位5件の流入チャネルです（セミコロン区切り）。'],
  ];
}

export function buildCsPaymentAliasReview(
  stagingPaymentRows: Array<Record<string, string>>,
  lineRegistrationRows: Array<Record<string, string>>,
  customerRows: Array<Record<string, string>>,
  aliasRows: Array<Record<string, string>>,
  existingInputRows: Array<Record<string, string>> = [],
): Array<Array<string>> {
  const header = [
    'priority',
    'suggested_action',
    'payment_customer_name',
    'payment_line_name',
    'contract_date',
    'paid_date',
    'plan_name',
    'amount',
    'payment_segment',
    'candidate_real_name',
    'candidate_line_registration_name',
    'candidate_display_name',
    'candidate_segment',
    'current_status',
    'current_canonical_customer_name',
    'current_canonical_customer_id',
    'suggestion_basis',
    'writeback_alias_name',
    'operator_decision_status',
    'operator_selected_customer_name',
    'operator_selected_customer_id',
    'operator_note',
    'payment_id',
    'payment_source_sheet',
    'payment_source_row',
    'candidate_line_registration_id',
    'sync_status',
    'last_collected_at',
  ];

  const aliasByName = new Map<string, Record<string, string>>();
  aliasRows.forEach((row) => {
    const aliasName = row['alias_name'] || '';
    if (aliasName) aliasByName.set(normalizeName(aliasName), row);
  });
  const customerById = buildCustomerById(customerRows);

  const existingInputByKey = new Map<string, Record<string, string>>();
  existingInputRows.forEach((row) => {
    const key = paymentReviewKey(row['payment_source_sheet'] || '', row['payment_source_row'] || '');
    if (key) existingInputByKey.set(key, row);
  });

  const unmatchedPayments = stagingPaymentRows
    .filter((row) => !(row['customer_id'] || ''))
    .sort((a, b) => {
      const aContract = a['contract_date'] || '';
      const bContract = b['contract_date'] || '';
      if (aContract !== bContract) return compareDateValuesDesc(aContract, bContract);
      return (a['source_row'] || '').localeCompare(b['source_row'] || '');
    });

  const rows = unmatchedPayments.map((paymentRow) => {
    const paymentCustomerName = paymentRow['customer_name'] || '';
    const paymentLineName = paymentRow['line_name'] || '';
    const paymentSegment = paymentRow['segment'] || '';
    const existingInput = existingInputByKey.get(paymentReviewKey(paymentRow['source_sheet'] || '', paymentRow['source_row'] || '')) || {};
    const currentAlias = findPaymentAliasRow(aliasByName, paymentCustomerName);
    const rankedCandidates = lineRegistrationRows
      .map((candidate) => ({
        candidate,
        score: scoreLineCandidate(paymentCustomerName, paymentLineName, paymentSegment, candidate),
      }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => {
        if (a.score !== b.score) return b.score - a.score;
        return (b.candidate['registered_at'] || '').localeCompare(a.candidate['registered_at'] || '');
      });

    const topCandidate = rankedCandidates[0]?.candidate || {};
    const topScore = rankedCandidates[0]?.score || 0;
    const suggestionBasisParts = [
      topCandidate['customer_id'] ? 'line_row_already_matched' : '',
      paymentCustomerName && normalizeName(paymentCustomerName) === normalizeName(topCandidate['real_name'] || '') ? 'real_name_match' : '',
      paymentCustomerName && normalizeName(paymentCustomerName) === normalizeName(topCandidate['line_registration_name'] || '') ? 'line_registration_name_match' : '',
      paymentCustomerName && normalizeName(paymentCustomerName) === normalizeName(topCandidate['display_name'] || '') ? 'display_name_match' : '',
      paymentLineName && normalizeName(paymentLineName) === normalizeName(topCandidate['line_registration_name'] || '') ? 'line_name_match' : '',
      paymentSegment && normalizeName(paymentSegment) === normalizeName(topCandidate['segment'] || '') ? `segment=${topCandidate['segment'] || ''}` : '',
      topScore ? `score=${String(topScore)}` : '',
    ].filter(Boolean);
    const suggestedCustomerId = topCandidate['customer_id'] || '';
    const suggestedCustomerName = customerById.get(topCandidate['customer_id'] || '')?.['customer_name'] || '';
    const shouldPreserveOperatorInput = ((existingInput['sync_status'] || '').trim().toLowerCase() !== 'processed');

    return [
      topCandidate['customer_id'] ? 'P1' : (topCandidate['line_registration_id'] ? 'P2' : 'P3'),
      localizeSuggestedAction(topCandidate['customer_id'] ? 'approve_if_context_matches' : (topCandidate['line_registration_id'] ? 'search_customer_or_wait_for_customer_ingest' : 'hold_no_candidate_found')),
      paymentRow['payment_customer_name'] || paymentCustomerName,
      paymentLineName,
      formatViewDate(paymentRow['contract_date'] || ''),
      formatViewDate(paymentRow['paid_date'] || ''),
      paymentRow['plan_name_raw'] || '',
      paymentRow['amount_numeric'] || '',
      paymentSegment,
      topCandidate['real_name'] || '',
      topCandidate['line_registration_name'] || '',
      topCandidate['display_name'] || '',
      topCandidate['segment'] || '',
      localizeCurrentStatus(currentAlias['status'] || 'review'),
      currentAlias['canonical_customer_name'] || suggestedCustomerName,
      currentAlias['canonical_customer_id'] || suggestedCustomerId,
      localizeSuggestionBasis(suggestionBasisParts.join('; ')),
      paymentCustomerName || paymentLineName,
      shouldPreserveOperatorInput ? (existingInput['operator_decision_status'] || '') : '',
      shouldPreserveOperatorInput ? (existingInput['operator_selected_customer_name'] || currentAlias['canonical_customer_name'] || suggestedCustomerName) : (currentAlias['canonical_customer_name'] || suggestedCustomerName),
      shouldPreserveOperatorInput ? (existingInput['operator_selected_customer_id'] || currentAlias['canonical_customer_id'] || suggestedCustomerId) : (currentAlias['canonical_customer_id'] || suggestedCustomerId),
      shouldPreserveOperatorInput ? (existingInput['operator_note'] || '') : '',
      paymentRow['staging_payment_id'] || '',
      paymentRow['source_sheet'] || '',
      paymentRow['source_row'] || '',
      topCandidate['line_registration_id'] || '',
      shouldPreserveOperatorInput ? (existingInput['sync_status'] || '') : '',
      shouldPreserveOperatorInput ? (existingInput['last_collected_at'] || '') : '',
    ];
  });

  return [header, ...rows];
}

export function buildCsContinuationAliasReview(
  continuationExceptionRows: Array<Record<string, string>>,
  lineRegistrationRows: Array<Record<string, string>>,
  customerRows: Array<Record<string, string>>,
  aliasRows: Array<Record<string, string>>,
  existingInputRows: Array<Record<string, string>> = [],
): Array<Array<string>> {
  const header = CS_CONTINUATION_ALIAS_REVIEW_HEADER as unknown as string[];

  const aliasByName = new Map<string, Record<string, string>>();
  aliasRows.forEach((row) => {
    const aliasName = row['alias_name'] || '';
    if (aliasName) aliasByName.set(normalizeName(aliasName), row);
  });
  const customerById = buildCustomerById(customerRows);

  const existingInputByCeId = new Map<string, Record<string, string>>();
  existingInputRows.forEach((row) => {
    const ceId = resolveContinuationCeId(row);
    if (ceId) existingInputByCeId.set(ceId, row);
  });

  const sortedExceptions = continuationExceptionRows
    .slice()
    .filter((row) => (row['issue'] || '') === 'continuation_customer_unmatched')
    .sort((a, b) => {
      const aDate = a['raw_contract_date'] || '';
      const bDate = b['raw_contract_date'] || '';
      if (aDate !== bDate) return compareDateValuesDesc(aDate, bDate);
      return (a['continuation_exception_id'] || '').localeCompare(b['continuation_exception_id'] || '');
    });

  const rows = sortedExceptions.map((excRow) => {
    const rawName = excRow['raw_name'] || '';
    const cleanedName = excRow['cleaned_name'] || rawName;
    const writebackAliasName = cleanedName || rawName;
    const ceId = resolveContinuationCeId(excRow);
    const existingInput = (ceId && existingInputByCeId.get(ceId)) || {};
    const currentAlias = aliasByName.get(normalizeName(writebackAliasName)) || {};

    const rankedCandidates = lineRegistrationRows
      .map((candidate) => ({
        candidate,
        score: scoreLineCandidate(cleanedName, rawName, '', candidate),
      }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => {
        if (a.score !== b.score) return b.score - a.score;
        return (b.candidate['registered_at'] || '').localeCompare(a.candidate['registered_at'] || '');
      });

    const topCandidate = rankedCandidates[0]?.candidate || {};
    const topScore = rankedCandidates[0]?.score || 0;
    const suggestionBasisParts = [
      topCandidate['customer_id'] ? 'line_row_already_matched' : '',
      cleanedName && normalizeName(cleanedName) === normalizeName(topCandidate['real_name'] || '') ? 'real_name_match' : '',
      cleanedName && normalizeName(cleanedName) === normalizeName(topCandidate['line_registration_name'] || '') ? 'line_registration_name_match' : '',
      cleanedName && normalizeName(cleanedName) === normalizeName(topCandidate['display_name'] || '') ? 'display_name_match' : '',
      rawName && normalizeName(rawName) === normalizeName(topCandidate['line_registration_name'] || '') ? 'raw_name_to_line_registration_name_match' : '',
      topScore ? `score=${String(topScore)}` : '',
    ].filter(Boolean);
    const suggestedCustomerId = topCandidate['customer_id'] || '';
    const suggestedCustomerName = customerById.get(topCandidate['customer_id'] || '')?.['customer_name'] || '';
    const shouldPreserveOperatorInput = ((existingInput['sync_status'] || '').trim().toLowerCase() !== 'processed');

    return [
      topCandidate['customer_id'] ? 'P1' : (topCandidate['line_registration_id'] ? 'P2' : 'P3'),
      localizeSuggestedAction(topCandidate['customer_id'] ? 'approve_if_context_matches' : (topCandidate['line_registration_id'] ? 'search_customer_or_wait_for_customer_ingest' : 'hold_no_candidate_found')),
      rawName,
      cleanedName,
      excRow['raw_plan'] || '',
      formatViewDate(excRow['raw_contract_date'] || ''),
      excRow['raw_amount'] || '',
      topCandidate['real_name'] || '',
      topCandidate['line_registration_name'] || '',
      topCandidate['display_name'] || '',
      topCandidate['segment'] || '',
      localizeCurrentStatus(currentAlias['status'] || 'review'),
      currentAlias['canonical_customer_name'] || suggestedCustomerName,
      currentAlias['canonical_customer_id'] || suggestedCustomerId,
      localizeSuggestionBasis(suggestionBasisParts.join('; ')),
      writebackAliasName,
      shouldPreserveOperatorInput ? (existingInput['operator_decision_status'] || '') : '',
      shouldPreserveOperatorInput ? (existingInput['operator_selected_customer_name'] || currentAlias['canonical_customer_name'] || suggestedCustomerName) : (currentAlias['canonical_customer_name'] || suggestedCustomerName),
      shouldPreserveOperatorInput ? (existingInput['operator_selected_customer_id'] || currentAlias['canonical_customer_id'] || suggestedCustomerId) : (currentAlias['canonical_customer_id'] || suggestedCustomerId),
      shouldPreserveOperatorInput ? (existingInput['operator_note'] || '') : '',
      ceId,
      topCandidate['line_registration_id'] || '',
      shouldPreserveOperatorInput ? (existingInput['sync_status'] || '') : '',
      shouldPreserveOperatorInput ? (existingInput['last_collected_at'] || '') : '',
    ];
  });

  return [header, ...rows];
}

export function buildCsAliasResolutionInput(
  exceptionRows: Array<Record<string, string>>,
  aliasRows: Array<Record<string, string>>,
  existingInputRows: Array<Record<string, string>> = [],
): Array<Array<string>> {
  const header = [
    'alias_name',
    'respondent_email',
    'related_coach_name',
    'current_status',
    'current_canonical_customer_name',
    'current_canonical_customer_id',
    'operator_decision_status',
    'operator_selected_customer_name',
    'operator_selected_customer_id',
    'operator_note',
    'response_id',
    'sync_status',
    'last_collected_at',
  ];

  const aliasByName = new Map<string, Record<string, string>>();
  aliasRows.forEach((row) => {
    const aliasName = row['alias_name'] || '';
    if (aliasName) aliasByName.set(normalizeName(aliasName), row);
  });

  const existingInputByKey = new Map<string, Record<string, string>>();
  existingInputRows.forEach((row) => {
    const key = aliasInputKey(row['response_id'] || '', row['alias_name'] || '');
    if (key) existingInputByKey.set(key, row);
  });

  const rows = exceptionRows
    .filter((r) => (r['issue'] || '') === 'customer_unmatched')
    .map((r) => {
      const aliasName = r['respondent_name'] || '';
      const alias = aliasByName.get(normalizeName(aliasName)) || {};
      const existingKey = aliasInputKey(r['response_id'] || '', aliasName);
      const existingInput = existingInputByKey.get(existingKey) || {};
      const shouldPreserveOperatorInput = ((existingInput['sync_status'] || '').trim().toLowerCase() !== 'processed');
      return [
        aliasName,
        r['respondent_email'] || alias['respondent_email'] || '',
        r['canonical_coach_name'] || alias['related_coach_name'] || '',
        localizeCurrentStatus(alias['status'] || 'review'),
        alias['canonical_customer_name'] || '',
        alias['canonical_customer_id'] || '',
        shouldPreserveOperatorInput ? (existingInput['operator_decision_status'] || '') : '',
        shouldPreserveOperatorInput ? (existingInput['operator_selected_customer_name'] || alias['canonical_customer_name'] || '') : (alias['canonical_customer_name'] || ''),
        shouldPreserveOperatorInput ? (existingInput['operator_selected_customer_id'] || alias['canonical_customer_id'] || '') : (alias['canonical_customer_id'] || ''),
        shouldPreserveOperatorInput ? (existingInput['operator_note'] || '') : '',
        r['response_id'] || '',
        shouldPreserveOperatorInput ? (existingInput['sync_status'] || '') : '',
        shouldPreserveOperatorInput ? (existingInput['last_collected_at'] || '') : '',
      ];
    });

  return [header, ...rows];
}

function inferSuggestedPartnerScope(applicationRow: Record<string, string>): string {
  const entries = Object.entries(applicationRow);
  for (const [key, rawValue] of entries) {
    const normalizedKey = normalizeName(key);
    const value = String(rawValue || '').trim().toLowerCase();
    if (!value || !normalizedKey.includes('学生')) continue;
    if (value.includes('はい') || value.includes('学生') || value == 'true') return 'student';
    if (value.includes('いいえ') || value.includes('社会人') || value.includes('転職') || value.includes('既卒')) return 'career_change_and_job_hunt';
  }
  const blob = entries.map((kv) => String(kv[1] || '').trim().toLowerCase()).join(' ');
  if (blob.includes('インターン')) return 'student';
  if (blob.includes('就活') || blob.includes('転職')) return 'career_change_and_job_hunt';
  return '';
}

function isPartnerAssignee(row: Record<string, string>): boolean {
  return (row['assignee_kind'] || '').trim().toLowerCase() === 'partner';
}

function buildAssigneeNameById(assigneeRows: Array<Record<string, string>>): Map<string, string> {
  const assigneeNameById = new Map<string, string>();
  assigneeRows.forEach((row) => {
    const assigneeId = row['coach_id'] || '';
    if (assigneeId && !assigneeNameById.has(assigneeId)) assigneeNameById.set(assigneeId, row['coach_name'] || '');
  });
  return assigneeNameById;
}

function buildAssigneeIdByScope(assigneeRows: Array<Record<string, string>>): Map<string, string> {
  const byScope = new Map<string, string>();
  assigneeRows.forEach((row) => {
    const scope = row['assignee_scope'] || '';
    const coachId = row['coach_id'] || '';
    if (scope && coachId && !byScope.has(scope)) byScope.set(scope, coachId);
  });
  return byScope;
}

function buildCurrentPartnerAssignmentByLeadId(assignmentRows: Array<Record<string, string>>): Map<string, Record<string, string>> {
  const assignmentByLeadId = new Map<string, Record<string, string>>();
  assignmentRows
    .slice()
    .filter((row) => (row['lead_id'] || row['customer_id'] || '') && (row['assignee_kind'] || '').toLowerCase() === 'partner')
    .sort((a, b) => {
      const aDate = a['updated_at'] || a['assigned_at'] || a['created_at'] || '';
      const bDate = b['updated_at'] || b['assigned_at'] || b['created_at'] || '';
      return bDate.localeCompare(aDate);
    })
    .forEach((row) => {
      const leadId = row['lead_id'] || row['customer_id'] || '';
      if (leadId && !assignmentByLeadId.has(leadId)) assignmentByLeadId.set(leadId, row);
    });
  return assignmentByLeadId;
}

function buildCustomerByEmail(customerRows: Array<Record<string, string>>): Map<string, Record<string, string>> {
  const customerByEmail = new Map<string, Record<string, string>>();
  customerRows.forEach((row) => {
    const email = normalizeEmail(row['email'] || '');
    if (email && !customerByEmail.has(email)) customerByEmail.set(email, row);
  });
  return customerByEmail;
}

function buildCustomerByNormalizedName(customerRows: Array<Record<string, string>>): Map<string, Record<string, string>> {
  const customerByName = new Map<string, Record<string, string>>();
  customerRows.forEach((row) => {
    const name = normalizeName(row['customer_name'] || '');
    if (name && !customerByName.has(name)) customerByName.set(name, row);
  });
  return customerByName;
}

export function buildCsAssignmentInput(
  applicationRows: Array<Record<string, string>>,
  customerRows: Array<Record<string, string>>,
  assigneeRows: Array<Record<string, string>>,
  assignmentRows: Array<Record<string, string>>,
  existingInputRows: Array<Record<string, string>> = [],
): Array<Array<string>> {
  const header = CS_ASSIGNMENT_INPUT_HEADER as unknown as string[];
  const partnerAssigneeRows = assigneeRows.filter((row) => isPartnerAssignee(row));
  const assigneeNameById = buildAssigneeNameById(partnerAssigneeRows);
  const assigneeIdByScope = buildAssigneeIdByScope(partnerAssigneeRows);
  const customerByEmail = buildCustomerByEmail(customerRows);
  const customerByName = buildCustomerByNormalizedName(customerRows);
  const currentAssignmentByLeadId = buildCurrentPartnerAssignmentByLeadId(assignmentRows);
  const existingInputByKey = new Map<string, Record<string, string>>();

  existingInputRows.forEach((row) => {
    const key = partnerAssignmentInputKey(row['lead_id'] || '', row['form_response_sheet'] || '', row['form_response_row'] || '');
    if (key) existingInputByKey.set(key, row);
  });

  const rows = applicationRows
    .map((row) => {
      const respondentEmail = normalizeEmail(row['respondent_email'] || row['email'] || '');
      const leadDisplayName = row['lead_display_name'] || row['respondent_name'] || row['customer_name'] || '';
      const matchedCustomer = customerByEmail.get(respondentEmail) || customerByName.get(normalizeName(leadDisplayName)) || {};
      const customerId = matchedCustomer['customer_id'] || row['customer_id'] || '';
      const customerName = matchedCustomer['customer_name'] || row['customer_name'] || leadDisplayName;
      const leadId = customerId || row['lead_id'] || '';
      if (!leadId) return null;
      const assignment = currentAssignmentByLeadId.get(leadId) || {};
      if (assignment['assignment_id']) return null;
      const currentAssigneeId = assignment['coach_id'] || '';
      const currentAssigneeName = assigneeNameById.get(currentAssigneeId) || '';
      const existingKey = partnerAssignmentInputKey(leadId, row['form_response_sheet'] || '', row['form_response_row'] || '');
      const existingInput = existingInputByKey.get(existingKey) || {};
      const shouldPreserveOperatorInput = ((existingInput['sync_status'] || '').trim().toLowerCase() !== 'processed');
      const suggestedAssigneeScope = inferSuggestedPartnerScope(row);
      const suggestedAssigneeId = assigneeIdByScope.get(suggestedAssigneeScope) || '';
      const suggestedAssigneeName = assigneeNameById.get(suggestedAssigneeId) || '';

      return [
        suggestedAssigneeId ? 'P1' : 'P2',
        leadDisplayName,
        respondentEmail,
        row['phone'] || '',
        row['age'] || '',
        suggestedAssigneeName,
        currentAssigneeName,
        localizeAssigneeType('partner'),
        shouldPreserveOperatorInput ? (existingInput['operator_decision_status'] || '') : '',
        shouldPreserveOperatorInput ? (existingInput['operator_selected_assignee_name'] || suggestedAssigneeName || currentAssigneeName) : (suggestedAssigneeName || currentAssigneeName),
        shouldPreserveOperatorInput ? (existingInput['assignment_note'] || '') : '',
        leadId,
        customerId,
        customerName,
        suggestedAssigneeId,
        currentAssigneeId,
        suggestedAssigneeScope,
        row['form_response_sheet'] || '',
        row['form_response_row'] || '',
        shouldPreserveOperatorInput ? (existingInput['sync_status'] || '') : '',
        shouldPreserveOperatorInput ? (existingInput['last_collected_at'] || '') : '',
      ];
    })
    .filter((row): row is string[] => Boolean(row));

  return [header, ...rows];
}

export function buildSalesReadme(): Array<Array<string>> {
  return [
    ['section', 'content'],
    ['purpose', '営業向けの参照ブックです。契約状況、未入金、最近のファネル変化を確認するために使います。'],
    ['read_first', '契約確認は 営業_契約一覧、未入金確認は 営業_未入金一覧、最近の動き確認は 営業_ファネル推移 の順で見てください。'],
    ['publish_only', 'このブックは参照専用です。公開行を直接編集せず、必要な修正は DB / CS 側フローで行ってください。'],
    ['writeback_policy', '現時点では sales 用 writeback はありません。修正や alias 解決は DB / CS 側の運用フローで対応してください。'],
    ['matching_note', '未紐づけの入金行は、営業とCSが顧客特定を進められるよう意図的にそのまま表示しています。'],
    ['do_not_edit', 'customer_id、matching 系列、source 系列は確認用です。手で上書きしないでください。'],
  ];
}

export function buildSalesContractsView(
  stagingPaymentRows: Array<Record<string, string>>,
  customerRows: Array<Record<string, string>>,
  assignmentRows: Array<Record<string, string>>,
  coachRows: Array<Record<string, string>>,
): Array<Array<string>> {
  const header = [
    'priority', 'payment_status', 'contract_date', 'paid_date', 'canonical_customer_name', 'payment_customer_name',
    'payment_line_name', 'plan_name', 'amount', 'segment', 'sales_owner_name', 'current_status',
    'assigned_coach_name', 'customer_id', 'customer_match_method', 'note', 'source_sheet', 'source_row',
  ];

  const customerById = buildCustomerById(customerRows);
  const assignmentByCustomerId = buildCurrentCoachAssignmentByCustomerId(assignmentRows);
  const coachById = buildCoachById(coachRows);

  const rows = stagingPaymentRows
    .slice()
    .sort((a, b) => {
      const aDate = a['contract_date'] || a['paid_date'] || '';
      const bDate = b['contract_date'] || b['paid_date'] || '';
      if (aDate !== bDate) return compareDateValuesDesc(aDate, bDate);
      return (b['source_row'] || '').localeCompare(a['source_row'] || '');
    })
    .map((row) => {
      const customer = customerById.get(row['customer_id'] || '') || {};
      const paid = isPaid(row);
      const matched = Boolean(row['customer_id'] || '');
      const priority = !matched ? 'P1' : (!paid ? 'P1' : 'P3');
      return [
        priority,
        localizePaymentStatus(paid ? 'paid' : 'pending'),
        formatViewDate(row['contract_date'] || ''),
        formatViewDate(row['paid_date'] || ''),
        customer['customer_name'] || '',
        row['customer_name'] || '',
        row['line_name'] || '',
        row['plan_name_raw'] || '',
        row['amount_numeric'] || '',
        row['segment'] || '',
        row['sales_owner_name'] || '',
        localizeCurrentStatus(customer['current_status'] || ''),
        resolveAssignedCoachName(row['customer_id'] || '', customer['assigned_coach_name'] || '', assignmentByCustomerId, coachById),
        row['customer_id'] || '',
        row['customer_match_method'] || '',
        row['note'] || '',
        row['source_sheet'] || '',
        row['source_row'] || '',
      ];
    });

  return [header, ...rows];
}

export function buildSalesPendingPaymentsView(
  stagingPaymentRows: Array<Record<string, string>>,
  customerRows: Array<Record<string, string>>,
  assignmentRows: Array<Record<string, string>>,
  coachRows: Array<Record<string, string>>,
): Array<Array<string>> {
  const header = [
    'priority', 'contract_date', 'canonical_customer_name', 'payment_customer_name', 'sales_owner_name', 'plan_name',
    'amount', 'segment', 'current_status', 'assigned_coach_name', 'customer_id', 'customer_match_method', 'source_sheet', 'source_row',
  ];

  const customerById = buildCustomerById(customerRows);
  const assignmentByCustomerId = buildCurrentCoachAssignmentByCustomerId(assignmentRows);
  const coachById = buildCoachById(coachRows);

  const rows = stagingPaymentRows
    .filter((row) => !isPaid(row))
    .sort((a, b) => compareDateValuesDesc(a['contract_date'] || '', b['contract_date'] || ''))
    .map((row) => {
      const customer = customerById.get(row['customer_id'] || '') || {};
      return [
        row['customer_id'] ? 'P1' : 'P0',
        formatViewDate(row['contract_date'] || ''),
        customer['customer_name'] || '',
        row['customer_name'] || '',
        row['sales_owner_name'] || '',
        row['plan_name_raw'] || '',
        row['amount_numeric'] || '',
        row['segment'] || '',
        localizeCurrentStatus(customer['current_status'] || ''),
        resolveAssignedCoachName(row['customer_id'] || '', customer['assigned_coach_name'] || '', assignmentByCustomerId, coachById),
        row['customer_id'] || '',
        row['customer_match_method'] || '',
        row['source_sheet'] || '',
        row['source_row'] || '',
      ];
    });

  return [header, ...rows];
}

export function buildSalesFunnelEventsView(
  conversionRows: Array<Record<string, string>>,
  customerRows: Array<Record<string, string>>,
  assignmentRows: Array<Record<string, string>>,
  coachRows: Array<Record<string, string>>,
): Array<Array<string>> {
  const header = [
    'event_date', 'event_type', 'customer_name', 'current_status', 'assigned_coach_name', 'changed_by', 'note', 'customer_id',
  ];

  const customerById = buildCustomerById(customerRows);
  const assignmentByCustomerId = buildCurrentCoachAssignmentByCustomerId(assignmentRows);
  const coachById = buildCoachById(coachRows);

  const rows = conversionRows
    .slice()
    .sort((a, b) => compareDateValuesDesc(a['event_date'] || '', b['event_date'] || ''))
    .map((row) => {
      const customer = customerById.get(row['customer_id'] || '') || {};
      return [
        formatViewDate(row['event_date'] || ''),
        localizeEventType(row['event_type'] || ''),
        customer['customer_name'] || '',
        localizeCurrentStatus(customer['current_status'] || ''),
        resolveAssignedCoachName(row['customer_id'] || '', customer['assigned_coach_name'] || '', assignmentByCustomerId, coachById),
        row['changed_by'] || '',
        row['note'] || '',
        row['customer_id'] || '',
      ];
    });

  return [header, ...rows];
}

export function buildSalesDataHealth(
  stagingPaymentRows: Array<Record<string, string>>,
  plansRows: Array<Record<string, string>>,
  paymentsRows: Array<Record<string, string>>,
  conversionRows: Array<Record<string, string>>,
): Array<Array<string>> {
  const unmatchedPayments = stagingPaymentRows.filter((row) => !(row['customer_id'] || '')).length;
  const pendingPayments = stagingPaymentRows.filter((row) => !isPaid(row)).length;
  const paidPayments = stagingPaymentRows.filter((row) => isPaid(row)).length;
  const lostEvents = conversionRows.filter((row) => (row['event_type'] || '') === 'lost').length;
  const contractedEvents = conversionRows.filter((row) => (row['event_type'] || '') === 'contracted').length;

  return [
    ['metric', 'value', 'note'],
    ['staging_payments_count', String(stagingPaymentRows.length), '営業向けに現在表示されている commercial source 行数です。'],
    ['payment_unmatched_count', String(unmatchedPayments), 'canonical customer に未紐づけの入金行件数です。'],
    ['pending_payment_count', String(pendingPayments), 'paid_flag が TRUE ではない行件数です。'],
    ['paid_payment_count', String(paidPayments), 'paid_flag が TRUE の行件数です。'],
    ['plans_count', String(plansRows.length), 'canonical Plans の行数です。'],
    ['payments_count', String(paymentsRows.length), 'canonical Payments の行数です。'],
    ['contracted_events_count', String(contractedEvents), 'ConversionHistory の event_type=contracted 件数です。'],
    ['lost_events_count', String(lostEvents), 'ConversionHistory の event_type=lost 件数です。'],
  ];
}

export function buildCoachReadme(): Array<Array<string>> {
  return [
    ['section', 'content'],
    ['purpose', 'コーチ向けの参照ブックです。担当負荷と要フォロー顧客を確認するために使います。'],
    ['read_first', '全体の負荷確認は コーチ_担当負荷、個別フォロー確認は コーチ_要フォロー一覧 の順で見てください。'],
    ['publish_only', 'このブックは参照専用です。公開行を直接編集せず、必要な修正は DB / CS 側フローで行ってください。'],
    ['writeback_policy', '現時点では coach 用 writeback はありません。修正が必要な場合は DB / CS 側の運用フローを使ってください。'],
    ['data_freshness', 'runPublishAll（毎時）と runFullRefresh（毎日 07:00 JST）で更新されます。'],
    ['do_not_edit', '優先度、警告フラグ、ID列は参照用です。手で上書きしないでください。'],
  ];
}

export function buildCoachLoadView(coachLoadRows: Array<Record<string, string>>): Array<Array<string>> {
  const header = [
    'coach_name', 'active_customer_count', 'session_count', 'followup_customer_count',
    'low_satisfaction_feedback_count', 'remaining_capacity', 'coach_id',
  ];
  const rows = coachLoadRows
    .slice()
    .sort((a, b) => {
      const aFollowup = Number(a['followup_customer_count'] || '0');
      const bFollowup = Number(b['followup_customer_count'] || '0');
      if (aFollowup !== bFollowup) return bFollowup - aFollowup;
      const aActive = Number(a['active_customer_count'] || '0');
      const bActive = Number(b['active_customer_count'] || '0');
      return bActive - aActive;
    })
    .map((r) => [
      r['coach_name'] || '',
      r['active_customer_count'] || '',
      r['session_count'] || '',
      r['followup_customer_count'] || '',
      r['low_satisfaction_feedback_count'] || '',
      r['remaining_capacity'] || '',
      r['coach_id'] || '',
    ]);
  return [header, ...rows];
}

export function buildCoachFollowupAlertsView(feedbackRows: Array<Record<string, string>>): Array<Array<string>> {
  const header = [
    'priority', 'low_satisfaction_flag', 'feedback_date', 'customer_name', 'coach_name',
    'followup_reason', 'comment', 'gap_comment', 'customer_id', 'feedback_id',
  ];
  const rows = feedbackRows
    .slice()
    .sort((a, b) => {
      const aPriority = a['priority'] || (a['low_satisfaction_flag'] === 'TRUE' ? 'P1' : 'P2');
      const bPriority = b['priority'] || (b['low_satisfaction_flag'] === 'TRUE' ? 'P1' : 'P2');
      if (aPriority !== bPriority) return aPriority.localeCompare(bPriority);
      return compareDateValuesDesc(a['feedback_date'] || '', b['feedback_date'] || '');
    })
    .map((r) => [
      r['priority'] || (r['low_satisfaction_flag'] === 'TRUE' ? 'P1' : 'P2'),
      localizeBooleanFlag(r['low_satisfaction_flag'] || ''),
      formatViewDateTime(r['feedback_date'] || ''),
      r['customer_name'] || '',
      r['feedback_coach_name'] || r['assigned_coach_name'] || r['coach_name'] || '',
      localizeFollowupReason(r['followup_reason'] || ''),
      r['comment'] || '',
      r['gap_comment'] || '',
      r['customer_id'] || '',
      r['feedback_id'] || '',
    ]);
  return [header, ...rows];
}

export function buildCoachDataHealth(
  coachLoadRows: Array<Record<string, string>>,
  followupRows: Array<Record<string, string>>,
): Array<Array<string>> {
  const lowSatisfactionCount = followupRows.filter((r) => (r['low_satisfaction_flag'] || '') === 'TRUE').length;
  const coachesWithFollowup = coachLoadRows.filter((r) => Number(r['followup_customer_count'] || '0') > 0).length;
  const totalActiveCustomers = coachLoadRows.reduce((sum, r) => sum + Number(r['active_customer_count'] || '0'), 0);
  const totalRemainingCapacity = coachLoadRows.reduce((sum, r) => sum + Number(r['remaining_capacity'] || '0'), 0);

  return [
    ['metric', 'value', 'note'],
    ['coach_count', String(coachLoadRows.length), 'Ops_コーチ_担当負荷 に現在表示されているコーチ人数です。'],
    ['followup_customer_count', String(followupRows.length), 'Ops_Followup_Queue に載っているフォロー対象件数です。'],
    ['low_satisfaction_feedback_count', String(lowSatisfactionCount), 'low_satisfaction_flag=TRUE のフォロー対象件数です。'],
    ['coaches_with_followup_count', String(coachesWithFollowup), '現在フォロー対象顧客を1件以上持つコーチ人数です。'],
    ['active_customer_total', String(totalActiveCustomers), '全コーチの active_customer_count 合計です。'],
    ['remaining_capacity_total', String(totalRemainingCapacity), '全コーチの remaining_capacity 合計です。'],
  ];
}

function resolvePartnerPriority(row: Record<string, string>, staleDays: number): string {
  if ((row['assignment_status'] || '').toLowerCase() !== 'active') return 'P3';
  if (staleDays >= 30) return 'P1';
  if (!(row['meeting_status'] || '')) return 'P1';
  if (!(row['potex_sale_status'] || '') || !(row['recruitment_status'] || '')) return 'P2';
  return 'P3';
}

function daysSince(timestamp: string, now: Date): number {
  const raw = String(timestamp || '').trim();
  if (!raw) return 9999;
  const parsed = new Date(raw);
  const time = parsed.getTime();
  if (Number.isNaN(time)) return 9999;
  return Math.floor((now.getTime() - time) / (1000 * 60 * 60 * 24));
}

function buildCurrentPlanStatusByCustomerId(plansRows: Array<Record<string, string>>): Map<string, string> {
  const byCustomerId = new Map<string, string>();
  const currentPlanByCustomerId = buildCurrentPlanByCustomerId(plansRows);
  currentPlanByCustomerId.forEach((row, customerId) => {
    byCustomerId.set(customerId, row['status'] || '');
  });
  return byCustomerId;
}

function buildPartnerAssignmentRows(
  assignmentRows: Array<Record<string, string>>,
  partnerCoachId: string,
): Array<Record<string, string>> {
  return assignmentRows
    .slice()
    .filter((row) =>
      (row['coach_id'] || '') === partnerCoachId
      && (row['assignee_kind'] || '').toLowerCase() === 'partner'
      && (row['assignment_status'] || '').toLowerCase() !== 'ended'
      && !(row['ended_at'] || ''))
    .sort((a, b) => {
      const aDate = a['assigned_at'] || a['updated_at'] || a['created_at'] || '';
      const bDate = b['assigned_at'] || b['updated_at'] || b['created_at'] || '';
      return bDate.localeCompare(aDate);
    });
}

function buildPartnerDisplayName(
  assignment: Record<string, string>,
  customerById: Map<string, Record<string, string>>,
): string {
  const customer = customerById.get(assignment['customer_id'] || '') || {};
  return assignment['lead_display_name'] || customer['customer_name'] || assignment['customer_id'] || assignment['lead_id'] || '';
}

export function buildPartnerReadme(partnerName: string): Array<Array<string>> {
  return [
    ['section', 'content'],
    ['purpose', `${partnerName}専用の担当lead / status workbook です。CSが割り当てたleadだけが表示されます。`],
    ['safe_tabs', 'パートナー_担当リード は参照用、パートナー_状況入力 は本人更新用、パートナー_データ状況 は件数/滞留確認用です。'],
    ['writeback_policy', 'パートナー_状況入力 では operator_* 列のみ編集し、submit_update に TRUE を入れて runWritebackCollection で反映します。assignment 操作は CS 側でのみ行います。'],
    ['status_vocab_meeting', 'meeting_status 推奨語彙: none / scheduled / completed / no_show / cancelled'],
    ['status_vocab_sale', 'potex_sale_status 推奨語彙: none / introduced / in_discussion / lost'],
    ['status_vocab_recruitment', 'recruitment_status 推奨語彙: none / intern_intro / intern_active / selection / closed / lost / unreachable'],
    ['stale_rule', 'last_partner_update_at または assigned_at から 30日以上更新がなければ stale として Data_Health で警告されます。'],
  ];
}

export function buildPartnerAssignedLeadsView(
  partnerName: string,
  partnerCoachId: string,
  assignmentRows: Array<Record<string, string>>,
  customerRows: Array<Record<string, string>>,
  plansRows: Array<Record<string, string>>,
): Array<Array<string>> {
  const header = [
    'assigned_at', 'lead_display_name', 'meeting_status', 'potex_sale_status', 'recruitment_status',
    'partner_status_note', 'last_partner_update_at', 'current_plan_name', 'current_plan_status', 'lead_id', 'customer_id', 'coach_id',
  ];
  const customerById = buildCustomerById(customerRows);
  const planByCustomerId = buildCurrentPlanByCustomerId(plansRows);
  const partnerAssignments = buildPartnerAssignmentRows(assignmentRows, partnerCoachId);
  const rows = partnerAssignments.map((assignment) => {
    const customerId = assignment['customer_id'] || '';
    const currentPlan = planByCustomerId.get(customerId) || {};
    return [
      assignment['assigned_at'] || '',
      buildPartnerDisplayName(assignment, customerById),
      assignment['meeting_status'] || '',
      assignment['potex_sale_status'] || '',
      assignment['recruitment_status'] || '',
      assignment['partner_status_note'] || '',
      assignment['last_partner_update_at'] || '',
      currentPlan['plan_name'] || '',
      currentPlan['status'] || '',
      assignment['lead_id'] || '',
      customerId,
      partnerCoachId,
    ];
  });
  return [header, ...rows];
}

export function buildPartnerStatusInput(
  partnerCoachId: string,
  assignmentRows: Array<Record<string, string>>,
  customerRows: Array<Record<string, string>>,
  plansRows: Array<Record<string, string>>,
  existingInputRows: Array<Record<string, string>> = [],
): Array<Array<string>> {
  const header = PARTNER_STATUS_INPUT_HEADER as unknown as string[];
  const customerById = buildCustomerById(customerRows);
  const planByCustomerId = buildCurrentPlanByCustomerId(plansRows);
  const planStatusByCustomerId = buildCurrentPlanStatusByCustomerId(plansRows);
  const existingByLeadId = new Map<string, Record<string, string>>();
  existingInputRows.forEach((row) => {
    const leadId = row['lead_id'] || '';
    if (leadId) existingByLeadId.set(leadId, row);
  });
  const now = new Date();

  const rows = buildPartnerAssignmentRows(assignmentRows, partnerCoachId).map((assignment) => {
    const customerId = assignment['customer_id'] || '';
    const customer = customerById.get(customerId) || {};
    const existing = existingByLeadId.get(assignment['lead_id'] || '') || {};
    const shouldPreserve = ((existing['sync_status'] || '').trim().toLowerCase() !== 'processed');
    const lastUpdatedAnchor = assignment['last_partner_update_at'] || assignment['assigned_at'] || assignment['updated_at'] || assignment['created_at'] || '';
    const staleDays = daysSince(lastUpdatedAnchor, now);
    return [
      resolvePartnerPriority(assignment, staleDays),
      buildPartnerDisplayName(assignment, customerById),
      assignment['respondent_email'] || customer['email'] || '',
      assignment['phone'] || customer['phone'] || '',
      assignment['age'] || customer['age'] || '',
      assignment['assigned_at'] || '',
      assignment['meeting_status'] || '',
      assignment['meeting_done_at'] || '',
      assignment['potex_sale_status'] || '',
      assignment['recruitment_status'] || '',
      assignment['partner_status_note'] || '',
      planByCustomerId.get(customerId)?.['plan_name'] || '',
      planStatusByCustomerId.get(customerId) || '',
      shouldPreserve ? (existing['operator_meeting_status'] || assignment['meeting_status'] || '') : (assignment['meeting_status'] || ''),
      shouldPreserve ? (existing['operator_meeting_done_at'] || assignment['meeting_done_at'] || '') : (assignment['meeting_done_at'] || ''),
      shouldPreserve ? (existing['operator_potex_sale_status'] || assignment['potex_sale_status'] || '') : (assignment['potex_sale_status'] || ''),
      shouldPreserve ? (existing['operator_recruitment_status'] || assignment['recruitment_status'] || '') : (assignment['recruitment_status'] || ''),
      shouldPreserve ? (existing['operator_partner_status_note'] || assignment['partner_status_note'] || '') : (assignment['partner_status_note'] || ''),
      shouldPreserve ? (existing['submit_update'] || '') : '',
      assignment['lead_id'] || '',
      customerId,
      partnerCoachId,
      shouldPreserve ? (existing['sync_status'] || '') : '',
      shouldPreserve ? (existing['last_collected_at'] || '') : '',
    ];
  });

  return [header, ...rows];
}

export function buildPartnerDataHealth(
  partnerName: string,
  partnerCoachId: string,
  assignmentRows: Array<Record<string, string>>,
): Array<Array<string>> {
  const partnerAssignments = buildPartnerAssignmentRows(assignmentRows, partnerCoachId);
  const now = new Date();
  const staleRows = partnerAssignments.filter((row) => {
    const anchor = row['last_partner_update_at'] || row['assigned_at'] || row['updated_at'] || row['created_at'] || '';
    return daysSince(anchor, now) >= 30;
  });
  const completedMeetings = partnerAssignments.filter((row) => (row['meeting_status'] || '').toLowerCase() === 'completed').length;
  const potexInProgress = partnerAssignments.filter((row) => ['introduced', 'in_discussion'].includes((row['potex_sale_status'] || '').toLowerCase())).length;
  const recruitmentActive = partnerAssignments.filter((row) => ['intern_intro', 'intern_active', 'selection'].includes((row['recruitment_status'] || '').toLowerCase())).length;

  return [
    ['metric', 'value', 'note'],
    ['partner_name', partnerName, '担当パートナー名です。'],
    ['assigned_lead_count', String(partnerAssignments.length), 'canonical assignment table に現在表示されている有効lead件数です。'],
    ['stale_30d_count', String(staleRows.length), 'last_partner_update_at または assigned_at から30日以上経過した件数です。'],
    ['meeting_completed_count', String(completedMeetings), 'meeting_status=completed の件数です。'],
    ['potex_in_progress_count', String(potexInProgress), 'potex_sale_status が introduced / in_discussion の件数です。'],
    ['recruitment_active_count', String(recruitmentActive), 'recruitment_status が intern_intro / intern_active / selection の件数です。'],
  ];
}
