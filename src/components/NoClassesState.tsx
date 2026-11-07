import type { DayType } from '@engine/index.ts';
import { MoonStar } from 'lucide-react';

export function NoClassesState({ dayType }: { dayType: DayType }) {
  const text = dayType === 'weekend'
    ? 'No classes today — weekend. Residents only; the LRT shuttle does not run.'
    : 'No classes today — public holiday or break.';
  return (
    <div className="card flex items-center gap-3 p-5 text-base text-text-2">
      <MoonStar aria-hidden="true" className="h-5 w-5 shrink-0 text-text-3" />{text}
    </div>
  );
}
