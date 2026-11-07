import { useEffect, useState } from 'react';
import { useProvider } from './ProviderContext.tsx';
import { useContextStore } from '../store/context.ts';
import { clockNowMyt, dateText } from '../lib/format.ts';
import type { SourceInfo } from '../providers/types.ts';

const SEVERITY: Record<SourceInfo['status'], number> = { static: 0, ok: 1, stale: 2, failed: 3 };
const STATUS_TEXT: Record<SourceInfo['status'], string> = { static: 'Static', ok: 'Up to date', stale: 'Stale', failed: 'Failed' };

export default function TopBar() {
  const provider = useProvider();
  const ctx = useContextStore((s) => s.ctx);
  const [clock, setClock] = useState(clockNowMyt);
  const [title, setTitle] = useState<string | null>(null);
  const [worst, setWorst] = useState<SourceInfo['status'] | null>(null);
  const [user, setUser] = useState<string | null>(null);

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

  const freshness = provider.info.kind === 'demo'
    ? 'Demo data · saved 5 Nov 2026'
    : `Data: ${worst ? STATUS_TEXT[worst] : 'Checking'}`;

  return (
    <header className="flex items-center gap-6 border-b border-border bg-panel px-6 text-sm">
      <div className="min-w-0 flex-1 truncate">
        <span className="font-medium">{ctx.date ? dateText(ctx.date) : ''}</span>
        {title && <span className="ml-3 text-text-2">{title}</span>}
      </div>
      <time className="tabular text-text-2" aria-label="Current time in Malaysia">{clock} MYT</time>
      <span className="rounded-full border border-border px-3 py-1 text-xs text-text-2">{freshness}</span>
      <button type="button" className="rounded-md border border-border px-3 py-1 text-text-2 hover:bg-panel-2">
        {user ?? 'Guest'}
      </button>
    </header>
  );
}
