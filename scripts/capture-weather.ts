import { writeFileSync } from 'node:fs';
import { parseOpenMeteoHourly } from '../shared/parsers/openMeteo.ts';
import { mytIso } from './myt.ts';

const url = 'https://api.open-meteo.com/v1/forecast?latitude=3.05607&longitude=101.70047&hourly=precipitation,precipitation_probability&timezone=Asia%2FKuala_Lumpur&forecast_days=16&past_days=3';
const res = await fetch(url);
if (!res.ok) throw new Error(`Open-Meteo HTTP ${res.status}`);
const json = await res.json();
const fetchedAt = mytIso(new Date());
writeFileSync('shared/fixtures/raw/open-meteo-2026-11-05.json', JSON.stringify(json));
const rows = parseOpenMeteoHourly(json, fetchedAt);
writeFileSync('shared/fixtures/rows/weather_hourly.json', JSON.stringify(rows));
console.log(`weather_hourly: ${rows.length} rows, ${rows[0]?.time} .. ${rows.at(-1)?.time}; fetched_at ${fetchedAt}`);
