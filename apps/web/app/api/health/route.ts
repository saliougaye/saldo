import { registrationAllowed } from '../../../src/server/auth/registration';
import { getDb } from '../../../src/server/db/client';
import { env } from '../../../src/server/env';
import { handle } from '../../../src/server/http/errors';
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
      version: APP_VERSION,
      registrationAllowed: allowed,
    });
  });
}
