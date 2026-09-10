import { createHash, randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { jwtVerify, SignJWT } from 'jose';
import { refreshTokens } from '../db/schema';
import type { ServerDatabase } from '../db/types';
import { env } from '../env';
import { ApiError } from '../http/errors';

/** §9.3 step 5: the app is told `expires_in: 900`. */
export const ACCESS_TTL_SECONDS = 900;
export const REFRESH_TTL_DAYS = 90;
const AUDIENCE = 'saldo-app';

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('base64url');
}

export function issueAccessToken(userId: string, now: Date): Promise<string> {
  const issuedAt = Math.floor(now.getTime() / 1000);
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuer(env().publicUrl)
    .setAudience(AUDIENCE)
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + ACCESS_TTL_SECONDS)
    .sign(env().jwtSecret);
}

export async function verifyAccessToken(token: string, now: Date): Promise<{ userId: string }> {
  try {
    const { payload } = await jwtVerify(token, env().jwtSecret, {
      issuer: env().publicUrl,
      audience: AUDIENCE,
      currentDate: now,
    });
    if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
      throw new Error('no subject');
    }
    return { userId: payload.sub };
  } catch {
    throw new ApiError(401, 'invalid_token', 'The access token is not valid');
  }
}

export async function issueRefreshToken(
  db: ServerDatabase,
  input: { userId: string; deviceName: string },
  now: Date,
): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  await db.insert(refreshTokens).values({
    userId: input.userId,
    tokenHash: sha256(token),
    deviceName: input.deviceName,
    createdAt: now,
    expiresAt: new Date(now.getTime() + REFRESH_TTL_DAYS * 24 * 3600 * 1000),
  });
  return token;
}

/**
 * Walks `replaced_by` forward from a row and revokes everything still live. Called when a revoked
 * token is presented again: either the client replayed it or somebody stole it, and in both cases
 * the safe move is to end the whole chain (§9.3 step 6).
 */
async function revokeChain(db: ServerDatabase, startId: string, now: Date): Promise<void> {
  let current: string | null = startId;
  const seen = new Set<string>();
  while (current !== null && !seen.has(current)) {
    seen.add(current);
    // Annotated because `current` is fed by the query that reads it, which TypeScript would
    // otherwise report as a circular inference.
    const rows: { replacedBy: string | null }[] = await db
      .update(refreshTokens)
      .set({ revokedAt: now })
      .where(eq(refreshTokens.id, current))
      .returning({ replacedBy: refreshTokens.replacedBy });
    current = rows[0]?.replacedBy ?? null;
  }
}

export interface RotatedRefresh {
  userId: string;
  refreshToken: string;
}

export async function rotateRefreshToken(
  db: ServerDatabase,
  presented: string,
  now: Date,
): Promise<RotatedRefresh> {
  const invalid = new ApiError(401, 'invalid_grant', 'The refresh token is not usable');
  const [row] = await db
    .select()
    .from(refreshTokens)
    .where(eq(refreshTokens.tokenHash, sha256(presented)));
  if (row === undefined) throw invalid;
  if (row.revokedAt !== null) {
    await revokeChain(db, row.id, now);
    throw invalid;
  }
  // Rejected *at* the expiry instant, not after it (RFC 7519's rule for `exp`).
  if (row.expiresAt.getTime() <= now.getTime()) throw invalid;

  const next = await issueRefreshToken(db, { userId: row.userId, deviceName: row.deviceName }, now);
  const [created] = await db
    .select()
    .from(refreshTokens)
    .where(eq(refreshTokens.tokenHash, sha256(next)));
  await db
    .update(refreshTokens)
    .set({ revokedAt: now, replacedBy: created?.id ?? null })
    .where(eq(refreshTokens.id, row.id));
  return { userId: row.userId, refreshToken: next };
}

/** Logout (§9.3 step 7). Revoking an unknown or already revoked token is a no-op, not an error. */
export async function revokeRefreshToken(
  db: ServerDatabase,
  presented: string,
  now: Date,
): Promise<void> {
  await db
    .update(refreshTokens)
    .set({ revokedAt: now })
    .where(eq(refreshTokens.tokenHash, sha256(presented)));
}
