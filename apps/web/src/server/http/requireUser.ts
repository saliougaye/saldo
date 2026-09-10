import { eq } from 'drizzle-orm';
import { verifyAccessToken } from '../auth/tokens';
import { getDb } from '../db/client';
import { users } from '../db/schema';
import { ApiError } from './errors';

export interface AuthenticatedUser {
  id: string;
  displayName: string;
}

/**
 * §14: every bearer route starts here, and every query downstream scopes on the id it returns.
 */
export async function requireUser(request: Request, now: Date): Promise<AuthenticatedUser> {
  const header = request.headers.get('authorization') ?? '';
  const [scheme, token] = header.split(' ');
  const unauthorized = new ApiError(401, 'unauthorized', 'A bearer token is required');
  if (scheme?.toLowerCase() !== 'bearer' || token === undefined || token.length === 0) {
    throw unauthorized;
  }
  const { userId } = await verifyAccessToken(token, now);
  const [user] = await getDb().select().from(users).where(eq(users.id, userId));
  if (user === undefined) throw unauthorized;
  return { id: user.id, displayName: user.displayName };
}
