import { strict as assert } from 'node:assert';
import { applyCustomerRepairNameMatchPromotions } from '../src/canonical/customerRepairPromotion.ts';

const syncedAt = '2026-05-28T12:34:56+09:00';

{
  const customers = [
    {
      customer_id: 'CUST-001',
      customer_name: '山田太郎',
      furigana: '',
      email: '',
      phone: '',
      current_status: '',
      assigned_coach_name: '',
      course_name: '',
      contact_email: '',
      contact_phone: '',
      age: '',
      line_registration_id: '',
      lifecycle_status: 'lead',
      first_contact_date: '',
      source_sheet: '',
      source_row: '',
      desired_plan_from_form: '',
      matching_contact_date: '',
      program_completed_flag: '',
      app_status: '',
      updated_at: '2026-05-01T00:00:00+09:00',
      note: 'manual note',
    },
  ];

  const stagingRows = [
    {
      customer_name: '山田太郎',
      furigana: 'やまだたろう',
      source_sheet: '顧客管理',
      source_row: '2',
      course_name: 'マスターコース',
      assigned_coach_name: '廣瀬ちえ',
      current_status: 'active',
      email: 'taro@example.com',
      phone: '090-1111-2222',
      age: '29',
      line_registration_id: 'LINE-123',
      lifecycle_status: 'active',
      created_at: '2026-05-20T10:00:00+09:00',
      desired_plan_from_form: 'マスター6か月',
      matching_contact_date: '2026-05-21',
      program_completed_flag: 'FALSE',
      app_status: 'interviewed',
    },
  ];

  const candidates = [
    {
      source_sheet: '顧客管理',
      source_row: '2',
      proposed_action: 'update_existing_from_name_match',
      matched_customer_id: 'CUST-001',
      customer_name: '山田太郎',
    },
  ];

  const result = applyCustomerRepairNameMatchPromotions({ customers, stagingRows, candidates, syncedAt });
  assert.equal(result.appliedCount, 1);
  assert.equal(result.customers[0].furigana, 'やまだたろう');
  assert.equal(result.customers[0].email, 'taro@example.com');
  assert.equal(result.customers[0].phone, '090-1111-2222');
  assert.equal(result.customers[0].current_status, 'active');
  assert.equal(result.customers[0].assigned_coach_name, '廣瀬ちえ');
  assert.equal(result.customers[0].course_name, 'マスターコース');
  assert.equal(result.customers[0].contact_email, 'taro@example.com');
  assert.equal(result.customers[0].contact_phone, '090-1111-2222');
  assert.equal(result.customers[0].age, '29');
  assert.equal(result.customers[0].line_registration_id, 'LINE-123');
  assert.equal(result.customers[0].lifecycle_status, 'active');
  assert.equal(result.customers[0].first_contact_date, '2026-05-20T10:00:00+09:00');
  assert.equal(result.customers[0].source_sheet, '顧客管理');
  assert.equal(result.customers[0].source_row, '2');
  assert.equal(result.customers[0].desired_plan_from_form, 'マスター6か月');
  assert.equal(result.customers[0].matching_contact_date, '2026-05-21');
  assert.equal(result.customers[0].program_completed_flag, 'FALSE');
  assert.equal(result.customers[0].app_status, 'interviewed');
  assert.equal(result.customers[0].updated_at, syncedAt);
  assert.match(result.customers[0].note, /customer_repair_name_match:顧客管理#2/);
}

{
  const customers = [
    {
      customer_id: 'CUST-002',
      customer_name: '佐藤花子',
      email: 'keep-legacy@example.com',
      phone: '090-8888-8888',
      contact_email: 'keep@example.com',
      contact_phone: '090-9999-9999',
      age: '35',
      line_registration_id: 'LINE-KEEP',
      source_sheet: 'old',
      source_row: '7',
      note: '',
      updated_at: 'old',
    },
  ];

  const stagingRows = [
    {
      customer_name: '佐藤花子',
      source_sheet: '顧客管理',
      source_row: '3',
      email: 'new@example.com',
      phone: '090-0000-0000',
      age: '22',
      line_registration_id: 'LINE-NEW',
      created_at: '2026-05-20T10:00:00+09:00',
    },
  ];

  const candidates = [
    {
      source_sheet: '顧客管理',
      source_row: '3',
      proposed_action: 'update_existing_from_name_match',
      matched_customer_id: 'CUST-002',
      customer_name: '佐藤花子',
    },
  ];

  const result = applyCustomerRepairNameMatchPromotions({ customers, stagingRows, candidates, syncedAt });
  assert.equal(result.customers[0].email, 'keep-legacy@example.com');
  assert.equal(result.customers[0].phone, '090-8888-8888');
  assert.equal(result.customers[0].contact_email, 'keep@example.com');
  assert.equal(result.customers[0].contact_phone, '090-9999-9999');
  assert.equal(result.customers[0].age, '35');
  assert.equal(result.customers[0].line_registration_id, 'LINE-KEEP');
  assert.equal(result.customers[0].source_sheet, '顧客管理');
  assert.equal(result.customers[0].source_row, '3');
}

{
  const customers = [
    { customer_id: 'CUST-003', customer_name: '中村一郎', updated_at: 'old', line_registration_id: 'line_csvd_1' },
    { customer_id: 'CUST-004', customer_name: '中村 一郎', updated_at: 'old', line_registration_id: 'line_csvpotex_1' },
  ];
  const stagingRows = [{ customer_name: '中村一郎', source_sheet: '顧客管理', source_row: '4', email: 'n@example.com' }];
  const candidates = [{ source_sheet: '顧客管理', source_row: '4', proposed_action: 'review_ambiguous_before_update', matched_customer_id: 'CUST-003' }];
  const result = applyCustomerRepairNameMatchPromotions({ customers, stagingRows, candidates, syncedAt });
  assert.equal(result.appliedCount, 0);
  assert.equal(result.unresolvedAmbiguousCount, 1);
  assert.deepEqual(result.customers, customers);
}

{
  const customers = [
    {
      customer_id: 'CUST-010',
      customer_name: '長島信子',
      line_registration_id: 'line_csvd_230907780',
      updated_at: 'old',
      note: '',
    },
    {
      customer_id: 'CUST-011',
      customer_name: '長島 信子',
      line_registration_id: 'line_csvpotex_216332661',
      updated_at: 'old',
      note: '',
    },
  ];
  const stagingRows = [
    {
      customer_name: '長島信子',
      source_sheet: '顧客管理',
      source_row: '14',
      email: 'nagashima@example.com',
      phone: '090-5555-0000',
      created_at: '2026-05-20T10:00:00+09:00',
      program_completed_flag: 'FALSE',
    },
  ];
  const candidates = [
    {
      source_sheet: '顧客管理',
      source_row: '14',
      proposed_action: 'review_ambiguous_before_update',
      customer_name: '長島信子',
    },
  ];
  const activityByCustomerId = {
    'CUST-010': { channelLinkCount: 2, conversionCount: 2 },
    'CUST-011': { channelLinkCount: 0, conversionCount: 0 },
  };
  const result = applyCustomerRepairNameMatchPromotions({ customers, stagingRows, candidates, syncedAt, activityByCustomerId });
  assert.equal(result.appliedCount, 1);
  assert.equal(result.unresolvedAmbiguousCount, 0);
  assert.equal(result.customers[0].source_sheet, '顧客管理');
  assert.equal(result.customers[0].source_row, '14');
  assert.equal(result.customers[0].contact_email, 'nagashima@example.com');
  assert.match(result.customers[0].note, /customer_repair_activity_match:顧客管理#14/);
  assert.equal(result.customers[1].source_sheet || '', '');
}

{
  const customers = [
    { customer_id: 'CUST-020', customer_name: '田中優', updated_at: 'old', line_registration_id: 'LINE-CSVD-001' },
    { customer_id: 'CUST-021', customer_name: '田中 優', updated_at: 'old', line_registration_id: 'line_csvpotex_002' },
  ];
  const stagingRows = [{ customer_name: '田中優', source_sheet: '顧客管理', source_row: '20', email: 'tanaka@example.com' }];
  const candidates = [{ source_sheet: '顧客管理', source_row: '20', proposed_action: 'review_ambiguous_before_update', customer_name: '田中優' }];
  const activityByCustomerId = {
    'CUST-020': { planCount: 1 },
    'CUST-021': { planCount: 1 },
  };
  const result = applyCustomerRepairNameMatchPromotions({ customers, stagingRows, candidates, syncedAt, activityByCustomerId });
  assert.equal(result.appliedCount, 1);
  assert.equal(result.unresolvedAmbiguousCount, 0);
  assert.equal(result.customers[0].source_sheet, '顧客管理');
  assert.equal(result.customers[1].source_sheet || '', '');
}

console.log('customer repair promotion tests passed');
