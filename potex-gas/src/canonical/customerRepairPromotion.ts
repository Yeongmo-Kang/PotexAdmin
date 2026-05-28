import { LINE_REGISTRATION_SOURCE_HINTS } from '../constants.ts';

export type Row = Record<string, string>;

export type CustomerActivity = {
  planCount?: number;
  paymentCount?: number;
  feedbackCount?: number;
  channelLinkCount?: number;
  conversionCount?: number;
};

export type ApplyCustomerRepairNameMatchPromotionsInput = {
  customers: Row[];
  stagingRows: Row[];
  candidates: Row[];
  syncedAt: string;
  activityByCustomerId?: Record<string, CustomerActivity>;
};

export type ApplyCustomerRepairNameMatchPromotionsResult = {
  customers: Row[];
  appliedCount: number;
  unresolvedAmbiguousCount: number;
};

function appendNote(note: string, marker: string): string {
  const trimmedNote = String(note || '').trim();
  if (!trimmedNote) return marker;
  if (trimmedNote.includes(marker)) return trimmedNote;
  return `${trimmedNote} | ${marker}`;
}

function setIfBlank(target: Row, key: string, value: string): void {
  if (!value) return;
  if (String(target[key] || '').trim()) return;
  target[key] = value;
}

function normalizeName(value: string): string {
  return String(value || '').replace(/[\s　]/g, '').trim().toLowerCase();
}

function customerActivityScore(activity: CustomerActivity | undefined): number {
  if (!activity) return 0;
  return (
    (activity.planCount || 0) * 10
    + (activity.paymentCount || 0) * 8
    + (activity.feedbackCount || 0) * 5
    + (activity.conversionCount || 0) * 2
    + (activity.channelLinkCount || 0)
  );
}

function lineRegistrationSourcePreference(lineRegistrationId: string): number {
  const normalized = String(lineRegistrationId || '').trim().toLowerCase();
  if (!normalized) return 0;
  if (normalized.includes(LINE_REGISTRATION_SOURCE_HINTS.CSV_D)) return 2;
  if (normalized.includes(LINE_REGISTRATION_SOURCE_HINTS.CSV_POTEX)) return 1;
  return 0;
}

function pickActivityResolvedCustomerId(
  candidate: Row,
  customers: Row[],
  activityByCustomerId: Record<string, CustomerActivity>,
): string {
  const nameKey = normalizeName(candidate['customer_name'] || '');
  if (!nameKey) return '';
  const matches = customers.filter((row) => normalizeName(row['customer_name'] || '') === nameKey);
  if (matches.length < 2) return '';

  const ranked = matches
    .map((row) => ({
      customerId: row['customer_id'] || '',
      score: customerActivityScore(activityByCustomerId[row['customer_id'] || '']),
      channelPreference: lineRegistrationSourcePreference(row['line_registration_id'] || ''),
    }))
    .sort((a, b) => b.score - a.score || b.channelPreference - a.channelPreference || a.customerId.localeCompare(b.customerId));

  if (!ranked[0]?.customerId || ranked[0].score <= 0) return '';
  if (ranked[1] && ranked[0].score === ranked[1].score && ranked[0].channelPreference === ranked[1].channelPreference) return '';
  return ranked[0].customerId;
}

export function applyCustomerRepairNameMatchPromotions(
  input: ApplyCustomerRepairNameMatchPromotionsInput,
): ApplyCustomerRepairNameMatchPromotionsResult {
  const { customers, stagingRows, candidates, syncedAt, activityByCustomerId = {} } = input;
  const nextCustomers = customers.map((row) => ({ ...row }));
  const customerIndexById = new Map<string, number>();
  nextCustomers.forEach((row, index) => {
    const customerId = row['customer_id'] || '';
    if (customerId && !customerIndexById.has(customerId)) customerIndexById.set(customerId, index);
  });

  const stagingBySourceKey = new Map<string, Row>();
  stagingRows.forEach((row) => {
    const sourceSheet = row['source_sheet'] || '';
    const sourceRow = row['source_row'] || '';
    const key = `${sourceSheet}::${sourceRow}`;
    if (key !== '::' && !stagingBySourceKey.has(key)) stagingBySourceKey.set(key, row);
  });

  let appliedCount = 0;
  let unresolvedAmbiguousCount = 0;
  candidates.forEach((candidate) => {
    let customerId = '';
    let noteMarkerPrefix = '';
    const action = candidate['proposed_action'] || '';
    if (action === 'update_existing_from_name_match') {
      customerId = candidate['matched_customer_id'] || '';
      noteMarkerPrefix = 'customer_repair_name_match';
    } else if (action === 'review_ambiguous_before_update') {
      customerId = pickActivityResolvedCustomerId(candidate, nextCustomers, activityByCustomerId);
      noteMarkerPrefix = 'customer_repair_activity_match';
      if (!customerId) {
        unresolvedAmbiguousCount += 1;
        return;
      }
    } else {
      return;
    }
    const customerIndex = customerIndexById.get(customerId);
    if (customerIndex === undefined) return;

    const sourceSheet = candidate['source_sheet'] || '';
    const sourceRow = candidate['source_row'] || '';
    const staging = stagingBySourceKey.get(`${sourceSheet}::${sourceRow}`);
    if (!staging) return;

    const current = { ...nextCustomers[customerIndex] };
    current['customer_name'] = staging['customer_name'] || current['customer_name'] || '';
    setIfBlank(current, 'furigana', staging['furigana'] || '');
    setIfBlank(current, 'email', staging['email'] || '');
    setIfBlank(current, 'phone', staging['phone'] || '');
    setIfBlank(current, 'contact_email', staging['email'] || '');
    setIfBlank(current, 'contact_phone', staging['phone'] || '');
    setIfBlank(current, 'age', staging['age'] || '');
    setIfBlank(current, 'line_registration_id', staging['line_registration_id'] || '');
    setIfBlank(current, 'first_contact_date', staging['created_at'] || '');
    setIfBlank(current, 'matching_contact_date', staging['matching_contact_date'] || '');
    setIfBlank(current, 'desired_plan_from_form', staging['desired_plan_from_form'] || '');
    setIfBlank(current, 'program_completed_flag', staging['program_completed_flag'] || '');
    setIfBlank(current, 'assigned_coach_name', staging['assigned_coach_name'] || '');
    setIfBlank(current, 'course_name', staging['course_name'] || '');
    if (staging['current_status']) current['current_status'] = staging['current_status'];
    if (staging['app_status']) current['app_status'] = staging['app_status'];
    if (staging['lifecycle_status']) current['lifecycle_status'] = staging['lifecycle_status'];
    if (sourceSheet) current['source_sheet'] = sourceSheet;
    if (sourceRow) current['source_row'] = sourceRow;
    current['updated_at'] = syncedAt;
    current['note'] = appendNote(current['note'] || '', `${noteMarkerPrefix}:${sourceSheet}#${sourceRow}`);

    nextCustomers[customerIndex] = current;
    appliedCount += 1;
  });

  return { customers: nextCustomers, appliedCount, unresolvedAmbiguousCount };
}
