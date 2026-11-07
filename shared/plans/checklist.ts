import type { InputBundle, LeverSet, BlockId } from '../engine/types.ts';
import { BLOCK_IDS } from '../engine/types.ts';
import { clock12 as clock, dateText } from '../engine/format.ts';
import { sessionsMovedBySlot } from '../engine/demand.ts';

export type Team = 'transport' | 'facilities' | 'cafeteria' | 'academic';
export interface ChecklistDraft { team: Team; text: string; dueMin: number | null }

const TEAM_ORDER: Team[] = ['transport', 'facilities', 'cafeteria', 'academic'];
const ADVISORY: Record<'leave_before' | 'walk_to_lrt' | 'expect_delays', (a: string) => string> = {
  leave_before: a => `Leave campus before ${a}`,
  walk_to_lrt: a => `Consider walking to LRT Bukit Jalil after ${a}`,
  expect_delays: a => `Expect shuttle delays after ${a}`,
};

export function buildChecklist(levers: LeverSet, bundle: InputBundle): ChecklistDraft[] {
  const out: ChecklistDraft[] = [];
  const add = (team: Team, text: string, dueMin: number | null) => out.push({ team, text, dueMin });
  const { baseline, settings, context } = bundle;
  for (const l of levers) {
    switch (l.kind) {
      case 'extraBuses':
        add('transport', `Hire ${l.buses} × ${baseline.busSeats.value}-seat bus${l.buses > 1 ? 'es' : ''}, ${clock(l.fromMin)}–${clock(l.toMin)}, ${dateText(context.date)}`, l.fromMin);
        break;
      case 'nonstopLoop':
        add('transport', `Run the nonstop shuttle loop ${clock(l.fromMin)}–${clock(l.toMin)}`, l.fromMin);
        break;
      case 'busesAtLrt':
        add('transport', `Hold ${l.buses} bus${l.buses > 1 ? 'es' : ''} at LRT Bukit Jalil from ${clock(l.atMin)}`, l.atMin);
        break;
      case 'waitingHall': {
        const hall = baseline.waitingHalls.find(h => h.id === l.hallId);
        add('facilities', `Open ${hall?.name ?? l.hallId} as a cooled waiting hall, ${clock(l.fromMin)}–${clock(l.toMin)}`, l.fromMin);
        break;
      }
      case 'acOffInGap': {
        const blocks = l.blocks === 'all' ? 'all blocks' : `Blocks ${l.blocks.join(', ')}`;
        add('facilities', `Switch off AC and lights in empty teaching rooms (${blocks}), ${clock(l.fromMin)}–${clock(l.toMin)}; pre-cool from ${clock(l.toMin - 15)}`, l.fromMin);
        break;
      }
      case 'cafeteria': {
        const outlet = baseline.cafeterias.find(c => c.id === l.outletId);
        const name = outlet?.name ?? l.outletId;
        if (l.extraCounters > 0) {
          add('cafeteria', `Open ${l.extraCounters} extra counter${l.extraCounters > 1 ? 's' : ''} at ${name}, ${clock(l.fromMin)}–${clock(l.toMin)} (${l.extraCounters * settings.staffPerCounter.value} staff)`, l.fromMin);
        }
        if (l.closeAtMin !== null) {
          add('cafeteria', `Keep ${name} open until ${clock(l.closeAtMin)} (${outlet?.staff.value ?? 0} staff on extended hours)`, l.closeAtMin);
        }
        break;
      }
      case 'classesOnline': {
        const slots = sessionsMovedBySlot(bundle, l);
        const total = slots.reduce((s, x) => s + x.count, 0);
        const byBlock = BLOCK_IDS.flatMap((b: BlockId) => {
          const mine = slots.filter(s => s.block === b);
          return mine.length === 0 ? [] : [`Block ${b}: ${mine.map(s => `${s.count} at ${clock(s.startMin)}`).join(', ')}`];
        });
        add('academic', `Move ${total} sessions online from ${clock(l.fromMin)}: ${byBlock.join('; ')}`, l.fromMin);
        break;
      }
      case 'stagger': {
        const list = BLOCK_IDS.filter(b => (l.shifts[b] ?? 0) !== 0)
          .map(b => `Block ${b} ${(l.shifts[b] ?? 0) > 0 ? '+' : ''}${l.shifts[b]} min`).join(', ');
        add('academic', `Shift ${l.target} times by block, ${clock(l.fromMin)}–${clock(l.toMin)}: ${list}`, l.fromMin);
        break;
      }
      case 'advisory':
        add('academic', `Send the student advisory "${ADVISORY[l.message](clock(l.advisedMin))}" before ${clock(l.advisedMin)}`, l.advisedMin);
        break;
      case 'studentCount':
        break;
    }
  }
  return out
    .map((d, i) => ({ d, i }))
    .sort((a, b) => TEAM_ORDER.indexOf(a.d.team) - TEAM_ORDER.indexOf(b.d.team)
      || (a.d.dueMin ?? Infinity) - (b.d.dueMin ?? Infinity) || a.i - b.i)
    .map(x => x.d);
}

/** Due time as an ISO string at +08:00; minutes >= 1440 roll to the next day. */
export function dueAtIso(date: string, dueMin: number | null): string | null {
  if (dueMin === null) return null;
  const [y, m, d] = date.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d) + Math.floor(dueMin / 1440) * 86400000);
  const mm = Math.round(dueMin) % 1440;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${t.getUTCFullYear()}-${p(t.getUTCMonth() + 1)}-${p(t.getUTCDate())}T${p(Math.floor(mm / 60))}:${p(mm % 60)}:00+08:00`;
}
