export const PARTNER_STATUS_INPUT_HEADER = [
  'priority',
  'lead_display_name',
  'respondent_email',
  'phone',
  'age',
  'assigned_at',
  'current_meeting_status',
  'current_meeting_done_at',
  'current_potex_sale_status',
  'current_recruitment_status',
  'current_partner_status_note',
  'current_plan_name',
  'current_plan_status',
  'operator_meeting_status',
  'operator_meeting_done_at',
  'operator_potex_sale_status',
  'operator_recruitment_status',
  'operator_partner_status_note',
  'submit_update',
  'lead_id',
  'customer_id',
  'coach_id',
  'sync_status',
  'last_collected_at',
] as const;

export const PARTNER_STATUS_INPUT_REQUIRED_COLUMNS = [
  'submit_update',
  'lead_id',
  'sync_status',
  'last_collected_at',
] as const;

export const PARTNER_STATUS_INPUT_EDITABLE_COLUMNS = [
  'operator_meeting_status',
  'operator_meeting_done_at',
  'operator_potex_sale_status',
  'operator_recruitment_status',
  'operator_partner_status_note',
  'submit_update',
] as const;

export const CUSTOMER_COACH_ASSIGNMENTS_HEADER = [
  'assignment_id', 'lead_id', 'customer_id', 'lead_display_name', 'respondent_email', 'phone', 'age', 'source_sheet', 'source_row',
  'coach_id', 'role', 'assignee_kind', 'assignee_scope', 'assignment_status', 'assigned_at', 'assignment_source',
  'meeting_status', 'meeting_done_at', 'potex_sale_status', 'recruitment_status', 'partner_status_note', 'last_partner_update_at', 'last_partner_updated_by',
  'ended_at', 'note', 'created_at', 'updated_at',
] as const;
