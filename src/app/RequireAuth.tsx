import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useProvider } from './ProviderContext.tsx';
import { loginRedirect, noteSignOut } from './redirect.ts';
import { checkAuth, nextGuardState, type AuthCheck } from './checkAuth.ts';

/** Sends signed-out visitors to /login. */
export default function RequireAuth({ children }: { children: ReactNode }) {
  const provider = useProvider();
  const { pathname, search } = useLocation();
  const [state, setState] = useState<AuthCheck | 'pending'>('pending');
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => { setState('pending'); setAttempt((n) => n + 1); }, []);

  useEffect(() => {
    let cancelled = false;
    const check = () => { void checkAuth(provider).then((r) => { if (!cancelled) setState((prev) => nextGuardState(prev, r)); }); };
    check();
    const onVisible = () => { if (document.visibilityState === 'visible') check(); };
    document.addEventListener('visibilitychange', onVisible);
    const offAuth = provider.subscribe('auth', check);
    return () => { cancelled = true; offAuth(); document.removeEventListener('visibilitychange', onVisible); };
  }, [provider, pathname, search, attempt]);

  useEffect(() => { if (state === 'in') noteSignOut(false); }, [state]);

  if (state === 'out') return <Navigate to={loginRedirect({ pathname, search })} replace />;
  if (state === 'pending') return <p className="p-6 text-text-2">Checking your sign-in…</p>;
  if (state === 'error') {
    return (
      <div role="alert" className="p-6 text-text-2">
        <p>Couldn’t check your sign-in. Check your connection and try again.</p>
        <button type="button" className="btn btn-sm mt-3" onClick={retry}>Try again</button>
      </div>
    );
  }
  return <>{children}</>;
}
