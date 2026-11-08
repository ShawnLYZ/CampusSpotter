import { assertEquals, assert } from 'jsr:@std/assert@1';
import { refreshRisks } from './risk.ts';
import { itemRisk } from './plans.ts';
import { seededRepo } from './testkit.ts';
import type { DisruptionRow } from '../../../shared/bundle/rows.ts';

const find = (repo: ReturnType<typeof seededRepo>, id: string) => (repo.tables.disruptions as DisruptionRow[]).find((r) => r.id === id)!;

Deno.test('refreshRisks stores the computed level on the bts item', async () => {
  const repo = seededRepo();
  const expected = await itemRisk(repo.rows, structuredClone(find(repo, 'bts-2026-12-12')));
  const n = await refreshRisks(repo, { today: '2026-11-10', ids: ['bts-2026-12-12'] });
  assertEquals(n, 1);
  const bts = find(repo, 'bts-2026-12-12');
  assertEquals(bts.risk_level, expected.level);
  assertEquals(bts.risk_reason, expected.reason);
  assert(bts.risk_computed_at);
  assertEquals(bts.risk_level, 'medium');
});

Deno.test('refreshRisks by dates touches overlapping items; items beyond 120 days are skipped', async () => {
  const repo = seededRepo();
  assert(await refreshRisks(repo, { today: '2026-11-10', dates: ['2026-12-12'] }) >= 1);
  assert(find(repo, 'bts-2026-12-12').risk_level !== null);
  assertEquals(await refreshRisks(seededRepo(), { today: '2026-06-01', ids: ['bts-2026-12-12'] }), 0);
});
