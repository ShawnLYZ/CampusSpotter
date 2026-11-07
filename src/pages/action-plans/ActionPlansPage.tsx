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

const field = 'rounded-md border border-border bg-bg px-2 py-1.5 text-sm text-text focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-verified';

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
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto [color-scheme:dark] pr-1">
      <div className="flex items-center justify-between">
        <h1 className="sr-only">Action Plans</h1>
        <span />
        <Link to="/action-plans/log" className="text-sm text-text underline underline-offset-2 hover:text-text-2">Decision Log</Link>
      </div>
      <div className="flex flex-wrap items-end gap-4">
        <ContextPicker today={today} />
        <div className="flex flex-col gap-1">
          <label htmlFor="budget" className="text-xs text-text-2">Budget (RM)</label>
          <input id="budget" type="number" min={0} step={100} className={`${field} w-32`} value={budget ?? ''}
            onChange={(e) => setBudget(e.target.value === '' ? null : Number(e.target.value))} />
        </div>
        <button type="button" onClick={generate} disabled={busy || budget === null || !ctx.date}
          className="rounded-md border border-accent bg-accent px-3 py-1.5 text-sm font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-verified disabled:opacity-50">
          {busy ? 'Generating…' : 'Generate plans'}
        </button>
      </div>
      {error && <p role="alert" className="text-sm text-red">Could not generate plans: {error}</p>}
      {!(plans && current) && !busy && !error && <p className="p-6 text-text-2">Choose a context and budget, then generate plans.</p>}
      {plans && planCtx && current && (
        <>
          <h2 className="text-lg font-semibold text-text">
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
