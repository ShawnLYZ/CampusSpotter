import { describe, it, expect } from 'vitest';
import { parseCsv, validateBaselineCsv, csvTemplate, rowsToCsv } from './csv.ts';
import { fixtureTables } from '../fixtures/rows/index.ts';
import type { BaselineValueRow, RoomRow } from './rows.ts';

const ctx = { existingKeys: ['population'] };

describe('parseCsv', () => {
  it('strips BOM, handles CRLF, quotes and trailing newline', () => {
    expect(parseCsv('﻿a,b\r\n"x, y",2\r\n')).toEqual([['a', 'b'], ['x, y', '2']]);
    expect(parseCsv('a,b\n"he said ""hi""",2')).toEqual([['a', 'b'], ['he said "hi"', '2']]);
  });
});

describe('validateBaselineCsv', () => {
  it('flags a bad seat count with its row (header is row 1)', () => {
    const r = validateBaselineCsv('rooms', 'code,block,level,room_type,seats\nR1,A,1,classroom,30\nR2,A,1,lab,0\n', ctx);
    expect(r.errors).toEqual([expect.objectContaining({ row: 3, column: 'seats' })]);
  });
  it('flags an unknown column on row 1', () => {
    const r = validateBaselineCsv('rooms', 'code,block,level,room_type,seats,extra\nR1,A,1,classroom,30,x\n', ctx);
    expect(r.errors[0]).toMatchObject({ row: 1, column: 'extra' });
  });
  it('rejects unknown baseline keys and accepts arrays', () => {
    const bad = validateBaselineCsv('baseline_values', 'key,value,unit,description\nnope,1,x,y\n', ctx);
    expect(bad.errors[0]).toMatchObject({ row: 2, column: 'key' });
    const ok = validateBaselineCsv('baseline_values', 'key,value,unit,description\npopulation,"[1,2,3]",x,y\n', ctx);
    expect(ok.errors).toEqual([]);
    expect(ok.rows[0].value).toEqual([1, 2, 3]);
  });
  it('requires all eight energy blocks', () => {
    const csv = 'block,base_load_kw,occupied_room_kw,idle_room_kw\n' + ['A', 'B', 'C', 'D', 'E', 'S', 'L'].map(b => `${b},10,1,1`).join('\n');
    expect(validateBaselineCsv('energy_profiles', csv, ctx).errors.length).toBeGreaterThan(0);
  });
  it('rejects opens >= closes for cafeterias', () => {
    const csv = 'id,name,zone,counters,service_rate_per_counter_15min,opens_min,closes_min,staff,diner_share\nm,Main,Z,4,20,600,500,5,0.5\n';
    expect(validateBaselineCsv('cafeteria_outlets', csv, ctx).errors[0]).toMatchObject({ row: 2, column: 'closes_min' });
  });
  it('validates a messy file the same as a clean one', () => {
    const clean = 'code,block,level,room_type,seats\nR1,A,,lab,30\n';
    const messy = '﻿code,block,level,room_type,seats\r\nR1,A,,lab,30\r\n\r\n';
    expect(validateBaselineCsv('rooms', messy, ctx)).toEqual(validateBaselineCsv('rooms', clean, ctx));
  });
  it('round-trips fixture rooms', () => {
    const rooms = (fixtureTables.rooms as RoomRow[]).map(r => ({ ...r }));
    const r = validateBaselineCsv('rooms', rowsToCsv('rooms', rooms), ctx);
    expect(r.errors).toEqual([]);
    expect(r.rows).toHaveLength(rooms.length);
  });
  it('round-trips the numeric and array fixture baseline values', () => {
    const rows = (fixtureTables.baseline_values as BaselineValueRow[]).filter(x => typeof x.value !== 'string');
    const r = validateBaselineCsv('baseline_values', rowsToCsv('baseline_values', rows.map(x => ({ ...x }))), { existingKeys: rows.map(x => x.key) });
    expect(r.errors).toEqual([]);
  });
});

describe('csvTemplate', () => {
  it('starts with the header', () => {
    expect(csvTemplate('rooms').startsWith('code,block,level,room_type,seats')).toBe(true);
    expect(csvTemplate('rooms', { code: 'R1', block: 'A', level: null, room_type: 'lab', seats: 30 })).toContain('R1,A,,lab,30');
  });
});
