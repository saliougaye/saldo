'use server';

import { FIRST_INVITE_TTL_DAYS } from '../../src/features/setup/setupView';
import { mintInvite } from '../../src/server/admin/invites';
import { requireWebAdmin } from '../../src/server/auth/currentUser';
import { getDb } from '../../src/server/db/client';
import { env } from '../../src/server/env';
import { type SetupWriteResult, saveSetupServer } from '../../src/server/setup/write';

/**
 * Step 2 (decision 3). No session exists yet, so there is no `require*` here: `saveSetupServer`
 * refuses by itself once an account exists. `revalidatePath` is not needed — the next request
 * reads `server_settings` again, every page here is `force-dynamic`.
 */
export async function saveSetupServerAction(input: unknown): Promise<SetupWriteResult> {
  return saveSetupServer(getDb(), input, new Date());
}

export type FirstInviteResult =
  | { ok: true; code: string; link: string; expiresAt: string }
  | { ok: false; error: 'invalid' };

/**
 * Step 4 (decision 6): the ceremony of step 3 signed this browser in as the first account, which
 * `claimRoleForNewUser` made the admin, so the ordinary admin guard applies. The expiry goes back
 * as an ISO instant: the new account has no `settings` row yet to format a date in, so the client
 * formats it in the page's locale.
 */
export async function mintFirstInviteAction(input: { label: string }): Promise<FirstInviteResult> {
  const admin = await requireWebAdmin();
  const minted = await mintInvite(
    getDb(),
    admin.id,
    { label: input.label, ttlDays: FIRST_INVITE_TTL_DAYS },
    new Date(),
    env().publicUrl,
  );
  if (!minted.ok) return minted;
  return { ok: true, code: minted.code, link: minted.link, expiresAt: minted.expiresAt };
}
