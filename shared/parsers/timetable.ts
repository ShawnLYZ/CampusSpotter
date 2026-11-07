import type { BlockId, RoomType } from '../engine/types.ts';
import type { RoomRow, TimetableConditionedRow, TimetableDayRow, TimetableGroupRow } from '../bundle/rows.ts';
import { STEPS, stepStartMin } from '../engine/grid.ts';

export interface SnapshotSession { date: string; room: string; location: string; start: string; end: string; type: string; intakes: number; firstOfDay: number; lastOfDay: number }

const SEATS: Record<RoomType, number> = { classroom: 40, lab: 30, auditorium: 150 };

export function isOnlineRoom(room: string, location: string): boolean {
  return location !== 'APU CAMPUS' || room === 'ONLINE' || room.startsWith('ONLMCO3');
}

export function roomBlock(room: string): BlockId {
  let m = /^([A-E])-/.exec(room);
  if (m) return m[1] as BlockId;
  if (/^S-/.test(room)) return 'S';
  m = /@ Block ([A-E])/.exec(room);
  if (m) return m[1] as BlockId;
  if (/Discussion Room .*Library/.test(room)) return 'L';
  return 'U';
}

export function roomType(room: string): RoomType {
  if (/Auditorium/.test(room)) return 'auditorium';
  if (/Lab|Studio|Workshop|Theatre/i.test(room)) return 'lab';
  return 'classroom';
}

export function roomLevel(room: string): string | null {
  const a = /^[A-E]-(\d+)-/.exec(room);
  if (a) return a[1];
  const b = /Level (\d+)/.exec(room);
  return b ? b[1] : null;
}

/** Local clock minutes from an ISO string with a +08:00 offset (reads the written clock, not UTC). */
export function isoToMin(iso: string): number {
  const m = /T(\d{2}):(\d{2})/.exec(iso);
  if (!m) throw new Error(`bad ISO time: ${iso}`);
  return Number(m[1]) * 60 + Number(m[2]);
}

const r4 = (n: number) => Math.round(n * 10000) / 10000;

export function aggregateSessions(sessions: SnapshotSession[], syncedAt: string): {
  days: TimetableDayRow[]; groups: TimetableGroupRow[]; conditioned: TimetableConditionedRow[]; rooms: RoomRow[];
} {
  const groupMap = new Map<string, { row: TimetableGroupRow; intakes: number; first: number; last: number }>();
  const roomSpan = new Map<string, { date: string; room: string; first: number; last: number }>();
  const roomCodes = new Set<string>();

  for (const s of sessions) {
    if (isOnlineRoom(s.room, s.location)) continue;
    const block = roomBlock(s.room), type = roomType(s.room);
    const start = isoToMin(s.start), end = isoToMin(s.end);
    const key = `${s.date}|${block}|${type}|${start}|${end}`;
    let g = groupMap.get(key);
    if (!g) {
      g = { row: { date: s.date, block, room_type: type, start_min: start, end_min: end, count: 0, first_of_day_share: 0, last_of_day_share: 0 }, intakes: 0, first: 0, last: 0 };
      groupMap.set(key, g);
    }
    g.row.count += 1; g.intakes += s.intakes; g.first += s.firstOfDay; g.last += s.lastOfDay;

    roomCodes.add(s.room);
    const rk = `${s.date}|${s.room}`;
    const sp = roomSpan.get(rk);
    if (!sp) roomSpan.set(rk, { date: s.date, room: s.room, first: start, last: end });
    else { sp.first = Math.min(sp.first, start); sp.last = Math.max(sp.last, end); }
  }

  const groups = [...groupMap.values()].map(g => ({
    ...g.row,
    first_of_day_share: g.intakes > 0 ? r4(g.first / g.intakes) : 0,
    last_of_day_share: g.intakes > 0 ? r4(g.last / g.intakes) : 0,
  })).sort((a, b) => a.date.localeCompare(b.date) || a.start_min - b.start_min || a.end_min - b.end_min
    || a.block.localeCompare(b.block) || a.room_type.localeCompare(b.room_type));

  const condMap = new Map<string, TimetableConditionedRow>();
  for (const sp of roomSpan.values()) {
    const block = roomBlock(sp.room), type = roomType(sp.room);
    for (let t = 0; t < STEPS; t++) {
      const m = stepStartMin(t);
      if (sp.first <= m && m < sp.last) {
        const key = `${sp.date}|${block}|${type}|${t}`;
        const c = condMap.get(key);
        if (c) c.rooms += 1;
        else condMap.set(key, { date: sp.date, block, room_type: type, step: t, rooms: 1 });
      }
    }
  }
  const conditioned = [...condMap.values()].sort((a, b) => a.date.localeCompare(b.date) || a.step - b.step
    || a.block.localeCompare(b.block) || a.room_type.localeCompare(b.room_type));

  const dayMap = new Map<string, number>();
  for (const g of groups) dayMap.set(g.date, (dayMap.get(g.date) ?? 0) + g.count);
  const days: TimetableDayRow[] = [...dayMap.entries()].sort(([a], [b]) => a.localeCompare(b))
    .map(([date, n]) => ({ date, sessions: n, label: 'verified', synced_at: syncedAt }));

  const rooms: RoomRow[] = [...roomCodes].sort().map(code => {
    const rt = roomType(code);
    return { code, block: roomBlock(code), level: roomLevel(code), room_type: rt, seats: SEATS[rt], seats_label: 'baseline' };
  });

  return { days, groups, conditioned, rooms };
}
