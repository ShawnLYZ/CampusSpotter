import type { WeatherRow } from '../bundle/rows.ts';

interface Hourly { time: string[]; precipitation?: (number | null)[]; precipitation_probability?: (number | null)[] }

export function parseOpenMeteoHourly(json: unknown, fetchedAt: string): WeatherRow[] {
  const h = (json as { hourly: Hourly }).hourly;
  return h.time.map((t, i) => ({
    time: `${t}:00+08:00`,
    precipitation_mm: h.precipitation?.[i] ?? null,
    precipitation_probability: h.precipitation_probability?.[i] ?? null,
    fetched_at: fetchedAt,
  }));
}
