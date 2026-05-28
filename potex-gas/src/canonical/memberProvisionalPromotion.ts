export type Row = Record<string, string>;

export type BuildProvisionalMembersFromTempInput = {
  existingMembers: Row[];
  tempRows: Row[];
  syncedAt: string;
};

export type BuildProvisionalMembersFromTempResult = {
  allMembers: Row[];
  created: Row[];
};

function normalizeName(value: string): string {
  return String(value || '').replace(/[\s　]/g, '').trim().toLowerCase();
}

function provisionalCoachId(coachName: string): string {
  const normalized = normalizeName(coachName);
  let hash = 0;
  for (let i = 0; i < normalized.length; i += 1) {
    hash = ((hash << 5) - hash + normalized.charCodeAt(i)) | 0;
  }
  const hex = (hash >>> 0).toString(16).toUpperCase().padStart(8, '0');
  return `MBR-PROV-${hex}`;
}

export function buildProvisionalMembersFromTemp(
  input: BuildProvisionalMembersFromTempInput,
): BuildProvisionalMembersFromTempResult {
  const { existingMembers, tempRows, syncedAt } = input;
  const allMembers = existingMembers.map((row) => ({ ...row }));
  const created: Row[] = [];
  const existingByName = new Set(allMembers.map((row) => normalizeName(row['coach_name'] || '')).filter(Boolean));

  tempRows.forEach((row) => {
    const action = row['proposed_action'] || '';
    if (!['create_provisional_member', 'create_provisional_member_from_assigned_customer'].includes(action)) return;
    const coachName = row['coach_name'] || '';
    const key = normalizeName(coachName);
    if (!key || existingByName.has(key)) return;

    const provisional = {
      coach_id: provisionalCoachId(coachName),
      coach_name: coachName,
      roles: 'coach',
      coach_type: 'provisional',
      is_partner: 'FALSE',
      email: '',
      line_url: '',
      specialty: row['specialty'] || '',
      coverage_areas: row['coverage_areas'] || '',
      contract_type: '業務委託',
      work_status: '仮登録',
      assignee_scope: '',
      external_role: '',
      is_active: 'TRUE',
      memo: [
        `provisional_member_from=${row['source_sheet'] || ''}#${row['source_row'] || ''}`,
        `assigned_customer_count=${row['assigned_customer_count'] || '0'}`,
      ].join(' | '),
      created_at: syncedAt,
      updated_at: syncedAt,
    };

    allMembers.push(provisional);
    created.push(provisional);
    existingByName.add(key);
  });

  return { allMembers, created };
}
