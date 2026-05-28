import { strict as assert } from 'node:assert';
import { buildProvisionalCustomersFromRepairCandidates } from '../src/canonical/customerProvisionalPromotion.ts';

const syncedAt = '2026-05-28T12:34:56+09:00';

{
  const existingCustomers = [
    {
      customer_id: 'CUS-0001',
      customer_name: '既存顧客',
      source_sheet: '顧客管理',
      source_row: '2',
      note: '',
    },
  ];

  const stagingRows = [
    {
      customer_name: '新規顧客',
      furigana: 'しんきこきゃく',
      source_sheet: '顧客管理',
      source_row: '10',
      email: 'new@example.com',
      phone: '090-1234-5678',
      age: '31',
      line_registration_id: '',
      lifecycle_status: 'active',
      created_at: '2026-05-20T10:00:00+09:00',
    },
  ];

  const candidates = [
    {
      source_sheet: '顧客管理',
      source_row: '10',
      customer_name: '新規顧客',
      proposed_action: 'promote_new_or_attach_by_other_id',
    },
  ];

  const result = buildProvisionalCustomersFromRepairCandidates({ existingCustomers, stagingRows, candidates, syncedAt });
  assert.equal(result.created.length, 1);
  assert.equal(result.allCustomers.length, 2);
  const created = result.created[0];
  assert.match(created.customer_id, /^CUS-PROV-/);
  assert.equal(created.customer_name, '新規顧客');
  assert.equal(created.furigana, 'しんきこきゃく');
  assert.equal(created.email, 'new@example.com');
  assert.equal(created.phone, '090-1234-5678');
  assert.equal(created.contact_email, 'new@example.com');
  assert.equal(created.contact_phone, '090-1234-5678');
  assert.equal(created.age, '31');
  assert.equal(created.lifecycle_status, 'active');
  assert.equal(created.current_status, 'active');
  assert.equal(created.first_contact_date, '2026-05-20T10:00:00+09:00');
  assert.equal(created.source_sheet, '顧客管理');
  assert.equal(created.source_row, '10');
  assert.match(created.note, /customer_repair_provisional_create:顧客管理#10/);
  assert.equal(created.created_at, syncedAt);
  assert.equal(created.updated_at, syncedAt);
}

{
  const existingCustomers = [
    {
      customer_id: 'CUS-PROV-AAAA1111',
      customer_name: '新規顧客',
      source_sheet: '顧客管理',
      source_row: '10',
      note: 'customer_repair_provisional_create:顧客管理#10',
    },
  ];
  const stagingRows = [
    { customer_name: '新規顧客', source_sheet: '顧客管理', source_row: '10', email: 'new@example.com' },
  ];
  const candidates = [
    { source_sheet: '顧客管理', source_row: '10', customer_name: '新規顧客', proposed_action: 'promote_new_or_attach_by_other_id' },
  ];
  const result = buildProvisionalCustomersFromRepairCandidates({ existingCustomers, stagingRows, candidates, syncedAt });
  assert.equal(result.created.length, 0);
  assert.equal(result.allCustomers.length, 1);
}

console.log('customer provisional promotion tests passed');
