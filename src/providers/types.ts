import type { DisruptionType, DisruptionKind, RiskLevel, Label, MetricId, LeverSet, LeverKind, Estimate, Summary, CostLine } from '@engine/index.ts';
import type { BaselineTableName, CsvError } from '@bundle/csv.ts';
import type { Team } from '@plans/checklist.ts';
export type { BaselineTableName, CsvError } from '@bundle/csv.ts';
export type { Team } from '@plans/checklist.ts';
export type Role = 'manager' | 'demo';
export interface AppUser { id: string; displayName: string; role: Role }
export interface Today { date: string; nowMin: number }
export interface ContextRequest { date: string; disruptionId?: string; reconstructed?: boolean }
export interface PeakView { metric: MetricId; value: number; atMin: number }
export interface SourceLink { url: string; title: string | null; publishedAt: string | null }
export interface EarlyWarningItem {
  id: string; title: string; type: DisruptionType; kind: DisruptionKind; venue: string | null; startAt: string; endAt: string;
  expectedAttendance: number | null; attendanceLabel: Label | null; origin: 'scan' | 'manual' | 'rule'; status: 'active' | 'dismissed';
  override: { startAt: string | null; endAt: string | null; expectedAttendance: number | null; by: string | null; at: string | null } | null;
  riskLevel: RiskLevel | null; riskReason: string | null; riskComputedAt: string | null; topPeaks: PeakView[];
  sources: SourceLink[]; notes: string | null; daysRemaining: number; isPast: boolean;
}
export interface DisruptionFilter { from: string; to: string; types?: DisruptionType[]; risks?: RiskLevel[]; includeDismissed?: boolean; includePast?: boolean }
export interface DisruptionInput { title: string; type: DisruptionType; kind: DisruptionKind; venue: string | null; startAt: string; endAt: string; expectedAttendance: number | null; notes: string | null }
export interface OverridePatch { startAt?: string; endAt?: string; expectedAttendance?: number }
export interface ScanRun { id: string; startedAt: string; finishedAt: string | null; status: 'running' | 'success' | 'failed'; method: 'grounding' | 'fallback' | null; itemsFound: number; itemsChanged: number; errorSummary: string | null }
export interface AskResult { matched: boolean; levers: LeverSet; restatement: string; changedKinds: LeverKind[] }
export interface PlanProposal { id: string; name: string; levers: LeverSet; rationale: string; costLines: CostLine[]; totalCostRm: number; summary: Summary; noActionSummary: Summary; overBudget: boolean; budgetRm: number }
export interface ChecklistItem { id: string; decisionId: string; team: Team; text: string; dueAt: string | null; done: boolean; doneBy: string | null; doneAt: string | null }
export interface Decision { id: string; planId: string; planName: string; disruptionId: string | null; contextDate: string; decidedBy: string; decidedAt: string; status: 'planned' | 'done' | 'cancelled'; notes: string | null; totalCostRm: number; predicted: Summary; levers: LeverSet; forecastId: string | null }
export interface Announcement { id: string; decisionId: string; draft: string; editedText: string | null; updatedAt: string }
export interface DecisionInput { plan: PlanProposal; ctx: ContextRequest; notes: string | null; announcementText: string }
export interface DecisionBundle { decision: Decision; checklist: ChecklistItem[]; announcement: Announcement }
export interface SourceInfo { id: string; name: string; label: Label; url: string | null; licence: string; description: string; lastUpdated: string | null; status: 'ok' | 'stale' | 'failed' | 'static'; ageHours: number | null }
export interface BaselineTable { name: BaselineTableName; title: string; columns: string[]; rows: Record<string, unknown>[] }
export interface CsvReport { ok: boolean; applied: boolean; rowCount: number; errors: CsvError[] }
export interface EstimateView extends Estimate { date: string; disruptionTitle: string }
export type Channel = 'disruptions' | 'job_runs' | 'decisions' | 'checklist_items' | 'baseline' | 'auth';
export interface StationDay { date: string; boardings: number; alightings: number; typicalBoardings: number | null; typicalAlightings: number | null }
