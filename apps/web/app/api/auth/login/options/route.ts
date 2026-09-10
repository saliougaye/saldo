import { createChallenge } from '../../../../../src/server/auth/challenges';
import { clientIp, enforceRateLimit } from '../../../../../src/server/auth/rateLimit';
import { authenticationOptions } from '../../../../../src/server/auth/webauthn';
import { getDb } from '../../../../../src/server/db/client';
import { handle } from '../../../../../src/server/http/errors';

export const runtime = 'nodejs';

/**
 * §9.3: a discoverable-credential login. `allowCredentials` is empty and no identifier is asked
 * for, so this endpoint cannot leak whether an account exists.
 */
export function POST(request: Request): Promise<Response> {
  return handle(async () => {
    const now = new Date();
    enforceRateLimit(clientIp(request), now);
    const options = await authenticationOptions();
    await createChallenge(getDb(), { challenge: options.challenge, kind: 'login' }, now);
    return Response.json(options);
  });
}
