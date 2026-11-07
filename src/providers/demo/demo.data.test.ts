import { describe, expect, it } from 'vitest';
import { validateLevers } from '@engine/index.ts';
import { createDemoProvider } from './createDemoProvider.ts';

describe('demo provider fixture disruptions (today 2026-11-05)', () => {
  const provider = createDemoProvider({ today: '2026-11-05', latencyMs: [0, 0] });
  const range = { from: '2026-11-01', to: '2027-03-31' };

  it('rates the multi-day Deepavali holiday low: no classes', async () => {
    const item = await provider.getDisruption('deepavali-2026');
    expect(item?.riskLevel).toBe('low');
    expect(item?.riskReason).toBe('No classes today');
  });

  it('rates the BTS concert medium', async () => {
    expect((await provider.getDisruption('bts-2026-12-12'))?.riskLevel).toBe('medium');
  });

  it('hides past items by default and flags them with includePast', async () => {
    expect((await provider.listDisruptions(range)).map((i) => i.id)).not.toContain('weeknd-2026-11-04');
    const past = await provider.listDisruptions({ ...range, includePast: true });
    expect(past.find((i) => i.id === 'weeknd-2026-11-04')?.isPast).toBe(true);
  });

  it('adds Friday prayer rule rows', async () => {
    const item = (await provider.listDisruptions(range)).find((i) => i.id === 'friday-prayer-2026-11-06');
    expect(item?.origin).toBe('rule');
  });

  it('gives the 13-day year-end break one risk level, from at most 14 days evaluated', async () => {
    const item = await provider.getDisruption('yearend-break-2026');
    // The 14-day cap, worst-day and earliest-tie rules are covered in shared/plans/itemRisk.test.ts.
    expect(['low', 'medium', 'high', 'critical']).toContain(item?.riskLevel);
    expect(item?.riskReason).toBeTruthy();
    expect(item?.topPeaks).toHaveLength(3);
  });

  it('sorts by start time ascending', async () => {
    const starts = (await provider.listDisruptions(range)).map((i) => Date.parse(i.startAt));
    expect(starts).toEqual([...starts].sort((a, b) => a - b));
  });
});

describe('demo provider write safety', () => {
  const range = { from: '2026-11-01', to: '2027-03-31' };
  const valid = {
    title: 'Safe', type: 'manual', kind: 'other', venue: null, expectedAttendance: null, notes: null,
    startAt: '2026-11-10T09:00:00+08:00', endAt: '2026-11-10T17:00:00+08:00',
  } as const;

  it('rejects invalid creates and keeps listing working', async () => {
    const provider = createDemoProvider({ today: '2026-11-05', latencyMs: [0, 0] });
    const before = (await provider.listDisruptions(range)).length;
    await expect(provider.createDisruption({ ...valid, startAt: 'garbage' })).rejects.toThrow(/valid ISO/);
    await expect(provider.createDisruption({ ...valid, endAt: valid.startAt })).rejects.toThrow(/after start/);
    await expect(provider.createDisruption({ ...valid, title: '  ' })).rejects.toThrow(/title/);
    expect(await provider.listDisruptions(range)).toHaveLength(before);
  });

  it('rejects invalid updates and leaves the item unchanged', async () => {
    const provider = createDemoProvider({ today: '2026-11-05', latencyMs: [0, 0] });
    const item = await provider.createDisruption(valid);
    await expect(provider.updateDisruption(item.id, { ...valid, title: 'Changed', endAt: 'nope' })).rejects.toThrow(/valid ISO/);
    expect((await provider.getDisruption(item.id))?.title).toBe('Safe');
    expect((await provider.listDisruptions(range)).map((i) => i.id)).toContain(item.id);
  });

  it('does not store a created row whose risk cannot be computed', async () => {
    const provider = createDemoProvider({ today: '2026-11-05', latencyMs: [0, 0], tables: { settings: [] } });
    await expect(provider.createDisruption(valid)).rejects.toThrow(/settings/);
    expect((await provider.listDisruptions(range)).some((i) => i.title === 'Safe')).toBe(false);
  });

  it('lists a row whose risk cannot be computed without risk instead of failing the list', async () => {
    const provider = createDemoProvider({ today: '2026-11-05', latencyMs: [0, 0], tables: { settings: [] } });
    provider.__test.insertDisruptionRow({
      id: 'bad-risk', title: 'Bad risk', type: 'manual', kind: 'other', venue: null,
      start_at: valid.startAt, end_at: valid.endAt, expected_attendance: null, attendance_label: null, origin: 'manual',
      override_start_at: null, override_end_at: null, override_attendance: null, overridden_by: null, overridden_at: null,
      status: 'active', risk_level: null, risk_reason: null, risk_peaks: null, risk_computed_at: null,
      notes: null, dedupe_key: null, created_by: null, updated_at: '2026-11-05T00:00:00+08:00',
    });
    const items = await provider.listDisruptions(range);
    expect(items.find((i) => i.id === 'bad-risk')).toMatchObject({ riskLevel: null, riskReason: null, topPeaks: [] });
    expect(items.length).toBeGreaterThan(1);
  });
});

describe('demo provider scripted plans per day type', () => {
  const provider = createDemoProvider({ today: '2026-11-05', latencyMs: [0, 0] });
  it.each([
    ['Friday', '2026-11-06', ['Smooth the restart', 'Extra counters only', 'Stagger only']],
    ['weekday', '2026-11-18', ['Afternoon online', 'One extra bus', 'Advisory and loop']],
  ])('generates evaluable plans without lever warnings for a %s', async (_n, date, names) => {
    const plans = await provider.generatePlans({ date }, 2000);
    expect(plans.map((p) => p.name)).toEqual(names);
    const bundle = await provider.getInputBundle({ date });
    for (const p of plans) {
      expect(validateLevers(p.levers, bundle).warnings, p.name).toEqual([]);
      expect(p.costLines.length).toBeGreaterThanOrEqual(1);
    }
    if (date === '2026-11-06') expect(plans[2].levers.map((l) => l.kind)).toEqual(['stagger']);
  });
});
