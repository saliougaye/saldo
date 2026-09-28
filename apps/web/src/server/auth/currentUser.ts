import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { type AuthenticatedUser, authenticate } from './session';

/**
 * The cookie session of this request, or null. A revoked account reads as signed out (§10).
 *
 * `cache()` for the same reason `loadUserData` has it: the root layout reads the session to set the
 * theme on `<html>` and the `(app)` layout reads it again to load the page, and one request must
 * not cost two session lookups. It lasts one request, which is shorter than any session can change.
 */
export const currentUser: () => Promise<AuthenticatedUser | null> = cache(async () =>
  authenticate(await headers()),
);

/**
 * What every page under `(app)` starts with. `redirect` throws, so nothing after it runs — and the
 * page keeps a non-null user without a non-null assertion (which this codebase does not allow).
 */
export async function requireWebUser(): Promise<AuthenticatedUser> {
  const user = await currentUser();
  if (user === null) redirect('/login');
  return user;
}
