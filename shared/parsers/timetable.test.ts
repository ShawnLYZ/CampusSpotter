import { describe, it, expect } from 'vitest';
import snapshot from '../../docs/superpowers/specs/data/timetable-sessions-2026-10-26_2026-11-22.json' with { type: 'json' };
import { aggregateSessions, roomBlock, roomType, roomLevel, isOnlineRoom } from './timetable.ts';
import { stepStartMin } from '../engine/grid.ts';

const agg = aggregateSessions(snapshot.sessions, snapshot.capturedAt);
const day = (d: string) => agg.groups.filter(g => g.date === d);
const sum = (gs: { count: number }[]) => gs.reduce((a, g) => a + g.count, 0);

describe('timetable aggregation', () => {
  it('matches the 4 Nov physical-room counts (D11)', () => {
    expect(sum(day('2026-11-04'))).toBe(554);
    expect(sum(day('2026-11-04').filter(g => g.start_min >= 645))).toBe(413);
  });
  it('has no room in use on Fri 6 Nov from 12:45 to 2:15 pm', () => {
    for (let t = 23; t <= 29; t++) {
      const m = stepStartMin(t);
      expect(day('2026-11-06').filter(g => g.start_min <= m && m < g.end_min)).toHaveLength(0);
    }
  });
  it('applies room rules', () => {
    expect(roomBlock('D-07-13')).toBe('D'); expect(roomBlock('S-05-01 (Studio 1)')).toBe('S');
    expect(roomBlock('Auditorium 3 @ Block C Level 9')).toBe('C'); expect(roomBlock('Discussion Room 1 (4th floor Library)')).toBe('L');
    expect(roomBlock('Tech Lab 6-03')).toBe('U'); expect(roomBlock('Auditorium 1 @ Level 7')).toBe('U');
    expect(roomType('Auditorium 5 @ Level 3')).toBe('auditorium'); expect(roomType('B-01-GEOLOGY LAB')).toBe('lab');
    expect(roomType('E-05-01 (Architecture Studio)')).toBe('lab'); expect(roomType('D-06-01')).toBe('classroom');
    expect(roomLevel('D-07-13')).toBe('07'); expect(roomLevel('Auditorium 3 @ Block C Level 9')).toBe('9');
    expect(isOnlineRoom('ONLMCO3-10', 'APU CAMPUS')).toBe(true); expect(isOnlineRoom('ONLINE', 'APU CAMPUS')).toBe(true);
    expect(isOnlineRoom('D-07-13', 'ONL')).toBe(true); expect(isOnlineRoom('D-07-13', 'APU CAMPUS')).toBe(false);
  });
  it('keeps exact off-grid and out-of-grid times (Review Focus 1)', () => {
    const s = (start: string, end: string) => ({ date: '2026-11-30', room: 'A-04-01', location: 'APU CAMPUS', start, end, type: 'L', intakes: 2, firstOfDay: 2, lastOfDay: 1 });
    const r = aggregateSessions([s('2026-11-30T06:30:00+08:00', '2026-11-30T08:30:00+08:00'), s('2026-11-30T10:40:00+08:00', '2026-11-30T12:40:00+08:00')], 'x');
    expect(r.groups.map(g => [g.start_min, g.end_min, g.count, g.first_of_day_share, g.last_of_day_share]))
      .toEqual([[390, 510, 1, 1, 0.5], [640, 760, 1, 1, 0.5]]);
    const at = (step: number) => r.conditioned.find(c => c.step === step)?.rooms ?? 0;
    expect(at(0)).toBe(1); expect(at(15)).toBe(1); expect(at(23)).toBe(0);  // room conditioned 06:30 → 12:40
  });
  it('writes no personal or cohort fields', () => {
    const text = JSON.stringify(agg);
    for (const k of ['LECTID', 'NAME', 'SAMACCOUNTNAME', 'INTAKE']) expect(text).not.toContain(`"${k}"`);
  });
});

import sampleFeed from '../fixtures/recorded/timetable-feed-sample.json';
import { assertFeedShape, sessionsFromFeed } from './timetable.ts';

describe('sessionsFromFeed', () => {
  const sessions = sessionsFromFeed(assertFeedShape(sampleFeed));
  const find = (date: string, room: string, start: string) =>
    sessions.find((s) => s.date === date && s.room === room && s.start === `${date}T${start}:00+08:00`)!;

  it('derives intakes, firstOfDay, lastOfDay and type per (room, start) session', () => {
    expect(sessions).toHaveLength(10);
    expect(find('2026-11-09', 'B-01-01', '08:30')).toMatchObject({ intakes: 2, firstOfDay: 2, lastOfDay: 0, type: 'L', end: '2026-11-09T10:30:00+08:00', location: 'APU CAMPUS' });
    expect(find('2026-11-09', 'C-02-03', '11:00')).toMatchObject({ intakes: 1, firstOfDay: 0, lastOfDay: 0, type: 'T' });
    expect(find('2026-11-09', 'Lab 3 @ Block D', '11:00')).toMatchObject({ intakes: 1, firstOfDay: 0, lastOfDay: 0, type: 'LAB' });
    expect(find('2026-11-10', 'B-01-01', '14:00')).toMatchObject({ intakes: 1, firstOfDay: 0, lastOfDay: 1, type: '?' });
    expect(find('2026-11-10', 'ONLMCO3-1', '15:00')).toMatchObject({ intakes: 1, firstOfDay: 0, lastOfDay: 1, type: 'P' });
  });

  it('aggregates like the snapshot pipeline (online rooms excluded)', () => {
    const agg = aggregateSessions(sessions, '2026-11-09T21:00:00Z');
    expect(agg.days.map((d) => [d.date, d.sessions])).toEqual([['2026-11-09', 4], ['2026-11-10', 4]]);
  });

  it('carries no personal fields or cohort codes', () => {
    const out = JSON.stringify(sessions);
    for (const s of ['Test Lecturer', 'L999', 'tl999', 'UCDF2401', 'UCDF2402', 'LECTID', 'SAMACCOUNTNAME']) expect(out).not.toContain(s);
  });
});

describe('assertFeedShape', () => {
  it('throws schema for a non-array, an empty array and malformed leading rows', () => {
    expect(() => assertFeedShape({})).toThrow(/^schema/);
    expect(() => assertFeedShape([])).toThrow(/^schema/);
    expect(() => assertFeedShape([{ ROOM: 'A' }])).toThrow(/^schema/);
  });
  it('keeps only the allowed keys on new objects and drops malformed rows beyond the first 50', () => {
    const good = { ...(sampleFeed[0] as object) };
    const rows = [...Array.from({ length: 50 }, () => good), { ROOM: 'x' }, good];
    const out = assertFeedShape(rows);
    expect(out).toHaveLength(51);
    expect(out[0]).not.toBe(good);
    expect(Object.keys(out[0]).sort()).toEqual(['CLASS_CODE', 'DATESTAMP_ISO', 'INTAKE', 'LOCATION', 'ROOM', 'TIME_FROM_ISO', 'TIME_TO_ISO']);
  });
});
