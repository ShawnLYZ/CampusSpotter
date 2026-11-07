import { readFileSync, writeFileSync } from 'node:fs';
import { aggregateSessions } from '../shared/parsers/timetable.ts';
import type { SnapshotSession } from '../shared/parsers/timetable.ts';

const input = process.argv[2] ?? 'docs/superpowers/specs/data/timetable-sessions-2026-10-26_2026-11-22.json';
const snap = JSON.parse(readFileSync(input, 'utf8')) as { capturedAt: string; sessions: SnapshotSession[] };
const agg = aggregateSessions(snap.sessions, snap.capturedAt);
const out = 'shared/fixtures/rows/';
const files: [string, unknown[]][] = [
  ['rooms', agg.rooms], ['timetable_days', agg.days], ['timetable_groups', agg.groups], ['timetable_conditioned', agg.conditioned],
];
for (const [name, rows] of files) {
  writeFileSync(`${out}${name}.json`, JSON.stringify(rows));
  console.log(`${name}: ${rows.length} rows`);
}
console.log(`snapshot sessions: ${snap.sessions.length}; physical sessions in days: ${agg.days.reduce((a, d) => a + d.sessions, 0)}`);
