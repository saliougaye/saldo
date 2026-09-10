import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { and, eq, isNull, lt } from 'drizzle-orm';
import { authCodes } from '../db/schema';
import type { ServerDatabase } from '../db/types';
import { ApiError } from '../http/errors';

/** §18: auth codes are single-use with a 60 second TTL. */
export const CODE_TTL_MS = 60_000;

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('base64url');
}

function equals(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/**
 * §18: the redirect target is allow-listed **by scheme**, which is what stops a crafted
 * `/auth/mobile?redirect_uri=…` from handing a code to somewhere else.
 */
export function validateRedirectUri(uri: string, allowedSchemes: readonly string[]): string {
  if (!URL.canParse(uri)) {
    throw new ApiError(400, 'invalid_redirect_uri', 'redirect_uri is not a valid URI');
  }
  const scheme = new URL(uri).protocol.replace(/:$/, '');
  if (!allowedSchemes.includes(scheme)) {
    throw new ApiError(
      400,
      'invalid_redirect_uri',
      `redirect_uri scheme "${scheme}" is not allowed`,
    );
  }
  return uri;
}

export interface CreatedAuthCode {
  code: string;
  /** Where `/auth/mobile` sends the browser once the ceremony succeeds (§9.3 step 4). */
  redirect: string;
}

export async function createAuthCode(
  db: ServerDatabase,
  input: { userId: string; codeChallenge: string; redirectUri: string; state: string },
  now: Date,
): Promise<CreatedAuthCode> {
  await db.delete(authCodes).where(lt(authCodes.expiresAt, now));
  const code = randomBytes(32).toString('base64url');
  await db.insert(authCodes).values({
    codeHash: sha256(code),
    userId: input.userId,
    codeChallenge: input.codeChallenge,
    redirectUri: input.redirectUri,
    expiresAt: new Date(now.getTime() + CODE_TTL_MS),
  });
  const url = new URL(input.redirectUri);
  url.searchParams.set('code', code);
  url.searchParams.set('state', input.state);
  return { code, redirect: url.toString() };
}

/**
 * Exchanges a code for its user. Every failure answers `invalid_grant`: which of the four reasons
 * it was is useful to an attacker and to nobody else.
 */
export async function consumeAuthCode(
  db: ServerDatabase,
  code: string,
  codeVerifier: string,
  now: Date,
): Promise<{ userId: string }> {
  const [row] = await db
    .select()
    .from(authCodes)
    .where(eq(authCodes.codeHash, sha256(code)));
  const invalid = new ApiError(400, 'invalid_grant', 'The authorization code is not usable');
  if (row === undefined || row.usedAt !== null) throw invalid;
  if (row.expiresAt.getTime() < now.getTime()) throw invalid;
  if (!equals(row.codeChallenge, sha256(codeVerifier))) throw invalid;
  // Mark used only now, and only if still unused: two concurrent exchanges cannot both win.
  const claimed = await db
    .update(authCodes)
    .set({ usedAt: now })
    .where(and(eq(authCodes.codeHash, row.codeHash), isNull(authCodes.usedAt)))
    .returning();
  if (claimed.length === 0) throw invalid;
  return { userId: row.userId };
}
