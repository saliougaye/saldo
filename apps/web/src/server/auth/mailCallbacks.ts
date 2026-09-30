import { readSettings } from '@saldo/core';
import { catalogs, makeTranslator } from '@saldo/i18n';
import { createEmailVerificationToken } from 'better-auth/api';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { webLocale } from '../../i18n/locale';
import { inBackground } from '../background';
import { syncRows, user } from '../db/schema';
import type { ServerDatabase } from '../db/types';
import { instanceInfo } from '../instance';
import { log } from '../log';
import { mailEnabled, sendMail } from '../mail/mailer';
import { type Message, recoveryMessage, verificationMessage } from '../mail/messages';
import { type MailKind, mailThrottle } from '../mail/throttle';
import { isRevoked } from './admin';
import { isSyntheticEmail } from './email';

/** 0.3f-3 decisions 3–5: who is mailed, silently, and how the two links are sent. */

/** How long each link lives; the same numbers the messages say. */
export const VERIFICATION_TTL_SECONDS = 24 * 60 * 60;
export const RECOVERY_TTL_SECONDS = 15 * 60;

/** Where a verification link lands: a public page, because a mail app opens whatever browser it likes. */
export const EMAIL_VERIFIED_PATH = '/email-verified';

/** Where a recovery link lands after it signs the browser in, and where a dead one sends it. */
export const RECOVERED_PATH = '/profile/passkeys?recovered';
/** Better Auth sets `?error=<its code>` on this itself, so the query is left to it. */
export const RECOVERY_ERROR_PATH = '/recover';

/**
 * The address Better Auth built, reduced to its origin, its path and the **token**; the rest is ours.
 * The library copies `callbackURL`, `errorCallbackURL` and `newUserCallbackURL` from whoever asked
 * for the mail, and `saldo://` is a trusted origin: a link that carried `saldo://steal` would, when
 * opened, redirect to it with the session cookie appended by the Expo plugin. Nothing the caller
 * chose reaches the message.
 */
function ownLink(libraryUrl: string, params: Record<string, string>): string {
  const link = new URL(libraryUrl);
  const token = link.searchParams.get('token');
  link.search = '';
  if (token !== null) link.searchParams.set('token', token);
  for (const [name, value] of Object.entries(params)) link.searchParams.set(name, value);
  return link.toString();
}

/**
 * The recipient's own `settings.language` when they have settings and it is not `system`; otherwise
 * the `Accept-Language` of the request that triggered the send; otherwise English (`webLocale`).
 */
async function messageFor(
  db: ServerDatabase,
  kind: MailKind,
  userId: string,
  acceptLanguage: string | null,
  url: string,
): Promise<Message> {
  const [settings] = await db
    .select({ data: syncRows.data })
    .from(syncRows)
    .where(
      and(eq(syncRows.userId, userId), eq(syncRows.entity, 'settings'), isNull(syncRows.deletedAt)),
    )
    .limit(1);
  const language = settings === undefined ? 'system' : readSettings(settings.data).language;
  const t = makeTranslator(catalogs[webLocale(language, acceptLanguage)]);
  const { name, host } = await instanceInfo(db);
  const details = { instance: name, host, url };
  return kind === 'recovery' ? recoveryMessage(t, details) : verificationMessage(t, details);
}

/** Throttles, builds and sends; a failure is logged without an address and never thrown. */
async function deliver(
  db: ServerDatabase,
  kind: MailKind,
  recipient: { id: string; email: string },
  url: string,
  acceptLanguage: string | null,
): Promise<void> {
  if (!mailThrottle.allow(kind, recipient.email, Date.now())) {
    log('mail', 'held by the per-address throttle', { kind });
    return;
  }
  const message = await messageFor(db, kind, recipient.id, acceptLanguage, url);
  const result = await sendMail(db, { to: recipient.email, ...message });
  if (!result.ok) log('mail', 'a message was not sent', { kind, reason: result.error });
}

/**
 * Better Auth's `sendMagicLink`. Mails **only** an existing, verified, not-revoked account, with mail
 * enabled and inside the throttle; every other case does nothing and looks the same, because the
 * endpoint answers `{ status: true }` either way. All of it — the lookup included — runs in the
 * background: a caller must not be able to tell «we sent it» from «we did nothing» by how long the
 * answer took.
 */
export function sendRecoveryLink(
  db: ServerDatabase,
  input: { email: string; url: string; acceptLanguage: string | null },
): void {
  inBackground(async () => {
    if (!(await mailEnabled(db))) return;
    const [account] = await db
      .select({ id: user.id, email: user.email, emailVerified: user.emailVerified })
      .from(user)
      .where(eq(sql`lower(${user.email})`, input.email.trim().toLowerCase()))
      .limit(1);
    if (account === undefined || !account.emailVerified) return;
    // A link minted before a revocation is refused by the `admin` plugin when it is opened; this is
    // the other half, so a revoked account is not sent one at all.
    if (await isRevoked(db, account.id)) return;
    // The throttle is asked only now, so addresses with no account never occupy it.
    const url = ownLink(input.url, {
      callbackURL: RECOVERED_PATH,
      errorCallbackURL: RECOVERY_ERROR_PATH,
    });
    await deliver(db, 'recovery', account, url, input.acceptLanguage);
  });
}

/**
 * Better Auth's `sendVerificationEmail`. The library only calls it for an account that exists and is
 * unverified; what is decided here is whether this server can and may mail that address.
 */
export function sendVerificationLink(
  db: ServerDatabase,
  input: { user: { id: string; email: string }; url: string; acceptLanguage: string | null },
): void {
  inBackground(async () => {
    if (isSyntheticEmail(input.user.email)) return;
    if (!(await mailEnabled(db))) return;
    const url = ownLink(input.url, { callbackURL: EMAIL_VERIFIED_PATH });
    await deliver(db, 'verification', input.user, url, input.acceptLanguage);
  });
}

/**
 * Sends a verification link without a request from the account's owner: after a registration
 * (decision 5a) and after `POST /api/me/email` fills a synthetic address (5b). Best effort — it runs
 * in the background and cannot fail what called it. Decided from the row, so a stale caller mails
 * nothing to an address that has meanwhile been verified.
 *
 * The URL is the one Better Auth's own `/send-verification-email` builds: `/verify-email` with the
 * signed token and a `callbackURL`, which it validates against the trusted origins when opened.
 */
export function requestVerification(
  db: ServerDatabase,
  input: { userId: string; secret: string; baseURL: string; acceptLanguage: string | null },
): void {
  inBackground(async () => {
    const [account] = await db
      .select({ id: user.id, email: user.email, emailVerified: user.emailVerified })
      .from(user)
      .where(eq(user.id, input.userId))
      .limit(1);
    if (account === undefined || account.emailVerified) return;
    if (isSyntheticEmail(account.email)) return;
    if (!(await mailEnabled(db))) return;
    const token = await createEmailVerificationToken(
      input.secret,
      account.email,
      undefined,
      VERIFICATION_TTL_SECONDS,
    );
    const callback = encodeURIComponent(EMAIL_VERIFIED_PATH);
    const url = `${input.baseURL}/verify-email?token=${token}&callbackURL=${callback}`;
    await deliver(db, 'verification', account, url, input.acceptLanguage);
  });
}
