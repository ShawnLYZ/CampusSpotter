export const STEPS = 76;
export const STEP_MIN = 15;
export const DAY_START_MIN = 420;
export const HOURLY_POINTS = 20;
export const STEP_HOURS = STEP_MIN / 60;

export function stepStartMin(i: number): number {
  return DAY_START_MIN + STEP_MIN * i;
}

export function stepOf(min: number): number {
  return Math.floor((min - DAY_START_MIN) / STEP_MIN);
}

export function inGrid(i: number): boolean {
  return Number.isInteger(i) && i >= 0 && i < STEPS;
}

export function interpolateHourly(points: readonly (number | null)[], step: number): number | null {
  const h = (stepStartMin(step) - DAY_START_MIN) / 60;
  const lo = Math.floor(h);
  const hi = Math.min(lo + 1, HOURLY_POINTS - 1);
  const f = h - lo;
  const a = points[lo];
  if (f === 0) return a ?? null;
  const b = points[hi];
  if (a == null || b == null) return null;
  return a + (b - a) * f;
}

export function hourIndexAtStep(step: number): number {
  const h = Math.floor((stepStartMin(step) - DAY_START_MIN) / 60);
  return Math.min(Math.max(h, 0), HOURLY_POINTS - 1);
}

export function hourSlot(date: string, hour: number): { contextDate: string; hourIndex: number } | null {
  if (hour >= 7 && hour <= 23) return { contextDate: date, hourIndex: hour - 7 };
  if (hour >= 0 && hour <= 2) return { contextDate: addDays(date, -1), hourIndex: 17 + hour };
  return null;
}

function parseUtc(date: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function addDays(date: string, n: number): string {
  const t = parseUtc(date);
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
}

export function dayOfWeek(date: string): number {
  return parseUtc(date).getUTCDay();
}

export function calendarDayType(date: string): 'weekday' | 'friday' | 'weekend' {
  const dow = dayOfWeek(date);
  if (dow === 0 || dow === 6) return 'weekend';
  if (dow === 5) return 'friday';
  return 'weekday';
}

export function zeros(n: number = STEPS): number[] {
  return new Array<number>(n).fill(0);
}
