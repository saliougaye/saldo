import { createHash, randomBytes } from 'node:crypto';
import { and, eq, gt } from 'drizzle-orm';
import { inBackground } from '../background';
import { emailChanges, user } from '../db/schema';
import type { ServerDatabase } from '../db/types';
import { env } from '../env';
import { log, shortId } from '../log';
import { mailEnabled } from '../mail/mailer';
import { emailChangedMessage, emailChangeMessage } from '../mail/messages';
import { mailThrottle } from '../mail/throttle';
import { createFixedWindowLimiter } from '../mcp/rateLimit';
import { isRevoked } from './admin';
import { emailIsTaken, isSyntheticEmail } from './email';
import { isFreshSession } from './freshSession';
import { deliver, VERIFICATION_TTL_SECONDS } from './mailCallbacks';

/**
 * Change of a real email address. Better Auth's own `/change-email` is not used: its token is a JWT
 * that can be replayed and finds the account by the *old* address (a person who registers that address
 * next gets swapped), opening the link without a session creates one, and no hook sees the old
 * address. Here the pending change is a row, spent once, and nothing signs a browser in.
 */

/** Where the mailed link points: a public page that asks and spends nothing. */
export const EMAIL_CHANGE_PATH = '/email-change';

const REQUESTS_PER_HOUR = 10;
const requestLimiter = createFixedWindowLimiter({ max: REQUESTS_PER_HOUR, windowMs: 60 * 60_000 });

/** Tests only. */
export function resetEmailChangeLimitForTests(): void {
  requestLimiter.reset();
}

const hashToken = (token: string): string =>
  createHash('sha256').update(token, 'utf8').digest('hex');

/** `ada@example.com` → `a***@example.com`: enough for the owner to know it, not for a stranger to use. */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf('@');
  if (at < 1) return '***';
  return `${email.slice(0, 1)}***${email.slice(at)}`;
}

export interface PendingChange {
  email: string;
  expiresAt: Date;
}

export type StartResult =
  | { ok: true; pending: PendingChange }
  | { ok: false; reason: 'mail_off' | 'reauth' | 'unchanged' | 'rate_limited' };

/**
 * The rules of a request, shared by `POST /api/me/email` and the Profilo form: a server without SMTP
 * cannot prove the new address, a session that no passkey ceremony created a short time ago cannot
 * start the change, and an address the account already has is no change. `newEmail` is normalised
 * (`normaliseEmail`) and the account's address is real: the caller has checked both.
 *
 * **Why the session must be fresh.** The change ends with `emailVerified = true` on an address that
 * the asker reads, and «recover by email» then lets that person register a passkey of their own. So
 * whoever can start the change can take the account, and a stolen session is enough to start it. The
 * notice to the old address is too slow to be the only defence. A refusal here stores nothing and
 * spends no slot of the hourly limit.
 */
export async function startEmailChange(
  db: ServerDatabase,
  input: {
    userId: string;
    currentEmail: string;
    newEmail: string;
    acceptLanguage: string | null;
    /** `AuthenticatedUser.sessionCreatedAt` of the session that asks. */
    sessionCreatedAt: Date;
    now: Date;
  },
): Promise<StartResult> {
  if (!(await mailEnabled(db))) return { ok: false, reason: 'mail_off' };
  if (!isFreshSession(input.sessionCreatedAt, input.now)) return { ok: false, reason: 'reauth' };
  if (input.newEmail === input.currentEmail.toLowerCase()) {
    return { ok: false, reason: 'unchanged' };
  }
  return requestEmailChange(db, input);
}

/**
 * Stores the pending change and mails the new address — unless another account has it, in which case
 * the row is stored all the same and nothing is mailed, so the answer cannot tell. The caller has
 * checked that the account has a real address, that the new one differs and that mail is enabled.
 */
export async function requestEmailChange(
  db: ServerDatabase,
  input: {
    userId: string;
    currentEmail: string;
    newEmail: string;
    acceptLanguage: string | null;
    now: Date;
  },
): Promise<StartResult> {
  if (!requestLimiter.allow(input.userId, input.now.getTime()).allowed) {
    return { ok: false, reason: 'rate_limited' };
  }
  // The mailbox's own limit is spent **first**, taken address or not, and a held request leaves the
  // pending row alone: the link already in the inbox keeps working. A taken address spends it too,
  // so a 429 cannot tell it from a free one. (The mail below is then sent unthrottled: it has paid.)
  if (!mailThrottle.allow('emailChange', input.newEmail, input.now.getTime())) {
    return { ok: false, reason: 'rate_limited' };
  }
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(input.now.getTime() + VERIFICATION_TTL_SECONDS * 1000);
  const row = {
    userId: input.userId,
    newEmail: input.newEmail,
    fromEmail: input.currentEmail.toLowerCase(),
    tokenHash: hashToken(token),
    createdAt: input.now,
    expiresAt,
  };
  // One row for each account: a new request replaces the old one, and so kills its link.
  await db
    .insert(emailChanges)
    .values(row)
    .onConflictDoUpdate({ target: emailChanges.userId, set: row });
  const taken = await emailIsTaken(db, input.newEmail, input.userId);
  inBackground(async () => {
    if (taken || !(await mailEnabled(db))) return;
    const url = new URL(EMAIL_CHANGE_PATH, env().publicUrl);
    url.searchParams.set('token', token);
    await deliver(
      db,
      'emailChange',
      { id: input.userId, email: input.newEmail },
      input.acceptLanguage,
      (t, instance) => emailChangeMessage(t, { ...instance, url: url.toString() }),
      { throttled: false },
    );
  });
  return { ok: true, pending: { email: input.newEmail, expiresAt } };
}

export async function pendingEmailChange(
  db: ServerDatabase,
  userId: string,
  now: Date,
): Promise<PendingChange | null> {
  const [row] = await db
    .select({ email: emailChanges.newEmail, expiresAt: emailChanges.expiresAt })
    .from(emailChanges)
    .where(and(eq(emailChanges.userId, userId), gt(emailChanges.expiresAt, now)))
    .limit(1);
  return row ?? null;
}

export async function cancelEmailChange(db: ServerDatabase, userId: string): Promise<void> {
  await db.delete(emailChanges).where(eq(emailChanges.userId, userId));
}

/** One answer for every way the link can fail: nothing tells why. */
export type ConfirmResult = { ok: true } | { ok: false };

/**
 * Spends the link. The token is the proof that the person reads the new mailbox, so no session is
 * needed and none is created. The old address is told only when it was verified.
 */
export async function confirmEmailChange(
  db: ServerDatabase,
  input: { token: string; acceptLanguage: string | null; now: Date },
): Promise<ConfirmResult> {
  // Atomic: of two requests with the same token, one gets the row and the other gets nothing.
  const [change] = await db
    .delete(emailChanges)
    .where(
      and(
        eq(emailChanges.tokenHash, hashToken(input.token)),
        gt(emailChanges.expiresAt, input.now),
      ),
    )
    .returning();
  if (change === undefined) return { ok: false };
  const [account] = await db
    .select({ id: user.id, email: user.email, emailVerified: user.emailVerified })
    .from(user)
    .where(eq(user.id, change.userId))
    .limit(1);
  if (account === undefined || (await isRevoked(db, account.id))) return { ok: false };
  if (isSyntheticEmail(account.email) || account.email.toLowerCase() !== change.fromEmail) {
    return { ok: false };
  }
  if (await emailIsTaken(db, change.newEmail, account.id)) return { ok: false };
  try {
    await db
      .update(user)
      .set({ email: change.newEmail, emailVerified: true })
      .where(eq(user.id, account.id));
  } catch {
    // The unique index is the real guard (see `emailIsTaken`): a race with a registration ends here.
    log('auth', 'an email change lost a race for the address', { user: shortId(account.id) });
    return { ok: false };
  }
  log('auth', 'an account changed its email', { user: shortId(account.id) });
  if (account.emailVerified) {
    const old = { id: account.id, email: account.email };
    inBackground(async () => {
      if (!(await mailEnabled(db))) return;
      await deliver(
        db,
        'emailChange',
        old,
        input.acceptLanguage,
        (t, instance) =>
          emailChangedMessage(t, { ...instance, newEmail: maskEmail(change.newEmail) }),
        { throttled: false },
      );
    });
  }
  return { ok: true };
}
