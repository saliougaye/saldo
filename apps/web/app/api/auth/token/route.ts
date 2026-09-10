import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { consumeAuthCode } from '../../../../src/server/auth/codes';
import { clientIp, enforceRateLimit } from '../../../../src/server/auth/rateLimit';
import {
  ACCESS_TTL_SECONDS,
  issueAccessToken,
  issueRefreshToken,
  rotateRefreshToken,
} from '../../../../src/server/auth/tokens';
import { getDb } from '../../../../src/server/db/client';
import { users } from '../../../../src/server/db/schema';
import { ApiError, handle } from '../../../../src/server/http/errors';
import { readJson } from '../../../../src/server/http/json';

export const runtime = 'nodejs';

const bodySchema = z.discriminatedUnion('grant_type', [
  z.object({
    grant_type: z.literal('authorization_code'),
    code: z.string().min(1),
    code_verifier: z.string().min(43).max(128),
    device_name: z.string().trim().min(1).max(80),
  }),
  z.object({
    grant_type: z.literal('refresh_token'),
    refresh_token: z.string().min(1),
  }),
]);

export function POST(request: Request): Promise<Response> {
  return handle(async () => {
    const now = new Date();
    enforceRateLimit(clientIp(request), now);
    const body = await readJson(request, bodySchema);
    const db = getDb();

    let userId: string;
    let refreshToken: string;
    if (body.grant_type === 'authorization_code') {
      const consumed = await consumeAuthCode(db, body.code, body.code_verifier, now);
      userId = consumed.userId;
      refreshToken = await issueRefreshToken(
        db,
        { userId: consumed.userId, deviceName: body.device_name },
        now,
      );
    } else {
      const rotated = await rotateRefreshToken(db, body.refresh_token, now);
      userId = rotated.userId;
      refreshToken = rotated.refreshToken;
    }

    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (user === undefined) throw new ApiError(401, 'invalid_grant', 'Unknown user');

    return Response.json({
      access_token: await issueAccessToken(userId, now),
      expires_in: ACCESS_TTL_SECONDS,
      refresh_token: refreshToken,
      user: { id: user.id, displayName: user.displayName },
    });
  });
}
