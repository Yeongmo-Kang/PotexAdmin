import { getRuntimeConfig } from '../config';
import { SHEETS, VIEWS } from '../constants';
import { openSpreadsheetById, readSheetAsObjects, readSheetAsObjectsOrEmpty, clearAndRewrite, normalizeDateColumns } from '../sheets';
import {
  buildCoachReadme,
  buildCoachLoadView,
  buildCoachFollowupAlertsView,
  buildCoachDataHealth,
} from './views';

export function publishCoachesWorkbook(): void {
  const cfg = getRuntimeConfig();
  if (!cfg.enableCoaches || !cfg.coachesSpreadsheetId) return;

  const db = openSpreadsheetById(cfg.dbSpreadsheetId);
  const coaches = openSpreadsheetById(cfg.coachesSpreadsheetId);
  const coachLoadRows = readSheetAsObjectsOrEmpty(db, SHEETS.OPS_COACH_LOAD);
  const followupRows = readSheetAsObjects(db, SHEETS.OPS_FOLLOWUP_QUEUE);

  clearAndRewrite(coaches, VIEWS.COACH_README, buildCoachReadme());
  clearAndRewrite(coaches, VIEWS.COACH_LOAD, buildCoachLoadView(coachLoadRows));
  clearAndRewrite(coaches, VIEWS.COACH_FOLLOWUP_ALERTS, buildCoachFollowupAlertsView(followupRows));
  clearAndRewrite(coaches, VIEWS.COACH_DATA_HEALTH, buildCoachDataHealth(coachLoadRows, followupRows));

  normalizeDateColumns(coaches, VIEWS.COACH_FOLLOWUP_ALERTS, [{ header: 'feedback_date', kind: 'datetime' }]);
}
