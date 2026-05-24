export function projectRowToHeader(
  header: readonly string[],
  row: Record<string, string>,
): Record<string, string> {
  const normalized: Record<string, string> = {};
  header.forEach((key) => {
    normalized[key] = row[key] || '';
  });
  return normalized;
}

export function rowsToContractValues(
  header: readonly string[],
  rows: Array<Record<string, string>>,
): string[][] {
  return [
    [...header],
    ...rows.map((row) => header.map((key) => row[key] || '')),
  ];
}

export function assertRequiredColumns(
  actualHeader: string[],
  requiredColumns: readonly string[],
  context: string,
): void {
  const missing = requiredColumns.filter((column) => !actualHeader.includes(column));
  if (!missing.length) return;
  throw new Error(`${context} is missing required columns: ${missing.join(', ')}`);
}
