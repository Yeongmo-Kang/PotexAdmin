import { VIEWS } from './constants';

const LEGACY_VIEW_NAME_ALIASES: Record<string, string[]> = {
  [VIEWS.CS_README]: ['CS_README'],
  [VIEWS.CS_FOLLOWUP_QUEUE]: ['CS_Followup_Queue'],
  [VIEWS.CS_CONTINUATION_TARGETS]: ['CS_Continuation_Targets'],
  [VIEWS.CS_EXCEPTION_REVIEW]: ['CS_Exception_Review'],
  [VIEWS.CS_ALIAS_RESOLUTION_INPUT]: ['CS_Alias_Resolution_Input'],
  [VIEWS.CS_ASSIGNMENT_INPUT]: ['CS_Assignment_Input'],
  [VIEWS.CS_APPROVAL_PROGRESS]: ['CS_Approval_Progress'],
  [VIEWS.CS_PAYMENT_ALIAS_REVIEW]: ['CS_Payment_Alias_Review'],
  [VIEWS.CS_CONTINUATION_ALIAS_REVIEW]: ['CS_Continuation_Alias_Review'],
  [VIEWS.CONCIERGE_README]: ['Concierge_README'],
  [VIEWS.CONCIERGE_FOLLOWUP_VIEW]: ['Concierge_Followup_View'],
  [VIEWS.CONCIERGE_DATA_HEALTH]: ['Concierge_Data_Health'],
  [VIEWS.SALES_README]: ['Sales_README'],
  [VIEWS.SALES_CONTRACTS_VIEW]: ['Sales_Contracts_View'],
  [VIEWS.SALES_PENDING_PAYMENTS]: ['Sales_Pending_Payments'],
  [VIEWS.SALES_FUNNEL_EVENTS]: ['Sales_Funnel_Events'],
  [VIEWS.SALES_DATA_HEALTH]: ['Sales_Data_Health'],
  [VIEWS.EXEC_README]: ['Exec_README'],
  [VIEWS.EXEC_COACH_LOAD_SUMMARY]: ['Exec_Coach_Load_Summary'],
  [VIEWS.EXEC_CUSTOMER_RISK_SUMMARY]: ['Exec_Customer_Risk_Summary'],
  [VIEWS.EXEC_DATA_HEALTH]: ['Exec_Data_Health'],
  [VIEWS.EXEC_EXCEPTION_TREND]: ['Exec_Exception_Trend'],
  [VIEWS.COACH_README]: ['Coach_README'],
  [VIEWS.COACH_LOAD]: ['Coach_Load'],
  [VIEWS.COACH_FOLLOWUP_ALERTS]: ['Coach_Followup_Alerts'],
  [VIEWS.COACH_DATA_HEALTH]: ['Coach_Data_Health'],
  [VIEWS.PARTNER_README]: ['Partner_README'],
  [VIEWS.PARTNER_ASSIGNED_LEADS]: ['Partner_Assigned_Leads'],
  [VIEWS.PARTNER_STATUS_INPUT]: ['Partner_Status_Input'],
  [VIEWS.PARTNER_DATA_HEALTH]: ['Partner_Data_Health'],
};

const MACHINE_HEADER_REGEX = /^[a-z0-9]+(?:_[a-z0-9]+)*$/;
// Localization rule:
// - canonical / DB column keys remain English snake_case for schema stability.
// - operator-facing publish sheets may render Japanese display labels and localized enum values.
// - when a dual header is used, the machine header row stays hidden so formulas/writeback can keep using stable English keys.
const DISPLAY_HEADER_SHEETS = new Set<string>([
  VIEWS.CS_README,
  VIEWS.CS_FOLLOWUP_QUEUE,
  VIEWS.CS_CONTINUATION_TARGETS,
  VIEWS.CS_EXCEPTION_REVIEW,
  VIEWS.CS_APPROVAL_PROGRESS,
  VIEWS.CONCIERGE_README,
  VIEWS.CONCIERGE_FOLLOWUP_VIEW,
  VIEWS.CONCIERGE_DATA_HEALTH,
  VIEWS.SALES_README,
  VIEWS.SALES_CONTRACTS_VIEW,
  VIEWS.SALES_PENDING_PAYMENTS,
  VIEWS.SALES_FUNNEL_EVENTS,
  VIEWS.SALES_DATA_HEALTH,
  VIEWS.EXEC_README,
  VIEWS.EXEC_COACH_LOAD_SUMMARY,
  VIEWS.EXEC_CUSTOMER_RISK_SUMMARY,
  VIEWS.EXEC_DATA_HEALTH,
  VIEWS.EXEC_EXCEPTION_TREND,
  VIEWS.COACH_README,
  VIEWS.COACH_LOAD,
  VIEWS.COACH_FOLLOWUP_ALERTS,
  VIEWS.COACH_DATA_HEALTH,
  VIEWS.PARTNER_README,
  VIEWS.PARTNER_ASSIGNED_LEADS,
  VIEWS.PARTNER_DATA_HEALTH,
]);

const GENERIC_DISPLAY_LABELS: Record<string, string> = {
  section: '項目',
  content: '内容',
  purpose: '用途',
  read_first: '最初に見るタブ',
  safe_tabs: '主に使うタブ',
  publish_only: '編集ルール',
  writeback_policy: '反映ルール',
  data_freshness: '更新タイミング',
  editing_rule: '編集ルール',
  status_rule: '入力ステータス',
  escalation: '異常時の対応',
  interpretation: '見方',
  customer_ingest_mode: '顧客取込モード',
  ingest_note: '取込メモ',
  color_legend_red: '赤の意味',
  color_legend_orange: 'オレンジの意味',
  color_legend_green: '緑の意味',
  metric: '指標',
  value: '値',
  note: '補足',
  scope: '対象',
  priority: '優先度',
  customer_name: '顧客名',
  customer_id: '顧客ID',
  coach_name: 'コーチ名',
  coach_id: 'コーチID',
  feedback_id: 'フィードバックID',
  feedback_date: 'フィードバック日時',
  feedback_type: 'フィードバック種別',
  low_satisfaction_flag: '低満足フラグ',
  low_satisfaction_feedback_count: '低満足フィードバック件数',
  followup_reason: 'フォロー理由',
  followup_customer_count: 'フォロー対象数',
  followup_feedback_count: 'フォロー対象フィードバック数',
  comment: 'コメント',
  gap_comment: 'ギャップコメント',
  current_status: '現在ステータス',
  continuation_tag: '継続タグ',
  after_follow_progress: 'AF進捗',
  after_follow_offer_date: 'AF提案日',
  after_follow_event_date: 'AF実施日',
  assigned_coach_name: '担当コーチ名',
  course_name: 'コース名',
  active_customer_count: '稼働顧客数',
  active_customer_total: '稼働顧客数合計',
  session_count: 'セッション数',
  sessions_count: 'セッション行数',
  remaining_capacity: '残り余力',
  remaining_capacity_total: '残り余力合計',
  alias_name: '別名',
  respondent_name: '回答者名',
  respondent_email: '回答者メール',
  related_coach_name: '関連コーチ名',
  response_id: '回答ID',
  current_canonical_customer_id: '現在の紐づき顧客ID',
  current_canonical_customer_name: '現在の紐づき顧客名',
  operator_decision_status: '運営入力ステータス',
  operator_selected_customer_id: '運営選択 顧客ID',
  operator_selected_customer_name: '運営選択 顧客名',
  operator_selected_assignee_id: '運営選択 担当者ID',
  operator_selected_assignee_name: '運営選択 担当者名',
  operator_note: '運営メモ',
  sync_status: '同期ステータス',
  last_collected_at: '最終取込日時',
  suggestion_basis: '候補根拠',
  suggested_action: '推奨アクション',
  payment_id: '入金ID',
  payment_status: '入金ステータス',
  payment_customer_name: '入金表の顧客名',
  payment_line_name: '入金表のLINE名',
  canonical_customer_name: 'canonical顧客名',
  segment: '流入セグメント',
  sales_owner_name: '営業担当者名',
  customer_match_method: '顧客紐づけ方法',
  source_sheet: '元シート',
  source_row: '元行',
  writeback_alias_name: 'writeback用別名',
  contract_date: '契約日',
  paid_date: '入金日',
  plan_name: 'プラン名',
  amount: '金額',
  payment_segment: '入金流入セグメント',
  payment_source_sheet: '入金元シート',
  payment_source_row: '入金元行',
  candidate_segment: '候補セグメント',
  candidate_line_registration_id: '候補LINE登録ID',
  candidate_display_name: '候補表示名',
  candidate_line_registration_name: '候補LINE名',
  candidate_real_name: '候補実名',
  raw_name: '元の名前',
  cleaned_name: '整形後の名前',
  raw_plan: '元プラン名',
  raw_contract_date: '元契約日',
  raw_amount: '元金額',
  continuation_exception_id: '継続例外ID',
  lead_id: 'リードID',
  lead_display_name: 'リード名',
  phone: '電話番号',
  age: '年齢',
  suggested_assignee_id: '推奨担当者ID',
  suggested_assignee_name: '推奨担当者名',
  suggested_assignee_scope: '推奨担当範囲',
  current_assignee_id: '現在の担当者ID',
  current_assignee_name: '現在の担当者名',
  assignee_type: '担当種別',
  assignment_note: 'アサインメモ',
  form_response_sheet: 'フォーム回答シート',
  form_response_row: 'フォーム回答行',
  assignee_kind: '担当者区分',
  assignee_scope: '担当範囲',
  queue_status: 'キュー状況',
  feedback_coach_name: '回答上のコーチ名',
  owner: '担当者',
  source_ref: '参照元',
  date_jst: '日付(JST)',
  latest_run_at_jst: '最新実行日時(JST)',
  source_job: '集計元ジョブ',
  issue: '課題',
  status: '状態',
  open_total: '未処理合計',
  open_p1: 'P1未処理',
  open_p2: 'P2未処理',
  open_p3: 'P3未処理',
  undecided_p1: 'P1未決定',
  p1_undecided: 'P1未決定',
  decided_waiting_sync: '決定済み・反映待ち',
  invalid_open: '要修正件数',
  processed_last_7d: '直近7日処理件数',
  invalid_last_7d: '直近7日エラー件数',
  last_writeback_success_at_jst: '直近writeback成功日時',
  stale_30d: '30日以上更新なし',
  waiting_first_update: '初回更新待ち',
  meeting_completed: '面談完了',
  potex_in_progress: 'POTEX進行中',
  recruitment_active: '採用進行中',
  feedback_match_exception_count: 'フィードバック未紐づけ件数',
  feedback_match_exception_delta: 'フィードバック未紐づけ増減',
  payment_unmatched_count: '入金未紐づけ件数',
  payment_unmatched_delta: '入金未紐づけ増減',
  continuation_unmatched_count: '継続未紐づけ件数',
  continuation_unmatched_delta: '継続未紐づけ増減',
  line_registration_unmatched_count: 'LINE未紐づけ件数',
  line_registration_unmatched_delta: 'LINE未紐づけ増減',
  feedback_response_id_collision_count: 'response_id重複件数',
  feedback_response_id_collision_delta: 'response_id重複増減',
  customers_count: '顧客行数',
  coaches_count: 'コーチ行数',
  feedback_count: 'フィードバック行数',
  followup_queue_count: 'フォローキュー件数',
  continuation_targets_count: '継続対象件数',
  plans_count: 'プラン行数',
  payments_count: '入金行数',
  conversion_events_count: '転換イベント行数',
  line_registrations_count: 'LINE登録行数',
  partner_assignment_count: 'パートナー割当件数',
  partner_status_updated_count: 'パートナー更新済み件数',
  partner_stale_30d_count: 'パートナー30日停滞件数',
  partner_meeting_completed_count: 'パートナー面談完了件数',
  partner_potex_in_progress_count: 'パートナーPOTEX進行件数',
  partner_recruitment_active_count: 'パートナー採用進行件数',
  acquisition_with_channel_count: '流入タグあり件数',
  acquisition_without_channel_count: '流入タグなし件数',
  acquisition_top_channels: '主要流入チャネル',
  coach_count: 'コーチ人数',
  coaches_with_followup_count: 'フォロー対象ありコーチ数',
};

const SHEET_DISPLAY_LABEL_OVERRIDES: Record<string, Record<string, string>> = {
  [VIEWS.CS_README]: {
    section: '項目',
    content: '内容',
  },
  [VIEWS.EXEC_README]: {
    section: '項目',
    content: '内容',
  },
  [VIEWS.CONCIERGE_README]: {
    section: '項目',
    content: '内容',
  },
  [VIEWS.SALES_README]: {
    section: '項目',
    content: '内容',
  },
  [VIEWS.COACH_README]: {
    section: '項目',
    content: '内容',
  },
  [VIEWS.PARTNER_README]: {
    section: '項目',
    content: '内容',
  },
  [VIEWS.CS_APPROVAL_PROGRESS]: {
    scope: '対象範囲',
  },
};

function isLikelyMachineHeaderCell(value: string): boolean {
  return MACHINE_HEADER_REGEX.test(String(value || '').trim());
}

function isLikelyMachineHeaderRow(row: string[]): boolean {
  const nonEmpty = row.map((cell) => String(cell || '').trim()).filter(Boolean);
  if (nonEmpty.length < 2) return false;
  return nonEmpty.every((cell) => isLikelyMachineHeaderCell(cell));
}

function titleCaseEnglish(text: string): string {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function fallbackDisplayLabel(key: string): string {
  const normalized = String(key || '').trim();
  if (!normalized) return '';
  return titleCaseEnglish(normalized.replace(/_/g, ' '));
}

function buildDisplayHeaderRow(sheetName: string, machineHeader: Array<string | number | boolean>): string[] {
  const overrides = SHEET_DISPLAY_LABEL_OVERRIDES[sheetName] || {};
  return machineHeader.map((cell) => {
    const key = String(cell || '').trim();
    return overrides[key] || GENERIC_DISPLAY_LABELS[key] || fallbackDisplayLabel(key);
  });
}

function shouldDecorateWithDisplayHeader(sheetName: string, rows: Array<Array<string | number | boolean>>): boolean {
  if (!DISPLAY_HEADER_SHEETS.has(sheetName)) return false;
  if (rows.length === 0 || rows[0].length === 0) return false;
  return isLikelyMachineHeaderRow(rows[0].map((cell) => String(cell || '').trim()));
}

function decorateRowsForDisplay(
  sheetName: string,
  rows: Array<Array<string | number | boolean>>,
): { rows: Array<Array<string | number | boolean>>; dualHeader: boolean } {
  if (!shouldDecorateWithDisplayHeader(sheetName, rows)) {
    return { rows, dualHeader: false };
  }
  const machineHeader = rows[0];
  const displayHeader = buildDisplayHeaderRow(sheetName, machineHeader);
  return {
    rows: [displayHeader, machineHeader, ...rows.slice(1)],
    dualHeader: true,
  };
}

function resolveHeaderLayout(values: unknown[][]): { headerRowIndex: number; dataStartRowIndex: number } {
  if (values.length >= 2) {
    const secondRow = (values[1] || []).map((cell) => String(cell || '').trim());
    const firstRow = (values[0] || []).map((cell) => String(cell || '').trim());
    if (isLikelyMachineHeaderRow(secondRow) && firstRow.join('\u0001') !== secondRow.join('\u0001')) {
      return { headerRowIndex: 1, dataStartRowIndex: 2 };
    }
  }
  return { headerRowIndex: 0, dataStartRowIndex: 1 };
}

export function openSpreadsheetById(id: string): GoogleAppsScript.Spreadsheet.Spreadsheet {
  return SpreadsheetApp.openById(id);
}

function getSheetByCanonicalOrLegacyName(
  ss: GoogleAppsScript.Spreadsheet.Spreadsheet,
  sheetName: string,
): GoogleAppsScript.Spreadsheet.Sheet | null {
  const direct = ss.getSheetByName(sheetName);
  if (direct) return direct;
  const legacyNames = LEGACY_VIEW_NAME_ALIASES[sheetName] || [];
  for (const legacyName of legacyNames) {
    const legacySheet = ss.getSheetByName(legacyName);
    if (legacySheet) return legacySheet;
  }
  return null;
}

function renameLegacySheetIfNeeded(
  ss: GoogleAppsScript.Spreadsheet.Spreadsheet,
  sheetName: string,
): GoogleAppsScript.Spreadsheet.Sheet | null {
  const direct = ss.getSheetByName(sheetName);
  if (direct) return direct;
  const legacyNames = LEGACY_VIEW_NAME_ALIASES[sheetName] || [];
  for (const legacyName of legacyNames) {
    const legacySheet = ss.getSheetByName(legacyName);
    if (legacySheet) {
      legacySheet.setName(sheetName);
      return legacySheet;
    }
  }
  return null;
}

export function readSheetAsObjects(ss: GoogleAppsScript.Spreadsheet.Spreadsheet, sheetName: string): Array<Record<string, string>> {
  const sheet = getSheetByCanonicalOrLegacyName(ss, sheetName);
  if (!sheet) throw new Error(`Sheet not found: ${sheetName}`);
  const values = sheet.getDataRange().getValues();
  if (values.length === 0) return [];
  const layout = resolveHeaderLayout(values);
  const header = (values[layout.headerRowIndex] || []).map((cell) => String(cell || ''));
  return values.slice(layout.dataStartRowIndex).map((row) => {
    const obj: Record<string, string> = {};
    header.forEach((key, idx) => {
      obj[key] = String(row[idx] ?? '');
    });
    return obj;
  });
}

export function readSheetAsObjectsOrEmpty(ss: GoogleAppsScript.Spreadsheet.Spreadsheet, sheetName: string): Array<Record<string, string>> {
  const sheet = getSheetByCanonicalOrLegacyName(ss, sheetName);
  if (!sheet) return [];
  return readSheetAsObjects(ss, sheet.getName());
}

export function clearAndRewrite(
  ss: GoogleAppsScript.Spreadsheet.Spreadsheet,
  sheetName: string,
  rows: Array<Array<string | number | boolean>>,
): void {
  let sheet = renameLegacySheetIfNeeded(ss, sheetName);
  if (!sheet) sheet = ss.getSheetByName(sheetName);
  if (!sheet) sheet = ss.insertSheet(sheetName);
  sheet.getRange(1, 1, sheet.getMaxRows(), sheet.getMaxColumns()).breakApart();
  sheet.clearContents();
  if (rows.length === 0) return;

  const decorated = decorateRowsForDisplay(sheetName, rows);
  sheet.getRange(1, 1, decorated.rows.length, decorated.rows[0].length).setValues(decorated.rows);

  if (sheet.getMaxRows() >= 2) {
    if (decorated.dualHeader) {
      sheet.showRows(2, 1);
      sheet.hideRows(2, 1);
    } else {
      sheet.showRows(2, 1);
    }
  }
  sheet.setFrozenRows(1);
}

export type DateColumnSpec = {
  header: string;
  kind?: 'date' | 'datetime';
};

function parseSheetDateValue(value: unknown): Date | null {
  if (Object.prototype.toString.call(value) === '[object Date]') {
    const asDate = value as Date;
    return Number.isNaN(asDate.getTime()) ? null : asDate;
  }

  const text = String(value ?? '').trim();
  if (!text) return null;

  const normalized = text.replace(/[.]/g, '-').replace(/\//g, '-');
  const localMatch = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (localMatch) {
    const year = Number(localMatch[1]);
    const month = Number(localMatch[2]);
    const day = Number(localMatch[3]);
    const hour = Number(localMatch[4] || '0');
    const minute = Number(localMatch[5] || '0');
    const second = Number(localMatch[6] || '0');
    const parsed = new Date(year, month - 1, day, hour, minute, second);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function normalizeDateColumns(
  ss: GoogleAppsScript.Spreadsheet.Spreadsheet,
  sheetName: string,
  specs: DateColumnSpec[],
): void {
  const sheet = getSheetByCanonicalOrLegacyName(ss, sheetName);
  if (!sheet || specs.length === 0) return;
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();
  if (lastRow <= 1 || lastColumn === 0) return;

  const allValues = sheet.getRange(1, 1, Math.min(lastRow, 2), lastColumn).getValues();
  const layout = resolveHeaderLayout(allValues);
  const header = (allValues[layout.headerRowIndex] || []).map((cell) => String(cell || ''));
  const firstDataRowNumber = layout.dataStartRowIndex + 1;
  if (lastRow < firstDataRowNumber) return;

  specs.forEach((spec) => {
    const columnIndex = header.indexOf(spec.header);
    if (columnIndex < 0) return;

    const range = sheet.getRange(firstDataRowNumber, columnIndex + 1, lastRow - firstDataRowNumber + 1, 1);
    const values = range.getValues();
    let changed = false;
    const nextValues = values.map((row) => {
      const current = row[0];
      const parsed = parseSheetDateValue(current);
      if (!parsed) return [current];
      if (Object.prototype.toString.call(current) !== '[object Date]') changed = true;
      return [parsed];
    });

    if (changed) range.setValues(nextValues);
    range.setNumberFormat(spec.kind === 'datetime' ? 'yyyy-mm-dd hh:mm:ss' : 'yyyy-mm-dd');
  });
}

export function ensureSheet(
  ss: GoogleAppsScript.Spreadsheet.Spreadsheet,
  sheetName: string,
): GoogleAppsScript.Spreadsheet.Sheet {
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) sheet = ss.insertSheet(sheetName);
  return sheet;
}

export function rewriteObjects(
  ss: GoogleAppsScript.Spreadsheet.Spreadsheet,
  sheetName: string,
  header: string[],
  rows: Array<Record<string, string>>,
): void {
  clearAndRewrite(ss, sheetName, [header, ...rows.map((row) => header.map((key) => row[key] || ''))]);
}

export function ensureAuditColumns(
  ss: GoogleAppsScript.Spreadsheet.Spreadsheet,
  sheetName: string,
  syncedAt: string,
): void {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return;
  const lastColumn = sheet.getLastColumn();
  if (lastColumn === 0) return;
  const header = sheet.getRange(1, 1, 1, lastColumn).getValues()[0].map((cell) => String(cell || ''));
  const additions: string[] = [];
  if (!header.includes('created_at')) additions.push('created_at');
  if (!header.includes('updated_at')) additions.push('updated_at');

  if (additions.length > 0) {
    const startCol = lastColumn + 1;
    sheet.getRange(1, startCol, 1, additions.length).setValues([additions]);
    additions.forEach((column) => header.push(column));
  }

  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return;
  const numRows = lastRow - 1;

  ['created_at', 'updated_at'].forEach((column) => {
    const colIdx = header.indexOf(column);
    if (colIdx < 0) return;
    const col = colIdx + 1;
    const existing = sheet.getRange(2, col, numRows, 1).getValues();
    let needsUpdate = false;
    const next: Array<[string]> = existing.map((row) => {
      const cell = String(row[0] || '').trim();
      if (cell) return [cell];
      needsUpdate = true;
      return [syncedAt];
    });
    if (needsUpdate) {
      sheet.getRange(2, col, numRows, 1).setValues(next);
    }
  });
}
