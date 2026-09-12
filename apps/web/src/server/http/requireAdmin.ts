import { isAdmin } from '../auth/admin';
import { getDb } from '../db/client';
import { ApiError } from './errors';
import { type AuthenticatedUser, requireUser } from './requireUser';

/**
 * §9.5. The administrative routes start here. The two failures are deliberately different codes:
 * 401 means "no usable session", which the app answers by signing in again, and 403 means "this
 * account exists and is not allowed", which no amount of signing in will change.
 */
export async function requireAdmin(request: Request): Promise<AuthenticatedUser> {
  const user = await requireUser(request);
  if (!(await isAdmin(getDb(), user.id))) {
    throw new ApiError(403, 'forbidden', 'Only the server owner can manage access');
  }
  return user;
}
