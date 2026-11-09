import { useCallback, useEffect, useState } from 'react';
import { Toast } from '../components/Toast.tsx';
import { useProvider } from './ProviderContext.tsx';
import { noteSignOut } from './redirect.ts';
import { useContextStore } from '../store/context.ts';
import { clockNowMyt, dateText } from '../lib/format.ts';
import { useNavigate } from 'react-router';
import type { AppUser, SourceInfo } from '../providers/types.ts';
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
  const [user, setUser] = useState<AppUser | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const clearToast = useCallback(() => setToast(null), []);
  const navigate = useNavigate();
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
    provider.currentUser().then((u) => { if (!cancelled) setUser(u); }, () => { /* the guard handles sign-in problems */ });
    provider.listSources().then((src) => {
      if (cancelled || src.length === 0) return;
      setWorst(src.reduce((w, s) => (SEVERITY[s.status] > SEVERITY[w] ? s.status : w), src[0].status));
    }, () => { /* the freshness badge stays on "Checking" */ });
    return () => { cancelled = true; };
  }, [provider]);

  const freshness = `Data: ${worst ? STATUS_TEXT[worst] : 'Checking'}`;
  const dot = worst ? STATUS_DOT[worst] : 'bg-text-3';

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
      <span className="inline-flex items-center gap-2 px-2 text-xs text-text-3">
        <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${dot}`} />{freshness}
      </span>
      <button type="button" onClick={openGuide} className="btn btn-sm">
        <CircleHelp aria-hidden="true" strokeWidth={1.75} /> How it works
      </button>
      <span className="inline-flex items-center gap-2 text-text-2">
        <UserRound aria-hidden="true" strokeWidth={1.75} className="h-4 w-4" /> {user?.displayName ?? 'Guest'}
        {user && <span className="rounded-full border border-border px-2 py-0.5 text-xs">{user.role === 'manager' ? 'Manager' : 'Limited access'}</span>}
      </span>
      <button type="button" className="btn btn-quiet btn-sm" onClick={() => { noteSignOut(true); provider.signOut().then(() => navigate('/login'), (e: unknown) => { noteSignOut(false); setToast(e instanceof Error ? e.message : 'Couldn’t sign you out.'); }); }}>Sign out</button>
      {toast && <Toast message={toast} onDone={clearToast} />}
    </header>
  );
}
