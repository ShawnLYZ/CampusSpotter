import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import type { TrafficRow, BaselineValueRow } from '../shared/bundle/rows.ts';
import { routeDepartureTimes, parseRouteDuration, typicalRatioFromRows } from '../shared/parsers/routes.ts';
import { mytIso } from './myt.ts';

const date = process.argv[2];
if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('usage: capture-traffic.ts YYYY-MM-DD');
const key = process.env.GOOGLE_ROUTES_KEY;
if (!key) throw new Error('GOOGLE_ROUTES_KEY is not set (run with node --env-file=.env)');

const APU = { latitude: 3.05607, longitude: 101.70047 };
const LRT = { latitude: 3.05813, longitude: 101.69222 };
const dirs = [
  { direction: 'apu_to_lrt', from: APU, to: LRT },
  { direction: 'lrt_to_apu', from: LRT, to: APU },
] as const;
const URL = 'https://routes.googleapis.com/directions/v2:computeRoutes';
const MASK = 'routes.duration,routes.staticDuration,routes.distanceMeters,routes.polyline.encodedPolyline';

const fetchedAt = mytIso(new Date());
const rows: TrafficRow[] = [];
const raw: unknown[] = [];
let polyline: string | null = null;

for (const { hourIndex, departureTimeUtc } of routeDepartureTimes(date)) {
  for (const d of dirs) {
    const res = await fetch(URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': MASK },
      body: JSON.stringify({
        origin: { location: { latLng: d.from } },
        destination: { location: { latLng: d.to } },
        travelMode: 'DRIVE',
        routingPreference: 'TRAFFIC_AWARE',
        departureTime: departureTimeUtc,
      }),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`Routes HTTP ${res.status} (hour ${hourIndex} ${d.direction}): ${text.slice(0, 500)}`);
    const json = JSON.parse(text);
    raw.push({ hourIndex, direction: d.direction, departureTimeUtc, response: json });
    const p = parseRouteDuration(json);
    rows.push({ date, hour_index: hourIndex, direction: d.direction, kind: 'google', duration_s: p.durationS, static_duration_s: p.staticDurationS, fetched_at: fetchedAt });
    if (hourIndex === 0 && d.direction === 'apu_to_lrt') polyline = p.encodedPolyline;
  }
}
if (!polyline) throw new Error('no encodedPolyline for APU->LRT 07:00');

writeFileSync(`shared/fixtures/raw/routes-${date}.json`, JSON.stringify(raw));

// Replace only this date's google rows; keep every other row.
const trafficPath = 'shared/fixtures/rows/traffic_cache.json';
const existing: TrafficRow[] = existsSync(trafficPath) ? JSON.parse(readFileSync(trafficPath, 'utf8')) : [];
const kept = existing.filter((r) => !(r.date === date && r.kind === 'google'));
writeFileSync(trafficPath, JSON.stringify([...kept, ...rows], null, 2) + '\n');

const ratios = typicalRatioFromRows(rows);
const staticMin = Math.round((rows.reduce((s, r) => s + r.static_duration_s, 0) / rows.length / 60) * 100) / 100;
const upserts: BaselineValueRow[] = [
  { key: 'typical_road_ratio', value: ratios, unit: 'ratio', label: 'baseline', description: `Typical hourly road ratio from Google predictions for Wed 18 Nov 2026 (D2)`, source_id: 'google-routes', updated_at: fetchedAt },
  { key: 'google_static_one_way_min', value: staticMin, unit: 'min', label: 'verified', description: 'Mean traffic-free one-way drive time APU to LRT Bukit Jalil, from Google Routes static duration', source_id: 'google-routes', updated_at: fetchedAt },
  { key: 'route_encoded_polyline', value: polyline, unit: 'polyline', label: 'verified', description: 'Shuttle road route APU ↔ LRT Bukit Jalil (map panel)', source_id: 'google-routes', updated_at: fetchedAt },
];
const bvPath = 'shared/fixtures/rows/baseline_values.json';
const bv: BaselineValueRow[] = JSON.parse(readFileSync(bvPath, 'utf8'));
for (const u of upserts) {
  const i = bv.findIndex((r) => r.key === u.key);
  if (i >= 0) bv[i] = u; else bv.push(u);
}
writeFileSync(bvPath, JSON.stringify(bv, null, 2) + '\n');
console.log(`traffic_cache: ${rows.length} google rows for ${date}; ratios ${JSON.stringify(ratios)}; static ${staticMin} min; polyline ${polyline.length} chars; fetched_at ${fetchedAt}`);
