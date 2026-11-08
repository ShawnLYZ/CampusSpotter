import { assert, assertEquals } from 'jsr:@std/assert@1';
import { assembleBundle, fetchBundleRows, memoryRowsClient } from './bundle.ts';
import { fixtureTables } from '../../../shared/fixtures/rows/index.ts';
import { coerceLevers, leverCatalogueText, toWireSet, toWireShape } from './levers.ts';

const b = assembleBundle(await fetchBundleRows(memoryRowsClient(fixtureTables), '2026-11-04'));

Deno.test('coerceLevers drops unknown kinds and missing fields', () => {
  const r = coerceLevers(
    [{ kind: 'extraBuses', buses: 2, fromMin: 600, toMin: 840 }, { kind: 'teleport' }, { kind: 'nonstopLoop', fromMin: 630 }],
    b,
  );
  assertEquals(r.levers.length, 1);
  assertEquals(r.levers[0].kind, 'extraBuses');
  assertEquals(r.dropped, 2);
});

Deno.test('coerceLevers drops wrong types and non-objects', () => {
  const r = coerceLevers(
    [{ kind: 'extraBuses', buses: '2', fromMin: 600, toMin: 840 }, null, 'x', { kind: 'advisory', advisedMin: 900, message: 'nope' }],
    b,
  );
  assertEquals(r.levers, []);
  assertEquals(r.dropped, 4);
});

Deno.test('coerceLevers passes engine warnings on (clamping)', () => {
  const r = coerceLevers([{ kind: 'extraBuses', buses: 50, fromMin: 600, toMin: 840 }], b);
  assertEquals(r.dropped, 0);
  assert(r.warnings.some((w) => w.code === 'lever_adjusted'));
});

Deno.test('leverCatalogueText lists kinds and ids', () => {
  const t = leverCatalogueText(b);
  assert(t.includes('main-hall'));
  assert(t.includes('classesOnline'));
});

const one = (l: Record<string, unknown>) => coerceLevers([l], b);

Deno.test('coerceLevers converts wire shapes to engine shapes', () => {
  const all = one({ kind: 'classesOnline', fromMin: 600, toMin: 700, blocks: ['A', 'all'] });
  assertEquals((all.levers[0] as unknown as { blocks: unknown }).blocks, 'all');
  const ids = one({ kind: 'acOffInGap', fromMin: 600, toMin: 700, blocks: ['A', 'B'] });
  assertEquals((ids.levers[0] as unknown as { blocks: unknown }).blocks, ['A', 'B']);
  const st = one({ kind: 'stagger', target: 'end', fromMin: 600, toMin: 700, shifts: [{ block: 'A', minutes: 10 }, { block: 'B', minutes: 5 }] });
  assertEquals(st.dropped, 0);
  assertEquals((st.levers[0] as unknown as { shifts: unknown }).shifts, { A: 10, B: 5 });
  const caf = one({ kind: 'cafeteria', outletId: b.baseline.cafeterias[0].id, extraCounters: 1, fromMin: 700, toMin: 800 });
  assertEquals(caf.dropped, 0);
  assertEquals((caf.levers[0] as unknown as { closeAtMin: unknown }).closeAtMin, null);
});

Deno.test('coerceLevers still accepts engine-shaped levers', () => {
  const r = coerceLevers([
    { kind: 'classesOnline', fromMin: 600, toMin: 700, blocks: 'all' },
    { kind: 'stagger', target: 'start', fromMin: 600, toMin: 700, shifts: { A: 10 } },
    { kind: 'cafeteria', outletId: b.baseline.cafeterias[0].id, extraCounters: 1, fromMin: 700, toMin: 800, closeAtMin: null },
  ], b);
  assertEquals(r.dropped, 0);
  assertEquals(r.levers.length, 3);
});

Deno.test('coerceLevers drops malformed shifts and empty blocks', () => {
  assertEquals(one({ kind: 'stagger', target: 'end', fromMin: 600, toMin: 700, shifts: [{ block: 'Z', minutes: 5 }] }).dropped, 1);
  assertEquals(one({ kind: 'stagger', target: 'end', fromMin: 600, toMin: 700, shifts: [{ block: 'A' }] }).dropped, 1);
  assertEquals(one({ kind: 'stagger', target: 'end', fromMin: 600, toMin: 700, shifts: ['x'] }).dropped, 1);
  assertEquals(one({ kind: 'classesOnline', fromMin: 600, toMin: 700, blocks: [] }).dropped, 1);
});

Deno.test('coerceLevers strips fields that do not belong to the lever kind', () => {
  const r = one({ kind: 'advisory', advisedMin: 900, message: 'leave_before', percent: 0, blocks: ['A'] });
  assertEquals(r.dropped, 0);
  assertEquals(r.levers[0], { kind: 'advisory', advisedMin: 900, message: 'leave_before' });
});

Deno.test('coerceLevers drops empty shifts and unknown block ids', () => {
  assertEquals(one({ kind: 'stagger', target: 'end', fromMin: 600, toMin: 700, shifts: [] }).dropped, 1);
  assertEquals(one({ kind: 'classesOnline', fromMin: 600, toMin: 700, blocks: ['Z'] }).dropped, 1);
});

Deno.test('coerceLevers counts engine drops (empty window, unknown outlet) as dropped', () => {
  const r = coerceLevers(
    [
      { kind: 'extraBuses', buses: 2, fromMin: 840, toMin: 840 },
      { kind: 'cafeteria', outletId: 'nope', extraCounters: 1, fromMin: 600, toMin: 700 },
      { kind: 'nonstopLoop', fromMin: 600, toMin: 700 },
      { kind: 'teleport' },
    ],
    b,
  );
  assertEquals(r.levers.length, 1);
  assertEquals(r.dropped, 3);
});

Deno.test('toWireShape is the inverse of the wire coercion', () => {
  const outlet = b.baseline.cafeterias[0].id;
  const levers = [
    { kind: 'classesOnline', fromMin: 780, toMin: 1020, blocks: 'all' },
    { kind: 'acOffInGap', fromMin: 780, toMin: 900, blocks: ['A', 'B'] },
    { kind: 'stagger', target: 'end', fromMin: 900, toMin: 1080, shifts: { A: 10, C: 20 } },
    { kind: 'cafeteria', outletId: outlet, extraCounters: 1, fromMin: 700, toMin: 800, closeAtMin: null },
    { kind: 'cafeteria', outletId: outlet, extraCounters: 1, fromMin: 700, toMin: 800, closeAtMin: 790 },
    { kind: 'nonstopLoop', fromMin: 600, toMin: 700 },
  ] as never[];
  const wire = levers.map(toWireShape);
  assertEquals((wire[0] as { blocks: unknown }).blocks, ['all']);
  assertEquals((wire[2] as { shifts: unknown }).shifts, [{ block: 'A', minutes: 10 }, { block: 'C', minutes: 20 }]);
  assert(!('closeAtMin' in (wire[3] as object)));
  const back = coerceLevers(wire, b);
  assertEquals(back.dropped, 0);
  assertEquals(back.levers, levers);
});

Deno.test('coerceLevers accepts the by-kind wire set and drops bad entries', () => {
  const r = coerceLevers({
    classesOnline: [{ fromMin: 810, toMin: 1020, blocks: ['all'] }],
    extraBuses: [{ buses: 2, fromMin: 960, toMin: 1140 }, { buses: 1 }],
    teleport: [{ fromMin: 1 }],
    nonstopLoop: 'nope',
  }, b);
  assertEquals(r.levers, [
    { kind: 'classesOnline', fromMin: 810, toMin: 1020, blocks: 'all' },
    { kind: 'extraBuses', buses: 2, fromMin: 960, toMin: 1140 },
  ]);
  assertEquals(r.dropped, 3);
});

Deno.test('toWireSet groups levers by kind in wire shape and round-trips', () => {
  const levers = [
    { kind: 'classesOnline', fromMin: 810, toMin: 1020, blocks: 'all' },
    { kind: 'extraBuses', buses: 2, fromMin: 960, toMin: 1140 },
  ] as never;
  const wire = toWireSet(levers);
  assertEquals(wire, { classesOnline: [{ fromMin: 810, toMin: 1020, blocks: ['all'] }], extraBuses: [{ buses: 2, fromMin: 960, toMin: 1140 }] });
  assertEquals(coerceLevers(wire, b).levers, levers);
});
