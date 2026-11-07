import type { Summary } from '@engine/index.ts';
import type { Team } from '@plans/checklist.ts';
import { summaryRows, type SummaryRowLabel } from '../scenario-lab/summaryRows.ts';

export interface ComparisonRow { label: SummaryRowLabel; noAction: string; plans: string[] }

/** Rows for the comparison table: one no-action column, then one column per plan. */
export function comparisonRows(noAction: Summary, plans: { summary: Summary }[]): ComparisonRow[] {
  const perPlan = plans.map((p) => summaryRows(noAction, p.summary));
  return summaryRows(noAction, noAction).map((r, i) => ({
    label: r.label, noAction: r.noAction, plans: perPlan.map((rows) => rows[i].withPlan),
  }));
}

export const TEAM_LABEL: Record<Team, string> = { transport: 'Transport', facilities: 'Facilities', cafeteria: 'Cafeteria', academic: 'Academic' };
export const TEAMS: Team[] = ['transport', 'facilities', 'cafeteria', 'academic'];

/** Groups items by team in fixed team order, omitting empty teams. */
export function groupByTeam<T extends { team: Team }>(items: T[]): { team: Team; items: T[] }[] {
  return TEAMS.map((team) => ({ team, items: items.filter((i) => i.team === team) })).filter((g) => g.items.length > 0);
}
