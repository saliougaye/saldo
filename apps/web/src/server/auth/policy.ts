import { sql } from 'drizzle-orm';
import { user } from '../db/schema';
import type { ServerDatabase } from '../db/types';
import type { RegistrationMode } from '../env';

/**
 * §9.2 `REGISTRATION`: `open` always, `closed` never, `first-user` only while the instance has no
 * user — which is how a fresh self-hosted server lets its owner in and then shuts the door.
 *
 * Better Auth has no notion of a closed instance, so this is checked in the passkey plugin's
 * `resolveUser` hook: the last moment before a user row would be created.
 */
export async function registrationAllowed(
  db: ServerDatabase,
  mode: RegistrationMode,
): Promise<boolean> {
  if (mode === 'open') return true;
  if (mode === 'closed') return false;
  const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(user);
  return (row?.count ?? 0) === 0;
}
