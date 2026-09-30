'use server';

import {
  type MintResult,
  mintInvite,
  type RevokeInviteResult,
  revokeInviteById,
} from '../../../../src/server/admin/invites';
import { requireWebAdmin } from '../../../../src/server/auth/currentUser';
import { getDb } from '../../../../src/server/db/client';
import { env } from '../../../../src/server/env';

/**
 * The code is in the returned value and nowhere else (§9.5): the panel keeps it in client state.
 * As in the accounts' actions, the guard runs here because a layout does not run for an action.
 */
export async function mintInviteAction(input: unknown): Promise<MintResult> {
  const admin = await requireWebAdmin();
  return mintInvite(getDb(), admin.id, input, new Date(), env().publicUrl);
}

export async function revokeInviteAction(id: unknown): Promise<RevokeInviteResult> {
  await requireWebAdmin();
  return revokeInviteById(getDb(), String(id), new Date());
}
