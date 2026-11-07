// MYT (UTC+8) wall-clock ISO string with explicit +08:00 offset for a capture moment.
export function mytIso(now: Date): string {
  return new Date(now.getTime() + 8 * 3600_000).toISOString().replace(/\.\d{3}Z$/, '+08:00');
}
