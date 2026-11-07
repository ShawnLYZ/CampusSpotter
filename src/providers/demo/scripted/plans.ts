import type { DayType, LeverSet } from '@engine/index.ts';
import { REPLAY_PLAN_4NOV } from '@plans/replayPlan.ts';
import { FRIDAY_PRAYER_PLAN } from '@plans/fridayPlan.ts';
import type { ContextRequest } from '../../types.ts';

export interface ScriptedPlan { name: string; levers: LeverSet; rationale: string }

const REPLAY_DATES = ['2026-11-04', '2026-11-05'];

export function scriptedPlans(ctx: ContextRequest, dayType: DayType): ScriptedPlan[] {
  if (REPLAY_DATES.includes(ctx.date)) {
    return [
      {
        name: 'Go online early', levers: REPLAY_PLAN_4NOV,
        rationale: 'Moving classes online from 10:45 AM empties the campus before the evening crowd arrives, at the cost of the most lost teaching time. It relies on the nonstop loop and buses held at the LRT to clear students already on campus.',
      },
      {
        name: 'Keep classes, add buses',
        levers: [
          { kind: 'extraBuses', buses: 2, fromMin: 600, toMin: 1080 },
          { kind: 'nonstopLoop', fromMin: 630, toMin: 720 },
          { kind: 'advisory', advisedMin: 960, message: 'expect_delays' },
        ],
        rationale: 'No class is moved, so learning is untouched. The cost is hired buses all day, and road delay near the stadium can still hold them back.',
      },
      {
        name: 'Hybrid afternoon',
        levers: [
          { kind: 'classesOnline', fromMin: 810, toMin: 1440, blocks: 'all' },
          { kind: 'extraBuses', buses: 1, fromMin: 600, toMin: 840 },
          { kind: 'nonstopLoop', fromMin: 720, toMin: 810 },
          { kind: 'cafeteria', outletId: 'main', extraCounters: 0, fromMin: 1080, toMin: 1320, closeAtMin: 1320 },
          { kind: 'waitingHall', hallId: 'main-hall', fromMin: 1020, toMin: 1320 },
        ],
        rationale: 'Mornings run as normal and only classes from 1:30 PM go online, so less learning is lost than in the early option. Students who stay are given a cafeteria and a cooled waiting hall until the roads clear.',
      },
    ];
  }
  if (dayType === 'friday') {
    return [
      {
        name: 'Smooth the restart', levers: FRIDAY_PRAYER_PLAN,
        rationale: 'Staggering the 2:30 PM restart by block spreads the rush to the stop and the cafeteria. It costs a little in extra staff and moves some class starts by up to 30 minutes.',
      },
      {
        name: 'Extra counters only', levers: [{ kind: 'cafeteria', outletId: 'main', extraCounters: 2, fromMin: 825, toMin: 900, closeAtMin: null }],
        rationale: 'Two more counters shorten the lunch queue after prayers and nothing else changes. It does not help the shuttle stop.',
      },
      {
        name: 'Stagger only', levers: [FRIDAY_PRAYER_PLAN[0]],
        rationale: 'Shifting block start times costs nothing and eases the restart at the stop. The cafeteria queue is left as it is.',
      },
    ];
  }
  return [
    {
      name: 'Afternoon online', levers: [{ kind: 'classesOnline', fromMin: 810, toMin: 1440, blocks: 'all' }],
      rationale: 'Moving afternoon classes online removes the evening rush at no cost. The price is the learning time lost, which is shown as sessions moved.',
    },
    {
      name: 'One extra bus', levers: [{ kind: 'extraBuses', buses: 1, fromMin: 960, toMin: 1200 }],
      rationale: 'One hired bus in the evening shortens waits while every class stays on campus. A single bus only trims the peak.',
    },
    {
      name: 'Advisory and loop',
      levers: [
        { kind: 'advisory', advisedMin: 1020, message: 'leave_before' },
        { kind: 'nonstopLoop', fromMin: 1020, toMin: 1080 },
      ],
      rationale: 'Asking students to leave early with a nonstop loop at the peak costs nothing. It depends on how many students follow the advice.',
    },
  ];
}
