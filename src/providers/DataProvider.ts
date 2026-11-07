import type { Estimate, Forecast, InputBundle, LeverSet, Settings, Summary } from '@engine/index.ts';
import type { ChecklistDraft } from '@plans/checklist.ts';
import type {
  Announcement, AppUser, AskResult, BaselineTable, BaselineTableName, Channel, ChecklistItem, ContextRequest, CsvReport, Decision,
  DecisionBundle, DecisionInput, DisruptionFilter, DisruptionInput, EarlyWarningItem, EstimateView, OverridePatch, PlanProposal,
  ProviderInfo, ScanRun, SourceInfo, StationDay, Today,
} from './types.ts';

export interface DataProvider {
  info: ProviderInfo;
  getToday(): Promise<Today>;
  listDisruptions(f: DisruptionFilter): Promise<EarlyWarningItem[]>;        // sorted by startAt ascending
  getDisruption(id: string): Promise<EarlyWarningItem | null>;
  createDisruption(input: DisruptionInput): Promise<EarlyWarningItem>;     // origin 'manual'; risk computed before returning
  updateDisruption(id: string, input: DisruptionInput): Promise<EarlyWarningItem>;   // manual items only, else throws
  deleteDisruption(id: string): Promise<void>;                             // manual items only, else throws
  dismissDisruption(id: string): Promise<void>;                            // scan or rule items
  overrideDisruption(id: string, patch: OverridePatch): Promise<EarlyWarningItem>;   // scan items; manual-override label
  triggerScan(): Promise<ScanRun>;
  getLatestScan(): Promise<ScanRun | null>;
  getInputBundle(ctx: ContextRequest): Promise<InputBundle>;
  refreshEstimates(ctx: ContextRequest): Promise<Estimate[]>;
  ask(question: string, ctx: ContextRequest, levers: LeverSet): Promise<AskResult>;
  explain(ctx: ContextRequest, levers: LeverSet, noAction: Summary, withPlan: Summary): Promise<string>;
  generatePlans(ctx: ContextRequest, budgetRm: number): Promise<PlanProposal[]>;   // exactly 3
  draftAnnouncement(plan: PlanProposal, ctx: ContextRequest, checklist: ChecklistDraft[]): Promise<string>;
  saveForecast(ctx: ContextRequest, levers: LeverSet): Promise<{ id: string }>;
  createDecision(input: DecisionInput): Promise<DecisionBundle>;
  listDecisions(): Promise<Decision[]>;                                    // newest first
  getDecision(id: string): Promise<(DecisionBundle & { forecast: Forecast | null }) | null>;
  updateDecision(id: string, patch: { status?: Decision['status']; notes?: string | null }): Promise<Decision>;
  setChecklistItemDone(id: string, done: boolean): Promise<ChecklistItem>;
  updateAnnouncement(id: string, text: string): Promise<Announcement>;
  listSources(): Promise<SourceInfo[]>;
  listBaselineTables(): Promise<BaselineTable[]>;
  uploadBaselineCsv(table: BaselineTableName, csv: string, opts: { markVerified: boolean }): Promise<CsvReport>;
  getCsvTemplate(table: BaselineTableName): Promise<string>;
  getSettings(): Promise<Settings>;
  listEstimates(): Promise<EstimateView[]>;
  getStationDay(date: string): Promise<StationDay | null>;   // LRT Bukit Jalil ridership for the date plus typical figures; null when no row
  subscribe(channel: Channel, handler: () => void): () => void;
  currentUser(): Promise<AppUser | null>;
  signIn(email: string, password: string): Promise<AppUser>;
  demoSignIn(): Promise<AppUser>;
  signOut(): Promise<void>;
}
