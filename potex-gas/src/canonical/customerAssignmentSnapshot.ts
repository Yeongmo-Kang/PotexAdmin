export type Row = Record<string, string>;

function sourceKey(row: Row): string {
  return `${row['source_sheet'] || ''}::${row['source_row'] || ''}`;
}

export function buildAssignmentSnapshotRows(
  stagingRows: Row[],
  refreshedCustomers: Row[],
): Row[] {
  const customerIdBySourceKey = new Map<string, string>();
  refreshedCustomers.forEach((row) => {
    const key = sourceKey(row);
    const customerId = row['customer_id'] || '';
    if (key !== '::' && customerId && !customerIdBySourceKey.has(key)) customerIdBySourceKey.set(key, customerId);
  });

  return stagingRows.map((row) => {
    const key = sourceKey(row);
    const resolvedCustomerId = row['customer_id'] || customerIdBySourceKey.get(key) || '';
    return {
      ...row,
      customer_id: resolvedCustomerId,
    };
  });
}
