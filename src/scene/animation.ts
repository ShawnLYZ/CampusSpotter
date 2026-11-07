import type { Forecast } from '@engine/output.ts';

export const MAX_BUSES = 24;
export const MAX_QUEUE_FIGURES = 200;
export const MAX_SPINE_PARTICLES = 400;
export const MAX_RAIN_DROPS = 1500;
export const MAX_CROWD = 600;
const DEFAULT_RTT_MIN = 18;

export interface BusState { t: number; direction: 'toLrt' | 'toApu' }

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const finiteOr = (v: number | null | undefined, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);

const rttAt = (forecast: Forecast, step: number): number => {
  const v = forecast.metrics.shuttleRtt.steps[step]?.value ?? DEFAULT_RTT_MIN;
  return Number.isFinite(v) && v > 0 ? v : DEFAULT_RTT_MIN;
};

const phaseBases = new WeakMap<Forecast, Float64Array>();
/** Cumulative bus phase at the start of each step: base[k] = sum over j<k of 15 / rtt_j (cached per forecast). */
function busPhaseBase(forecast: Forecast): Float64Array {
  let base = phaseBases.get(forecast);
  if (!base) {
    const n = forecast.metrics.shuttleRtt.steps.length;
    base = new Float64Array(n + 1);
    for (let k = 0; k < n; k++) base[k + 1] = base[k]! + 15 / rttAt(forecast, k);
    phaseBases.set(forecast, base);
  }
  return base;
}

/** Number of buses running at a step: 0 when there is no service or the fleet rounds to 0. */
function busCount(forecast: Forecast, step: number): number {
  const series = forecast.metrics.shuttleRtt;
  const sv = series.steps[step];
  if (!sv || sv.status === 'no_service') return 0;
  return Math.min(MAX_BUSES, Math.max(0, Math.round(finiteOr(series.detail.fleet?.[step], 0))));
}

/**
 * Allocation-free bus positions: writes t into `tOut` and direction (1 = toLrt, 0 = toApu) into `dirOut`; returns the count.
 * Phase is accumulated across steps (sum of 15/rtt_k, not stepStart/rtt) so a changing rtt slows or speeds the buses
 * without teleporting them at step boundaries (deliberate deviation from the plan's absolute formula).
 */
export function busStatesInto(tOut: Float32Array, dirOut: Uint8Array, forecast: Forecast, step: number, frac: number): number {
  const count = Math.min(busCount(forecast, step), tOut.length);
  if (count === 0) return 0;
  const base = busPhaseBase(forecast);
  const phase = (base[Math.min(step, base.length - 1)] ?? 0) + (15 * clamp01(finiteOr(frac, 0))) / rttAt(forecast, step);
  for (let i = 0; i < count; i++) {
    let p = (phase + i / count) % 1;
    if (!Number.isFinite(p)) p = 0;
    if (p < 0) p += 1;
    if (p < 0.5) { tOut[i] = clamp01(2 * p); dirOut[i] = 1; } else { tOut[i] = clamp01(2 - 2 * p); dirOut[i] = 0; }
  }
  return count;
}

/** Shuttle positions along the route (t in [0,1]), always finite. Longer rtt slows the buses. */
export function busStates(forecast: Forecast, step: number, frac: number): BusState[] {
  const t = new Float32Array(MAX_BUSES), d = new Uint8Array(MAX_BUSES);
  const n = busStatesInto(t, d, forecast, step, frac);
  return Array.from({ length: n }, (_, i) => ({ t: t[i]!, direction: d[i] ? 'toLrt' : 'toApu' }));
}

/** Figures for a queue: at most 200, each standing for `perFigure` people, with a ×N label when it stands for more than one. */
export function queueFigures(queue: number): { count: number; perFigure: number; overflowLabel: string | null } {
  const q = Number.isFinite(queue) && queue > 0 ? queue : 0;
  const perFigure = q <= MAX_QUEUE_FIGURES ? 1 : Math.ceil(q / MAX_QUEUE_FIGURES);
  return {
    count: Math.min(MAX_QUEUE_FIGURES, Math.round(q / perFigure)),
    perFigure,
    overflowLabel: perFigure > 1 ? `×${perFigure}` : null,
  };
}

export function spineParticleCount(flowPerMin: number): number {
  return Number.isFinite(flowPerMin) ? Math.max(0, Math.min(MAX_SPINE_PARTICLES, Math.round(flowPerMin * 2))) : 0;
}

/** Window intensity 0.1..1 from a block's energy against its base (overnight floor) energy. */
export function windowGlow(kwhBlock: number, baseKwh: number): number {
  if (!(baseKwh > 0) || !Number.isFinite(kwhBlock)) return 0.1;
  return 0.1 + 0.9 * Math.min(1, Math.max(0, (kwhBlock - baseKwh) / (3 * baseKwh)));
}

export function rainDrops(precipMm: number | null): number {
  return precipMm && precipMm >= 0.5 ? Math.min(MAX_RAIN_DROPS, Math.round(precipMm * 150)) : 0;
}

export function stadiumCrowdCount(eventFlow: number): number {
  return Number.isFinite(eventFlow) && eventFlow > 0 ? Math.min(MAX_CROWD, Math.round(eventFlow / 10)) : 0;
}
