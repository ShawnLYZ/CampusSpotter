export type SqlType = 'text' | 'number' | 'boolean' | 'jsonb' | 'timestamptz' | 'date';
export interface SqlColumn { name: string; type: SqlType }

const quote = (s: string): string => `'${s.replaceAll("'", "''")}'`;

export function sqlLiteral(v: unknown, type: SqlType): string {
  if (v === null || v === undefined) return 'null';
  switch (type) {
    case 'number':
      if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error(`bad number literal: ${String(v)}`);
      return String(v);
    case 'boolean':
      return v ? 'true' : 'false';
    case 'jsonb':
      return `${quote(JSON.stringify(v))}::jsonb`;
    case 'timestamptz':
      return `${quote(String(v))}::timestamptz`;
    case 'date':
      return `${quote(String(v))}::date`;
    default:
      return quote(String(v));
  }
}

export function toUpsertSql(
  table: string,
  rows: Record<string, unknown>[],
  columns: SqlColumn[],
  conflict: string[],
): string {
  if (rows.length === 0) return '';
  const names = columns.map((c) => c.name).join(', ');
  const values = rows
    .map((r) => `(${columns.map((c) => sqlLiteral(r[c.name], c.type)).join(', ')})`)
    .join(',\n');
  const updates = columns.filter((c) => !conflict.includes(c.name)).map((c) => `${c.name} = excluded.${c.name}`);
  const action = updates.length ? `do update set ${updates.join(', ')}` : 'do nothing';
  return `insert into public.${table} (${names}) values\n${values}\non conflict (${conflict.join(', ')}) ${action};`;
}
