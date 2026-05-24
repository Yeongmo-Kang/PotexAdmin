export function requireValue(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing required configuration: ${name}`);
  }
  return value;
}

export function assertSheetExists(ss: GoogleAppsScript.Spreadsheet.Spreadsheet, sheetName: string): void {
  if (!ss.getSheetByName(sheetName)) {
    throw new Error(`Sheet not found: ${sheetName}`);
  }
}
