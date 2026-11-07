import type { CsvReport } from '../../providers/types.ts';

/** Human-readable lines for an upload report. */
export function reportLines(r: CsvReport): string[] {
  if (r.errors.length === 0) return [`Applied ${r.rowCount} rows`];
  return r.errors.map((e) => `Row ${e.row}, ${e.column ?? 'file'}: ${e.message}`);
}

/** Columns shown in the values table: the spec columns plus the label column. */
export function displayColumns(table: string, specColumns: string[]): { key: string; header: string }[] {
  const labelKey = table === 'rooms' ? 'seats_label' : 'label';
  return [...specColumns.map((c) => ({ key: c, header: c })), { key: labelKey, header: 'label' }];
}

export function cellText(v: unknown): string {
  if (v === null || v === undefined) return '—';
  return typeof v === 'object' ? JSON.stringify(v) : String(v);
}
