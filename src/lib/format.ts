import { clock12, dateText, durationText, pctText, ratioText } from '@engine/index.ts';
import { mytDate, mytMinutes } from './dates.ts';
import type { MetricId, Pressure, StepValue } from '@engine/index.ts';

export * from '@engine/format.ts';

function minutesText(v: number): string {
  return Math.round(v) < 60 ? `${Math.round(v)} min` : durationText(v);
}

function energyText(v: number): string {
  const r = Math.round(v);
  if (r === 0) return '0% vs normal';
  return `${r > 0 ? '+' : '−'}${Math.abs(r)}% vs normal`;
}

export function formatMetric(metric: MetricId, s: StepValue): string {
  if (s.status === 'no_service') return 'No service';
  if (s.status === 'not_enough_data') return 'Not enough data';
  const v = s.value;
  if (v === null) return 'Not enough data';
  switch (metric) {
    case 'classroomOccupancy':
    case 'walkwayTraffic':
      return pctText(v);
    case 'cafeteriaQueue':
    case 'apuStopQueue':
    case 'lrtStopQueue':
    case 'shuttleRtt':
      return minutesText(v);
    case 'buildingEnergy':
      return energyText(v);
    case 'roadDelay':
    case 'lrtCrowding':
      return ratioText(v);
  }
}

export function pressureText(p: Pressure): 'Normal' | 'Busy' | 'Overloaded' {
  return p === 'green' ? 'Normal' : p === 'amber' ? 'Busy' : 'Overloaded';
}

const MYT_CLOCK = new Intl.DateTimeFormat('en-MY', { timeZone: 'Asia/Kuala_Lumpur', hour: 'numeric', minute: '2-digit', hour12: true });
export function clockNowMyt(): string {
  return MYT_CLOCK.format(new Date()).toUpperCase().replace(/\s+/g, ' ');
}

/** An ISO instant as Malaysia date and 12-hour time, e.g. 'Thu, 5 Nov 2026, 12:00 PM'. Unparsable input is returned unchanged. */
export function stampText(iso: string): string {
  if (Number.isNaN(Date.parse(iso))) return iso;
  return `${dateText(mytDate(iso))}, ${clock12(mytMinutes(iso))}`;
}

/** Error text for a banner that adds its own period after the message. */
export function withoutEndPeriod(message: string): string {
  return message.trim().replace(/\.+$/, '');
}
