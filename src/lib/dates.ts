const DAY_MS = 86_400_000;
const MYT_MS = 8 * 3_600_000;

/** Add n calendar days to a 'YYYY-MM-DD' date. */
export const addDays = (date: string, n: number): string =>
  new Date(Date.parse(`${date}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);

/** ISO instant to calendar date in Malaysia time (UTC+8). */
export const mytDate = (iso: string): string => new Date(Date.parse(iso) + MYT_MS).toISOString().slice(0, 10);

/** ISO instant to minutes since midnight in Malaysia time. */
export function mytMinutes(iso: string): number {
  const d = new Date(Date.parse(iso) + MYT_MS);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

/** ISO instant to 'HH:MM' in Malaysia time. */
export const mytClock = (iso: string): string => new Date(Date.parse(iso) + MYT_MS).toISOString().slice(11, 16);

/** ISO instant to a `datetime-local` value ('YYYY-MM-DDTHH:MM') in Malaysia time. */
export const toLocalInput = (iso: string): string => new Date(Date.parse(iso) + MYT_MS).toISOString().slice(0, 16);

/** `datetime-local` value (read as Malaysia time) to ISO with +08:00; null when invalid. */
export function fromLocalInput(v: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) return null;
  const ms = Date.parse(`${v}:00+08:00`);
  return Number.isNaN(ms) ? null : `${v}:00+08:00`;
}
