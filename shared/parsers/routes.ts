import type { TrafficRow } from '../bundle/rows.ts';

// Hour index h is MYT 07:00 + h hours on `date`; MYT = UTC+8, so 07:00 MYT = 23:00Z the day before.
export function routeDepartureTimes(date: string): { hourIndex: number; departureTimeUtc: string }[] {
  const [y, m, d] = date.split('-').map(Number);
  const base = Date.UTC(y, m - 1, d, 7 - 8, 0, 0);
  return Array.from({ length: 20 }, (_, h) => ({
    hourIndex: h,
    departureTimeUtc: new Date(base + h * 3600_000).toISOString().replace(/\.\d{3}Z$/, 'Z'),
  }));
}

function seconds(v: unknown, field: string): number {
  const m = typeof v === 'string' ? /^(\d+(?:\.\d+)?)s$/.exec(v) : null;
  if (!m) throw new Error(`routes: bad ${field}`);
  return Number(m[1]);
}

export function parseRouteDuration(json: unknown): { durationS: number; staticDurationS: number; distanceM: number; encodedPolyline: string | null } {
  const route = (json as { routes?: Record<string, any>[] } | null)?.routes?.[0];
  if (!route) throw new Error('routes: no route in response');
  return {
    durationS: seconds(route.duration, 'duration'),
    staticDurationS: seconds(route.staticDuration, 'staticDuration'),
    distanceM: Number(route.distanceMeters ?? 0),
    encodedPolyline: route.polyline?.encodedPolyline ?? null,
  };
}

export function typicalRatioFromRows(rows: TrafficRow[]): number[] {
  return Array.from({ length: 20 }, (_, h) => {
    const rs = rows.filter((r) => r.hour_index === h);
    if (rs.length === 0) throw new Error(`typical ratio: missing hour ${h}`);
    const mean = rs.reduce((s, r) => s + r.duration_s / r.static_duration_s, 0) / rs.length;
    return Math.round(mean * 1000) / 1000;
  });
}
