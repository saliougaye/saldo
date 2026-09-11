import { sql } from 'drizzle-orm';
import { user } from '../db/schema';
import type { ServerDatabase } from '../db/types';
import type { RegistrationMode } from '../env';

/**
 * §9.2 `REGISTRATION`: `open` always, `closed` never, `first-user` only while the instance has no
 * user — which is how a fresh self-hosted server lets its owner in and then shuts the door — and
 * `invite` always, because under that mode it is the **code** that decides, not the instance.
 *
 * What this answers is "should the client offer to create an account", which is why `invite` is
 * `true`: somebody holding a code must be able to reach the form. Whether the code is any good is
 * settled later, in `resolveUser`.
 *
 * Better Auth has no notion of a closed instance, so this is checked in the passkey plugin's
 * `resolveUser` hook: the last moment before a user row would be created.
 */
export async function registrationAllowed(
  db: ServerDatabase,
  mode: RegistrationMode,
): Promise<boolean> {
  if (mode === 'open' || mode === 'invite') return true;
  if (mode === 'closed') return false;
  const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(user);
  return (row?.count ?? 0) === 0;
}

/**
 * Under `invite` **every** account needs a code, including the first: the first code is minted by
 * the CLI on the server, so the first account to exist is the one belonging to whoever installed
 * it. That is the whole of §10's "who is allowed in" — there is no window during which the door
 * stands open.
 */
export function registrationRequiresInvite(mode: RegistrationMode): boolean {
  return mode === 'invite';
}
