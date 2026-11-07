import type { LeverSet, BlockId } from '@engine/index.ts';
import { REPLAY_PLAN_4NOV } from '@plans/replayPlan.ts';
import { FRIDAY_PRAYER_PLAN } from '@plans/fridayPlan.ts';
import {
  AFTERNOON_ONLINE_QUESTION, DELAY_NOON_QUESTION, REPLAY_PLAN_QUESTION, FRIDAY_SMOOTH_QUESTION,
} from '@plans/suggestedQuestions.ts';

export interface ScriptedAsk { id: string; question: string; keywords: string[]; levers: LeverSet; restatement: string }

const ALL_PLUS_20: Partial<Record<BlockId, number>> = { A: 20, B: 20, C: 20, D: 20, E: 20, S: 20, L: 20, U: 20 };

export const SCRIPTED_ASKS: ScriptedAsk[] = [
  {
    id: 'afternoon-online-one-bus',
    question: AFTERNOON_ONLINE_QUESTION,
    keywords: ['afternoon', 'online', 'bus', 'add'],
    levers: [
      { kind: 'classesOnline', fromMin: 810, toMin: 1440, blocks: 'all' },
      { kind: 'extraBuses', buses: 1, fromMin: 720, toMin: 1080 },
    ],
    restatement: 'Move classes starting from 1:30 PM online and add one 44-seat bus from 12:00 PM to 6:00 PM.',
  },
  {
    id: 'delay-noon-counter',
    question: DELAY_NOON_QUESTION,
    keywords: ['delay', '12', '20', 'counter', 'cafeteria'],
    levers: [
      { kind: 'stagger', target: 'start', fromMin: 720, toMin: 735, shifts: ALL_PLUS_20 },
      { kind: 'cafeteria', outletId: 'main', extraCounters: 1, fromMin: 690, toMin: 840, closeAtMin: null },
    ],
    restatement: 'Start the 12:00 PM classes 20 minutes later in every block and open one extra cafeteria counter from 11:30 AM to 2:00 PM.',
  },
  {
    id: 'replay-plan',
    question: REPLAY_PLAN_QUESTION,
    keywords: ['online', 'loop', 'noon', 'lrt', '45', 'waiting'],
    levers: REPLAY_PLAN_4NOV,
    restatement: 'Keep the 8:30 AM slot on campus, move every class from 10:45 AM online, run a nonstop loop 10:30 AM–12:00 PM, hold 2 buses at LRT Bukit Jalil from 12:00 PM, advise students to leave before 12:00 PM, keep the cafeteria open until 10:00 PM, open the Main Hall 5:00–10:00 PM and switch off idle rooms from 1:00 PM.',
  },
  {
    id: 'friday-smooth',
    question: FRIDAY_SMOOTH_QUESTION,
    keywords: ['friday', 'prayer', 'prayers', 'afternoon', 'smooth'],
    levers: FRIDAY_PRAYER_PLAN,
    restatement: 'Stagger the 2:30 PM restart by block, open one extra counter 1:45–2:30 PM and switch off AC in empty rooms during the prayer gap.',
  },
];

export function matchScripted(question: string): ScriptedAsk | null {
  const tokens = new Set(question.toLowerCase().split(/[^a-z0-9]+/));
  let best: ScriptedAsk | null = null;
  let bestScore = 0;
  for (const ask of SCRIPTED_ASKS) {
    const score = ask.keywords.filter(k => tokens.has(k)).length;
    if (score > bestScore) { best = ask; bestScore = score; }
  }
  return bestScore >= 2 ? best : null;
}
