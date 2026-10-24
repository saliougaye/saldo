'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { requireWebUser } from '../../../../src/server/auth/currentUser';
import { type RenameAccountResult, renameAccount } from '../../../../src/server/auth/displayName';
import { normaliseEmail } from '../../../../src/server/auth/email';
import { cancelEmailChange, startEmailChange } from '../../../../src/server/auth/emailChange';
import { getDb } from '../../../../src/server/db/client';

/**
 * Profilo → Nome. The account is the session's (`requireWebUser`), never an id from the request; the
 * rules are `renameAccount`'s. The name shows in the frame's head and in the top bar's avatar menu,
 * so the whole signed-in layout is revalidated.
 */
export async function renameAccountAction(name: unknown): Promise<RenameAccountResult> {
  const account = await requireWebUser();
  const result = await renameAccount(getDb(), account.id, name, new Date());
  if (result.ok) revalidatePath('/', 'layout');
  return result;
}

export type ChangeEmailResult =
  | { ok: true }
  | { ok: false; reason: 'invalid' | 'same' | 'later' | 'failed' };

/**
 * Profilo → Account asks to change the address. The rules are `startEmailChange`'s, the same ones
 * `POST /api/me/email` applies; the answer does not say whether another account has the address.
 */
export async function requestEmailChangeAction(address: string): Promise<ChangeEmailResult> {
  const account = await requireWebUser();
  const email = normaliseEmail(address);
  if (email === null) return { ok: false, reason: 'invalid' };
  const result = await startEmailChange(getDb(), {
    userId: account.id,
    currentEmail: account.email,
    newEmail: email,
    acceptLanguage: (await headers()).get('accept-language'),
    now: new Date(),
  });
  if (!result.ok) {
    if (result.reason === 'unchanged') return { ok: false, reason: 'same' };
    return { ok: false, reason: result.reason === 'rate_limited' ? 'later' : 'failed' };
  }
  revalidatePath('/profile', 'layout');
  return { ok: true };
}

export async function cancelEmailChangeAction(): Promise<ChangeEmailResult> {
  const account = await requireWebUser();
  await cancelEmailChange(getDb(), account.id);
  revalidatePath('/profile', 'layout');
  return { ok: true };
}
