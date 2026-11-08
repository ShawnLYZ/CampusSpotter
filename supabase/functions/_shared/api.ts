// Mirrors the API types in src/providers/types.ts (Edge code may not import from src/).
import type { LeverSet, Summary, CostLine } from './engine.ts';
import type { Team } from './plans.ts';

export type { Team };
export interface ContextRequest { date: string; disruptionId?: string; reconstructed?: boolean }
export interface PlanProposal { id: string; name: string; levers: LeverSet; rationale: string; costLines: CostLine[]; totalCostRm: number; summary: Summary; noActionSummary: Summary; overBudget: boolean; budgetRm: number }
export interface ChecklistItem { id: string; decisionId: string; team: Team; text: string; dueAt: string | null; done: boolean; doneBy: string | null; doneAt: string | null }
export interface Decision { id: string; planId: string; planName: string; disruptionId: string | null; contextDate: string; decidedBy: string; decidedAt: string; status: 'planned' | 'done' | 'cancelled'; notes: string | null; totalCostRm: number; predicted: Summary; levers: LeverSet; forecastId: string | null }
export interface Announcement { id: string; decisionId: string; draft: string; editedText: string | null; updatedAt: string }
export interface DecisionBundle { decision: Decision; checklist: ChecklistItem[]; announcement: Announcement }
