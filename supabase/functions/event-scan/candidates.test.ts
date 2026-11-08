import { assertEquals } from 'jsr:@std/assert@1';
import { clusterToRow, expandEvents, mergeCandidates, slug } from './candidates.ts';
import type { ExtractedEvent } from './candidates.ts';

const TODAY = '2026-11-08';
const ev = (o: Partial<ExtractedEvent>): ExtractedEvent => ({
  title: 'BTS World Tour KL', venue: 'Stadium Nasional Bukit Jalil', startDate: '2026-12-12', expectedAttendance: null,
  attendanceStated: false, isApuCalendar: false, sourceUrls: ['https://a.example/1'], confidence: 'medium', ...o,
});
const NOW = '2026-11-07T22:00:00.000Z';

Deno.test('slug: lower-case alphanumerics joined by hyphens, at most 40 characters', () => {
  assertEquals(slug('BTS World Tour KL!'), 'bts-world-tour-kl');
  assertEquals(slug('  Intake: Degree (Level 1)  '), 'intake-degree-level-1');
  const long = slug('A very long event title that keeps on going and going forever');
  assertEquals(long.length <= 40, true);
  assertEquals(long.endsWith('-'), false);
  assertEquals(slug('!!!'), 'event');
});

Deno.test('validation: window [today, today+120] inclusive, venue by alias, APU flag or 3 km', () => {
  const { candidates, rejected } = expandEvents([
    ev({ startDate: TODAY }),
    ev({ startDate: '2027-03-08' }), // today + 120
    ev({ startDate: '2027-03-09' }), // today + 121
    ev({ startDate: '2026-11-07' }), // yesterday
    ev({ startDate: 'Dec 12' }),
    ev({ venue: 'Stadium Merdeka', venueLat: 3.1408, venueLng: 101.7011 }),
    ev({ venue: 'Zepp Kuala Lumpur' }),
    ev({ venue: '  Bukit Jalil Park  ', venueLat: 3.0547, venueLng: 101.6914 }),
    ev({ venue: 'APU campus', isApuCalendar: true }),
  ], TODAY);
  assertEquals(rejected, 5);
  assertEquals(candidates.map((c) => [c.date, c.venueKey]), [
    [TODAY, 'TM Stadium Nasional'],
    ['2027-03-08', 'TM Stadium Nasional'],
    ['2026-12-12', 'Bukit Jalil Park'],
    ['2026-12-12', 'APU'],
  ]);
});

Deno.test('expansion: one candidate per date, clipped to the window and capped at 14 days', () => {
  const two = expandEvents([ev({ startDate: '2026-12-12', endDate: '2026-12-13' })], TODAY).candidates;
  assertEquals(two.map((c) => c.date), ['2026-12-12', '2026-12-13']);
  const clipped = expandEvents([ev({ startDate: '2027-03-07', endDate: '2027-03-20' })], TODAY).candidates;
  assertEquals(clipped.map((c) => c.date), ['2027-03-07', '2027-03-08']);
  const capped = expandEvents([ev({ startDate: '2026-12-01', endDate: '2026-12-31' })], TODAY).candidates;
  assertEquals(capped.length, 14);
  assertEquals(expandEvents([ev({ endDate: '2026-12-01' })], TODAY).candidates.length, 1);
});

Deno.test('an event already in progress is kept from today to its end; one that ended yesterday is rejected', () => {
  const { candidates, rejected } = expandEvents([
    ev({ title: 'Expo', startDate: '2026-11-05', endDate: '2026-11-10' }),
    ev({ title: 'Last day', startDate: '2026-11-06', endDate: TODAY }),
    ev({ title: 'Over', startDate: '2026-11-05', endDate: '2026-11-07' }),
    ev({ title: 'No end', startDate: '2026-11-05' }),
  ], TODAY);
  assertEquals(rejected, 2);
  assertEquals(candidates.map((c) => `${c.event.title} ${c.date}`), [
    'Expo 2026-11-08', 'Expo 2026-11-09', 'Expo 2026-11-10', `Last day ${TODAY}`,
  ]);
});

Deno.test('merging: similar titles share the bare key; a different title gets a slug suffix', () => {
  const { candidates } = expandEvents([
    ev({ title: 'BTS World Tour KL', sourceUrls: ['https://rss.example/1'] }),
    ev({ title: 'BTS Kuala Lumpur 2026', sourceUrls: ['https://ln.example/1', 'https://rss.example/1'], confidence: 'high' }),
    ev({ title: 'Coldplay Music of the Spheres', sourceUrls: ['https://ln.example/2'] }),
    ev({ title: 'Coldplay Spheres', sourceUrls: ['https://ln.example/3'] }),
  ], TODAY);
  const clusters = mergeCandidates(candidates);
  assertEquals(clusters.map((c) => [c.key, c.candidates.length]), [
    ['TM Stadium Nasional|2026-12-12', 2],
    ['TM Stadium Nasional|2026-12-12|coldplay-music-of-the-spheres', 2],
  ]);
});

Deno.test('merging: a stored bare-key row keeps its key whatever the extraction order', () => {
  const apu = (title: string) => ev({ title, venue: 'APU campus', isApuCalendar: true, startDate: '2026-12-01' });
  const stored = new Map([['APU|2026-12-01', 'Intake: Degree Level 1']]);
  const keys = (titles: string[], existing = stored) =>
    mergeCandidates(expandEvents(titles.map(apu), TODAY).candidates, existing).map((c) => [c.key, c.candidates[0].event.title]);
  // B first: A still takes the bare key.
  assertEquals(keys(['Graduation rehearsal', 'Intake: Degree Level 1']), [
    ['APU|2026-12-01|graduation-rehearsal', 'Graduation rehearsal'],
    ['APU|2026-12-01', 'Intake: Degree Level 1'],
  ]);
  // Only B: a single cluster takes the bare key whatever its title (one event per venue per date).
  assertEquals(keys(['Graduation rehearsal']), [['APU|2026-12-01', 'Graduation rehearsal']]);
  // Two clusters and neither similar to the stored title: both get a slug, the stored row is left alone.
  assertEquals(keys(['Graduation rehearsal', 'Library closure']), [
    ['APU|2026-12-01|graduation-rehearsal', 'Graduation rehearsal'],
    ['APU|2026-12-01|library-closure', 'Library closure'],
  ]);
  // No stored row: first seen takes it.
  assertEquals(keys(['Graduation rehearsal', 'Intake: Degree Level 1'], new Map()), [
    ['APU|2026-12-01', 'Graduation rehearsal'],
    ['APU|2026-12-01|intake-degree-level-1', 'Intake: Degree Level 1'],
  ]);
  // The most similar cluster wins; a stored row under another base does not matter.
  // B scores 0.5 and A 0.75 against the stored title (A and B score 0.33, so they stay apart).
  assertEquals(keys(['Alpha Bravo Charlie Xray Yankee', 'Bravo Charlie Delta'], new Map([['APU|2026-12-01', 'Alpha Bravo Charlie Delta'], ['APU|2026-12-02', 'x']])), [
    ['APU|2026-12-01|alpha-bravo-charlie-xray-yankee', 'Alpha Bravo Charlie Xray Yankee'],
    ['APU|2026-12-01', 'Bravo Charlie Delta'],
  ]);
});

Deno.test('rows: best-confidence title, max attendance, labels, MYT times and source union', () => {
  const { candidates } = expandEvents([
    ev({ title: 'BTS World Tour KL', expectedAttendance: 55000, attendanceStated: true, sourceUrls: ['https://rss.example/1'] }),
    ev({ title: 'BTS Kuala Lumpur 2026', startTime: '19:30', endTime: '22:30', confidence: 'high', sourceUrls: ['https://ln.example/1', 'https://rss.example/1'] }),
  ], TODAY);
  const [c] = mergeCandidates(candidates);
  const { row, sources } = clusterToRow(c, { nowIso: NOW, publishedAt: new Map([['https://rss.example/1', '2026-10-20T02:00:00.000Z']]) });
  assertEquals(row.id, 'bts-kuala-lumpur-2026-2026-12-12');
  assertEquals(row.title, 'BTS Kuala Lumpur 2026');
  assertEquals([row.type, row.kind, row.venue, row.origin, row.status], ['stadium_event', 'concert', 'TM Stadium Nasional', 'scan', 'active']);
  assertEquals([row.expected_attendance, row.attendance_label], [55000, 'verified']);
  // Times come from the best-confidence candidate that states them.
  assertEquals([row.start_at, row.end_at], ['2026-12-12T19:30:00+08:00', '2026-12-12T22:30:00+08:00']);
  assertEquals(row.dedupe_key, 'TM Stadium Nasional|2026-12-12');
  assertEquals(sources, [
    { disruption_id: row.id, url: 'https://rss.example/1', title: 'BTS World Tour KL', published_at: '2026-10-20T02:00:00.000Z', fetched_at: NOW },
    { disruption_id: row.id, url: 'https://ln.example/1', title: 'BTS Kuala Lumpur 2026', published_at: null, fetched_at: NOW },
  ]);
});

Deno.test('rows: an end before the start rolls to the next day; no attendance gives nulls', () => {
  const { candidates } = expandEvents([ev({ startTime: '22:00', endTime: '01:30' })], TODAY);
  const { row } = clusterToRow(mergeCandidates(candidates)[0], { nowIso: NOW, publishedAt: new Map() });
  assertEquals([row.start_at, row.end_at], ['2026-12-12T22:00:00+08:00', '2026-12-13T01:30:00+08:00']);
  assertEquals([row.expected_attendance, row.attendance_label], [null, null]);
});

Deno.test('rows: APU calendar items span the whole day with their kind; coordinate-only venues keep their name', () => {
  const { candidates } = expandEvents([
    ev({ title: 'Intake: Foundation', venue: 'APU campus', isApuCalendar: true, calendarKind: 'intake', startTime: '09:00' }),
    ev({ title: 'Mid-sem break', venue: 'APU', isApuCalendar: true, startDate: '2026-12-14' }),
    ev({ title: 'Fun run', venue: 'Bukit Jalil Park', venueLat: 3.0547, venueLng: 101.6914, expectedAttendance: 3000 }),
  ], TODAY);
  const rows = mergeCandidates(candidates).map((c) => clusterToRow(c, { nowIso: NOW, publishedAt: new Map() }).row);
  assertEquals(rows.map((r) => [r.type, r.kind, r.venue, r.start_at, r.end_at, r.dedupe_key]), [
    ['apu_calendar', 'intake', 'APU', '2026-12-12T00:00:00+08:00', '2026-12-12T23:59:00+08:00', 'APU|2026-12-12'],
    ['apu_calendar', 'other', 'APU', '2026-12-14T00:00:00+08:00', '2026-12-14T23:59:00+08:00', 'APU|2026-12-14'],
    ['stadium_event', 'concert', 'Bukit Jalil Park', '2026-12-12T19:30:00+08:00', '2026-12-12T23:00:00+08:00', 'Bukit Jalil Park|2026-12-12'],
  ]);
  assertEquals(rows[2].attendance_label, 'ai');
});
