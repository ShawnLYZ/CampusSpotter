import type { BlockId, Estimate, InputBundle, Label, Labeled } from '@engine/index.ts';
import { ESTIMATE_KEYS } from '@engine/index.ts';
import type { SourceInfo } from '../providers/types.ts';

export interface InputDescription {
  id: string; title: string; label: Label; source: string; lastUpdated: string | null; reasoning?: string; range?: string;
}

const RANK: Record<Label, number> = { verified: 3, baseline: 2, ai: 1 };

function weakestLabeled(items: (Labeled<unknown> | null | undefined)[]): { label: Label; sourceId: string } | null {
  let out: Labeled<unknown> | null = null;
  for (const it of items) if (it && (out === null || RANK[it.label] < RANK[out.label])) out = it;
  return out ? { label: out.label, sourceId: out.sourceId } : null;
}

function humanize(field: string): string {
  const s = field.replace(/([A-Z])/g, ' $1').trim().toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function rangeText(e: Estimate): string {
  const lo = Array.isArray(e.low) ? Math.min(...e.low) : e.low;
  const hi = Array.isArray(e.high) ? Math.max(...e.high) : e.high;
  return `${lo}–${hi} ${e.unit}`;
}

export function describeInputs(inputs: string[], bundle: InputBundle, sources?: SourceInfo[]): InputDescription[] {
  const byId = new Map((sources ?? []).map((s) => [s.id, s]));
  const fromSource = (sourceId: string) => {
    const s = byId.get(sourceId);
    return { source: s?.name ?? sourceId, lastUpdated: s?.lastUpdated ?? null };
  };
  const out: InputDescription[] = [];
  for (const id of inputs) {
    const [kind, a, b] = id.split(':');
    let item: InputDescription | null = null;
    const lab = (title: string, l: { label: Label; sourceId: string } | null | undefined): InputDescription | null =>
      l ? { id, title, label: l.label, ...fromSource(l.sourceId) } : null;
    switch (kind) {
      case 'estimate': {
        const e = bundle.estimates.find((x) => x.key === a && x.disruptionId === b);
        if (e) {
          const title = ESTIMATE_KEYS.find((k) => k.key === e.key)?.title ?? humanize(e.key);
          item = { id, title, label: 'ai', source: e.model, lastUpdated: e.createdAt, reasoning: e.reasoning, range: rangeText(e) };
        }
        break;
      }
      case 'baseline': {
        const field = (bundle.baseline as unknown as Record<string, unknown>)[a];
        if (field && typeof field === 'object' && 'label' in field && 'sourceId' in field) {
          item = lab(humanize(a), field as Labeled<unknown>);
        }
        break;
      }
      case 'road': {
        const title = a === 'reconstructed' ? 'Road delay (4 Nov reconstruction)'
          : a === 'google' ? 'Road delay (Google traffic)' : 'Road delay (typical pattern)';
        item = lab(title, weakestLabeled([...bundle.road.ratio, bundle.road.googleStaticOneWayMin]));
        break;
      }
      case 'timetable':
        item = bundle.timetable ? lab('Class timetable', bundle.timetable) : null; break;
      case 'weather':
        item = bundle.weather ? lab('Weather forecast', weakestLabeled([...bundle.weather.precipitationMm, ...bundle.weather.probabilityPct])) : null; break;
      case 'ridership':
        item = bundle.ridership ? lab('LRT ridership', weakestLabeled([bundle.ridership.typicalDailyBoardings, bundle.ridership.typicalDailyAlightings])) : null; break;
      case 'prayer':
        item = bundle.prayer ? lab('Friday prayer time', bundle.prayer.zuhrMin) : null; break;
      case 'hall': {
        const h = bundle.baseline.waitingHalls.find((x) => x.id === a);
        item = h ? lab(`Waiting hall: ${h.name}`, h.loadKw) : null; break;
      }
      case 'energy': {
        const e = bundle.baseline.energy[a as BlockId];
        item = e ? lab(`Energy profile, Block ${a}`, weakestLabeled([e.baseLoadKw, e.occupiedRoomKw, e.idleRoomKw])) : null; break;
      }
      case 'shuttle':
        item = lab('Shuttle timetable', bundle.shuttle); break;
      case 'seats': {
        const all = Object.values(bundle.seats).flatMap((r) => Object.values(r));
        item = lab('Room seat counts', weakestLabeled(all)); break;
      }
    }
    out.push(item ?? { id, title: `Unrecognised input (${id})`, label: 'baseline', source: 'unknown', lastUpdated: null });
  }
  return out;
}
