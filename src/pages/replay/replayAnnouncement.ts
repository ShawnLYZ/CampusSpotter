import { clock12 as clock } from '@engine/index.ts';
import type { LeverSet } from '@engine/index.ts';
import type { ChecklistDraft } from '@plans/checklist.ts';

/** Student-facing notice for the replay plan, one fixed sentence per student-facing lever. Outlet and hall names come from the checklist text. */
export function replayAnnouncement(levers: LeverSet, checklist: ChecklistDraft[]): string {
  const lines: string[] = ['Please note the following arrangements.'];
  const nameFrom = (re: RegExp, fallback: string): string => checklist.map((c) => re.exec(c.text)?.[1]).find((n) => n) ?? fallback;
  for (const l of levers) {
    switch (l.kind) {
      case 'classesOnline': lines.push(`All classes from ${clock(l.fromMin)} will run online.`); break;
      case 'nonstopLoop': lines.push(`Shuttles will run nonstop between ${clock(l.fromMin)} and ${clock(l.toMin)}.`); break;
      case 'advisory':
        if (l.message === 'leave_before') lines.push(`Please leave campus before ${clock(l.advisedMin)} if you can.`);
        break;
      case 'cafeteria':
        if (l.closeAtMin !== null) lines.push(`${nameFrom(/Keep (.+) open until/, 'The cafeteria')} will stay open until ${clock(l.closeAtMin)}.`);
        break;
      case 'waitingHall':
        lines.push(`${nameFrom(/Open (.+) as a cooled waiting hall/, 'The waiting hall')} will be open as a cooled waiting area from ${clock(l.fromMin)}.`);
        break;
      case 'extraBuses': lines.push(`Extra shuttle buses will run from ${clock(l.fromMin)} to ${clock(l.toMin)}.`); break;
      default: break;
    }
  }
  return ['Dear students,', ...lines, 'Thank you for planning ahead. — APU Management'].join('\n\n');
}
