import { type AuthenticatedUser, authenticate } from '../auth/session';
import { ApiError } from './errors';

export type { AuthenticatedUser };

/**
 * Every bearer route starts here, and every query downstream scopes on the id it returns. A revoked
 * account and no session at all are the same 401 on purpose: the app answers both by signing in
 * again, and the difference is the admin's business, not the caller's.
 */
export async function requireUser(request: Request): Promise<AuthenticatedUser> {
  const user = await authenticate(request.headers);
  if (user === null) throw new ApiError(401, 'unauthorized', 'A bearer token is required');
  return user;
}
