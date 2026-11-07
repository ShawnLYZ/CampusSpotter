import { clock12, dateText } from '../../lib/format.ts';
import { mytDate, mytMinutes } from '../../lib/dates.ts';
import type { ScanRun } from '../../providers/types.ts';

export function scanText(run: ScanRun): string {
  const at = run.finishedAt ?? run.startedAt;
  return `Last scan ${clock12(mytMinutes(at))} ${dateText(mytDate(at))} · ${run.status} · ${run.itemsFound} items (${run.method ?? 'none'})`;
}

export function ScanStatus({ run }: { run: ScanRun | null }) {
  return <p className="text-xs text-text-3">{run ? scanText(run) : 'No scan has run yet'}</p>;
}
