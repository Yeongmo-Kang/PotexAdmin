export type PartnerAssignee = {
  coachId: string;
  coachName: string;
  assigneeScope: string;
  externalRole: string;
  isActive: string;
};

export const PARTNER_ASSIGNEES: PartnerAssignee[] = [
  {
    coachId: 'COACH-PARTNER-001',
    coachName: '稲井',
    assigneeScope: 'student',
    externalRole: '人材会社社長 + 長期インターン伴走授業',
    isActive: 'TRUE',
  },
  {
    coachId: 'COACH-PARTNER-002',
    coachName: '佐藤',
    assigneeScope: 'career_change_and_job_hunt',
    externalRole: '転職希望者 + 就活生向け人材紹介 / POTEX案内',
    isActive: 'TRUE',
  },
];

export function normalizePartnerName(value: string): string {
  return String(value || '').replace(/\s|　/g, '').trim().toLowerCase();
}

export function findPartnerByCoachId(coachId: string): PartnerAssignee | undefined {
  return PARTNER_ASSIGNEES.find((partner) => partner.coachId === coachId);
}

export function findPartnerByCoachName(coachName: string): PartnerAssignee | undefined {
  const normalized = normalizePartnerName(coachName);
  return PARTNER_ASSIGNEES.find((partner) => normalizePartnerName(partner.coachName) === normalized);
}
