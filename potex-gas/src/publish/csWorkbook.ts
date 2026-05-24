import { getRuntimeConfig } from '../config';
import { SHEETS, VIEWS } from '../constants';
import { readSheetAsObjects, readSheetAsObjectsOrEmpty, clearAndRewrite, normalizeDateColumns, openSpreadsheetById } from '../sheets';
import { buildCsReadme, buildCsFollowupQueue, buildCsContinuationTargets, buildCsAliasResolutionInput, buildCsPaymentAliasReview, buildCsContinuationAliasReview, buildCsApprovalProgress, buildCsAssignmentInput } from './views';

function safeReadSheetAsObjects(spreadsheet: GoogleAppsScript.Spreadsheet.Spreadsheet, sheetName: string): Array<Record<string, string>> {
  try {
    return readSheetAsObjects(spreadsheet, sheetName);
  } catch (error) {
    return [];
  }
}

function readRawSheetAsObjectsOrEmpty(spreadsheet: GoogleAppsScript.Spreadsheet.Spreadsheet, sheetName: string): Array<Record<string, string>> {
  const sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) return [];
  const values = sheet.getDataRange().getValues();
  if (!values.length) return [];
  const header = values[0].map((value) => String(value || '').trim());
  return values.slice(1).map((row, idx) => header.reduce<Record<string, string>>((acc, key, keyIdx) => {
    if (key) acc[key] = String(row[keyIdx] || '').trim();
    return acc;
  }, {
    lead_id: `LEAD-FORM-${String(idx + 2).padStart(5, '0')}`,
    lead_display_name: String(row[header.indexOf('氏名')] || row[header.indexOf('お名前')] || '').trim(),
    respondent_name: String(row[header.indexOf('氏名')] || row[header.indexOf('お名前')] || '').trim(),
    respondent_email: String(row[header.indexOf('メールアドレス')] || '').trim(),
    email: String(row[header.indexOf('メールアドレス')] || '').trim(),
    phone: String(row[header.indexOf('電話番号')] || '').trim(),
    age: String(row[header.indexOf('年齢')] || '').trim(),
    form_response_sheet: sheetName,
    form_response_row: String(idx + 2),
  }));
}

export function publishCsWorkbook(): void {
  const cfg = getRuntimeConfig();
  const db = openSpreadsheetById(cfg.dbSpreadsheetId);
  const cs = openSpreadsheetById(cfg.csSpreadsheetId);
  const sourceCustomers = openSpreadsheetById(cfg.sourceCustomersWorkbookId || '');

  const feedbackRows = readSheetAsObjects(db, SHEETS.OPS_FOLLOWUP_QUEUE);
  const continuationRows = readSheetAsObjects(db, SHEETS.OPS_CONTINUATION_TARGETS);
  const exceptionRows = readSheetAsObjects(db, SHEETS.EXCEPTIONS_FEEDBACK_MATCH);
  const aliasRows = readSheetAsObjects(db, SHEETS.CUSTOMER_ALIAS_MAP);
  const customerRows = readSheetAsObjects(db, SHEETS.CUSTOMERS);
  const coachRows = readSheetAsObjects(db, SHEETS.COACHES);
  const customerCoachAssignmentRows = readSheetAsObjectsOrEmpty(db, SHEETS.CUSTOMER_COACH_ASSIGNMENTS);
  const plansRows = readSheetAsObjects(db, SHEETS.PLANS);
  const stagingPaymentRows = readSheetAsObjects(db, SHEETS.STAGING_PAYMENTS);
  const lineRegistrationRows = readSheetAsObjects(db, SHEETS.LINE_REGISTRATIONS);
  const continuationExceptionRows = readSheetAsObjectsOrEmpty(db, SHEETS.EXCEPTIONS_CONTINUATION_MATCH);
  const syncLogRows = readSheetAsObjectsOrEmpty(db, SHEETS.SYNC_LOG);
  const existingAliasInputRows = safeReadSheetAsObjects(cs, VIEWS.CS_ALIAS_RESOLUTION_INPUT);
  const existingAssignmentInputRows = safeReadSheetAsObjects(cs, VIEWS.CS_ASSIGNMENT_INPUT);
  const existingPaymentAliasRows = safeReadSheetAsObjects(cs, VIEWS.CS_PAYMENT_ALIAS_REVIEW);
  const existingContinuationAliasRows = safeReadSheetAsObjects(cs, VIEWS.CS_CONTINUATION_ALIAS_REVIEW);
  const applicationRows = readRawSheetAsObjectsOrEmpty(sourceCustomers, cfg.sourceApplicationsSheetName);

  const paymentAliasReview = buildCsPaymentAliasReview(stagingPaymentRows, lineRegistrationRows, customerRows, aliasRows, existingPaymentAliasRows);
  const continuationAliasReview = buildCsContinuationAliasReview(continuationExceptionRows, lineRegistrationRows, customerRows, aliasRows, existingContinuationAliasRows);

  clearAndRewrite(cs, VIEWS.CS_README, buildCsReadme());
  clearAndRewrite(cs, VIEWS.CS_FOLLOWUP_QUEUE, buildCsFollowupQueue(feedbackRows));
  clearAndRewrite(cs, VIEWS.CS_CONTINUATION_TARGETS, buildCsContinuationTargets(continuationRows, customerCoachAssignmentRows, coachRows, plansRows));
  clearAndRewrite(cs, VIEWS.CS_EXCEPTION_REVIEW, [
    Object.keys(exceptionRows[0] || { issue: '', respondent_name: '', respondent_email: '' }),
    ...exceptionRows.map((r) => Object.values(r)),
  ]);
  clearAndRewrite(cs, VIEWS.CS_ALIAS_RESOLUTION_INPUT, buildCsAliasResolutionInput(exceptionRows, aliasRows, existingAliasInputRows));
  clearAndRewrite(cs, VIEWS.CS_ASSIGNMENT_INPUT, buildCsAssignmentInput(applicationRows, customerRows, coachRows, customerCoachAssignmentRows, existingAssignmentInputRows));
  clearAndRewrite(cs, VIEWS.CS_APPROVAL_PROGRESS, buildCsApprovalProgress(paymentAliasReview, continuationAliasReview, syncLogRows, customerCoachAssignmentRows));
  clearAndRewrite(cs, VIEWS.CS_PAYMENT_ALIAS_REVIEW, paymentAliasReview);
  clearAndRewrite(cs, VIEWS.CS_CONTINUATION_ALIAS_REVIEW, continuationAliasReview);

  normalizeDateColumns(cs, VIEWS.CS_FOLLOWUP_QUEUE, [{ header: 'feedback_date', kind: 'datetime' }]);
  normalizeDateColumns(cs, VIEWS.CS_CONTINUATION_TARGETS, [
    { header: 'after_follow_offer_date', kind: 'date' },
    { header: 'after_follow_event_date', kind: 'date' },
  ]);
  normalizeDateColumns(cs, VIEWS.CS_PAYMENT_ALIAS_REVIEW, [
    { header: 'contract_date', kind: 'date' },
    { header: 'paid_date', kind: 'date' },
  ]);
  normalizeDateColumns(cs, VIEWS.CS_CONTINUATION_ALIAS_REVIEW, [{ header: 'raw_contract_date', kind: 'date' }]);
}
