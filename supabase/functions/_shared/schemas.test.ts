import { assert, assertEquals } from 'jsr:@std/assert@1';
import { validateJson } from './jsonschema.ts';
import { SCHEMAS } from './schemas.ts';
import { PROMPT_VERSION, SYSTEM_PROMPTS } from './prompts.ts';

const p = { name: 'A', levers: { nonstopLoop: [{ fromMin: 600, toMin: 700 }] }, rationale: 'r' };

Deno.test('plans schema requires exactly three plans', () => {
  assert(validateJson(SCHEMAS.plans, { plans: [p, p] }).some((e) => e.includes('too few items')));
  assert(validateJson(SCHEMAS.plans, { plans: [p, p, p, p] }).some((e) => e.includes('too many items')));
  assertEquals(validateJson(SCHEMAS.plans, { plans: [p, p, p] }), []);
});

Deno.test('lever item enforces integer minute bounds', () => {
  const ask = (l: Record<string, unknown>) => {
    const { kind, ...rest } = l;
    return validateJson(SCHEMAS.ask, { levers: { [kind as string]: [rest] }, restatement: 'x' });
  };
  assertEquals(ask({ kind: 'busesAtLrt', buses: 2, atMin: 810 }), []);
  assert(ask({ kind: 'busesAtLrt', buses: 2, atMin: 810.5 }).length > 0);
  assert(ask({ kind: 'busesAtLrt', buses: 2, atMin: 100 }).length > 0);
  assertEquals(ask({ kind: 'cafeteria', outletId: 'x', extraCounters: 1, fromMin: 700, toMin: 800, closeAtMin: 1320 }), []);
  assertEquals(ask({ kind: 'cafeteria', outletId: 'x', extraCounters: 1, fromMin: 700, toMin: 800 }), []);
  assertEquals(ask({ kind: 'acOffInGap', fromMin: 700, toMin: 800, blocks: ['all'] }), []);
  assertEquals(ask({ kind: 'stagger', target: 'end', fromMin: 700, toMin: 800, shifts: [{ block: 'A', minutes: 10 }] }), []);
});

Deno.test('estimate schema accepts scalar or curve and rejects unknown key', () => {
  const e = (key: string, v: unknown) =>
    validateJson(SCHEMAS.estimate, {
      estimates: [{ key, likely: v, low: v, high: v, unit: 'share', reasoning: 'r', confidence: 'low' }],
    });
  assertEquals(e('attendanceDrop', 0.2), []);
  assertEquals(e('eventArrivalCurve', [0.1, 0.2]), []);
  assert(e('bogus', 1).length > 0);
});

Deno.test('extract, explain, announcement schemas accept valid values', () => {
  assertEquals(validateJson(SCHEMAS.explain, { text: 'hi' }), []);
  assertEquals(validateJson(SCHEMAS.announcement, { draft: 'hi' }), []);
  assertEquals(
    validateJson(SCHEMAS.extract, {
      events: [{
        title: 't', venue: 'v', startDate: '2026-11-04', expectedAttendance: null, attendanceStated: false,
        isApuCalendar: false, sourceUrls: [], confidence: 'high',
      }],
    }),
    [],
  );
});

Deno.test('prompts', () => {
  assertEquals(PROMPT_VERSION, 'v4');
  assertEquals(Object.keys(SYSTEM_PROMPTS).sort(), ['announcement', 'ask', 'estimate', 'explain', 'extract', 'plans']);
});

Deno.test('Gemini-facing lever set avoids constructs Gemini rejects', () => {
  const set = (SCHEMAS.ask.properties as Record<string, Record<string, unknown>>).levers;
  const text = JSON.stringify(set);
  assert(!text.includes('anyOf'));
  assert(!text.includes('additionalProperties'));
  assert(!text.includes('maxItems'), 'per-kind maxItems makes the nested plans schema too large for Gemini');
  const walk = (n: unknown): void => {
    if (Array.isArray(n)) return n.forEach(walk);
    if (n && typeof n === 'object') {
      const o = n as Record<string, unknown>;
      if ('type' in o) assert(typeof o.type === 'string', 'type must not be an array');
      Object.values(o).forEach(walk);
    }
  };
  walk(set);
  const kinds = set.properties as Record<string, { type: string; items: { required: string[]; properties: Record<string, { type: string }> } }>;
  assertEquals(kinds.stagger.items.properties.shifts.type, 'array');
  assertEquals(kinds.classesOnline.items.properties.blocks.type, 'array');
});

Deno.test('each lever kind requires its own fields, so Gemini cannot omit them', () => {
  const kinds = (SCHEMAS.ask.properties as Record<string, { properties: Record<string, { items: { required: string[] } }> }>).levers.properties;
  assertEquals(kinds.extraBuses.items.required, ['buses', 'fromMin', 'toMin']);
  assertEquals(kinds.cafeteria.items.required, ['outletId', 'extraCounters', 'fromMin', 'toMin']);
  const plansLevers = JSON.stringify(((SCHEMAS.plans.properties as any).plans.items.properties.levers));
  assertEquals(plansLevers, JSON.stringify((SCHEMAS.ask.properties as any).levers));
  assert(validateJson(SCHEMAS.ask, { levers: { extraBuses: [{ buses: 1 }] }, restatement: 'x' }).some((e) => e.includes('fromMin: required')));
});
