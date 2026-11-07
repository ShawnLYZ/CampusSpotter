import { describe, it, expect } from 'vitest';
import { buildChecklist, dueAtIso } from './checklist.ts';
import { REPLAY_PLAN_4NOV } from './replayPlan.ts';
import { concert4Nov, normalWednesday } from '../fixtures/engine/index.ts';

describe('buildChecklist', () => {
  it('covers every team for the replay plan', async () => {
    const items = buildChecklist(REPLAY_PLAN_4NOV, await concert4Nov());
    expect(new Set(items.map(i => i.team))).toEqual(new Set(['transport', 'facilities', 'cafeteria', 'academic']));
    expect(items.map(i => i.text)).toContain('Run the nonstop shuttle loop 10:30 AM–12:00 PM');
    const online = items.find(i => i.text.startsWith('Move '));
    expect(online?.text.startsWith('Move 413 sessions online from 10:45 AM:')).toBe(true);
    const order = ['transport', 'facilities', 'cafeteria', 'academic'];
    const idx = items.map(i => order.indexOf(i.team));
    expect(idx).toEqual([...idx].sort((a, b) => a - b));
  });
  it('words bus hires with seats and date', async () => {
    const b = await normalWednesday();
    expect(buildChecklist([{ kind: 'extraBuses', buses: 2, fromMin: 600, toMin: 840 }], b)[0].text)
      .toBe('Hire 2 × 44-seat buses, 10:00 AM–2:00 PM, Wed, 18 Nov 2026');
  });
  it('omits studentCount', async () => {
    expect(buildChecklist([{ kind: 'studentCount', percent: 80 }], await normalWednesday())).toEqual([]);
  });
});

describe('dueAtIso', () => {
  it('rolls past midnight and uses +08:00', () => {
    expect(dueAtIso('2026-11-04', 1500)).toBe('2026-11-05T01:00:00+08:00');
    expect(dueAtIso('2026-11-04', 645)).toBe('2026-11-04T10:45:00+08:00');
    expect(dueAtIso('2026-11-04', null)).toBeNull();
  });
});
