export type Row = Record<string, string>;

export type BuildProvisionalCustomersFromRepairCandidatesInput = {
  existingCustomers: Row[];
  stagingRows: Row[];
  candidates: Row[];
  syncedAt: string;
};

export type BuildProvisionalCustomersFromRepairCandidatesResult = {
  allCustomers: Row[];
  created: Row[];
};

function provisionalCustomerId(customerName: string, sourceSheet: string, sourceRow: string): string {
  const normalized = `${customerName}::${sourceSheet}::${sourceRow}`.replace(/[\s　]/g, '').trim().toLowerCase();
  let hash = 0;
  for (let i = 0; i < normalized.length; i += 1) {
    hash = ((hash << 5) - hash + normalized.charCodeAt(i)) | 0;
  }
  const hex = (hash >>> 0).toString(16).toUpperCase().padStart(8, '0');
  return `CUS-PROV-${hex}`;
}

export function buildProvisionalCustomersFromRepairCandidates(
  input: BuildProvisionalCustomersFromRepairCandidatesInput,
): BuildProvisionalCustomersFromRepairCandidatesResult {
  const { existingCustomers, stagingRows, candidates, syncedAt } = input;
  const allCustomers = existingCustomers.map((row) => ({ ...row }));
  const created: Row[] = [];
  const existingSourceKeys = new Set(allCustomers.map((row) => `${row['source_sheet'] || ''}::${row['source_row'] || ''}`));
  const stagingBySourceKey = new Map<string, Row>();
  stagingRows.forEach((row) => {
    const key = `${row['source_sheet'] || ''}::${row['source_row'] || ''}`;
    if (key !== '::' && !stagingBySourceKey.has(key)) stagingBySourceKey.set(key, row);
  });

  candidates.forEach((candidate) => {
    if ((candidate['proposed_action'] || '') !== 'promote_new_or_attach_by_other_id') return;
    const sourceSheet = candidate['source_sheet'] || '';
    const sourceRow = candidate['source_row'] || '';
    const sourceKey = `${sourceSheet}::${sourceRow}`;
    if (!sourceSheet || !sourceRow || existingSourceKeys.has(sourceKey)) return;
    const staging = stagingBySourceKey.get(sourceKey);
    if (!staging) return;

    const createdRow: Row = {
      customer_id: provisionalCustomerId(staging['customer_name'] || candidate['customer_name'] || '', sourceSheet, sourceRow),
      customer_name: staging['customer_name'] || candidate['customer_name'] || '',
      furigana: staging['furigana'] || '',
      real_name: '',
      line_registration_name: '',
      line_display_name: '',
      gender: '',
      age: staging['age'] || '',
      occupation: '',
      email: staging['email'] || '',
      phone: staging['phone'] || '',
      contact_email: staging['email'] || '',
      contact_phone: staging['phone'] || '',
      acquisition_source_id: '',
      line_registration_id: staging['line_registration_id'] || '',
      current_status: staging['current_status'] || staging['lifecycle_status'] || 'active',
      lifecycle_status: staging['lifecycle_status'] || 'active',
      first_contact_date: staging['created_at'] || syncedAt,
      assigned_coach_name: staging['assigned_coach_name'] || '',
      course_name: staging['course_name'] || '',
      continuation_tag: staging['continuation_tag'] || '',
      program_completed_flag: staging['program_completed_flag'] || '',
      app_status: staging['app_status'] || '',
      matching_contact_date: staging['matching_contact_date'] || '',
      drive_label_or_url: staging['drive_label_or_url'] || '',
      desired_plan_from_form: staging['desired_plan_from_form'] || '',
      sales_owner_member_id: '',
      lost_reason: '',
      note: `customer_repair_provisional_create:${sourceSheet}#${sourceRow}`,
      created_at: syncedAt,
      updated_at: syncedAt,
      source_sheet: sourceSheet,
      source_row: sourceRow,
    };
    allCustomers.push(createdRow);
    created.push(createdRow);
    existingSourceKeys.add(sourceKey);
  });

  return { allCustomers, created };
}
