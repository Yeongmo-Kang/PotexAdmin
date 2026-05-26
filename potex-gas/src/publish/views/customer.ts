type Row = Record<string, string>;

const CUSTOMER_CONTRACTED_VIEW_HEADER = [
  '顧客ID',
  '顧客名',
  'ふりがな',
  'LINE登録名',
  '流入元',
  '商談日',
  '営業担当',
  'ステータス',
  '失注理由',
  '成約日',
  '契約コース',
  '契約金額',
  '支払方法',
  '備考',
  '成約後経過月数',
  'AFS状態',
  '担当コーチ',
  '直近入金日',
  '未入金フラグ',
  'LINE状態',
  '要対応フラグ',
  'アップグレード余地',
  '今後提案可能性',
  'AFSプラン',
  'AFS契約日',
  'last_synced_at',
] as const;

export const CUSTOMER_VIEW_COLUMN_COUNT = CUSTOMER_CONTRACTED_VIEW_HEADER.length;

function normalizeName(value: string): string {
  return String(value || '').replace(/[\s　]/g, '').trim();
}

function normalizeLifecycleStatus(value: string): string {
  const v = String(value || '').trim();
  if (!v) return '';
  const lower = v.toLowerCase();
  if (v.includes('クーオフ') || v.includes('クールオフ') || lower.includes('cooloff') || lower.includes('cooling')) return 'クーオフ';
  if (v.includes('返金')) return '返金';
  if (v.includes('解約') || v.includes('キャンセル')) return '解約';
  return v;
}

function normalizeDate(value: string): string {
  const text = String(value || '').trim();
  if (!text) return '';
  const m = text.replace(/[.]/g, '-').replace(/\//g, '-').match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!m) return text;
  return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
}

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
  contractAmountByCustomerId: Map<string, string>;
  afsStatusByCustomerId: Map<string, 'none' | 'active' | 'ended'>;
  afsPlanNameByCustomerId: Map<string, string>;
  afsContractDateByCustomerId: Map<string, string>;
  recentPaymentDateByCustomerId: Map<string, string>;
  recentPaymentMethodByCustomerId: Map<string, string>;
  hasUnpaidByCustomerId: Map<string, boolean>;
} {
  const contractedCustomerIds = new Set<string>();
  const contractDateByCustomerId = new Map<string, string>();
  const currentPlanNameByCustomerId = new Map<string, string>();
  const contractAmountByCustomerId = new Map<string, string>();
  const afsStatusByCustomerId = new Map<string, 'none' | 'active' | 'ended'>();
  const afsPlanNameByCustomerId = new Map<string, string>();
  const afsContractDateByCustomerId = new Map<string, string>();

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
    const amount = row['amount_tax_included'] || '';
    const isAfs = planType.includes('afs') || planType.includes('after') || planName.includes('AFS') || planName.includes('アフター');
    if (isAfs) {
      const currentAfs = afsStatusByCustomerId.get(customerId);
      if (status === 'active' || status === '進行中' || status === '稼働' || status === '') {
        afsStatusByCustomerId.set(customerId, 'active');
      } else if (status === 'ended' || status === '終了' || status === 'closed' || status === '完了') {
        if (currentAfs !== 'active') afsStatusByCustomerId.set(customerId, 'ended');
      }
      if (planName && !afsPlanNameByCustomerId.has(customerId)) {
        afsPlanNameByCustomerId.set(customerId, planName);
      }
      if (contractDate) {
        const existingAfsDate = afsContractDateByCustomerId.get(customerId);
        if (!existingAfsDate || contractDate < existingAfsDate) {
          afsContractDateByCustomerId.set(customerId, contractDate);
        }
      }
    }
    const isActiveStatus = status === 'active' || status === '進行中' || status === '稼働' || status === '';
    if (isActiveStatus) {
      if (!isAfs || !currentPlanNameByCustomerId.has(customerId)) {
        currentPlanNameByCustomerId.set(customerId, planName);
        if (amount) contractAmountByCustomerId.set(customerId, amount);
      }
    } else if (!currentPlanNameByCustomerId.has(customerId)) {
      currentPlanNameByCustomerId.set(customerId, planName);
      if (amount) contractAmountByCustomerId.set(customerId, amount);
    }
  });

  contractedCustomerIds.forEach((customerId) => {
    if (!afsStatusByCustomerId.has(customerId)) afsStatusByCustomerId.set(customerId, 'none');
  });

  const recentPaymentDateByCustomerId = new Map<string, string>();
  const recentPaymentMethodByCustomerId = new Map<string, string>();
  const hasUnpaidByCustomerId = new Map<string, boolean>();
  paymentsRows.forEach((row) => {
    const customerId = row['customer_id'] || '';
    if (!customerId) return;
    const paymentDate = row['payment_date'] || '';
    const status = (row['payment_status'] || '').toLowerCase();
    const method = row['payment_method'] || '';
    if (paymentDate) {
      const existing = recentPaymentDateByCustomerId.get(customerId) || '';
      if (paymentDate > existing) {
        recentPaymentDateByCustomerId.set(customerId, paymentDate);
        if (method) recentPaymentMethodByCustomerId.set(customerId, method);
      }
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
    contractAmountByCustomerId,
    afsStatusByCustomerId,
    afsPlanNameByCustomerId,
    afsContractDateByCustomerId,
    recentPaymentDateByCustomerId,
    recentPaymentMethodByCustomerId,
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
  lineRegistrationNameByCustomerId: Map<string, string>;
} {
  const friendStatusByCustomerId = new Map<string, string>();
  const lineDisplayNameByCustomerId = new Map<string, string>();
  const lineRegistrationNameByCustomerId = new Map<string, string>();
  lineRows.forEach((row) => {
    const customerId = row['customer_id'] || '';
    if (!customerId) return;
    const status = row['friend_status'] || '';
    if (status) friendStatusByCustomerId.set(customerId, status);
    const display = row['display_name'] || row['line_registration_name'] || row['real_name'] || '';
    if (display && !lineDisplayNameByCustomerId.has(customerId)) {
      lineDisplayNameByCustomerId.set(customerId, display);
    }
    const regName = row['line_registration_name'] || '';
    if (regName && !lineRegistrationNameByCustomerId.has(customerId)) {
      lineRegistrationNameByCustomerId.set(customerId, regName);
    }
  });
  return { friendStatusByCustomerId, lineDisplayNameByCustomerId, lineRegistrationNameByCustomerId };
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

type ShodanJoinIndex = {
  byNameDate: Map<string, Row>;
  ambiguousNameDate: Set<string>;
  byName: Map<string, Row>;
  ambiguousName: Set<string>;
};

function buildShodanIndex(shodanRows: Row[]): ShodanJoinIndex {
  const byNameDate = new Map<string, Row>();
  const ambiguousNameDate = new Set<string>();
  const byName = new Map<string, Row>();
  const ambiguousName = new Set<string>();
  shodanRows.forEach((row) => {
    const name = normalizeName(row['顧客名'] || '');
    if (!name) return;
    const contractDate = normalizeDate(row['成約日'] || '');
    if (contractDate) {
      const key = `${name}|${contractDate}`;
      if (byNameDate.has(key)) ambiguousNameDate.add(key);
      else byNameDate.set(key, row);
    }
    if (byName.has(name)) ambiguousName.add(name);
    else byName.set(name, row);
  });
  return { byNameDate, ambiguousNameDate, byName, ambiguousName };
}

type ShodanMatch = { row: Row | null; matched: boolean };

function lookupShodan(
  shodanIndex: ShodanJoinIndex,
  customerName: string,
  contractDate: string,
  dbNameCounter: Map<string, number>,
): ShodanMatch {
  const name = normalizeName(customerName);
  if (!name) return { row: null, matched: false };
  const normDate = normalizeDate(contractDate);
  if (normDate) {
    const key = `${name}|${normDate}`;
    if (!shodanIndex.ambiguousNameDate.has(key)) {
      const hit = shodanIndex.byNameDate.get(key);
      if (hit) return { row: hit, matched: true };
    }
  }
  if (!shodanIndex.ambiguousName.has(name) && (dbNameCounter.get(name) || 0) <= 1) {
    const hit = shodanIndex.byName.get(name);
    if (hit) return { row: hit, matched: true };
  }
  return { row: null, matched: false };
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
  shodanRows: Row[];
  syncedAt: string;
};

export type CustomerContractedViewResult = {
  rows: Array<Array<string | number>>;
  shodanMatched: number;
  shodanUnmatched: number;
  shodanAmbiguousNameSkipped: number;
  refundedCount: number;
};

export function buildCustomerContractedView(inputs: CustomerContractedViewInputs): CustomerContractedViewResult {
  const {
    customers,
    plans,
    payments,
    customerCoachAssignments,
    coaches,
    lineRegistrations,
    followupQueue,
    editorialNotes,
    shodanRows,
    syncedAt,
  } = inputs;

  const contractInfo = buildContractedSet(plans, payments);
  const assignedCoachByCustomerId = buildAssignedCoachByCustomerId(customerCoachAssignments, coaches);
  const { friendStatusByCustomerId, lineDisplayNameByCustomerId, lineRegistrationNameByCustomerId } = buildLineRegistrationLookup(lineRegistrations);
  const followupFlagSet = buildFollowupFlagSet(followupQueue);
  const { upgradePotentialByCustomerId, futureProposalByCustomerId } = buildEditorialNotesByCustomerId(editorialNotes);
  const shodanIndex = buildShodanIndex(shodanRows);
  const now = parseIsoDate(syncedAt) || new Date();

  const dbNameCounter = new Map<string, number>();
  customers.forEach((customer) => {
    const customerId = customer['customer_id'] || '';
    if (!customerId) return;
    if (!contractInfo.contractedCustomerIds.has(customerId)) return;
    const afsStatus = contractInfo.afsStatusByCustomerId.get(customerId) || 'none';
    if (afsStatus === 'ended') return;
    const name = normalizeName(customer['customer_name'] || '');
    if (!name) return;
    dbNameCounter.set(name, (dbNameCounter.get(name) || 0) + 1);
  });

  const rows: Array<Array<string | number>> = [Array.from(CUSTOMER_CONTRACTED_VIEW_HEADER)];
  let shodanMatched = 0;
  let shodanUnmatched = 0;
  let shodanAmbiguousNameSkipped = 0;
  let refundedCount = 0;

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
    const contractAmount = contractInfo.contractAmountByCustomerId.get(customerId) || '';
    const assignedCoach = assignedCoachByCustomerId.get(customerId) || '';
    const recentPaymentDate = contractInfo.recentPaymentDateByCustomerId.get(customerId) || '';
    const recentPaymentMethod = contractInfo.recentPaymentMethodByCustomerId.get(customerId) || '';
    const hasUnpaid = contractInfo.hasUnpaidByCustomerId.get(customerId) ? 'TRUE' : 'FALSE';
    const friendStatus = friendStatusByCustomerId.get(customerId) || '';
    const lineRegName = lineRegistrationNameByCustomerId.get(customerId) || '';
    const followupFlag = followupFlagSet.has(customerId) ? 'TRUE' : 'FALSE';
    const upgradePotential = upgradePotentialByCustomerId.get(customerId) || '';
    const futureProposal = futureProposalByCustomerId.get(customerId) || '';
    const afsPlanName = contractInfo.afsPlanNameByCustomerId.get(customerId) || '';
    const afsContractDate = contractInfo.afsContractDateByCustomerId.get(customerId) || '';
    const lifecycleStatus = normalizeLifecycleStatus(customer['lifecycle_status'] || '');
    const displayStatus = lifecycleStatus || '成約';
    if (lifecycleStatus) refundedCount += 1;

    const shodan = lookupShodan(shodanIndex, displayName, contractDate, dbNameCounter);
    if (shodan.matched) {
      shodanMatched += 1;
    } else {
      shodanUnmatched += 1;
      const name = normalizeName(displayName);
      if (name && (shodanIndex.ambiguousName.has(name) || (dbNameCounter.get(name) || 0) > 1)) {
        shodanAmbiguousNameSkipped += 1;
      }
    }
    const shodanFurigana = shodan.row ? shodan.row['ふりがな'] || '' : '';
    const shodanInflow = shodan.row ? shodan.row['流入元'] || '' : '';
    const shodanShodanDate = shodan.row ? shodan.row['商談日'] || '' : '';
    const shodanLineName = shodan.row ? shodan.row['LINE登録名'] || '' : '';

    rows.push([
      customerId,
      displayName,
      shodanFurigana,
      shodanLineName || lineRegName,
      shodanInflow,
      shodanShodanDate,
      '',
      displayStatus,
      '',
      contractDate,
      currentPlanName,
      contractAmount,
      recentPaymentMethod,
      '',
      monthsElapsed === '' ? '' : monthsElapsed,
      afsStatus,
      assignedCoach,
      recentPaymentDate,
      hasUnpaid,
      friendStatus,
      followupFlag,
      upgradePotential,
      futureProposal,
      afsPlanName,
      afsContractDate,
      syncedAt,
    ]);
  });

  return { rows, shodanMatched, shodanUnmatched, shodanAmbiguousNameSkipped, refundedCount };
}
