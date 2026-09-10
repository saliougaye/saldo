import { sql } from 'drizzle-orm';
import { users } from '../db/schema';
import type { ServerDatabase } from '../db/types';
import type { RegistrationMode } from '../env';

/**
 * §9.2 `REGISTRATION`: `open` always, `closed` never, `first-user` only while the instance has no
 * user — which is how a fresh self-hosted server lets its owner in and then shuts the door.
 */
export async function registrationAllowed(
  db: ServerDatabase,
  mode: RegistrationMode,
): Promise<boolean> {
  if (mode === 'open') return true;
  if (mode === 'closed') return false;
  const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(users);
  return (row?.count ?? 0) === 0;
}
