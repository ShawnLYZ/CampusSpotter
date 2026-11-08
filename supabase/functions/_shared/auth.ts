import type { Repo } from './repo.ts';

export interface Caller { userId: string; role: 'manager' | 'demo' }

export async function getCaller(req: Request, repo: Repo): Promise<Caller | null> {
  const m = /^Bearer\s+(.+)$/i.exec(req.headers.get('Authorization') ?? '');
  if (!m) return null;
  const user = await repo.userFromJwt(m[1].trim());
  if (!user) return null;
  const role = await repo.roleOf(user.id);
  return role ? { userId: user.id, role } : null;
}
