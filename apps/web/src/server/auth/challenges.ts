import { and, eq, lt } from 'drizzle-orm';
import { webauthnChallenges } from '../db/schema';
import type { ServerDatabase } from '../db/types';
import { ApiError } from '../http/errors';

/** §9.3: challenges expire after 5 minutes and are deleted on use. */
export const CHALLENGE_TTL_MS = 5 * 60_000;

export type ChallengeKind = 'register' | 'login';

export interface ConsumedChallenge {
  challenge: string;
  displayName: string | null;
}

export async function createChallenge(
  db: ServerDatabase,
  input: { challenge: string; kind: ChallengeKind; displayName?: string },
  now: Date,
): Promise<void> {
  // Opportunistic sweep: no cron job in a single-container deployment.
  await db.delete(webauthnChallenges).where(lt(webauthnChallenges.expiresAt, now));
  await db.insert(webauthnChallenges).values({
    challenge: input.challenge,
    kind: input.kind,
    displayName: input.displayName ?? null,
    expiresAt: new Date(now.getTime() + CHALLENGE_TTL_MS),
  });
}

/** Deletes the row whatever the outcome: a challenge is single-use even when it has expired. */
export async function consumeChallenge(
  db: ServerDatabase,
  challenge: string,
  kind: ChallengeKind,
  now: Date,
): Promise<ConsumedChallenge> {
  const [row] = await db
    .delete(webauthnChallenges)
    .where(and(eq(webauthnChallenges.challenge, challenge), eq(webauthnChallenges.kind, kind)))
    .returning();
  if (row === undefined) {
    throw new ApiError(400, 'challenge_not_found', 'Unknown or already used challenge');
  }
  // Rejected *at* the expiry instant, not after it: the same convention RFC 7519 sets for `exp`.
  if (row.expiresAt.getTime() <= now.getTime()) {
    throw new ApiError(400, 'challenge_expired', 'The ceremony took too long, try again');
  }
  return { challenge: row.challenge, displayName: row.displayName };
}
