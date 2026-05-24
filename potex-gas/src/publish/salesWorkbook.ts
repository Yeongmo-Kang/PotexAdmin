import { getRuntimeConfig } from '../config';
import { SHEETS, VIEWS } from '../constants';
import { readSheetAsObjects, readSheetAsObjectsOrEmpty, clearAndRewrite, normalizeDateColumns, openSpreadsheetById } from '../sheets';
import {
  buildSalesReadme,
  buildSalesContractsView,
  buildSalesPendingPaymentsView,
  buildSalesFunnelEventsView,
  buildSalesDataHealth,
} from './views/sales';

export function publishSalesWorkbook(): void {
  const cfg = getRuntimeConfig();
  if (!cfg.enableSales || !cfg.salesSpreadsheetId) return;

  const db = openSpreadsheetById(cfg.dbSpreadsheetId);
  const sales = openSpreadsheetById(cfg.salesSpreadsheetId);

  const customerRows = readSheetAsObjects(db, SHEETS.CUSTOMERS);
  const coachRows = readSheetAsObjects(db, SHEETS.COACHES);
  const customerCoachAssignmentRows = readSheetAsObjectsOrEmpty(db, SHEETS.CUSTOMER_COACH_ASSIGNMENTS);
  const stagingPaymentRows = readSheetAsObjects(db, SHEETS.STAGING_PAYMENTS);
  const plansRows = readSheetAsObjects(db, SHEETS.PLANS);
  const paymentsRows = readSheetAsObjects(db, SHEETS.PAYMENTS);
  const conversionRows = readSheetAsObjects(db, SHEETS.CONVERSION_HISTORY);

  clearAndRewrite(sales, VIEWS.SALES_README, buildSalesReadme());
  clearAndRewrite(sales, VIEWS.SALES_CONTRACTS_VIEW, buildSalesContractsView(stagingPaymentRows, customerRows, customerCoachAssignmentRows, coachRows));
  clearAndRewrite(sales, VIEWS.SALES_PENDING_PAYMENTS, buildSalesPendingPaymentsView(stagingPaymentRows, customerRows, customerCoachAssignmentRows, coachRows));
  clearAndRewrite(sales, VIEWS.SALES_FUNNEL_EVENTS, buildSalesFunnelEventsView(conversionRows, customerRows, customerCoachAssignmentRows, coachRows));
  clearAndRewrite(sales, VIEWS.SALES_DATA_HEALTH, buildSalesDataHealth(stagingPaymentRows, plansRows, paymentsRows, conversionRows));

  normalizeDateColumns(sales, VIEWS.SALES_CONTRACTS_VIEW, [
    { header: 'contract_date', kind: 'date' },
    { header: 'paid_date', kind: 'date' },
  ]);
  normalizeDateColumns(sales, VIEWS.SALES_PENDING_PAYMENTS, [{ header: 'contract_date', kind: 'date' }]);
  normalizeDateColumns(sales, VIEWS.SALES_FUNNEL_EVENTS, [{ header: 'event_date', kind: 'date' }]);
}
