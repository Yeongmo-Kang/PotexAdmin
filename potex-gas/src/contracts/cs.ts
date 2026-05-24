export const CS_CONTINUATION_ALIAS_REVIEW_HEADER = [
  'priority',
  'suggested_action',
  'raw_name',
  'cleaned_name',
  'raw_plan',
  'raw_contract_date',
  'raw_amount',
  'candidate_real_name',
  'candidate_line_registration_name',
  'candidate_display_name',
  'candidate_segment',
  'current_status',
  'current_canonical_customer_name',
  'current_canonical_customer_id',
  'suggestion_basis',
  'writeback_alias_name',
  'operator_decision_status',
  'operator_selected_customer_name',
  'operator_selected_customer_id',
  'operator_note',
  'continuation_exception_id',
  'candidate_line_registration_id',
  'sync_status',
  'last_collected_at',
] as const;

export const CS_CONTINUATION_ALIAS_REVIEW_REQUIRED_COLUMNS = [
  'operator_decision_status',
  'current_canonical_customer_id',
  'current_canonical_customer_name',
  'sync_status',
  'last_collected_at',
] as const;

export const CS_CONTINUATION_ALIAS_REVIEW_EDITABLE_COLUMNS = [
  'operator_decision_status',
  'operator_selected_customer_name',
  'operator_selected_customer_id',
  'operator_note',
] as const;

export const CS_ASSIGNMENT_INPUT_HEADER = [
  'priority',
  'lead_display_name',
  'respondent_email',
  'phone',
  'age',
  'suggested_assignee_name',
  'current_assignee_name',
  'assignee_type',
  'operator_decision_status',
  'operator_selected_assignee_name',
  'assignment_note',
  'lead_id',
  'customer_id',
  'customer_name',
  'suggested_assignee_id',
  'current_assignee_id',
  'suggested_assignee_scope',
  'form_response_sheet',
  'form_response_row',
  'sync_status',
  'last_collected_at',
] as const;

export const CS_ASSIGNMENT_INPUT_REQUIRED_COLUMNS = [
  'operator_decision_status',
  'lead_id',
  'sync_status',
  'last_collected_at',
] as const;

export const CS_ASSIGNMENT_INPUT_EDITABLE_COLUMNS = [
  'operator_decision_status',
  'operator_selected_assignee_name',
  'assignment_note',
] as const;

export const CS_ALIAS_RESOLUTION_INPUT_HEADER = [
  'alias_name',
  'respondent_email',
  'related_coach_name',
  'response_id',
  'current_status',
  'current_canonical_customer_id',
  'current_canonical_customer_name',
  'operator_decision_status',
  'operator_selected_customer_id',
  'operator_selected_customer_name',
  'operator_note',
  'sync_status',
  'last_collected_at',
] as const;

export const CS_ALIAS_RESOLUTION_INPUT_REQUIRED_COLUMNS = [
  'alias_name',
  'operator_decision_status',
  'sync_status',
  'last_collected_at',
] as const;

export const CS_ALIAS_RESOLUTION_INPUT_EDITABLE_COLUMNS = [
  'operator_decision_status',
  'operator_selected_customer_id',
  'operator_selected_customer_name',
  'operator_note',
] as const;

export const CS_PAYMENT_ALIAS_REVIEW_HEADER = [
  'priority',
  'payment_id',
  'payment_customer_name',
  'payment_line_name',
  'writeback_alias_name',
  'contract_date',
  'paid_date',
  'plan_name',
  'amount',
  'payment_segment',
  'payment_source_sheet',
  'payment_source_row',
  'candidate_segment',
  'candidate_line_registration_id',
  'candidate_display_name',
  'candidate_line_registration_name',
  'candidate_real_name',
  'current_status',
  'current_canonical_customer_id',
  'current_canonical_customer_name',
  'suggestion_basis',
  'suggested_action',
  'operator_decision_status',
  'operator_selected_customer_id',
  'operator_selected_customer_name',
  'operator_note',
  'sync_status',
  'last_collected_at',
] as const;

export const CS_PAYMENT_ALIAS_REVIEW_REQUIRED_COLUMNS = [
  'operator_decision_status',
  'current_canonical_customer_id',
  'current_canonical_customer_name',
  'sync_status',
  'last_collected_at',
] as const;

export const CS_PAYMENT_ALIAS_REVIEW_EDITABLE_COLUMNS = [
  'operator_decision_status',
  'operator_selected_customer_id',
  'operator_selected_customer_name',
  'operator_note',
] as const;
