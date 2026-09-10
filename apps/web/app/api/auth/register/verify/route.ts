import { z } from 'zod';
import { consumeChallenge } from '../../../../../src/server/auth/challenges';
import { createAuthCode, validateRedirectUri } from '../../../../../src/server/auth/codes';
import { clientIp, enforceRateLimit } from '../../../../../src/server/auth/rateLimit';
import { registrationAllowed } from '../../../../../src/server/auth/registration';
import {
  challengeFromClientData,
  verifyRegistration,
} from '../../../../../src/server/auth/webauthn';
import { getDb } from '../../../../../src/server/db/client';
import { passkeys, users } from '../../../../../src/server/db/schema';
import { env } from '../../../../../src/server/env';
import { ApiError, handle } from '../../../../../src/server/http/errors';
import { readJson } from '../../../../../src/server/http/json';

export const runtime = 'nodejs';

const bodySchema = z.object({
  // The attestation as `@simplewebauthn/browser` produces it; its own verifier validates the shape.
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
    if (!(await registrationAllowed(db, env().registration))) {
      throw new ApiError(403, 'registration_closed', 'This server is not accepting new accounts');
    }

    const signed = challengeFromClientData(body.response.response.clientDataJSON);
    const stored = await consumeChallenge(db, signed, 'register', now);
    if (stored.displayName === null) {
      throw new ApiError(400, 'challenge_not_found', 'Unknown or already used challenge');
    }
    const credential = await verifyRegistration(body.response, stored.challenge);

    const [user] = await db.insert(users).values({ displayName: stored.displayName }).returning();
    if (user === undefined) throw new ApiError(500, 'internal_error', 'Could not create the user');
    await db.insert(passkeys).values({
      id: credential.credentialId,
      userId: user.id,
      publicKey: credential.publicKey,
      counter: credential.counter,
      transports: credential.transports,
      deviceType: credential.deviceType,
      backedUp: credential.backedUp,
      lastUsedAt: now,
    });

    const { redirect } = await createAuthCode(
      db,
      { userId: user.id, codeChallenge: body.code_challenge, redirectUri, state: body.state },
      now,
    );
    return Response.json({ redirect });
  });
}
