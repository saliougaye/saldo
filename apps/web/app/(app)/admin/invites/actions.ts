'use server';

import { revalidatePath } from 'next/cache';
import {
  type MintActionResult,
  mintInvite,
  type RevokeInviteResult,
  revokeInviteById,
} from '../../../../src/server/admin/invites';
import { requireWebAdmin } from '../../../../src/server/auth/currentUser';
import { getDb } from '../../../../src/server/db/client';
import { env } from '../../../../src/server/env';
import { adminContext } from '../../../../src/server/page/adminContext';

/**
 * The code is in the returned value and nowhere else (§9.5): the panel keeps it in client state.
 * As in the accounts' actions, the guard runs here because a layout does not run for an action.
 *
 * `/admin` is revalidated as a layout, so the same answer brings the list and the count with the
 * new invite. ✕ and Esc close the panel in place, with no request: without this, the list behind
 * it would not have the invite. The page holds no code, so the new render holds none either.
 */
export async function mintInviteAction(input: unknown): Promise<MintActionResult> {
  const admin = await requireWebAdmin();
  const minted = await mintInvite(getDb(), admin.id, input, new Date(), env().publicUrl);
  if (!minted.ok) return minted;
  revalidatePath('/admin', 'layout');
  const { formatDate } = await adminContext(admin);
  return { ...minted, expiresOn: formatDate.long(minted.expiresAt) };
}

export async function revokeInviteAction(id: unknown): Promise<RevokeInviteResult> {
  await requireWebAdmin();
  return revokeInviteById(getDb(), String(id), new Date());
}
