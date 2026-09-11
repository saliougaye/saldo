import { SYNC_SCHEMA_VERSION } from '@saldo/core';
import { registrationAllowed, registrationRequiresInvite } from '../../../src/server/auth/policy';
import { getDb } from '../../../src/server/db/client';
import { env } from '../../../src/server/env';
import { handle } from '../../../src/server/http/errors';
import { getStore } from '../../../src/server/storage';
import { APP_VERSION } from '../../../src/server/version';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * §9.3 step 1: the mobile app points at a URL and this is what tells it there is a Saldo server on
 * the other end, which protocol version it speaks, and whether it can offer "create account".
 */
export function GET(): Promise<Response> {
  return handle(async () => {
    const allowed = await registrationAllowed(getDb(), env().registration);
    return Response.json({
      app: 'saldo',
      apiVersion: 1,
      /** §8.1: the app compares this before it exchanges any row. */
      schemaVersion: SYNC_SCHEMA_VERSION,
      version: APP_VERSION,
      registrationAllowed: allowed,
      /**
       * §9.5: under `REGISTRATION=invite` the form asks for a code. The app does not use this
       * today — the ceremony runs in the browser, which reads the same flag server-side — but a
       * client that ever collects the code itself needs to know before it asks.
       */
      inviteRequired: registrationRequiresInvite(env().registration),
      /**
       * §10: false is a supported answer, not a fault. The app then keeps attachments on this
       * phone and says so, instead of queueing an upload that could never succeed.
       */
      attachmentsEnabled: (await getStore()) !== null,
    });
  });
}
