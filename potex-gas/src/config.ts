import { PROPS } from './constants';

export type RuntimeConfig = {
  dbSpreadsheetId: string;
  csSpreadsheetId: string;
  conciergeSpreadsheetId?: string;
  salesSpreadsheetId?: string;
  coachesSpreadsheetId?: string;
  execSpreadsheetId?: string;
  inaiSpreadsheetId?: string;
  satoSpreadsheetId?: string;
  customerV2SpreadsheetId?: string;
  enableConcierge: boolean;
  enableSales: boolean;
  enableCoaches: boolean;
  enableExec: boolean;
  sourceCustomersWorkbookId?: string;
  sourceCustomersSheetName: string;
  sourceApplicationsSheetName: string;
  sourceFeedbackWorkbookId: string;
  sourceFeedbackSheets: string[];
  sourceCommercialWorkbookId?: string;
  sourceCustomersFallbackToCanonical: boolean;
};

const DEFAULT_SCRIPT_PROPERTIES: Record<string, string> = {
  [PROPS.DB_SPREADSHEET_ID]: '1sJuEM1RXn5zVeBj6dVTujnf0P2m-CweLPbt_gpcxFFs',
  [PROPS.CS_SPREADSHEET_ID]: '1KFRLdsT2-LlhSA0YLkXuV3Oh76yxnhL_6tvmOdvv4yg',
  [PROPS.CONCIERGE_SPREADSHEET_ID]: '1c-Ie03M619iMqhwqV1jHPSYDVPTMHPPKs6zhSr8QPr8',
  [PROPS.SALES_SPREADSHEET_ID]: '1i5uxVG9IUu0PTPSy9MqWMHcmNDNk3LDJwZo7nqT_Xao',
  [PROPS.COACHES_SPREADSHEET_ID]: '19jpwf97PwDj93bVB3WJdhXhtT-vo8YmNGA6T0eEigUc',
  [PROPS.EXEC_SPREADSHEET_ID]: '1pnEWHFdGHY6Er3aAXuvAz-H1MwgQcvrEZq_Z5oqdwuY',
  [PROPS.INAI_SPREADSHEET_ID]: '',
  [PROPS.SATO_SPREADSHEET_ID]: '',
  [PROPS.CUSTOMER_V2_SPREADSHEET_ID]: '',
  [PROPS.ENABLE_CONCIERGE]: 'false',
  [PROPS.ENABLE_SALES]: 'true',
  [PROPS.ENABLE_COACHES]: 'true',
  [PROPS.ENABLE_EXEC]: 'true',
  [PROPS.SOURCE_CUSTOMERS_WORKBOOK_ID]: '17fkrUdf-vS7tQ06lzR3LDp-PPsWSwajqPcB0vyRXOk4',
  [PROPS.SOURCE_CUSTOMERS_SHEET_NAME]: '顧客管理',
  [PROPS.SOURCE_APPLICATIONS_SHEET_NAME]: 'フォームの回答',
  [PROPS.SOURCE_FEEDBACK_WORKBOOK_ID]: '1hl2JVJ_DSvjtk8axnZWJ8TTwOIMECfkREg7rN6tbDH8',
  [PROPS.SOURCE_FEEDBACK_SHEETS]: '通常月用,（最終月用）',
  [PROPS.SOURCE_COMMERCIAL_WORKBOOK_ID]: '1arXU3lqzY8c7-mYY7CnDlxEpr5ar68Q2m4h4HEwLYC8',
  [PROPS.SOURCE_CUSTOMERS_FALLBACK_TO_CANONICAL]: 'true',
};

function getProp(key: string): string {
  const value = PropertiesService.getScriptProperties().getProperty(key);
  if (typeof value === 'string' && value !== '') return value;
  return DEFAULT_SCRIPT_PROPERTIES[key] || '';
}

function asBool(value: string): boolean {
  return ['1', 'true', 'yes', 'on'].includes((value || '').toLowerCase());
}

function parseList(value: string, fallback: string[]): string[] {
  const raw = (value || '').trim();
  if (!raw) return fallback;
  if (raw.startsWith('[')) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map(String).map((item) => item.trim()).filter(Boolean);
    } catch (error) {
      // fall through to comma-split
    }
  }
  return raw.split(',').map((item) => item.trim()).filter(Boolean);
}

export function getRuntimeConfig(): RuntimeConfig {
  const conciergeSpreadsheetId = getProp(PROPS.CONCIERGE_SPREADSHEET_ID) || undefined;
  const salesSpreadsheetId = getProp(PROPS.SALES_SPREADSHEET_ID) || undefined;
  const coachesSpreadsheetId = getProp(PROPS.COACHES_SPREADSHEET_ID) || undefined;
  const inaiSpreadsheetId = getProp(PROPS.INAI_SPREADSHEET_ID) || undefined;
  const satoSpreadsheetId = getProp(PROPS.SATO_SPREADSHEET_ID) || undefined;
  const customerV2SpreadsheetId = getProp(PROPS.CUSTOMER_V2_SPREADSHEET_ID) || undefined;
  return {
    dbSpreadsheetId: getProp(PROPS.DB_SPREADSHEET_ID),
    csSpreadsheetId: getProp(PROPS.CS_SPREADSHEET_ID),
    conciergeSpreadsheetId,
    salesSpreadsheetId,
    coachesSpreadsheetId,
    execSpreadsheetId: getProp(PROPS.EXEC_SPREADSHEET_ID) || undefined,
    inaiSpreadsheetId,
    satoSpreadsheetId,
    customerV2SpreadsheetId,
    enableConcierge: asBool(getProp(PROPS.ENABLE_CONCIERGE)) || Boolean(conciergeSpreadsheetId),
    enableSales: asBool(getProp(PROPS.ENABLE_SALES)) || Boolean(salesSpreadsheetId),
    enableCoaches: asBool(getProp(PROPS.ENABLE_COACHES)) || Boolean(coachesSpreadsheetId),
    enableExec: asBool(getProp(PROPS.ENABLE_EXEC)),
    sourceCustomersWorkbookId: getProp(PROPS.SOURCE_CUSTOMERS_WORKBOOK_ID) || undefined,
    sourceCustomersSheetName: getProp(PROPS.SOURCE_CUSTOMERS_SHEET_NAME) || '顧客管理',
    sourceApplicationsSheetName: getProp(PROPS.SOURCE_APPLICATIONS_SHEET_NAME) || 'フォームの回答',
    sourceFeedbackWorkbookId: getProp(PROPS.SOURCE_FEEDBACK_WORKBOOK_ID) || '1hl2JVJ_DSvjtk8axnZWJ8TTwOIMECfkREg7rN6tbDH8',
    sourceFeedbackSheets: parseList(getProp(PROPS.SOURCE_FEEDBACK_SHEETS), ['通常月用', '（最終月用）']),
    sourceCommercialWorkbookId: getProp(PROPS.SOURCE_COMMERCIAL_WORKBOOK_ID) || '1arXU3lqzY8c7-mYY7CnDlxEpr5ar68Q2m4h4HEwLYC8',
    sourceCustomersFallbackToCanonical: asBool(getProp(PROPS.SOURCE_CUSTOMERS_FALLBACK_TO_CANONICAL) || 'true'),
  };
}

export function setInitialScriptProperties(values: Partial<Record<string, string>> = {}): void {
  const existing = PropertiesService.getScriptProperties().getProperties();
  const merged: Record<string, string> = { ...DEFAULT_SCRIPT_PROPERTIES };

  Object.entries(existing).forEach(([key, value]) => {
    if (typeof value === 'string' && value !== '') merged[key] = value;
  });

  Object.entries(values).forEach(([key, value]) => {
    if (typeof value === 'string' && value !== '') merged[key] = value;
  });

  PropertiesService.getScriptProperties().setProperties(merged, false);
}
