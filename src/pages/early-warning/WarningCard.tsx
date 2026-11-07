import { Link } from 'react-router';
import { METRIC_TITLES } from '@engine/index.ts';
import type { DisruptionType } from '@engine/index.ts';
import { RiskBadge } from '../../components/RiskBadge.tsx';
import { ProvenanceBadge } from '../../components/ProvenanceBadge.tsx';
import { clock12, dateText, formatMetric } from '../../lib/format.ts';
import { mytDate, mytMinutes } from '../../lib/dates.ts';
import type { EarlyWarningItem } from '../../providers/types.ts';

const TYPE_ICON: Record<DisruptionType, { glyph: string; word: string }> = {
  stadium_event: { glyph: '♪', word: 'Stadium event' },
  apu_calendar: { glyph: '▦', word: 'APU calendar' },
  weekly_pattern: { glyph: '↻', word: 'Weekly pattern' },
  weather: { glyph: '☂', word: 'Weather' },
  manual: { glyph: '✎', word: 'Manual entry' },
};

const clockOf = (iso: string) => clock12(mytMinutes(iso));

function whenText(item: EarlyWarningItem): string {
  const d = item.daysRemaining;
  if (item.isPast) return 'past';
  return d <= 0 ? 'today' : d === 1 ? 'in 1 day' : `in ${d} days`;
}

export interface CardActions {
  onScenario: (i: EarlyWarningItem) => void;
  onPlans: (i: EarlyWarningItem) => void;
  onEdit: (i: EarlyWarningItem) => void;
  onDismiss: (i: EarlyWarningItem) => void;
  onDelete: (i: EarlyWarningItem) => void;
}

const BTN = 'rounded-md border border-border bg-panel-2 px-3 py-1.5 text-sm text-text hover:border-text-3';

type WarningCardProps =
  | { item: EarlyWarningItem; actions: CardActions; past?: boolean; readOnly?: false }
  | { item: EarlyWarningItem; actions?: CardActions; past?: boolean; readOnly: true };

export function WarningCard({ item, actions, past = false, readOnly = false }: WarningCardProps) {
  const icon = TYPE_ICON[item.type];
  const startDay = mytDate(item.startAt);
  const endDay = mytDate(item.endAt);
  const range = startDay === endDay
    ? `${clockOf(item.startAt)} – ${clockOf(item.endAt)}`
    : `${clockOf(item.startAt)} – ${dateText(endDay)} ${clockOf(item.endAt)}`;
  const att = item.override?.expectedAttendance ?? item.expectedAttendance;
  const isWeeknd = item.id === 'weeknd-2026-11-04';
  return (
    <li className="rounded-lg border border-border bg-panel p-4" aria-label={item.title}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-lg font-semibold">
            <span aria-hidden="true" className="text-text-2">{icon.glyph}</span>
            <span className="sr-only">{icon.word}: </span>
            {item.title}
          </h3>
          <p className="mt-0.5 text-sm text-text-2">
            {dateText(startDay)} · {range} · <span className="font-medium text-text">{whenText(item)}</span>
            {item.venue ? ` · ${item.venue}` : ''}
          </p>
        </div>
        <RiskBadge level={item.riskLevel} reason={item.riskReason ?? undefined} />
      </div>
      {item.riskReason && <p className="mt-2 text-sm text-text-2">{item.riskReason}</p>}
      {item.topPeaks.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-text-2">
          {item.topPeaks.slice(0, 3).map((p) => (
            <li key={p.metric}>
              {METRIC_TITLES[p.metric]}: {formatMetric(p.metric, { value: p.value, status: 'ok', pressure: null, provenance: null })} at {clock12(p.atMin)}
            </li>
          ))}
        </ul>
      )}
      {(att !== null || item.override) && (
        <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-text-2">
          {att !== null && <span>Attendance: <span className="tabular font-medium text-text">{att.toLocaleString('en-MY')}</span></span>}
          <ProvenanceBadge label={item.attendanceLabel} />
          {item.override && <span className="rounded-md border border-amber/60 px-2 py-0.5 text-xs text-amber">Manual override</span>}
        </p>
      )}
      {item.notes && <p className="mt-2 text-sm text-text-2">{item.notes}</p>}
      {item.sources.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {item.sources.map((s) => (
            <li key={s.url}><a href={s.url} target="_blank" rel="noreferrer" className="text-verified underline">{s.title ?? s.url}<span className="sr-only"> (opens in a new tab)</span></a></li>
          ))}
        </ul>
      )}
      {!readOnly && actions && <div className="mt-3 flex flex-wrap gap-2">
        {past ? (
          isWeeknd && <Link to="/replay" className={BTN}>Open replay</Link>
        ) : (
          <>
            <button type="button" className={BTN} onClick={() => actions.onScenario(item)}>Open in Scenario Lab</button>
            <button type="button" className={BTN} onClick={() => actions.onPlans(item)}>Generate plans</button>
            {item.origin !== 'rule' && <button type="button" className={BTN} onClick={() => actions.onEdit(item)}>Edit</button>}
            {item.origin === 'manual'
              ? <button type="button" className={BTN} onClick={() => actions.onDelete(item)}>Delete</button>
              : <button type="button" className={BTN} onClick={() => actions.onDismiss(item)}>Dismiss</button>}
          </>
        )}
      </div>}
    </li>
  );
}
