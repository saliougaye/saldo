import { sql } from 'drizzle-orm';
import { user } from '../db/schema';
import type { ServerDatabase } from '../db/types';
import type { RegistrationMode } from '../env';

/** How many accounts the instance has. Zero is the one number that matters: it is what `/setup` keys on (0.3h). */
export async function userCount(db: ServerDatabase): Promise<number> {
  const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(user);
  return row?.count ?? 0;
}

/**
 * §9.2 `REGISTRATION`: `open` always, `invite` always (under that mode it is the **code** that
 * decides, not the instance), and `closed` and `first-user` only while the instance has no user.
 *
 * **A fresh instance lets its first account in under every mode** (0.3h). The first-run wizard at
 * `/setup` replaced the CLI's first invite, so an instance that starts with `REGISTRATION=invite`
 * — the documented recommendation — has to accept the account the wizard creates. The window is
 * the one `first-user` always had: it closes the moment an account exists.
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
  return (await userCount(db)) === 0;
}

/**
 * Under `invite` every account needs a code **except the first** (0.3h): the first account is the
 * one the wizard creates, and it becomes the admin who mints every later code. Once it exists the
 * door is the code, with no window during which it stands open.
 */
export async function registrationRequiresInvite(
  db: ServerDatabase,
  mode: RegistrationMode,
): Promise<boolean> {
  return mode === 'invite' && (await userCount(db)) > 0;
}
