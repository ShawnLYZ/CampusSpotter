import { describe, expect, it } from 'vitest';
import { memoryRowsClient } from '../bundle/assemble.ts';
import type { RowsClient } from '../bundle/assemble.ts';
import type { DisruptionRow } from '../bundle/rows.ts';
import { fixtureTables } from '../fixtures/rows/index.ts';
import { itemRisk } from './itemRisk.ts';

const synthetic = (id: string, startDate: string, endDate: string): DisruptionRow => ({
  id, title: id, type: 'manual', kind: 'other', venue: null,
  start_at: `${startDate}T09:00:00+08:00`, end_at: `${endDate}T17:00:00+08:00`,
  expected_attendance: null, attendance_label: null, origin: 'manual',
  override_start_at: null, override_end_at: null, override_attendance: null, overridden_by: null, overridden_at: null,
  status: 'active', risk_level: null, risk_reason: null, risk_peaks: null, risk_computed_at: null,
  notes: null, dedupe_key: null, created_by: null, updated_at: '2026-11-05T00:00:00+08:00',
});

/** Fixture tables plus `row`; counts one evaluated day per prayer_times lookup. */
function countingClient(row: DisruptionRow): { client: RowsClient; days: () => number } {
  const inner = memoryRowsClient({ ...fixtureTables, disruptions: [...(fixtureTables.disruptions as DisruptionRow[]), row] });
  let days = 0;
  return {
    client: { select: (table, filters) => { if (table === 'prayer_times') days++; return inner.select(table, filters); } },
    days: () => days,
  };
}

describe('itemRisk', () => {
  it('evaluates at most 14 days of a long disruption', async () => {
    const row = synthetic('long', '2026-11-09', '2026-12-31');
    const { client, days } = countingClient(row);
    await itemRisk(client, row);
    expect(days()).toBe(14);
  });

  it('evaluates every day of the 13-day year-end break, never more than 14', async () => {
    const row = (fixtureTables.disruptions as DisruptionRow[]).find((d) => d.id === 'yearend-break-2026')!;
    const { client, days } = countingClient({ ...row, id: 'copy' });
    await itemRisk(client, row);
    expect(days()).toBe(13);
  });

  it('returns the worst day, with that day\'s reason and peaks', async () => {
    // 9 Nov is low, 10 Nov is medium, 11 Nov is low.
    const row = synthetic('worst', '2026-11-09', '2026-11-11');
    const risk = await itemRisk(countingClient(row).client, row);
    expect(risk.level).toBe('medium');
    expect(risk.reason).toBe('Classrooms reach 85% of seats around 6:00 PM');
    expect(risk.peaks).toHaveLength(3);
    expect(risk.peaks[0]).toMatchObject({ metric: 'classroomOccupancy', value: 85, atMin: 1080 });
  });

  it('breaks ties between equally bad days in favour of the earliest', async () => {
    // 16 Nov high (106%), 17 Nov medium, 18 Nov high (107%), 19 Nov high (113%).
    const row = synthetic('tie', '2026-11-16', '2026-11-19');
    const risk = await itemRisk(countingClient(row).client, row);
    expect(risk.level).toBe('high');
    expect(risk.reason).toBe('The Spine reaches 106% of capacity around 1:00 PM');
  });

  it('rates a multi-day holiday by its days: no classes means low', async () => {
    const row = (fixtureTables.disruptions as DisruptionRow[]).find((d) => d.id === 'deepavali-2026')!;
    const risk = await itemRisk(countingClient({ ...row, id: 'copy' }).client, row);
    expect(risk).toMatchObject({ level: 'low', reason: 'No classes today' });
  });
});
