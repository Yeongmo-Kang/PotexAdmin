import { getRuntimeConfig } from '../config';
import { SHEETS, VIEWS } from '../constants';
import { readSheetAsObjects, readSheetAsObjectsOrEmpty, clearAndRewrite, openSpreadsheetById } from '../sheets';
import { buildExecReadme, buildExecMeetingCheck, buildExecUpdateStatus, buildExecCoachLoad, buildExecCustomerRiskSummary, buildExecDataHealth, buildExecExceptionTrend } from './views/executive';

export function publishExecutiveWorkbook(): void {
  const cfg = getRuntimeConfig();
  if (!cfg.enableExec || !cfg.execSpreadsheetId) return;

  const db = openSpreadsheetById(cfg.dbSpreadsheetId);
  const exec = openSpreadsheetById(cfg.execSpreadsheetId);

  const coachLoadRows = readSheetAsObjects(db, SHEETS.OPS_COACH_LOAD);
  const customersRows = readSheetAsObjects(db, SHEETS.CUSTOMERS);
  const coachesRows = readSheetAsObjects(db, SHEETS.COACHES);
  const sessionsRows = readSheetAsObjects(db, SHEETS.SESSIONS);
  const feedbackRows = readSheetAsObjects(db, SHEETS.OPS_FOLLOWUP_QUEUE);
  const continuationRows = readSheetAsObjects(db, SHEETS.OPS_CONTINUATION_TARGETS);
  const exceptionRows = readSheetAsObjects(db, SHEETS.EXCEPTIONS_FEEDBACK_MATCH);
  const continuationExceptionRows = readSheetAsObjectsOrEmpty(db, SHEETS.EXCEPTIONS_CONTINUATION_MATCH);
  const canonicalFeedbackRows = readSheetAsObjects(db, SHEETS.FEEDBACK);
  const plansRows = readSheetAsObjects(db, SHEETS.PLANS);
  const paymentsRows = readSheetAsObjects(db, SHEETS.PAYMENTS);
  const conversionRows = readSheetAsObjects(db, SHEETS.CONVERSION_HISTORY);
  const stagingPaymentsRows = readSheetAsObjects(db, SHEETS.STAGING_PAYMENTS);
  const lineRegistrationRows = readSheetAsObjects(db, SHEETS.LINE_REGISTRATIONS);
  const customerCoachAssignmentRows = readSheetAsObjectsOrEmpty(db, SHEETS.CUSTOMER_COACH_ASSIGNMENTS);
  const syncLogRows = readSheetAsObjectsOrEmpty(db, SHEETS.SYNC_LOG);

  clearAndRewrite(exec, VIEWS.EXEC_README, buildExecReadme());
  clearAndRewrite(exec, VIEWS.EXEC_MEETING_CHECK, buildExecMeetingCheck(
    feedbackRows,
    continuationRows,
    exceptionRows,
    plansRows,
    paymentsRows,
    conversionRows,
    stagingPaymentsRows,
    lineRegistrationRows,
    continuationExceptionRows,
    customerCoachAssignmentRows,
    syncLogRows,
  ));
  clearAndRewrite(exec, VIEWS.EXEC_UPDATE_STATUS, buildExecUpdateStatus(
    feedbackRows,
    continuationRows,
    exceptionRows,
    plansRows,
    paymentsRows,
    conversionRows,
    stagingPaymentsRows,
    lineRegistrationRows,
    continuationExceptionRows,
    customerCoachAssignmentRows,
    syncLogRows,
  ));
  clearAndRewrite(exec, VIEWS.EXEC_COACH_LOAD_SUMMARY, buildExecCoachLoad(coachLoadRows));
  clearAndRewrite(exec, VIEWS.EXEC_CUSTOMER_RISK_SUMMARY, buildExecCustomerRiskSummary(feedbackRows, exceptionRows));
  clearAndRewrite(exec, VIEWS.EXEC_DATA_HEALTH, buildExecDataHealth(
    customersRows,
    coachesRows,
    sessionsRows,
    canonicalFeedbackRows,
    feedbackRows,
    continuationRows,
    exceptionRows,
    plansRows,
    paymentsRows,
    conversionRows,
    stagingPaymentsRows,
    lineRegistrationRows,
    continuationExceptionRows,
    customerCoachAssignmentRows,
    syncLogRows,
  ));
  clearAndRewrite(exec, VIEWS.EXEC_EXCEPTION_TREND, buildExecExceptionTrend(syncLogRows));
}
