import { auth } from '../auth/auth';
import { ApiError } from './errors';

export interface AuthenticatedUser {
  id: string;
  displayName: string;
}

/**
 * Every bearer route starts here, and every query downstream scopes on the id it returns. The
 * `bearer` plugin lets `getSession` read the token out of the Authorization header, so this is the
 * same call a cookie-bearing browser would make — session expiry and revocation are Better Auth's.
 */
export async function requireUser(request: Request): Promise<AuthenticatedUser> {
  const session = await auth().api.getSession({ headers: request.headers });
  if (session === null) throw new ApiError(401, 'unauthorized', 'A bearer token is required');
  return { id: session.user.id, displayName: session.user.name };
}
