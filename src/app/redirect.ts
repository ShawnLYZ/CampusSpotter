let signedOutOnPurpose = false;

/** Marks a sign-out the user asked for, so the guard sends them to a plain /login. Cleared on the next sign-in or a failed sign-out. */
export function noteSignOut(onPurpose: boolean): void {
  signedOutOnPurpose = onPurpose;
}

/** Where an unauthenticated visitor goes; the page they wanted travels in `next` unless they signed out on purpose. */
export function loginRedirect(location: { pathname: string; search: string }): string {
  if (signedOutOnPurpose) return '/login';
  return `/login?next=${encodeURIComponent(location.pathname + location.search)}`;
}

const BASE = 'http://x.invalid';

/** The page to open after sign-in: `next` when it is a relative path on this site, otherwise the home page. */
export function nextFromLogin(search: string): string {
  const next = new URLSearchParams(search).get('next');
  // Browsers drop tabs/newlines and treat backslashes as slashes, so reject those outright, then confirm the origin is unchanged.
  if (!next || !next.startsWith('/') || /[\x00-\x20\x7f\\]/.test(next)) return '/';
  try {
    const u = new URL(next, BASE);
    return u.origin === BASE ? u.pathname + u.search + u.hash : '/';
  } catch { return '/'; }
}
