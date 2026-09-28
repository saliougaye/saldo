'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { canDeletePasskey } from '../../../../src/features/passkeys/list';
import { auth } from '../../../../src/server/auth/auth';
import { requireWebUser } from '../../../../src/server/auth/currentUser';
import { listPasskeysForUser } from '../../../../src/server/auth/passkeys';
import { getDb } from '../../../../src/server/db/client';
import { log } from '../../../../src/server/log';

/** What the client does with the answer: show nothing, or one line where the row is. */
export type PasskeyActionResult = { ok: true } | { ok: false; reason: 'last_one' | 'failed' };

const MAX_NAME_LENGTH = 60;

/**
 * §17.1.7: the name is Saldo's own label — the authenticator's name does not change — so this is a
 * plain rename, and an empty one puts the row back to «Passkey».
 */
export async function renamePasskeyAction(id: string, name: string): Promise<PasskeyActionResult> {
  const user = await requireWebUser();
  const trimmed = name.trim().slice(0, MAX_NAME_LENGTH);
  try {
    // The endpoint checks the passkey belongs to the session (`requireResourceOwnership`), so an id
    // from somewhere else is refused there rather than trusted here.
    await auth().api.updatePasskey({ body: { id, name: trimmed }, headers: await headers() });
  } catch (error) {
    log('auth', 'renaming a passkey failed', { user: user.id, error: String(error) });
    return { ok: false, reason: 'failed' };
  }
  revalidatePath('/profile/passkeys');
  return { ok: true };
}

/**
 * Never the last one. The rule lives here and not only in the button: a disabled button is a
 * courtesy, and this is the promise (§17.1.7).
 */
export async function deletePasskeyAction(id: string): Promise<PasskeyActionResult> {
  const user = await requireWebUser();
  const existing = await listPasskeysForUser(getDb(), user.id);
  if (!canDeletePasskey(existing.length)) return { ok: false, reason: 'last_one' };
  try {
    await auth().api.deletePasskey({ body: { id }, headers: await headers() });
  } catch (error) {
    log('auth', 'deleting a passkey failed', { user: user.id, error: String(error) });
    return { ok: false, reason: 'failed' };
  }
  revalidatePath('/profile/passkeys');
  return { ok: true };
}
