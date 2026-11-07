import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useProvider } from '../../app/ProviderContext.tsx';
import { useContextStore } from '../../store/context.ts';
import { usePresenterAction, usePresenterCancel } from '../../presenter/usePresenterAction.ts';
import { useLeverStore } from '../../store/levers.ts';
import { useForecast } from '../../hooks/useForecast.ts';
import type { LeverSet } from '@engine/index.ts';
import type { ContextRequest, PlanProposal, Today } from '../../providers/types.ts';
import { dateText } from '../../lib/format.ts';
import { ContextPicker } from '../scenario-lab/ContextPicker.tsx';
import { PlanCard } from './PlanCard.tsx';
import { ComparisonTable } from './ComparisonTable.tsx';
import { DecisionView } from './DecisionView.tsx';
import type { PresenterAction } from '../../presenter/bus.ts';
import { BookOpen, ClipboardCheck, Sparkles } from 'lucide-react';
import { PageIntro } from '../../components/PageIntro.tsx';

const field = 'field';

const NO_LEVERS: LeverSet = [];
const ctxKey = (c: ContextRequest) => `${c.date}|${c.disruptionId ?? ''}|${c.reconstructed ? 1 : 0}`;

export default function ActionPlansPage() {
  const provider = useProvider();
  const navigate = useNavigate();
  const ctx = useContextStore((s) => s.ctx);
  const [today, setToday] = useState<Today | null>(null);
  const [budget, setBudget] = useState<number | null>(null);
  const [plans, setPlans] = useState<PlanProposal[] | null>(null);
  const [planCtx, setPlanCtx] = useState<ContextRequest | null>(null);
  const [chosen, setChosen] = useState<PlanProposal | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [planTitle, setPlanTitle] = useState<string | null>(null);
  // Figure badges take their provenance from the no-action forecast of the plans' context.
  const labelFc = useForecast(planCtx ?? ctx, NO_LEVERS);
  const req = useRef(0);
  const planBudget = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    void provider.getToday().then((t) => { if (!cancelled) setToday(t); });
    void provider.getSettings().then((s) => { if (!cancelled) setBudget((b) => b ?? s.defaultBudgetRm.value); });
    return () => { cancelled = true; };
  }, [provider]);

  const generateFor = (usedCtx: ContextRequest) => {
    if (budget === null || !Number.isFinite(budget) || budget < 0 || !usedCtx.date) return;
    const id = ++req.current;
    planBudget.current = budget;
    setBusy(true); setError(null); setChosen(null);
    provider.generatePlans(usedCtx, budget).then(
      (p) => { if (id === req.current) { setPlans(p); setPlanCtx(usedCtx); setBusy(false); } },
      (e: unknown) => { if (id === req.current) { setError(e instanceof Error ? e.message : String(e)); setBusy(false); } },
    );
  };

  const generate = () => generateFor(ctx);

  // Presenter: set the budget, press Generate once it has applied, then Choose a plan after a delay.
  // Each phase is an effect, so unmount, a new script or a step change cancels the pending choose timer.
  const [script, setScript] = useState<Extract<PresenterAction, { type: 'plans.generate' }> | null>(null);
  const scriptGenerated = useRef<typeof script>(null);
  usePresenterAction('plans.generate', (a) => { scriptGenerated.current = null; setScript(a); setBudget(a.budgetRm); });
  usePresenterCancel(() => { scriptGenerated.current = null; setScript(null); });
  useEffect(() => {
    if (!script || scriptGenerated.current === script || budget !== script.budgetRm || !ctx.date) return;
    scriptGenerated.current = script;
    generateFor(ctx);
  });

  // A changed context invalidates plans, the chosen plan and any in-flight request.
  const key = ctxKey(ctx);
  const planKey = planCtx ? ctxKey(planCtx) : null;
  const current = planKey === key;
  useEffect(() => {
    if (planKey === null || planKey === key) return;
    req.current++;
    setPlans(null); setChosen(null); setPlanCtx(null); setBusy(false); setError(null);
  }, [key, planKey]);
  useEffect(() => { req.current++; setBusy(false); }, [key]);

  useEffect(() => {
    const id = planCtx?.disruptionId;
    setPlanTitle(null);
    if (!id) return;
    let cancelled = false;
    provider.getDisruption(id).then((d) => { if (!cancelled) setPlanTitle(d?.title ?? null); }, () => undefined);
    return () => { cancelled = true; };
  }, [provider, planCtx]);

  // Once plans exist, a changed budget re-evaluates them (for the context they were made for) after a short pause.
  const regenerate = useRef<() => void>(() => undefined);
  regenerate.current = () => { if (planCtx) generateFor(planCtx); };
  const hasPlans = plans !== null && current;
  useEffect(() => {
    if (!hasPlans || budget === null || !Number.isFinite(budget) || budget < 0) return;
    if (budget === planBudget.current) return;
    const t = window.setTimeout(() => regenerate.current(), 400);
    return () => window.clearTimeout(t);
  }, [budget, hasPlans]);

  const scriptReady = script !== null && scriptGenerated.current === script && plans !== null && current && !busy;
  useEffect(() => {
    if (!script || !scriptReady || script.chooseIndex === null) return;
    const pick = plans?.[script.chooseIndex];
    if (!pick) return;
    const t = window.setTimeout(() => { setChosen(pick); setScript(null); }, script.chooseAfterMs);
    return () => window.clearTimeout(t);
  }, [script, scriptReady, plans]);

  const openLab = (plan: PlanProposal) => {
    useContextStore.getState().setCtx(planCtx ?? ctx);
    useLeverStore.getState().setLevers(plan.levers, plan.levers.map((l) => l.kind));
    void navigate('/scenario-lab');
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-5 overflow-y-auto pr-1">
      <PageIntro id="action-plans" Icon={ClipboardCheck} title="Action Plans"
        summary="Gemini suggests three plans within your budget; the forecast engine works out what each one achieves."
        steps={['Pick the day and your budget', 'Generate and compare three plans', 'Choose one to get team checklists and a student message']}
        actions={<Link to="/action-plans/log" className="btn"><BookOpen aria-hidden="true" /> Decision Log</Link>} />
      <div className="card flex flex-wrap items-end gap-4 p-4">
        <ContextPicker today={today} />
        <div className="flex flex-col gap-1">
          <label htmlFor="budget" className="field-label">Budget per day (RM)</label>
          <input id="budget" type="number" min={0} step={100} className={`${field} w-36`} value={budget ?? ''}
            onChange={(e) => setBudget(e.target.value === '' ? null : Number(e.target.value))} />
        </div>
        <button type="button" onClick={generate} disabled={busy || budget === null || !ctx.date} className="btn btn-primary">
          <Sparkles aria-hidden="true" className={busy ? 'animate-pulse' : ''} />
          {busy ? 'Generating…' : plans && current ? 'Generate again' : 'Generate plans'}
        </button>
      </div>
      {error && <p role="alert" className="rounded-xl border border-red/60 bg-red/10 px-4 py-3 text-sm text-red-ink">Could not generate plans: {error}. Check the day and budget, then try again.</p>}
      {!(plans && current) && !busy && !error && (
        <div className="card flex flex-col items-center gap-2 px-6 py-12 text-center">
          <Sparkles aria-hidden="true" className="h-8 w-8 text-ai-ink" />
          <p className="font-medium">No plans yet for this day</p>
          <p className="max-w-[56ch] text-sm text-text-2">Choose a day above, often one flagged on Early Warning, set what you can spend, then press <span className="font-medium text-text">Generate plans</span>. You will get three different options with costs and effects side by side.</p>
        </div>
      )}
      {busy && <p role="status" className="card px-6 py-8 text-center text-sm text-text-2">Gemini is drafting three plans and the engine is testing each one…</p>}
      {plans && planCtx && current && (
        <>
          <h2 className="text-lg font-semibold tracking-[-0.01em] text-text">
            Plans for {dateText(planCtx.date)}{planTitle ? <span className="text-text-2"> · {planTitle}</span> : null}
          </h2>
          <div className="grid grid-cols-3 gap-4">
            {plans.map((p, i) => (
              <PlanCard key={p.id} plan={p} index={i} onChoose={() => setChosen(p)} onOpenLab={() => openLab(p)} forecast={labelFc.noAction} bundle={labelFc.bundle} />
            ))}
          </div>
          {plans[0] && <ComparisonTable noAction={plans[0].noActionSummary} plans={plans} forecast={labelFc.noAction} bundle={labelFc.bundle} />}
          {chosen && (
            <DecisionView key={chosen.id} plan={chosen} ctx={planCtx} onClose={() => setChosen(null)}
              onConfirmed={() => void navigate('/action-plans/log')} />
          )}
        </>
      )}
    </div>
  );
}
