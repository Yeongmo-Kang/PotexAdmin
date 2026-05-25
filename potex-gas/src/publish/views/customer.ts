type Row = Record<string, string>;

const CUSTOMER_CONTRACTED_VIEW_HEADER = [
  'customer_id',
  '表示名',
  '成約日',
  '成約後経過月数',
  '現プラン',
  'AFS状態',
  '担当コーチ',
  '直近入金日',
  '未入金フラグ',
  'LINE状態',
  '要対応フラグ',
  'アップグレード余地',
  '今後提案可能性',
  'last_synced_at',
] as const;

function parseIsoDate(value: string): Date | null {
  const text = String(value || '').trim();
  if (!text) return null;
  const normalized = text.replace(/[.]/g, '-').replace(/\//g, '-');
  const match = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (!match) return null;
  const parsed = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4] || '0'),
    Number(match[5] || '0'),
    Number(match[6] || '0'),
  );
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function diffMonths(from: Date, to: Date): number {
  const days = Math.floor((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
  if (days < 0) return 0;
  return Math.floor(days / 30);
}

function buildContractedSet(
  plansRows: Row[],
  paymentsRows: Row[],
): {
  contractedCustomerIds: Set<string>;
  contractDateByCustomerId: Map<string, string>;
  currentPlanNameByCustomerId: Map<string, string>;
  afsStatusByCustomerId: Map<string, 'none' | 'active' | 'ended'>;
  recentPaymentDateByCustomerId: Map<string, string>;
  hasUnpaidByCustomerId: Map<string, boolean>;
} {
  const contractedCustomerIds = new Set<string>();
  const contractDateByCustomerId = new Map<string, string>();
  const currentPlanNameByCustomerId = new Map<string, string>();
  const afsStatusByCustomerId = new Map<string, 'none' | 'active' | 'ended'>();

  plansRows.forEach((row) => {
    const customerId = row['customer_id'] || '';
    if (!customerId) return;
    contractedCustomerIds.add(customerId);
    const contractDate = row['contract_date'] || '';
    const existing = contractDateByCustomerId.get(customerId);
    if (contractDate && (!existing || contractDate < existing)) {
      contractDateByCustomerId.set(customerId, contractDate);
    }
    const planType = (row['plan_type'] || '').toLowerCase();
    const planName = row['plan_name'] || '';
    const status = (row['status'] || '').toLowerCase();
    const isAfs = planType.includes('afs') || planType.includes('after') || planName.includes('AFS') || planName.includes('アフター');
    if (isAfs) {
      const currentAfs = afsStatusByCustomerId.get(customerId);
      if (status === 'active' || status === '進行中' || status === '稼働' || status === '') {
        afsStatusByCustomerId.set(customerId, 'active');
      } else if (status === 'ended' || status === '終了' || status === 'closed' || status === '完了') {
        if (currentAfs !== 'active') afsStatusByCustomerId.set(customerId, 'ended');
      }
    }
    if (status === 'active' || status === '進行中' || status === '稼働' || status === '') {
      if (!isAfs || !currentPlanNameByCustomerId.has(customerId)) {
        currentPlanNameByCustomerId.set(customerId, planName);
      }
    } else if (!currentPlanNameByCustomerId.has(customerId)) {
      currentPlanNameByCustomerId.set(customerId, planName);
    }
  });

  contractedCustomerIds.forEach((customerId) => {
    if (!afsStatusByCustomerId.has(customerId)) afsStatusByCustomerId.set(customerId, 'none');
  });

  const recentPaymentDateByCustomerId = new Map<string, string>();
  const hasUnpaidByCustomerId = new Map<string, boolean>();
  paymentsRows.forEach((row) => {
    const customerId = row['customer_id'] || '';
    if (!customerId) return;
    const paymentDate = row['payment_date'] || '';
    const status = (row['payment_status'] || '').toLowerCase();
    if (paymentDate) {
      const existing = recentPaymentDateByCustomerId.get(customerId) || '';
      if (paymentDate > existing) recentPaymentDateByCustomerId.set(customerId, paymentDate);
    }
    if (status === 'unpaid' || status === '未入金' || status === '滞納') {
      hasUnpaidByCustomerId.set(customerId, true);
    } else if (!hasUnpaidByCustomerId.has(customerId)) {
      hasUnpaidByCustomerId.set(customerId, false);
    }
  });

  return {
    contractedCustomerIds,
    contractDateByCustomerId,
    currentPlanNameByCustomerId,
    afsStatusByCustomerId,
    recentPaymentDateByCustomerId,
    hasUnpaidByCustomerId,
  };
}

function buildAssignedCoachByCustomerId(
  assignmentRows: Row[],
  coachRows: Row[],
): Map<string, string> {
  const coachNameById = new Map<string, string>();
  coachRows.forEach((row) => {
    const id = row['coach_id'] || '';
    const name = row['coach_name'] || '';
    if (id) coachNameById.set(id, name);
  });
  const result = new Map<string, string>();
  assignmentRows.forEach((row) => {
    const customerId = row['customer_id'] || '';
    if (!customerId) return;
    const status = (row['status'] || '').toLowerCase();
    if (status && status !== 'active' && status !== '稼働' && status !== '進行中' && status !== '') return;
    const coachId = row['coach_id'] || '';
    const coachName = row['coach_name'] || coachNameById.get(coachId) || '';
    if (coachName) result.set(customerId, coachName);
  });
  return result;
}

function buildLineRegistrationLookup(lineRows: Row[]): {
  friendStatusByCustomerId: Map<string, string>;
  lineDisplayNameByCustomerId: Map<string, string>;
} {
  const friendStatusByCustomerId = new Map<string, string>();
  const lineDisplayNameByCustomerId = new Map<string, string>();
  lineRows.forEach((row) => {
    const customerId = row['customer_id'] || '';
    if (!customerId) return;
    const status = row['friend_status'] || '';
    if (status) friendStatusByCustomerId.set(customerId, status);
    const display = row['display_name'] || row['line_registration_name'] || row['real_name'] || '';
    if (display && !lineDisplayNameByCustomerId.has(customerId)) {
      lineDisplayNameByCustomerId.set(customerId, display);
    }
  });
  return { friendStatusByCustomerId, lineDisplayNameByCustomerId };
}

function buildFollowupFlagSet(followupRows: Row[]): Set<string> {
  const result = new Set<string>();
  followupRows.forEach((row) => {
    const customerId = row['customer_id'] || '';
    if (customerId) result.add(customerId);
  });
  return result;
}

function buildEditorialNotesByCustomerId(_editRows: Row[]): {
  upgradePotentialByCustomerId: Map<string, string>;
  futureProposalByCustomerId: Map<string, string>;
} {
  return {
    upgradePotentialByCustomerId: new Map<string, string>(),
    futureProposalByCustomerId: new Map<string, string>(),
  };
}

export type CustomerContractedViewInputs = {
  customers: Row[];
  plans: Row[];
  payments: Row[];
  customerCoachAssignments: Row[];
  coaches: Row[];
  lineRegistrations: Row[];
  followupQueue: Row[];
  editorialNotes: Row[];
  syncedAt: string;
};

export function buildCustomerContractedView(inputs: CustomerContractedViewInputs): Array<Array<string | number>> {
  const {
    customers,
    plans,
    payments,
    customerCoachAssignments,
    coaches,
    lineRegistrations,
    followupQueue,
    editorialNotes,
    syncedAt,
  } = inputs;

  const contractInfo = buildContractedSet(plans, payments);
  const assignedCoachByCustomerId = buildAssignedCoachByCustomerId(customerCoachAssignments, coaches);
  const { friendStatusByCustomerId, lineDisplayNameByCustomerId } = buildLineRegistrationLookup(lineRegistrations);
  const followupFlagSet = buildFollowupFlagSet(followupQueue);
  const { upgradePotentialByCustomerId, futureProposalByCustomerId } = buildEditorialNotesByCustomerId(editorialNotes);
  const now = parseIsoDate(syncedAt) || new Date();

  const rows: Array<Array<string | number>> = [Array.from(CUSTOMER_CONTRACTED_VIEW_HEADER)];

  customers.forEach((customer) => {
    const customerId = customer['customer_id'] || '';
    if (!customerId) return;
    if (!contractInfo.contractedCustomerIds.has(customerId)) return;
    const afsStatus = contractInfo.afsStatusByCustomerId.get(customerId) || 'none';
    if (afsStatus === 'ended') return;

    const contractDate = contractInfo.contractDateByCustomerId.get(customerId) || '';
    const contractDateObj = parseIsoDate(contractDate);
    const monthsElapsed = contractDateObj ? diffMonths(contractDateObj, now) : '';
    const displayName = customer['customer_name'] || lineDisplayNameByCustomerId.get(customerId) || '';
    const currentPlanName = contractInfo.currentPlanNameByCustomerId.get(customerId) || '';
    const assignedCoach = assignedCoachByCustomerId.get(customerId) || '';
    const recentPaymentDate = contractInfo.recentPaymentDateByCustomerId.get(customerId) || '';
    const hasUnpaid = contractInfo.hasUnpaidByCustomerId.get(customerId) ? 'TRUE' : 'FALSE';
    const friendStatus = friendStatusByCustomerId.get(customerId) || '';
    const followupFlag = followupFlagSet.has(customerId) ? 'TRUE' : 'FALSE';
    const upgradePotential = upgradePotentialByCustomerId.get(customerId) || '';
    const futureProposal = futureProposalByCustomerId.get(customerId) || '';

    rows.push([
      customerId,
      displayName,
      contractDate,
      monthsElapsed === '' ? '' : monthsElapsed,
      currentPlanName,
      afsStatus,
      assignedCoach,
      recentPaymentDate,
      hasUnpaid,
      friendStatus,
      followupFlag,
      upgradePotential,
      futureProposal,
      syncedAt,
    ]);
  });

  return rows;
}
