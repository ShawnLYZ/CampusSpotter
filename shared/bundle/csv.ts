import { BLOCK_IDS, ROOM_TYPES } from '../engine/types.ts';

export type BaselineTableName = 'baseline_values' | 'rooms' | 'cafeteria_outlets' | 'energy_profiles' | 'waiting_halls';
export interface CsvError { row: number; column: string | null; message: string }
export interface ColumnSpec {
  name: string;
  type: 'string' | 'int' | 'number' | 'json_or_number' | 'enum';
  min?: number;
  max?: number;
  values?: readonly string[];
  /** empty cell allowed; stored as null */
  optional?: boolean;
  unique?: boolean;
}

export const BASELINE_TABLES: { name: BaselineTableName; title: string; columns: ColumnSpec[]; mode: 'upsert_by_key' | 'replace' }[] = [
  {
    name: 'baseline_values', title: 'Baseline values', mode: 'upsert_by_key',
    columns: [
      { name: 'key', type: 'string' },
      { name: 'value', type: 'json_or_number' },
      { name: 'unit', type: 'string' },
      { name: 'description', type: 'string' },
    ],
  },
  {
    name: 'rooms', title: 'Rooms', mode: 'replace',
    columns: [
      { name: 'code', type: 'string', unique: true },
      { name: 'block', type: 'enum', values: BLOCK_IDS },
      { name: 'level', type: 'string', optional: true },
      { name: 'room_type', type: 'enum', values: ROOM_TYPES },
      { name: 'seats', type: 'int', min: 1, max: 1000 },
    ],
  },
  {
    name: 'cafeteria_outlets', title: 'Cafeteria outlets', mode: 'replace',
    columns: [
      { name: 'id', type: 'string', unique: true },
      { name: 'name', type: 'string' },
      { name: 'zone', type: 'string' },
      { name: 'counters', type: 'int', min: 0, max: 50 },
      { name: 'service_rate_per_counter_15min', type: 'number', min: 1, max: 100 },
      { name: 'opens_min', type: 'int', min: 0, max: 1560 },
      { name: 'closes_min', type: 'int', min: 0, max: 1560 },
      { name: 'staff', type: 'int', min: 0, max: 200 },
      { name: 'diner_share', type: 'number', min: 0, max: 1 },
    ],
  },
  {
    name: 'energy_profiles', title: 'Energy profiles', mode: 'replace',
    columns: [
      { name: 'block', type: 'enum', values: BLOCK_IDS, unique: true },
      { name: 'base_load_kw', type: 'number', min: 0, max: 5000 },
      { name: 'occupied_room_kw', type: 'number', min: 0, max: 100 },
      { name: 'idle_room_kw', type: 'number', min: 0, max: 100 },
    ],
  },
  {
    name: 'waiting_halls', title: 'Waiting halls', mode: 'replace',
    columns: [
      { name: 'id', type: 'string', unique: true },
      { name: 'name', type: 'string' },
      { name: 'block', type: 'enum', values: BLOCK_IDS },
      { name: 'capacity', type: 'int', min: 1, max: 5000 },
      { name: 'load_kw', type: 'number', min: 0, max: 1000 },
    ],
  },
];

export function parseCsv(text: string): string[][] {
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') { cell += '"'; i++; } else quoted = false;
      } else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += c;
  }
  if (cell !== '' || row.length > 0) { row.push(cell); rows.push(row); }
  return rows;
}

function spec(table: BaselineTableName) {
  return BASELINE_TABLES.find(t => t.name === table)!;
}

export function validateBaselineCsv(
  table: BaselineTableName, text: string, ctx: { existingKeys: string[] },
): { rows: Record<string, unknown>[]; errors: CsvError[] } {
  const { columns } = spec(table);
  const errors: CsvError[] = [];
  const grid = parseCsv(text);
  if (grid.length === 0) return { rows: [], errors: [{ row: 1, column: null, message: 'The file is empty' }] };
  const header = grid[0].map(h => h.trim());
  for (const h of header) {
    if (!columns.some(c => c.name === h)) errors.push({ row: 1, column: h, message: `Unknown column "${h}"` });
  }
  for (const c of columns) {
    if (!header.includes(c.name)) errors.push({ row: 1, column: c.name, message: `Missing column "${c.name}"` });
  }
  if (errors.length > 0) return { rows: [], errors };

  const rows: Record<string, unknown>[] = [];
  const seen = new Map<string, Set<string>>(columns.filter(c => c.unique).map(c => [c.name, new Set<string>()]));
  for (let r = 1; r < grid.length; r++) {
    const cells = grid[r];
    if (cells.every(c => c.trim() === '')) continue;
    const rowNo = r + 1;
    const before = errors.length;
    if (cells.length !== header.length) {
      errors.push({ row: rowNo, column: null, message: `Expected ${header.length} columns but found ${cells.length}` });
      continue;
    }
    const out: Record<string, unknown> = {};
    for (const c of columns) {
      const raw = cells[header.indexOf(c.name)].trim();
      const fail = (message: string) => errors.push({ row: rowNo, column: c.name, message });
      if (raw === '') {
        if (c.optional) out[c.name] = null; else fail(`"${c.name}" is required`);
        continue;
      }
      switch (c.type) {
        case 'string':
          out[c.name] = raw;
          break;
        case 'enum':
          if (c.values!.includes(raw)) out[c.name] = raw;
          else fail(`"${c.name}" must be one of ${c.values!.join(', ')}`);
          break;
        case 'int':
        case 'number': {
          const n = Number(raw);
          if (!Number.isFinite(n)) fail(`"${c.name}" must be a number`);
          else if (c.type === 'int' && !Number.isInteger(n)) fail(`"${c.name}" must be a whole number`);
          else if ((c.min !== undefined && n < c.min) || (c.max !== undefined && n > c.max)) fail(`"${c.name}" must be between ${c.min} and ${c.max}`);
          else out[c.name] = n;
          break;
        }
        case 'json_or_number': {
          const n = Number(raw);
          if (Number.isFinite(n)) { out[c.name] = n; break; }
          try {
            const j: unknown = JSON.parse(raw);
            if (Array.isArray(j) && j.every(x => typeof x === 'number' && Number.isFinite(x))) out[c.name] = j;
            else fail(`"${c.name}" must be a number or a JSON array of numbers`);
          } catch {
            fail(`"${c.name}" must be a number or a JSON array of numbers`);
          }
          break;
        }
      }
      const set = seen.get(c.name);
      if (set && c.name in out && out[c.name] !== null) {
        const v = String(out[c.name]);
        if (set.has(v)) fail(`Duplicate ${c.name} "${v}"`); else set.add(v);
      }
    }
    if (table === 'baseline_values' && typeof out.key === 'string' && !ctx.existingKeys.includes(out.key)) {
      errors.push({ row: rowNo, column: 'key', message: `Unknown key "${out.key}"` });
    }
    if (table === 'cafeteria_outlets' && typeof out.opens_min === 'number' && typeof out.closes_min === 'number' && out.opens_min >= out.closes_min) {
      errors.push({ row: rowNo, column: 'closes_min', message: '"closes_min" must be later than "opens_min"' });
    }
    if (errors.length === before) rows.push(out);
  }
  if (table === 'energy_profiles') {
    const have = new Set(rows.map(r => r.block));
    for (const b of BLOCK_IDS) {
      if (!have.has(b) && !errors.some(e => e.column === 'block')) {
        errors.push({ row: 1, column: 'block', message: `Block ${b} is missing; all 8 blocks are required` });
      }
    }
  }
  return { rows: errors.length === 0 ? rows : [], errors };
}

function cellText(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = Array.isArray(v) ? JSON.stringify(v) : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function csvTemplate(table: BaselineTableName, exampleRow?: Record<string, unknown>): string {
  const { columns } = spec(table);
  const head = columns.map(c => c.name).join(',');
  return exampleRow ? `${head}\n${columns.map(c => cellText(exampleRow[c.name])).join(',')}\n` : `${head}\n`;
}

export function rowsToCsv(table: BaselineTableName, rows: Record<string, unknown>[]): string {
  const { columns } = spec(table);
  return [columns.map(c => c.name).join(','), ...rows.map(r => columns.map(c => cellText(r[c.name])).join(','))].join('\n') + '\n';
}
