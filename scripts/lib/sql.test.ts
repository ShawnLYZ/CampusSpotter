import { describe, expect, it } from 'vitest';
import { sqlLiteral, toUpsertSql } from './sql.ts';

const cols = [
  { name: 'code', type: 'text' as const },
  { name: 'block', type: 'text' as const },
  { name: 'seats', type: 'number' as const },
];

describe('sqlLiteral', () => {
  it('doubles single quotes in text', () => {
    expect(sqlLiteral("Kompleks Sukan Negara's", 'text')).toBe("'Kompleks Sukan Negara''s'");
  });
  it('quotes jsonb and doubles quotes', () => {
    expect(sqlLiteral({ a: "it's" }, 'jsonb')).toBe(`'{"a":"it''s"}'::jsonb`);
  });
  it('renders null', () => {
    expect(sqlLiteral(null, 'number')).toBe('null');
  });
  it('renders numbers and booleans bare', () => {
    expect(sqlLiteral(40, 'number')).toBe('40');
    expect(sqlLiteral(true, 'boolean')).toBe('true');
  });
});

describe('toUpsertSql', () => {
  it('builds an upsert excluding conflict columns from the update list', () => {
    const sql = toUpsertSql('rooms', [{ code: 'A-04-01', block: 'A', seats: 40 }], cols, ['code']);
    expect(sql).toContain('insert into public.rooms (code, block, seats) values');
    expect(sql).toContain('on conflict (code) do update set block = excluded.block, seats = excluded.seats;');
    expect(sql).not.toContain('code = excluded.code');
  });
  it('returns empty string for no rows', () => {
    expect(toUpsertSql('x', [], cols, ['id'])).toBe('');
  });
});
