import { readSettings } from '@saldo/core';
import { catalogs, makeTranslator, type Translate } from '@saldo/i18n';
import { createEmailVerificationToken } from 'better-auth/api';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { RECOVERY_CONFIRM_PATH } from '../../features/auth/recoverView';
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

/**
 * The address Better Auth built, reduced to its origin and the **token**; the path and the rest are
 * ours. The library copies `callbackURL`, `errorCallbackURL` and `newUserCallbackURL` from whoever asked
 * for the mail, and `saldo://` is a trusted origin: a link that carried `saldo://steal` would, when
 * opened, redirect to it with the session cookie appended by the Expo plugin. Nothing the caller
 * chose reaches the message.
 */
function ownLink(libraryUrl: string, path: string, params: Record<string, string>): string {
  const from = new URL(libraryUrl);
  const link = new URL(path, from.origin);
  const token = from.searchParams.get('token');
  if (token !== null) link.searchParams.set('token', token);
  for (const [name, value] of Object.entries(params)) link.searchParams.set(name, value);
  return link.toString();
}

/** Builds the text once the recipient's language and the instance are known. */
export type MessageBuilder = (
  t: Translate,
  instance: { instance: string; host: string },
) => Message;

/**
 * The recipient's own `settings.language` when they have settings and it is not `system`; otherwise
 * the `Accept-Language` of the request that triggered the send; otherwise English (`webLocale`).
 */
async function messageFor(
  db: ServerDatabase,
  userId: string,
  acceptLanguage: string | null,
  build: MessageBuilder,
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
  return build(t, { instance: name, host });
}

/**
 * Throttles (unless told not to), builds and sends; a failure is logged without an address and never
 * thrown. Only a security notice goes out unthrottled: the throttle is shared by every kind, and
 * anybody can fill it for an address by asking for recovery links.
 */
export async function deliver(
  db: ServerDatabase,
  kind: MailKind,
  recipient: { id: string; email: string },
  acceptLanguage: string | null,
  build: MessageBuilder,
  options: { throttled?: boolean } = {},
): Promise<void> {
  if ((options.throttled ?? true) && !mailThrottle.allow(kind, recipient.email, Date.now())) {
    log('mail', 'held by the per-address throttle', { kind });
    return;
  }
  const message = await messageFor(db, recipient.id, acceptLanguage, build);
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
    // Not the library's `/magic-link/verify`: that GET signs in on sight. Ours asks first.
    const url = ownLink(input.url, RECOVERY_CONFIRM_PATH, {});
    await deliver(db, 'recovery', account, input.acceptLanguage, (t, instance) =>
      recoveryMessage(t, { ...instance, url }),
    );
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
    if (await isRevoked(db, input.user.id)) return;
    // The library's own verify path, which it built; only the callback is replaced.
    const url = ownLink(input.url, new URL(input.url).pathname, {
      callbackURL: EMAIL_VERIFIED_PATH,
    });
    await deliver(db, 'verification', input.user, input.acceptLanguage, (t, instance) =>
      verificationMessage(t, { ...instance, url }),
    );
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
    if (await isRevoked(db, account.id)) return;
    const token = await createEmailVerificationToken(
      input.secret,
      account.email,
      undefined,
      VERIFICATION_TTL_SECONDS,
    );
    const callback = encodeURIComponent(EMAIL_VERIFIED_PATH);
    const url = `${input.baseURL}/verify-email?token=${token}&callbackURL=${callback}`;
    await deliver(db, 'verification', account, input.acceptLanguage, (t, instance) =>
      verificationMessage(t, { ...instance, url }),
    );
  });
}
