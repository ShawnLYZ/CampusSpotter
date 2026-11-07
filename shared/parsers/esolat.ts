import type { PrayerRow } from '../bundle/rows.ts';

const MONTHS: Record<string, string> = {
  Jan: '01', Feb: '02', Mac: '03', Mar: '03', Apr: '04', Mei: '05', May: '05', Jun: '06', Jul: '07',
  Ogos: '08', Aug: '08', Sep: '09', Okt: '10', Oct: '10', Nov: '11', Dis: '12', Dec: '12',
};

function minutes(t: string): number {
  const [h, m] = t.split(':');
  return Number(h) * 60 + Number(m);
}

export function parseEsolatYear(json: unknown, fetchedAt: string, zone = 'WLY01'): PrayerRow[] {
  const days = (json as { prayerTime?: Record<string, string>[] }).prayerTime ?? [];
  return days.map((d) => {
    const [dd, mon, yyyy] = d.date.split('-');
    const mm = MONTHS[mon];
    if (!mm) throw new Error(`e-Solat: unknown month ${mon}`);
    return {
      date: `${yyyy}-${mm}-${dd.padStart(2, '0')}`,
      zone,
      fajr_min: minutes(d.fajr),
      dhuhr_min: minutes(d.dhuhr),
      asr_min: minutes(d.asr),
      maghrib_min: minutes(d.maghrib),
      isha_min: minutes(d.isha),
      fetched_at: fetchedAt,
    };
  });
}
