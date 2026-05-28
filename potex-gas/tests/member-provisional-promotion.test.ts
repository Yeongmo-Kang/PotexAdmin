import { strict as assert } from 'node:assert';
import { buildProvisionalMembersFromTemp } from '../src/canonical/memberProvisionalPromotion.ts';

const syncedAt = '2026-05-28T12:34:56+09:00';

{
  const existingMembers = [
    { coach_id: 'MBR-001', coach_name: '榊原 洋平', roles: 'coach', updated_at: 'old' },
  ];
  const tempRows = [
    {
      coach_name: '廣瀬ちえ',
      proposed_action: 'create_provisional_member',
      specialty: 'キャリア',
      coverage_areas: 'キャリア,英語',
      assigned_customer_count: '3',
      source_sheet: '委託コーチ一覧',
      source_row: '12',
    },
  ];
  const result = buildProvisionalMembersFromTemp({ existingMembers, tempRows, syncedAt });
  assert.equal(result.created.length, 1);
  assert.equal(result.allMembers.length, 2);
  const created = result.created[0];
  assert.equal(created.coach_name, '廣瀬ちえ');
  assert.equal(created.roles, 'coach');
  assert.equal(created.coach_type, 'provisional');
  assert.equal(created.is_partner, 'FALSE');
  assert.equal(created.specialty, 'キャリア');
  assert.equal(created.coverage_areas, 'キャリア,英語');
  assert.equal(created.contract_type, '業務委託');
  assert.equal(created.work_status, '仮登録');
  assert.equal(created.is_active, 'TRUE');
  assert.equal(created.created_at, syncedAt);
  assert.equal(created.updated_at, syncedAt);
  assert.match(created.coach_id, /^MBR-PROV-/);
  assert.match(created.memo, /assigned_customer_count=3/);
}

{
  const existingMembers = [
    { coach_id: 'MBR-777', coach_name: '廣瀬ちえ', roles: 'coach', updated_at: 'old' },
  ];
  const tempRows = [
    {
      coach_name: '廣瀬 ちえ',
      proposed_action: 'create_provisional_member',
      specialty: 'キャリア',
      coverage_areas: 'キャリア,英語',
      assigned_customer_count: '3',
      source_sheet: '委託コーチ一覧',
      source_row: '12',
    },
  ];
  const result = buildProvisionalMembersFromTemp({ existingMembers, tempRows, syncedAt });
  assert.equal(result.created.length, 0);
  assert.equal(result.allMembers.length, 1);
}

{
  const existingMembers: Array<Record<string, string>> = [];
  const tempRows = [
    { coach_name: '福井', proposed_action: 'keep_existing_member', assigned_customer_count: '5', source_sheet: '委託コーチ一覧', source_row: '9' },
    { coach_name: '吉住颯一郎', proposed_action: 'create_provisional_member_from_assigned_customer', assigned_customer_count: '2', source_sheet: '顧客管理', source_row: '' },
  ];
  const result = buildProvisionalMembersFromTemp({ existingMembers, tempRows, syncedAt });
  assert.equal(result.created.length, 1);
  assert.equal(result.created[0].coach_name, '吉住颯一郎');
}

console.log('member provisional promotion tests passed');
