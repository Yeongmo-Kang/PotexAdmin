import { strict as assert } from 'node:assert';
import { buildAssignmentSnapshotRows } from '../src/canonical/customerAssignmentSnapshot.ts';

{
  const stagingRows = [
    {
      customer_id: '',
      customer_name: '新規顧客',
      assigned_coach_name: '廣瀬ちえ',
      email: 'new@example.com',
      phone: '090-1111-2222',
      age: '31',
      source_sheet: '顧客管理',
      source_row: '77',
      matching_contact_date: '2026-05-28',
      created_at: '2026-05-20T10:00:00+09:00',
    },
  ];
  const refreshedCustomers = [
    {
      customer_id: 'CUS-PROV-12345678',
      customer_name: '新規顧客',
      contact_email: 'new@example.com',
      contact_phone: '090-1111-2222',
      age: '31',
      source_sheet: '顧客管理',
      source_row: '77',
    },
  ];

  const result = buildAssignmentSnapshotRows(stagingRows, refreshedCustomers);
  assert.equal(result.length, 1);
  assert.equal(result[0].customer_id, 'CUS-PROV-12345678');
  assert.equal(result[0].assigned_coach_name, '廣瀬ちえ');
  assert.equal(result[0].email, 'new@example.com');
  assert.equal(result[0].phone, '090-1111-2222');
  assert.equal(result[0].source_sheet, '顧客管理');
  assert.equal(result[0].source_row, '77');
}

{
  const stagingRows = [
    {
      customer_id: 'CUST-001',
      customer_name: '既存顧客',
      assigned_coach_name: '既存コーチ',
      email: 'staging@example.com',
      phone: '090-0000-0000',
      age: '22',
      source_sheet: '顧客管理',
      source_row: '10',
      created_at: '2026-05-20T10:00:00+09:00',
    },
  ];
  const refreshedCustomers = [
    {
      customer_id: 'CUST-001',
      customer_name: '既存顧客',
      source_sheet: '顧客管理',
      source_row: '10',
    },
  ];

  const result = buildAssignmentSnapshotRows(stagingRows, refreshedCustomers);
  assert.equal(result[0].customer_id, 'CUST-001');
  assert.equal(result[0].email, 'staging@example.com');
}

console.log('customer assignment snapshot tests passed');
