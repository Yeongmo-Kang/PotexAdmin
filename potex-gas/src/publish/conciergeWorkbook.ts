import { getRuntimeConfig } from '../config';
import { SHEETS, VIEWS } from '../constants';
import { readSheetAsObjects, readSheetAsObjectsOrEmpty, clearAndRewrite, normalizeDateColumns, openSpreadsheetById } from '../sheets';
import { buildConciergeDataHealth, buildConciergeFollowupView, buildConciergeReadme } from './views';

function inferCustomerIngestMode(cfg: ReturnType<typeof getRuntimeConfig>): string {
  if (!cfg.sourceCustomersWorkbookId) return 'canonical_fallback_active';
  return 'raw_source_configured';
}

export function publishConciergeWorkbook(): void {
  const cfg = getRuntimeConfig();
  if (!cfg.enableConcierge || !cfg.conciergeSpreadsheetId) return;

  const db = openSpreadsheetById(cfg.dbSpreadsheetId);
  const concierge = openSpreadsheetById(cfg.conciergeSpreadsheetId);
  const ingestMode = inferCustomerIngestMode(cfg);

  const followupRows = readSheetAsObjects(db, SHEETS.OPS_FOLLOWUP_QUEUE);
  const continuationRows = readSheetAsObjects(db, SHEETS.OPS_CONTINUATION_TARGETS);
  const customerCoachAssignmentRows = readSheetAsObjectsOrEmpty(db, SHEETS.CUSTOMER_COACH_ASSIGNMENTS);
  const coachRows = readSheetAsObjects(db, SHEETS.COACHES);
  const exceptionRows = readSheetAsObjects(db, SHEETS.EXCEPTIONS_FEEDBACK_MATCH);
  const continuationExceptionRows = readSheetAsObjectsOrEmpty(db, SHEETS.EXCEPTIONS_CONTINUATION_MATCH);
  const plansRows = readSheetAsObjects(db, SHEETS.PLANS);
  const paymentsRows = readSheetAsObjects(db, SHEETS.PAYMENTS);
  const conversionRows = readSheetAsObjects(db, SHEETS.CONVERSION_HISTORY);
  const stagingPaymentsRows = readSheetAsObjects(db, SHEETS.STAGING_PAYMENTS);
  const lineRegistrationRows = readSheetAsObjects(db, SHEETS.LINE_REGISTRATIONS);

  clearAndRewrite(concierge, VIEWS.CONCIERGE_README, buildConciergeReadme(ingestMode));
  clearAndRewrite(concierge, VIEWS.CONCIERGE_FOLLOWUP_VIEW, buildConciergeFollowupView(followupRows, customerCoachAssignmentRows, coachRows));
  clearAndRewrite(concierge, VIEWS.CONCIERGE_DATA_HEALTH, buildConciergeDataHealth(
    ingestMode,
    followupRows,
    continuationRows,
    exceptionRows,
    plansRows,
    paymentsRows,
    conversionRows,
    stagingPaymentsRows,
    lineRegistrationRows,
    continuationExceptionRows,
  ));

  normalizeDateColumns(concierge, VIEWS.CONCIERGE_FOLLOWUP_VIEW, [{ header: 'feedback_date', kind: 'datetime' }]);
}
