'use server';

import {
  type AccountResult,
  deleteAccount,
  promoteAccount,
  restoreAccount,
  revokeAccount,
} from '../../../../src/server/admin/accounts';
import { requireWebAdmin } from '../../../../src/server/auth/currentUser';
import { getDb } from '../../../../src/server/db/client';
import { getStore } from '../../../../src/server/storage';

/**
 * §17.1.7: each action resolves the admin itself — a layout does not run for a Server Action, and
 * this is a public endpoint whatever the page shows — and hands the rest to `src/server/admin`.
 * The arguments come from the browser, so they are `unknown` until that module has looked at them.
 */
export async function promoteAccountAction(id: unknown): Promise<AccountResult<'notFound'>> {
  const admin = await requireWebAdmin();
  return promoteAccount(getDb(), admin.id, String(id));
}

export async function revokeAccountAction(
  id: unknown,
): Promise<AccountResult<'self' | 'notFound'>> {
  const admin = await requireWebAdmin();
  return revokeAccount(getDb(), admin.id, String(id), new Date());
}

export async function restoreAccountAction(id: unknown): Promise<AccountResult<'notFound'>> {
  const admin = await requireWebAdmin();
  return restoreAccount(getDb(), admin.id, String(id));
}

/** `input` is `{ id, confirmation }`; the confirmation is checked again on the server. */
export async function deleteAccountAction(
  input: unknown,
): Promise<AccountResult<'self' | 'notFound' | 'emailMismatch'>> {
  const admin = await requireWebAdmin();
  const fields: { id?: unknown; confirmation?: unknown } =
    typeof input === 'object' && input !== null ? input : {};
  return deleteAccount(getDb(), await getStore(), admin.id, {
    id: String(fields.id),
    confirmation: String(fields.confirmation ?? ''),
  });
}
