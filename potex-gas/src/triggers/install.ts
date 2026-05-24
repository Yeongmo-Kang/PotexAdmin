import { runFullRefresh, runPublishAll, runWritebackCollection } from '../main';

export function installTriggers(): void {
  deleteManagedTriggers();
  ScriptApp.newTrigger('handlePublishTrigger').timeBased().everyHours(1).create();
  ScriptApp.newTrigger('handleWritebackTrigger').timeBased().everyMinutes(30).create();
  ScriptApp.newTrigger('handleDailyRefreshTrigger').timeBased().everyDays(1).atHour(7).create();
}

export function deleteManagedTriggers(): void {
  ScriptApp.getProjectTriggers().forEach((trigger) => ScriptApp.deleteTrigger(trigger));
}

export function reinstallTriggers(): void {
  installTriggers();
}

export function handlePublishTrigger(): void {
  runPublishAll();
}

export function handleWritebackTrigger(): void {
  runWritebackCollection();
}

export function handleDailyRefreshTrigger(): void {
  runFullRefresh();
}
