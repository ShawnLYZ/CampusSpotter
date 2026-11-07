import type { LeverSet } from '@engine/index.ts';
import { FRIDAY_PRAYER_PLAN } from '@plans/fridayPlan.ts';
import type { ContextRequest } from '../providers/types.ts';
import type { CameraPresetId } from '../scene/cameraPresets.ts';
import type { PresenterAction } from './bus.ts';

export interface PresenterStep {
  id: string;
  title: string;
  route: string;
  ctx: ContextRequest;
  cameraPreset: CameraPresetId;
  step: number;
  levers: LeverSet;
  actions: { atMs: number; action: PresenterAction }[];
}

const NOV4: ContextRequest = { date: '2026-11-04', disruptionId: 'weeknd-2026-11-04', reconstructed: true };

export const PRESENTER_STEPS: PresenterStep[] = [
  { id: 'command-center', title: 'Command Center', route: '/', ctx: { date: '2026-11-18' }, cameraPreset: 'overview', step: 12, levers: [], actions: [] },
  { id: 'early-warning', title: 'Early Warning', route: '/early-warning', ctx: { date: '2026-11-05' }, cameraPreset: 'overview', step: 12, levers: [], actions: [] },
  {
    id: 'replay', title: 'Replay 4 Nov', route: '/replay', ctx: NOV4, cameraPreset: 'overview', step: 20, levers: [],
    actions: [
      { atMs: 0, action: { type: 'replay.milestone', id: 'jun3' } },
      { atMs: 5000, action: { type: 'replay.milestone', id: 'nov4' } },
      { atMs: 6000, action: { type: 'replay.play', from: 20, to: 45, speed: 4 } },
    ],
  },
  {
    id: 'scenario-lab-4nov', title: 'Scenario Lab, 4 Nov', route: '/scenario-lab', ctx: NOV4, cameraPreset: 'campus', step: 44, levers: [],
    actions: [{ atMs: 1500, action: { type: 'lab.ask', askId: 'replay-plan' } }],
  },
  {
    id: 'action-plans', title: 'Action Plans', route: '/action-plans', ctx: NOV4, cameraPreset: 'overview', step: 44, levers: [],
    actions: [{ atMs: 500, action: { type: 'plans.generate', budgetRm: 2000, chooseIndex: 0, chooseAfterMs: 6000 } }],
  },
  { id: 'friday', title: 'Friday prayer', route: '/scenario-lab', ctx: { date: '2026-11-06' }, cameraPreset: 'campus', step: 29, levers: FRIDAY_PRAYER_PLAN, actions: [] },
  {
    id: 'data', title: 'Data & Assumptions', route: '/data', ctx: { date: '2026-11-05' }, cameraPreset: 'overview', step: 12, levers: [],
    actions: [{ atMs: 0, action: { type: 'data.tab', tab: 'sources' } }],
  },
];
