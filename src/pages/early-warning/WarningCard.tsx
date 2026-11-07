import { Link } from 'react-router';
import { ArrowRight, CalendarDays, CloudRain, ExternalLink, History, Music, Pencil, ListChecks, Repeat, Trash2, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { METRIC_TITLES } from '@engine/index.ts';
import type { DisruptionType } from '@engine/index.ts';
import { RiskBadge } from '../../components/RiskBadge.tsx';
import { ProvenanceBadge } from '../../components/ProvenanceBadge.tsx';
import { clock12, dateText, formatMetric } from '../../lib/format.ts';
import { mytDate, mytMinutes } from '../../lib/dates.ts';
import type { EarlyWarningItem } from '../../providers/types.ts';

export const TYPE_ICON: Record<DisruptionType, { Icon: LucideIcon; word: string }> = {
  stadium_event: { Icon: Music, word: 'Stadium event' },
  apu_calendar: { Icon: CalendarDays, word: 'APU calendar' },
  weekly_pattern: { Icon: Repeat, word: 'Weekly pattern' },
  weather: { Icon: CloudRain, word: 'Weather' },
  manual: { Icon: Pencil, word: 'Manual entry' },
};

/** "malaymail.com · the weeknds kl concerts sell out…" instead of a raw URL. */
function sourceLabel(url: string): string {
  try {
    const u = new URL(url);
    const slug = u.pathname.split('/').filter((p) => p && !/^\d+$/.test(p)).pop() ?? '';
    const words = decodeURIComponent(slug).replace(/[-_]+/g, ' ').trim();
    const host = u.hostname.replace(/^www\./, '');
    return words ? `${host} · ${words.length > 64 ? `${words.slice(0, 64)}…` : words}` : host;
  } catch { return url; }
}

const clockOf = (iso: string) => clock12(mytMinutes(iso));

function whenText(item: EarlyWarningItem): string {
  const d = item.daysRemaining;
  if (item.isPast) return 'Past';
  return d <= 0 ? 'Today' : d === 1 ? 'In 1 day' : `In ${d} days`;
}

export interface CardActions {
  onScenario: (i: EarlyWarningItem) => void;
  onPlans: (i: EarlyWarningItem) => void;
  onEdit: (i: EarlyWarningItem) => void;
  onDismiss: (i: EarlyWarningItem) => void;
  onDelete: (i: EarlyWarningItem) => void;
}


type WarningCardProps =
  | { item: EarlyWarningItem; actions: CardActions; past?: boolean; readOnly?: false; lead?: boolean }
  | { item: EarlyWarningItem; actions?: CardActions; past?: boolean; readOnly: true; lead?: boolean };

/** `lead`: the most urgent card on the page; only it gets the filled primary button. */
export function WarningCard({ item, actions, past = false, readOnly = false, lead = false }: WarningCardProps) {
  const icon = TYPE_ICON[item.type];
  const startDay = mytDate(item.startAt);
  const endDay = mytDate(item.endAt);
  const range = startDay === endDay
    ? `${clockOf(item.startAt)} – ${clockOf(item.endAt)}`
    : `${clockOf(item.startAt)} – ${dateText(endDay)} ${clockOf(item.endAt)}`;
  const att = item.override?.expectedAttendance ?? item.expectedAttendance;
  const isWeeknd = item.id === 'weeknd-2026-11-04';
  const soon = !item.isPast && item.daysRemaining <= 7;
  return (
    <li className="card flex flex-col p-5" aria-label={item.title}>
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-panel-2 text-text-2">
          <icon.Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-text-3">{icon.word}</p>
          <h3 className="text-lg font-medium leading-snug">{item.title}</h3>
          <p className="mt-0.5 text-sm text-text-2">
            {dateText(startDay)} · {range}{item.venue ? ` · ${item.venue}` : ''}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <RiskBadge level={item.riskLevel} reason={item.riskReason ?? undefined} />
          <span className={`figure text-[13px] ${soon ? 'text-amber-ink' : 'text-text-2'}`}>{whenText(item)}</span>
        </div>
      </div>
      {(item.riskReason || item.topPeaks.length > 0) && (
        <div className="mt-4 rounded-lg bg-bg/60 p-3">
          {item.riskReason && <p className="text-sm text-text"><span className="text-text-3">If nothing is done: </span>{item.riskReason}</p>}
          {item.topPeaks.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-2 text-xs">
              {item.topPeaks.slice(0, 3).map((p) => (
                <li key={p.metric} className="rounded-md border border-border px-2 py-1 text-text-2">
                  {METRIC_TITLES[p.metric]} <span className="tabular font-medium text-text">{formatMetric(p.metric, { value: p.value, status: 'ok', pressure: null, provenance: null })}</span> at {clock12(p.atMin)}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {(att !== null || item.override) && (
        <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-text-2">
          {att !== null && <span>Expected crowd: <span className="tabular font-medium text-text">{att.toLocaleString('en-MY')}</span></span>}
          <ProvenanceBadge label={item.attendanceLabel} />
          {item.override && <span className="rounded-md border border-amber/50 px-1.5 py-0.5 text-xs text-amber-ink">Manual override</span>}
        </p>
      )}
      {item.notes && <p className="mt-2 text-sm text-text-2">{item.notes}</p>}
      {item.sources.length > 0 && (
        <details className="group mt-2 text-sm">
          <summary className="inline-flex items-center gap-1.5 text-text-2 hover:text-text">
            <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
            {item.sources.length === 1 ? '1 source' : `${item.sources.length} sources`}
            <span className="text-text-3 group-open:hidden">· show</span>
          </summary>
          <ul className="mt-2 flex flex-col gap-1.5 pl-5">
            {item.sources.map((s) => (
              <li key={s.url} className="truncate">
                <a href={s.url} target="_blank" rel="noreferrer" title={s.url} className="text-verified-ink underline decoration-verified/50 hover:decoration-verified-ink">
                  {s.title ?? sourceLabel(s.url)}
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              </li>
            ))}
          </ul>
        </details>
      )}
      {!readOnly && actions && <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
        {past ? (
          isWeeknd && <Link to="/replay" className="btn"><History aria-hidden="true" /> Open replay</Link>
        ) : (
          <>
            <button type="button" className={`btn ${lead ? 'btn-primary' : ''}`} onClick={() => actions.onScenario(item)}>Open in Scenario Lab <ArrowRight aria-hidden="true" /></button>
            <button type="button" className="btn" onClick={() => actions.onPlans(item)}><ListChecks aria-hidden="true" /> Generate plans</button>
            <span className="flex-1" />
            {item.origin !== 'rule' && <button type="button" className="btn btn-quiet btn-sm" onClick={() => actions.onEdit(item)}><Pencil aria-hidden="true" /> Edit</button>}
            {item.origin === 'manual'
              ? <button type="button" className="btn btn-quiet btn-danger btn-sm" onClick={() => actions.onDelete(item)}><Trash2 aria-hidden="true" /> Delete</button>
              : <button type="button" className="btn btn-quiet btn-sm" onClick={() => actions.onDismiss(item)}><X aria-hidden="true" /> Dismiss</button>}
          </>
        )}
      </div>}
    </li>
  );
}
