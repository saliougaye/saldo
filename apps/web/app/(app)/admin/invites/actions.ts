'use server';

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
 */
export async function mintInviteAction(input: unknown): Promise<MintActionResult> {
  const admin = await requireWebAdmin();
  const minted = await mintInvite(getDb(), admin.id, input, new Date(), env().publicUrl);
  if (!minted.ok) return minted;
  const { formatDate } = await adminContext(admin);
  return { ...minted, expiresOn: formatDate.long(minted.expiresAt) };
}

export async function revokeInviteAction(id: unknown): Promise<RevokeInviteResult> {
  await requireWebAdmin();
  return revokeInviteById(getDb(), String(id), new Date());
}
