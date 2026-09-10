import { auth } from '../auth/auth';
import { session, user } from '../db/schema';
import type { ServerDatabase } from '../db/types';

export interface TestSession {
  userId: string;
  token: string;
  bearer: string;
}

/**
 * A signed-in user, made by writing the two rows Better Auth would have written. Going through the
 * passkey endpoints would mean driving a WebAuthn ceremony from Node; the `bearer` plugin only
 * cares that the token names a live session, which is exactly what this creates.
 */
export async function createTestSession(
  db: ServerDatabase,
  displayName = 'Ada',
): Promise<TestSession> {
  const id = crypto.randomUUID();
  const [created] = await db
    .insert(user)
    .values({
      id,
      name: displayName,
      // Passkey-only accounts carry a synthetic address in the reserved `.invalid` TLD.
      email: `${id}@passkey.saldo.invalid`,
      emailVerified: false,
    })
    .returning();
  if (created === undefined) throw new Error('insert returned no row');
  const token = crypto.randomUUID();
  await db.insert(session).values({
    id: crypto.randomUUID(),
    userId: created.id,
    token,
    expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
    updatedAt: new Date(),
  });
  // Touch the instance so a misconfigured one fails here rather than inside a route handler.
  auth();
  return { userId: created.id, token, bearer: `Bearer ${token}` };
}
