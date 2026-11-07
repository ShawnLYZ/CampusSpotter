import { BookOpen, ClipboardCheck, Database, FlaskConical, History, LayoutDashboard, Siren } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface NavItem { to: string; label: string; hint: string; Icon: LucideIcon; end: boolean; sub?: boolean }
export interface NavGroup { title: string; items: NavItem[] }

/** Pages in the order a manager uses them: watch, test, decide, then learn. */
export const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Watch',
    items: [
      { to: '/', label: 'Command Center', hint: 'Today at a glance', Icon: LayoutDashboard, end: true },
      { to: '/early-warning', label: 'Early Warning', hint: 'Upcoming disruptions', Icon: Siren, end: false },
    ],
  },
  {
    title: 'Plan and decide',
    items: [
      { to: '/scenario-lab', label: 'Scenario Lab', hint: 'Try actions, compare results', Icon: FlaskConical, end: false },
      { to: '/action-plans', label: 'Action Plans', hint: 'Three plans within budget', Icon: ClipboardCheck, end: true },
      { to: '/action-plans/log', label: 'Decision Log', hint: 'What was decided', Icon: BookOpen, end: true, sub: true },
    ],
  },
  {
    title: 'Learn',
    items: [
      { to: '/replay', label: 'Replay: 4 Nov', hint: 'The concert night, replayed', Icon: History, end: false },
      { to: '/data', label: 'Data & Assumptions', hint: 'Where numbers come from', Icon: Database, end: false },
    ],
  },
];
