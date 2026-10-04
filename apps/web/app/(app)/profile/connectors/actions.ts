'use server';

import { revalidatePath } from 'next/cache';
import { requireWebUser } from '../../../../src/server/auth/currentUser';
import { log, shortId } from '../../../../src/server/log';
import { revokeConnector } from '../../../../src/server/mcp/connectors';

export type RevokeConnectorResult = { ok: true } | { ok: false };

/** Longer than any id the provider mints; anything longer is not one of ours. */
const MAX_CLIENT_ID_LENGTH = 255;

/**
 * §17.4.1: revoking deletes the consent and every token of this user–client pair; the client's next
 * call is a 401. `revokeConnector` scopes by the signed-in user, so an id from elsewhere revokes
 * nothing of anybody else's.
 */
export async function revokeConnectorAction(clientId: unknown): Promise<RevokeConnectorResult> {
  const user = await requireWebUser();
  if (
    typeof clientId !== 'string' ||
    clientId.length === 0 ||
    clientId.length > MAX_CLIENT_ID_LENGTH
  ) {
    return { ok: false };
  }
  try {
    await revokeConnector(user.id, clientId);
  } catch (error) {
    log('mcp', 'revoking a connector failed', {
      user: shortId(user.id),
      error: error instanceof Error ? error.name : 'unknown',
    });
    return { ok: false };
  }
  revalidatePath('/profile/connectors');
  return { ok: true };
}
