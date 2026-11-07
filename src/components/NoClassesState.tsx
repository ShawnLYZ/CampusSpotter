import type { DayType } from '@engine/index.ts';

export function NoClassesState({ dayType }: { dayType: DayType }) {
  const text = dayType === 'weekend'
    ? 'No classes today — weekend. Residents only; the LRT shuttle does not run.'
    : 'No classes today — public holiday or break.';
  return (
    <div className="rounded-lg border border-border bg-panel p-6 text-lg text-text-2">
      <span aria-hidden="true" className="mr-2">○</span>{text}
    </div>
  );
}
