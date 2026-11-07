import { useEffect, useState } from 'react';
import { useProvider } from './ProviderContext.tsx';
import { useContextStore } from '../store/context.ts';
import { clockNowMyt, dateText } from '../lib/format.ts';
import type { SourceInfo } from '../providers/types.ts';
import { CalendarDays, CircleHelp, Clock, UserRound } from 'lucide-react';
import { useGuide } from './guide.ts';

const SEVERITY: Record<SourceInfo['status'], number> = { static: 0, ok: 1, stale: 2, failed: 3 };
const STATUS_TEXT: Record<SourceInfo['status'], string> = { static: 'Static', ok: 'Up to date', stale: 'Stale', failed: 'Failed' };
const STATUS_DOT: Record<SourceInfo['status'], string> = { static: 'bg-baseline', ok: 'bg-green', stale: 'bg-amber', failed: 'bg-red' };

export default function TopBar() {
  const provider = useProvider();
  const ctx = useContextStore((s) => s.ctx);
  const [clock, setClock] = useState(clockNowMyt);
  const [title, setTitle] = useState<string | null>(null);
  const [worst, setWorst] = useState<SourceInfo['status'] | null>(null);
  const [user, setUser] = useState<string | null>(null);
  const openGuide = useGuide((x) => x.open);

  useEffect(() => {
    const id = setInterval(() => setClock(clockNowMyt()), 15_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!ctx.disruptionId) {
      setTitle(null);
      return;
    }
    void provider.getDisruption(ctx.disruptionId).then((d) => { if (!cancelled) setTitle(d?.title ?? null); });
    return () => { cancelled = true; };
  }, [provider, ctx.disruptionId]);

  useEffect(() => {
    let cancelled = false;
    void provider.currentUser().then((u) => { if (!cancelled) setUser(u?.displayName ?? null); });
    if (provider.info.kind !== 'demo') {
      void provider.listSources().then((src) => {
        if (cancelled || src.length === 0) return;
        setWorst(src.reduce((w, s) => (SEVERITY[s.status] > SEVERITY[w] ? s.status : w), src[0].status));
      });
    }
    return () => { cancelled = true; };
  }, [provider]);

  const demo = provider.info.kind === 'demo';
  const freshness = demo ? 'Demo data · saved 5 Nov 2026' : `Data: ${worst ? STATUS_TEXT[worst] : 'Checking'}`;
  const dot = demo ? 'bg-accent' : worst ? STATUS_DOT[worst] : 'bg-text-3';

  return (
    <header className="flex items-center gap-3 border-b border-border bg-panel px-6 text-sm">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-panel-2 px-3 py-1.5 font-medium">
          <CalendarDays aria-hidden="true" strokeWidth={1.75} className="h-4 w-4 text-text-3" />
          <span><span className="sr-only">Viewing </span>{ctx.date ? dateText(ctx.date) : ''}</span>
        </span>
        {title && <span className="truncate text-text-2">{title}</span>}
      </div>
      <time className="figure inline-flex items-center gap-2 text-[13px] text-text-2" aria-label="Current time in Malaysia">
        <Clock aria-hidden="true" strokeWidth={1.75} className="h-4 w-4 text-text-3" />{clock} MYT
      </time>
      <span className="inline-flex items-center gap-2 px-2 text-xs text-text-3"
        title={demo ? 'Saved demo data; the forecast engine still recomputes live' : undefined}>
        <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${dot}`} />{freshness}
      </span>
      <button type="button" onClick={openGuide} className="btn btn-sm">
        <CircleHelp aria-hidden="true" strokeWidth={1.75} /> How it works
      </button>
      <button type="button" className="btn btn-quiet btn-sm">
        <UserRound aria-hidden="true" strokeWidth={1.75} /> {user ?? 'Guest'}
      </button>
    </header>
  );
}
