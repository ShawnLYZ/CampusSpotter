import { writeFileSync } from 'node:fs';
import { parseEsolatYear } from '../shared/parsers/esolat.ts';
import { mytIso } from './myt.ts';

const url = 'https://www.e-solat.gov.my/index.php?r=esolatApi/takwimsolat&period=year&zone=WLY01';
const res = await fetch(url);
if (!res.ok) throw new Error(`e-Solat HTTP ${res.status}`);
const json = await res.json();
const fetchedAt = mytIso(new Date());
writeFileSync('shared/fixtures/raw/esolat-WLY01-2026.json', JSON.stringify(json, null, 1));
// Only 2026-10-01 .. 2026-12-31 (the year endpoint has no &year= parameter; no 2027 request).
const rows = parseEsolatYear(json, fetchedAt).filter((r) => r.date >= '2026-10-01' && r.date <= '2026-12-31');
writeFileSync('shared/fixtures/rows/prayer_times.json', JSON.stringify(rows));
console.log(`prayer_times: ${rows.length} rows, ${rows[0]?.date} .. ${rows.at(-1)?.date}; fetched_at ${fetchedAt}`);
const nov6 = rows.find((r) => r.date === '2026-11-06');
console.log(`2026-11-06 dhuhr_min: ${nov6?.dhuhr_min}`);
