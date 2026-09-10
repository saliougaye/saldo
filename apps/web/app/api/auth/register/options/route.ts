import { z } from 'zod';
import { createChallenge } from '../../../../../src/server/auth/challenges';
import { clientIp, enforceRateLimit } from '../../../../../src/server/auth/rateLimit';
import { registrationAllowed } from '../../../../../src/server/auth/registration';
import { registrationOptions } from '../../../../../src/server/auth/webauthn';
import { getDb } from '../../../../../src/server/db/client';
import { env } from '../../../../../src/server/env';
import { ApiError, handle } from '../../../../../src/server/http/errors';
import { readJson } from '../../../../../src/server/http/json';

export const runtime = 'nodejs';

const bodySchema = z.object({
  displayName: z.string().trim().min(1).max(80),
});

export function POST(request: Request): Promise<Response> {
  return handle(async () => {
    const now = new Date();
    enforceRateLimit(clientIp(request), now);
    const { displayName } = await readJson(request, bodySchema);
    const db = getDb();
    if (!(await registrationAllowed(db, env().registration))) {
      throw new ApiError(403, 'registration_closed', 'This server is not accepting new accounts');
    }
    const options = await registrationOptions(displayName);
    await createChallenge(db, { challenge: options.challenge, kind: 'register', displayName }, now);
    return Response.json(options);
  });
}
