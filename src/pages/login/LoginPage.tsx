import { useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useProvider } from '../../app/ProviderContext.tsx';
import { nextFromLogin } from '../../app/redirect.ts';

export default function LoginPage() {
  const provider = useProvider();
  const navigate = useNavigate();
  const { search } = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      navigate(nextFromLogin(search), { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Couldn’t sign in. Try again.');
      setBusy(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void run(() => provider.signIn(email.trim(), password));
  }

  return (
    <div className="grid h-full place-items-center bg-bg p-6 text-text">
      <div className="w-full max-w-sm rounded-xl border border-border bg-panel p-6">
        <h1 className="text-xl font-semibold">CampusSpotter</h1>
        <p className="mt-1 text-sm text-text-2">Sign in to see live campus data.</p>
        <form onSubmit={onSubmit} className="mt-5 grid gap-3">
          <label className="grid gap-1 text-sm text-text-2">Email
            <input className="field" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="grid gap-1 text-sm text-text-2">Password
            <input className="field" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          {error && <p role="alert" className="text-sm text-red-ink">{error}</p>}
          <button type="submit" className="btn btn-primary" disabled={busy}>Sign in</button>
        </form>
        <button type="button" className="btn mt-3 w-full" disabled={busy} onClick={() => void run(() => provider.demoSignIn())}>Continue as guest (view only)</button>
      </div>
    </div>
  );
}
