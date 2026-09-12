import { isRevoked } from '../auth/admin';
import { auth } from '../auth/auth';
import { getDb } from '../db/client';
import { ApiError } from './errors';

export interface AuthenticatedUser {
  id: string;
  displayName: string;
}

/**
 * Every bearer route starts here, and every query downstream scopes on the id it returns. The
 * `bearer` plugin lets `getSession` read the token out of the Authorization header, so this is the
 * same call a cookie-bearing browser would make — session expiry and revocation are Better Auth's.
 *
 * The revocation check is ours and is deliberately not left to the library: better-auth only tests
 * the ban flag when a session is **created**, so a live bearer would survive until its session row
 * happened to be deleted. §10 promises that a revoked account stops syncing at once, and that
 * promise is kept here rather than by remembering to delete rows everywhere else.
 */
export async function requireUser(request: Request): Promise<AuthenticatedUser> {
  const session = await auth().api.getSession({ headers: request.headers });
  if (session === null) throw new ApiError(401, 'unauthorized', 'A bearer token is required');
  if (await isRevoked(getDb(), session.user.id)) {
    throw new ApiError(401, 'unauthorized', 'This account no longer has access');
  }
  return { id: session.user.id, displayName: session.user.name };
}
