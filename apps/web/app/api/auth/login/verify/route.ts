import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { consumeChallenge } from '../../../../../src/server/auth/challenges';
import { createAuthCode, validateRedirectUri } from '../../../../../src/server/auth/codes';
import { clientIp, enforceRateLimit } from '../../../../../src/server/auth/rateLimit';
import {
  challengeFromClientData,
  verifyAuthentication,
} from '../../../../../src/server/auth/webauthn';
import { getDb } from '../../../../../src/server/db/client';
import { passkeys } from '../../../../../src/server/db/schema';
import { env } from '../../../../../src/server/env';
import { ApiError, handle } from '../../../../../src/server/http/errors';
import { readJson } from '../../../../../src/server/http/json';

export const runtime = 'nodejs';

const bodySchema = z.object({
  response: z.looseObject({
    id: z.string().min(1),
    response: z.looseObject({ clientDataJSON: z.string().min(1) }),
  }),
  code_challenge: z.string().min(43).max(128),
  redirect_uri: z.string().min(1),
  state: z.string().min(1).max(128),
});

export function POST(request: Request): Promise<Response> {
  return handle(async () => {
    const now = new Date();
    enforceRateLimit(clientIp(request), now);
    const body = await readJson(request, bodySchema);
    const redirectUri = validateRedirectUri(body.redirect_uri, env().appRedirectSchemes);
    const db = getDb();

    const signed = challengeFromClientData(body.response.response.clientDataJSON);
    const stored = await consumeChallenge(db, signed, 'login', now);

    const [key] = await db.select().from(passkeys).where(eq(passkeys.id, body.response.id));
    // §18: an unknown credential answers exactly like a bad signature.
    if (key === undefined) throw new ApiError(401, 'invalid_credentials', 'Could not sign you in');

    const { newCounter } = await verifyAuthentication(body.response, stored.challenge, {
      id: key.id,
      publicKey: key.publicKey,
      counter: key.counter,
      transports: key.transports,
    });
    await db
      .update(passkeys)
      .set({ counter: newCounter, lastUsedAt: now })
      .where(eq(passkeys.id, key.id));

    const { redirect } = await createAuthCode(
      db,
      { userId: key.userId, codeChallenge: body.code_challenge, redirectUri, state: body.state },
      now,
    );
    return Response.json({ redirect });
  });
}
