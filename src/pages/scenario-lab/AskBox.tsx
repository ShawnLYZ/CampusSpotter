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
import { CornerDownLeft, MessageSquareText } from 'lucide-react';

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
    <section aria-labelledby="ask-gemini" className="card border-ai/40 p-4">
      <h2 id="ask-gemini" className="flex items-center gap-2 section-title"><MessageSquareText aria-hidden="true" strokeWidth={1.75} className="h-4 w-4 text-ai-ink" />Ask Gemini</h2>
      <p className="mb-3 mt-1 text-xs text-text-2">Describe an action in plain English. Gemini ticks the matching actions for you; the numbers come from the forecast engine.</p>
      <form onSubmit={onSubmit} className="flex flex-col gap-2">
        <label htmlFor="ask-input" className="sr-only">Ask a what-if question</label>
        <textarea id="ask-input" rows={3} value={question} onChange={(e) => setQuestion(e.target.value)}
          placeholder="What if we move afternoon classes online?"
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void submit(question); } }}
          className="field w-full resize-none" />
        <button type="submit" disabled={busy || question.trim() === ''}
          className="btn">
          {busy ? 'Asking…' : <>Ask <CornerDownLeft aria-hidden="true" /></>}
        </button>
      </form>
      <p className="mt-4 text-xs text-text-3">Or try one of these</p>
      <div className="mt-2 flex flex-col gap-2" role="group" aria-label="Suggested questions">
        {SUGGESTED_QUESTIONS.map((q) => (
          <button key={q} type="button" disabled={busy} onClick={() => { setQuestion(q); void submit(q); }}
            className="rounded-lg border border-border bg-panel-2 px-3 py-2 text-left text-xs leading-relaxed text-text-2 transition-colors hover:border-ai/60 hover:text-text disabled:opacity-50">
            {q}
          </button>
        ))}
      </div>
      <div aria-live="polite" className="mt-3 flex flex-col gap-3">
        {error && <p role="alert" className="text-sm text-red-ink">{error}</p>}
        {restatement && (
          <p className="text-sm text-text"><TypedText key={restatement + token.current} text={restatement} onDone={() => setRestDone(true)} /></p>
        )}
        {restDone && (pending || explanation) && (
          <div>
            <h3 className="mb-1 text-sm font-medium text-ai-ink">Why the results changed</h3>
            {explanation
              ? <p className="text-sm text-text"><TypedText key={explanation} text={explanation} /></p>
              : <p className="text-sm text-text-2">Working out why…</p>}
          </div>
        )}
      </div>
    </section>
  );
}
