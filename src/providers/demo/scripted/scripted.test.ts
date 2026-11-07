import { describe, expect, it } from 'vitest';
import { clock12, durationText, rmText, runForecast } from '@engine/index.ts';
import type { InputBundle, Summary } from '@engine/index.ts';
import { assembleBundle, fetchBundleRows, memoryRowsClient } from '@bundle/assemble.ts';
import { fixtureTables } from '@fixtures/rows/index.ts';
import { buildChecklist } from '@plans/checklist.ts';
import { REPLAY_PLAN_4NOV } from '@plans/replayPlan.ts';
import type { PlanProposal } from '../../types.ts';
import { announcementScripted } from './announcement.ts';
import { explainScripted } from './explain.ts';
import { scriptedPlans } from './plans.ts';

async function bundleFor(date: string): Promise<InputBundle> {
  return assembleBundle(await fetchBundleRows(memoryRowsClient(structuredClone(fixtureTables)), date));
}
const dur = (m: number | null): string => (m === null ? 'no shuttle queue' : durationText(m));

async function summaries(): Promise<{ a: Summary; b: Summary }> {
  const bundle = await bundleFor('2026-11-04');
  return { a: runForecast(bundle, []).summary, b: runForecast(bundle, REPLAY_PLAN_4NOV).summary };
}

describe('explainScripted', () => {
  it('uses only numbers from the formatted inputs, in 3 to 6 sentences', async () => {
    const { a, b } = await summaries();
    const text = explainScripted(a, b);
    const allowed = [
      dur(a.peakApuWaitMin), a.peaks.apuStopQueue.atMin === null ? '' : clock12(a.peaks.apuStopQueue.atMin), String(a.totalRedMinutes),
      dur(b.peakApuWaitMin), String(b.totalRedMinutes), rmText(b.totalCostRm),
      String(b.learningDisruption.sessionsMoved), String(Math.round(b.learningDisruption.share * 100)),
      String(Math.round(a.studentHoursWaited)), String(Math.round(b.studentHoursWaited)),
    ].join(' ');
    const trim = (n: string): string => n.replace(/[.,]+$/, '');   // a sentence-ending full stop is not part of the number
    const allowedNums = new Set((allowed.match(/\d[\d,.]*/g) ?? []).map(trim));
    for (const n of (text.match(/\d[\d,.]*/g) ?? []).map(trim)) expect(allowedNums.has(n), `unexpected number ${n} in: ${text}`).toBe(true);
    const sentences = text.split(/(?<=\.)\s+/);
    expect(sentences.length).toBeGreaterThanOrEqual(3);
    expect(sentences.length).toBeLessThanOrEqual(6);
  });

  it('prints "no shuttle queue" for a null wait', async () => {
    const { a, b } = await summaries();
    expect(explainScripted({ ...a, peakApuWaitMin: null }, b)).toContain('no shuttle queue');
  });
});

describe('announcementScripted', () => {
  it('is under 150 words and has the fixed opening and closing', async () => {
    const bundle = await bundleFor('2026-11-04');
    const plan = { levers: REPLAY_PLAN_4NOV } as PlanProposal;
    const text = announcementScripted(plan, { date: '2026-11-04' }, 'Concert', buildChecklist(REPLAY_PLAN_4NOV, bundle));
    expect(text.split(/\s+/).length).toBeLessThan(150);
    expect(text.startsWith('Dear students,')).toBe(true);
    expect(text.endsWith('Thank you for planning ahead. — APU Management')).toBe(true);
    expect(text).toContain('All classes from 10:45 AM will run online.');
  });
});

describe('announcementScripted names', () => {
  it('uses the real outlet and hall names from the checklist for Hybrid afternoon', async () => {
    const bundle = await bundleFor('2026-11-04');
    const levers = scriptedPlans({ date: '2026-11-04' }, 'weekday')[2].levers;
    const text = announcementScripted({ levers } as PlanProposal, { date: '2026-11-04' }, null, buildChecklist(levers, bundle));
    expect(text).toContain(`${bundle.baseline.cafeterias[0].name} will stay open until 10:00 PM.`);
    expect(text).toContain(`${bundle.baseline.waitingHalls.find((h) => h.id === 'main-hall')!.name} will be open as a cooled waiting area from 5:00 PM.`);
    expect(text.split(/\s+/).length).toBeLessThan(150);
  });
});

describe('scriptedPlans', () => {
  it.each([
    ['weekday', '2026-11-18', 'weekday'], ['friday', '2026-11-06', 'friday'], ['4 Nov', '2026-11-04', 'weekday'], ['weekend', '2026-11-21', 'weekend'],
  ] as const)('returns exactly three plans for %s', (_n, date, dayType) => {
    const plans = scriptedPlans({ date }, dayType);
    expect(plans).toHaveLength(3);
    for (const p of plans) expect(p.rationale.split(/(?<=\.)\s+/).length).toBeGreaterThanOrEqual(2);
  });
});
