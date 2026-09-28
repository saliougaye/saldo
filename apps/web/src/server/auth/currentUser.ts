import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { type AuthenticatedUser, authenticate } from './session';

/** The cookie session of this request, or null. A revoked account reads as signed out (§10). */
export async function currentUser(): Promise<AuthenticatedUser | null> {
  return authenticate(await headers());
}

/**
 * What every page under `(app)` starts with. `redirect` throws, so nothing after it runs — and the
 * page keeps a non-null user without a non-null assertion (which this codebase does not allow).
 */
export async function requireWebUser(): Promise<AuthenticatedUser> {
  const user = await currentUser();
  if (user === null) redirect('/login');
  return user;
}
