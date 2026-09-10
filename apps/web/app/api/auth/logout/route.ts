import { z } from 'zod';
import { clientIp, enforceRateLimit } from '../../../../src/server/auth/rateLimit';
import { revokeRefreshToken } from '../../../../src/server/auth/tokens';
import { getDb } from '../../../../src/server/db/client';
import { handle } from '../../../../src/server/http/errors';
import { readJson } from '../../../../src/server/http/json';

export const runtime = 'nodejs';

const bodySchema = z.object({ refresh_token: z.string().min(1) });

/**
 * §9.3 step 7. Answers 204 whatever the token was: telling a caller that a token was already
 * revoked, or never existed, is information it has no use for.
 */
export function POST(request: Request): Promise<Response> {
  return handle(async () => {
    const now = new Date();
    enforceRateLimit(clientIp(request), now);
    const body = await readJson(request, bodySchema);
    await revokeRefreshToken(getDb(), body.refresh_token, now);
    return new Response(null, { status: 204 });
  });
}
