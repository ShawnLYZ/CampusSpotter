import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { Forecast } from '@engine/index.ts';
import { SUGGESTED_QUESTIONS } from '@plans/suggestedQuestions.ts';
import { useProvider } from '../../app/ProviderContext.tsx';
import { useContextStore } from '../../store/context.ts';
import { useLeverStore } from '../../store/levers.ts';
import { TypedText } from '../../components/TypedText.tsx';
import { SCRIPTED_ASKS } from '../../providers/demo/scripted/ask.ts';
import { usePresenterAction, usePresenterCancel } from '../../presenter/usePresenterAction.ts';
import { explainGate, type ForecastStatus } from './explainGate.ts';

interface Props { status: ForecastStatus; noAction?: Forecast; withPlan?: Forecast }

export function AskBox({ status, noAction, withPlan }: Props) {
  const provider = useProvider();
  const ctx = useContextStore((s) => s.ctx);
  const levers = useLeverStore((s) => s.levers);
  const setLevers = useLeverStore((s) => s.setLevers);

  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [restatement, setRestatement] = useState<string | null>(null);
  const [restDone, setRestDone] = useState(false);
  const [pending, setPending] = useState(false);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const token = useRef(0);

  // Explain exactly once per ask. useForecast computes withPlan from the store levers in the same render,
  // so a ready forecast is the one for the current levers.
  const gate = explainGate(pending, status, noAction !== undefined && withPlan !== undefined);
  useEffect(() => {
    if (gate === 'wait') return;
    setPending(false);
    const mine = token.current;
    if (gate === 'fail' || !noAction || !withPlan) { setError('The explanation is unavailable because the forecast failed.'); return; }
    provider.explain(ctx, levers, noAction.summary, withPlan.summary).then(
      (text) => { if (token.current === mine) setExplanation(text); },
      () => { if (token.current === mine) setError('The explanation is unavailable right now.'); },
    );
  }, [gate, noAction, withPlan, levers, ctx, provider]);

  const submit = async (q: string) => {
    const text = q.trim();
    if (!text || busy) return;
    const mine = ++token.current;
    setBusy(true); setError(null); setPending(false); setExplanation(null); setRestatement(null); setRestDone(false);
    try {
      const result = await provider.ask(text, ctx, levers);
      if (token.current !== mine) return;
      setRestatement(result.restatement);
      if (result.matched) {
        setLevers(result.levers, result.changedKinds);
        setPending(true);
      }
    } catch {
      if (token.current === mine) setError('Could not reach the assistant. Try again.');
    } finally {
      if (token.current === mine) setBusy(false);
    }
  };

  // Presenter: type the scripted question at 30 cps, then submit it the normal way. One typer at a time.
  const submitRef = useRef(submit);
  submitRef.current = submit;
  const typer = useRef<number | null>(null);
  const stopTyping = () => { if (typer.current !== null) { window.clearInterval(typer.current); typer.current = null; } };
  // Also drop any in-flight answer so it cannot touch levers after the next presenter step has reset them.
  // The bumped token makes submit's finally skip setBusy(false), so clear busy here.
  const cancelAsk = () => { stopTyping(); token.current++; setBusy(false); };
  usePresenterAction('lab.ask', (a) => {
    const q = SCRIPTED_ASKS.find((x) => x.id === a.askId)?.question;
    if (!q) return;
    stopTyping();
    let n = 0;
    setQuestion('');
    typer.current = window.setInterval(() => {
      n += 1;
      setQuestion(q.slice(0, n));
      if (n >= q.length) { stopTyping(); void submitRef.current(q); }
    }, 1000 / 30);
  });
  usePresenterCancel(cancelAsk);
  useEffect(() => cancelAsk, []);

  const onSubmit = (e: FormEvent) => { e.preventDefault(); void submit(question); };

  return (
    <section aria-labelledby="ask-gemini" className="rounded-lg border border-border bg-panel p-3">
      <h2 id="ask-gemini" className="mb-2 text-sm font-semibold text-text">Ask Gemini</h2>
      <form onSubmit={onSubmit} className="flex flex-col gap-2">
        <label htmlFor="ask-input" className="sr-only">Ask a what-if question</label>
        <textarea id="ask-input" rows={3} value={question} onChange={(e) => setQuestion(e.target.value)}
          placeholder="What if we move afternoon classes online?"
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void submit(question); } }}
          className="w-full resize-none rounded-md border border-border bg-bg p-2 text-sm text-text placeholder:text-text-3 focus-visible:outline-2 focus-visible:outline-verified" />
        <button type="submit" disabled={busy || question.trim() === ''}
          className="rounded-md border border-verified bg-verified/20 px-3 py-1.5 text-sm font-medium text-text disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-verified">
          {busy ? 'Asking…' : 'Ask'}
        </button>
      </form>
      <div className="mt-3 flex flex-col gap-1.5" role="group" aria-label="Suggested questions">
        {SUGGESTED_QUESTIONS.map((q) => (
          <button key={q} type="button" disabled={busy} onClick={() => { setQuestion(q); void submit(q); }}
            className="rounded-md border border-border bg-panel-2 px-3 py-1.5 text-left text-xs text-text-2 hover:text-text disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-verified">
            {q}
          </button>
        ))}
      </div>
      <div aria-live="polite" className="mt-3 flex flex-col gap-3">
        {error && <p role="alert" className="text-sm text-red">{error}</p>}
        {restatement && (
          <p className="text-sm text-text"><TypedText key={restatement + token.current} text={restatement} onDone={() => setRestDone(true)} /></p>
        )}
        {restDone && (pending || explanation) && (
          <div>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-2">Why the results changed</h3>
            {explanation
              ? <p className="text-sm text-text"><TypedText key={explanation} text={explanation} /></p>
              : <p className="text-sm text-text-2">Working out why…</p>}
          </div>
        )}
      </div>
    </section>
  );
}
